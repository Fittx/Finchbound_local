import { FeedEvent } from "../src/models/FeedEvent.js";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import mongoose, { Types } from "mongoose";
import request from "supertest";
import sharp from "sharp";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { initializeAuthModels } from "../src/models/auth.js";
import { initializeBookModels } from "../src/models/books.js";
import { initializeUploadModels } from "../src/models/uploads.js";
import { initializeGuestModels } from "../src/models/guests.js";
import { User } from "../src/models/User.js";
import { AuthSession } from "../src/models/AuthSession.js";
import { Book } from "../src/models/Book.js";
import { Page } from "../src/models/Page.js";
import { Upload } from "../src/models/Upload.js";
import { UploadGrant } from "../src/models/UploadGrant.js";
import { UploadQuota } from "../src/models/UploadQuota.js";
import { Submission } from "../src/models/Submission.js";
import { Report } from "../src/models/Report.js";
import { BlockedGuest } from "../src/models/BlockedGuest.js";
import { GuestOtp } from "../src/models/GuestOtp.js";
import { GuestVerification } from "../src/models/GuestVerification.js";
import type { AuthMailer } from "../src/services/mail.js";
import type { ObjectStorage } from "../src/config/storage.js";
import { GuestService } from "../src/services/guests.js";
import { ApiError } from "../src/utils/ApiError.js";
import { signSession, digest } from "../src/services/tokens.js";
import { guestCookieName } from "../src/services/guestSecurity.js";
import { testConfig, testLogger } from "./helpers.js";
const uri = process.env.TEST_MONGODB_URI;
const dbName = "finchbound_guests_test_" + randomUUID().replaceAll("-", "");
const config = testConfig({
  RATE_LIMIT_MAX_REQUESTS: "10000",
  AUTH_RATE_LIMIT_MAX_REQUESTS: "300",
});
const inbox: { email: string; code: string }[] = [];
const mailer: AuthMailer = {
  assertConfigured() {},
  async sendVerification(email, code) {
    inbox.push({ email, code });
  },
  async sendPasswordReset() {},
};
const objects = new Map<string, Buffer>();
const storage: ObjectStorage = {
  assertConfigured() {},
  async put(key, bytes) {
    objects.set(key, Buffer.from(bytes));
  },
  async remove(key) {
    objects.delete(key);
  },
  async get(key) {
    const bytes = objects.get(key);
    if (!bytes) throw new ApiError("NOT_FOUND");
    return { body: Readable.from(bytes), bytes: bytes.length };
  },
};
let app: ReturnType<typeof createApp>, owner: string, outsider: string;
const theme = {
  background: "#ffffff",
  grid: "#eeeeee",
  cover: "#c92a37",
  accent: "#f4a261",
  text: "#2b2d42",
  header: "#2b2d42",
};
const cookies = (response: request.Response) =>
  ((response.headers["set-cookie"] as unknown as string[]) ?? [])
    .map((value) => value.split(";")[0])
    .join("; ");
async function host(email: string) {
  const user = await User.create({
    name: "Host",
    email,
    passwordHash: "unused-test-hash",
    emailVerified: true,
  });
  const jti = randomUUID();
  await AuthSession.create({
    _id: digest(jti),
    userId: user._id,
    authVersion: 0,
    expiresAt: new Date(Date.now() + 3600000),
  });
  return (
    config.JWT_COOKIE_NAME + "=" + (await signSession(config, user._id.toString(), 0, jti, 3600))
  );
}
const post = (path: string, cookie = "") =>
  request(app)
    .post("/api" + path)
    .set("Origin", config.CLIENT_URL)
    .set("Cookie", cookie);
async function book(
  access: "name" | "email" | "strict" = "name",
  slug: string = randomUUID(),
  extra = {},
) {
  return (
    await post("/books", owner)
      .send({
        title: "Guest event",
        slug,
        kind: "event",
        visibility: "link",
        preset: "crimson",
        theme,
        font: "hand",
        lines: true,
        access,
        photoRequired: false,
        messageRequired: true,
        status: "open",
        hosts: "Our hosts",
        prompt: "A memory",
        ...extra,
      })
      .expect(201)
  ).body.book as { id: string; slug: string };
}
type Challenge = { proof: string; upload: string; device: string; draftId: string };
async function challenge(
  slug: string,
  cookie = "",
  draftId: string = randomUUID(),
): Promise<Challenge> {
  const result = await post("/public/captcha", cookie)
    .send({ bookSlug: slug, draftId, token: randomUUID() })
    .expect(200);
  return {
    proof: result.body.token,
    upload: result.body.uploadToken,
    device: cookies(result) || cookie,
    draftId,
  };
}
const sendCode = (slug: string, c: Challenge, email = "guest@example.org") =>
  post(`/public/books/${slug}/verify-email`, c.device)
    .set("Authorization", "Bearer " + c.proof)
    .send({ email });
const confirm = (slug: string, c: Challenge, code: string, email = "guest@example.org") =>
  post(`/public/books/${slug}/verify-email/confirm`, c.device)
    .set("Authorization", "Bearer " + c.proof)
    .send({ email, code });
async function verified(slug: string, c: Challenge, email = "guest@example.org") {
  await sendCode(slug, c, email).expect(200);
  return cookies(await confirm(slug, c, inbox.at(-1)!.code, email).expect(200));
}
const submit = (slug: string, c: Challenge, patch = {}, cookie = c.device) =>
  post(`/public/books/${slug}/submissions`, cookie).send({
    name: "Guest",
    email: "",
    message: "A memory",
    captcha: c.proof,
    ...patch,
  });
const entry = async () => (await Submission.findOne().select("+fingerprint"))!;
describe.skipIf(!uri)("guest flows with real MongoDB, scoped credentials and transactions", () => {
  beforeAll(async () => {
    mongoose.set("sanitizeFilter", true);
    await mongoose.connect(uri!, { dbName, serverSelectionTimeoutMS: 5000 });
    if (mongoose.connection.name !== dbName) throw new Error("Unexpected database");
    const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== "isdbgrid") throw new Error("Replica set required");
    await initializeAuthModels();
    await initializeBookModels();
    await initializeUploadModels();
    await initializeGuestModels();
  }, 20000);
  beforeEach(async () => {
    if (mongoose.connection.name !== dbName) throw new Error("Unexpected database");
    await Promise.all([
      User.deleteMany({}),
      AuthSession.deleteMany({}),
      Book.deleteMany({}),
      Page.deleteMany({}),
      Upload.deleteMany({}),
      UploadGrant.deleteMany({}),
      UploadQuota.deleteMany({}),
      Submission.deleteMany({}),
      Report.deleteMany({}),
      BlockedGuest.deleteMany({}),
      GuestOtp.deleteMany({}),
      GuestVerification.deleteMany({}),
    ]);
    owner = await host("owner@gmail.com");
    outsider = await host("other@gmail.com");
    inbox.length = 0;
    objects.clear();
    app = createApp({
      config,
      isDatabaseReady: () => true,
      mailer,
      storage,
      captcha: { async verify() {} },
      logger: testLogger(),
    });
  });
  afterAll(async () => {
    if (
      mongoose.connection.readyState === 1 &&
      mongoose.connection.name === dbName &&
      dbName.startsWith("finchbound_guests_test_")
    )
      await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  it("returns only the guest DTO, with collection independent of reader publication", async () => {
    const b = await book();
    const response = await request(app).get(`/api/public/books/${b.slug}/guest`).expect(200);
    expect(response.body).toEqual({
      slug: b.slug,
      title: "Guest event",
      hosts: "Our hosts",
      prompt: "A memory",
      theme,
      font: "hand",
      lines: true,
      access: "name",
      photoRequired: false,
      messageRequired: true,
      status: "open",
      readerAvailable: false,
    });
    expect(response.headers["set-cookie"]![0]).toContain("HttpOnly");
    for (const status of ["not-live", "closed"]) {
      await Book.updateOne({ _id: b.id }, { $set: { collectionStatus: status } });
      expect(
        (await request(app).get(`/api/public/books/${b.slug}/guest`).expect(200)).body.status,
      ).toBe(status);
    }
    await Book.updateOne({ _id: b.id }, { $set: { deletedAt: new Date() } });
    await request(app).get(`/api/public/books/${b.slug}/guest`).expect(404);
    const personal = await book("name", randomUUID(), { kind: "personal" });
    await request(app).get(`/api/public/books/${personal.slug}/guest`).expect(404);
  });
  it("stores Name-only entries as Approved, hidden until placement, without client-controlled fields", async () => {
    const b = await book(),
      c = await challenge(b.slug);
    await submit(b.slug, c).expect(201, { status: "added" });
    const saved = await entry();
    expect(saved.status).toBe("approved");
    expect(saved.emailVerified).toBe(false);
    expect(saved.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect((await Book.findById(b.id))!.entriesCount).toBe(1);
    expect(await Page.countDocuments()).toBe(0);
    await post(`/books/${b.id}/publish`, owner).expect(200);
    expect((await request(app).get(`/api/public/books/${b.slug}`).expect(200)).body.pages).toEqual(
      [],
    );
    const next = await challenge(b.slug);
    await submit(b.slug, next, { status: "in-book", emailVerified: true }).expect(400);
    await submit(b.slug, next, { name: "", message: "" }).expect(400);
    expect(await Submission.countDocuments()).toBe(1);
  });
  it.each(["email", "strict"] as const)(
    "requires matching verified email in %s mode and preserves the correct status",
    async (mode) => {
      const b = await book(mode),
        c = await challenge(b.slug);
      await submit(b.slug, c, { email: "guest@example.org" }).expect(401);
      const cookie = await verified(b.slug, c, "GUEST@example.org");
      await submit(
        b.slug,
        c,
        { name: mode === "email" ? "" : "Guest", email: "guest@example.org" },
        cookie,
      ).expect(201, { status: mode === "strict" ? "pending" : "added" });
      const saved = await entry();
      expect(
        await FeedEvent.countDocuments({ bookId: b.id, entryId: saved._id, name: "submission" }),
      ).toBe(1);
      expect(saved.emailVerified).toBe(true);
      expect(saved.guestEmail).toBe("guest@example.org");
      expect(saved.status).toBe(mode === "strict" ? "pending" : "approved");
      expect((await GuestVerification.findOne())!.consumedAt).not.toBeNull();
    },
  );
  it("enforces photo/message/name rules and rolls back verification and counts after bad photos", async () => {
    const b = await book("strict", randomUUID(), { photoRequired: true }),
      c = await challenge(b.slug),
      cookie = await verified(b.slug, c);
    const missing = await submit(
      b.slug,
      c,
      { name: "", email: "guest@example.org", message: "" },
      cookie,
    ).expect(400);
    expect(missing.body.error.fields).toHaveProperty("photo");
    expect(missing.body.error.fields).toHaveProperty("message");
    expect(missing.body.error.fields).toHaveProperty("name");
    await submit(
      b.slug,
      c,
      { email: "guest@example.org", photo: new Types.ObjectId().toString() },
      cookie,
    ).expect(422);
    expect((await Book.findById(b.id))!.entriesCount).toBe(0);
    expect((await GuestVerification.findOne())!.consumedAt).toBeNull();
    const bytes = await sharp({
      create: { width: 32, height: 32, channels: 3, background: "blue" },
    })
      .png()
      .toBuffer();
    const photo = await post("/uploads/image")
      .set("Authorization", "Bearer " + c.upload)
      .attach("file", bytes, { filename: "photo.png", contentType: "image/png" })
      .expect(201);
    await submit(
      b.slug,
      c,
      { email: "guest@example.org", photo: photo.body.uploadId },
      cookie,
    ).expect(201);
    const saved = await entry();
    expect(saved.photoUrl).toBe(`/api/uploads/${photo.body.uploadId}/page`);
    expect((await Upload.findById(photo.body.uploadId))!.submissionId!.toString()).toBe(
      saved._id.toString(),
    );
    await request(app).get(saved.photoUrl!).expect(404);
    await request(app).get(photo.body.url).expect(200);
    await post("/uploads/image")
      .set("Authorization", "Bearer " + c.upload)
      .attach("file", bytes, { filename: "photo.png", contentType: "image/png" })
      .expect(429);
  });
  it("consumes CAPTCHA once under concurrent submission and rejects refreshed proof for a used draft", async () => {
    const b = await book(),
      c = await challenge(b.slug);
    const responses = await Promise.all([submit(b.slug, c), submit(b.slug, c)]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 400]);
    expect(await Submission.countDocuments()).toBe(1);
    expect((await Book.findById(b.id))!.entriesCount).toBe(1);
    await post("/public/captcha", c.device)
      .send({ bookSlug: b.slug, draftId: c.draftId, token: randomUUID() })
      .expect(409);
  });
  it("distinguishes wrong/expired OTPs and commits the fifth-attempt limit", async () => {
    const b = await book("email"),
      c = await challenge(b.slug);
    await sendCode(b.slug, c).expect(200);
    const correct = inbox.at(-1)!.code,
      wrong = correct === "000000" ? "111111" : "000000";
    expect((await GuestOtp.findOne().select("+codeHash"))!.codeHash).not.toBe(correct);
    for (let i = 0; i < 4; i++)
      expect((await confirm(b.slug, c, wrong).expect(400)).body.error.code).toBe("INVALID_CODE");
    await confirm(b.slug, c, wrong).expect(429);
    await confirm(b.slug, c, correct).expect(429);
    expect((await GuestOtp.findOne())!.attempts).toBe(5);
    await GuestOtp.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await confirm(b.slug, c, correct).expect(410)).body.error.code).toBe("CODE_EXPIRED");
  });
  it("enforces resend cooldown across drafts and consumes successful OTPs once", async () => {
    const b = await book("email"),
      c = await challenge(b.slug),
      d = await challenge(b.slug);
    const sends = await Promise.all([sendCode(b.slug, c), sendCode(b.slug, d)]);
    expect(sends.map((r) => r.status).sort()).toEqual([200, 429]);
    expect(inbox).toHaveLength(1);
    const otp = (await GuestOtp.findOne())!,
      winner = otp.draftId === c.draftId ? c : d,
      loser = winner === c ? d : c;
    await confirm(b.slug, loser, inbox[0]!.code).expect(410);
    const confirmations = await Promise.all([
      confirm(b.slug, winner, inbox[0]!.code),
      confirm(b.slug, winner, inbox[0]!.code),
    ]);
    expect(confirmations.map((r) => r.status).sort()).toEqual([200, 410]);
    expect(await GuestVerification.countDocuments()).toBe(1);
  });
  it("binds email cookies and CAPTCHA to the book, draft, email and purpose", async () => {
    const b = await book("email"),
      other = await book("email"),
      c = await challenge(b.slug),
      cookie = await verified(b.slug, c);
    const d = await challenge(b.slug),
      e = await challenge(other.slug);
    await submit(b.slug, d, { email: "guest@example.org" }, cookie).expect(401);
    await submit(b.slug, c, { email: "different@example.org" }, cookie).expect(401);
    await submit(other.slug, c, { email: "guest@example.org" }, cookie).expect(400);
    const raw = cookie.split("=").slice(1).join("=");
    await submit(
      other.slug,
      e,
      { email: "guest@example.org" },
      `${guestCookieName(config, other.id)}=${raw}`,
    ).expect(401);
    await submit(b.slug, c, { email: "guest@example.org", captcha: c.upload }, cookie).expect(400);
    await submit(b.slug, c, { email: "guest@example.org", captcha: "forged" }, cookie).expect(400);
    await submit(b.slug, c, { email: "guest@example.org" }, owner).expect(401);
    expect(await Submission.countDocuments()).toBe(0);
  });
  it("checks collection status, rules and deletion again at saving time", async () => {
    const b = await book(),
      c = await challenge(b.slug);
    for (const collectionStatus of ["closed", "not-live"]) {
      await Book.updateOne({ _id: b.id }, { $set: { collectionStatus } });
      await submit(b.slug, c).expect(409);
    }
    await Book.updateOne(
      { _id: b.id },
      { $set: { collectionStatus: "open", "rules.photoRequired": true } },
    );
    await submit(b.slug, c).expect(400);
    await Book.updateOne({ _id: b.id }, { $set: { deletedAt: new Date() } });
    await submit(b.slug, c).expect(404);
    expect(await Submission.countDocuments()).toBe(0);
  });
  it("rejects photos belonging to other drafts/books, hosts and quarantined assets", async () => {
    const b = await book(),
      other = await book(),
      c = await challenge(b.slug);
    for (const patch of [
      { draftId: randomUUID() },
      { bookId: other.id },
      { ownerId: new Types.ObjectId() },
      { status: "quarantine" as const },
    ]) {
      const asset = await Upload.create({
        bookId: b.id,
        draftId: c.draftId,
        ownerId: null,
        status: "ready",
        originalBytes: 1,
        renditions: { page: { key: "test-only", bytes: 1, width: 1, height: 1 } },
        ...patch,
      });
      await submit(b.slug, c, { photo: asset._id.toString() }).expect(422);
    }
    expect((await Book.findById(b.id))!.entriesCount).toBe(0);
  });
  it("supports book reports and validates optional submission ownership transactionally", async () => {
    const b = await book(),
      other = await book(),
      c = await challenge(b.slug);
    await submit(b.slug, c).expect(201);
    const saved = await entry();
    await post(`/public/books/${b.slug}/reports`)
      .send({ reason: "privacy", details: "Book concern" })
      .expect(201, { ok: true });
    await post(`/public/books/${b.slug}/reports`)
      .send({ reason: "spam", details: "Entry concern", submissionId: saved._id.toString() })
      .expect(201);
    await post(`/public/books/${other.slug}/reports`)
      .send({ reason: "spam", details: "", submissionId: saved._id.toString() })
      .expect(404);
    const reportsPath = "/api/books/" + b.id + "/reports";
    await request(app).get(reportsPath).expect(401);
    await request(app).get(reportsPath).set("Cookie", outsider).expect(403);
    const inbox = (await request(app).get(reportsPath).set("Cookie", owner).expect(200)).body.items;
    expect(inbox).toHaveLength(2);
    expect(inbox.find((item: { submission?: unknown }) => item.submission).submission.id).toBe(
      String(saved._id),
    );
    const bookReport = inbox.find((item: { submission?: unknown }) => !item.submission);
    const ack = (cookie: string) =>
      request(app)
        .delete(reportsPath + "/" + bookReport.id)
        .set("Origin", config.CLIENT_URL)
        .set("Cookie", cookie);
    await ack(outsider).expect(403);
    await ack(owner).expect(204);
    expect((await request(app).get(reportsPath).set("Cookie", owner)).body.items).toHaveLength(1);
    expect(await Report.countDocuments()).toBe(2);
    expect((await Submission.findById(saved._id))!.reportedCount).toBe(1);
    const closed = await book("name", randomUUID(), { status: "closed" });
    await post(`/public/books/${closed.slug}/reports`)
      .send({ reason: "other", details: "" })
      .expect(201);
  });
  it("requires ownership for blocking, blocks later proofs and rejects existing proofs", async () => {
    const b = await book(),
      other = await book(),
      c = await challenge(b.slug);
    await submit(b.slug, c).expect(201);
    const saved = await entry(),
      pending = await challenge(b.slug, c.device);
    await post(`/books/${b.id}/blocked-guests`, outsider)
      .send({ submissionId: saved._id.toString() })
      .expect(403);
    await post(`/books/${other.id}/blocked-guests`, owner)
      .send({ submissionId: saved._id.toString() })
      .expect(404);
    const blocked = await post(`/books/${b.id}/blocked-guests`, owner)
      .send({ submissionId: saved._id.toString() })
      .expect(201);
    expect(blocked.body.blockedSubmissionIds).toEqual([saved._id.toString()]);
    await submit(b.slug, pending).expect(403);
    await post("/public/captcha", c.device)
      .send({ bookSlug: b.slug, draftId: randomUUID(), token: randomUUID() })
      .expect(403);
    await post(`/books/${b.id}/blocked-guests`, owner)
      .send({ submissionId: saved._id.toString() })
      .expect(409);
    const unrelated = await challenge(other.slug, c.device);
    await submit(other.slug, unrelated).expect(201);
  });
  it("blocks verified email across devices but never blocks an unverified volunteered email", async () => {
    const b = await book("email"),
      c = await challenge(b.slug),
      cookie = await verified(b.slug, c);
    await submit(b.slug, c, { email: "guest@example.org", name: "" }, cookie).expect(201);
    await post(`/books/${b.id}/blocked-guests`, owner)
      .send({ submissionId: (await entry())._id.toString() })
      .expect(201);
    const otherDevice = await challenge(b.slug);
    await sendCode(b.slug, otherDevice).expect(403);
    const nameBook = await book(),
      d = await challenge(nameBook.slug);
    await submit(nameBook.slug, d, { email: "victim@example.org" }).expect(201);
    const unverified = (await Submission.findOne({ bookId: nameBook.id }))!;
    await post(`/books/${nameBook.id}/blocked-guests`, owner)
      .send({ submissionId: unverified._id.toString() })
      .expect(201);
    expect(
      await BlockedGuest.exists({ bookId: nameBook.id, email: "victim@example.org" }),
    ).toBeNull();
    const fresh = await challenge(nameBook.slug);
    await submit(nameBook.slug, fresh, { email: "victim@example.org" }).expect(201);
  });
  it("uses shared durable IP and per-book quotas", async () => {
    const guests = new GuestService(
      testConfig({ RATE_LIMIT_MAX_REQUESTS: "2", RATE_LIMIT_WINDOW_MS: "3600000" }),
      mailer,
    );
    await guests.quota("submit", "ip-one", "a");
    await guests.quota("submit", "ip-two", "a");
    await expect(guests.quota("submit", "ip-three", "a")).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
    await guests.quota("submit", "ip-one", "b");
    await expect(guests.quota("submit", "ip-one", "c")).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });
  it("does not create a challenge if SMTP is unconfigured and rolls back failed commits", async () => {
    const b = await book("email"),
      c = await challenge(b.slug);
    const unavailable: AuthMailer = {
      ...mailer,
      assertConfigured() {
        throw new ApiError("SERVER", "Email delivery is not configured.");
      },
    };
    await expect(
      new GuestService(config, unavailable).sendCode(b.slug, "guest@example.org", c.proof),
    ).rejects.toMatchObject({ code: "SERVER" });
    expect(await GuestOtp.countDocuments()).toBe(0);
    const nameBook = await book(),
      d = await challenge(nameBook.slug);
    const fail = vi
      .spyOn(Submission, "create")
      .mockRejectedValueOnce(new Error("Injected failure"));
    try {
      await submit(nameBook.slug, d).expect(500);
    } finally {
      fail.mockRestore();
    }
    expect((await Book.findById(nameBook.id))!.entriesCount).toBe(0);
    expect((await UploadGrant.findOne({ draftId: d.draftId }))!.consumedAt).toBeNull();
    await submit(nameBook.slug, d).expect(201);
  });
});
