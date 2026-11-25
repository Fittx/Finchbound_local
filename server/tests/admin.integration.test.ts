import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { initializeAuthModels } from "../src/models/auth.js";
import { initializeBookModels } from "../src/models/books.js";
import { initializeGuestModels } from "../src/models/guests.js";
import { initializeUploadModels } from "../src/models/uploads.js";
import { User } from "../src/models/User.js";
import { AuthSession } from "../src/models/AuthSession.js";
import { Book } from "../src/models/Book.js";
import { Page } from "../src/models/Page.js";
import { Submission } from "../src/models/Submission.js";
import { UploadQuota } from "../src/models/UploadQuota.js";
import { PlatformReport } from "../src/models/PlatformReport.js";
import { signSession, digest } from "../src/services/tokens.js";
import { testConfig, testLogger } from "./helpers.js";

const uri = process.env.TEST_MONGODB_URI;
const dbName = "finchbound_admin_test_" + randomUUID().replaceAll("-", "");
const config = testConfig({
  ADMIN_EMAILS: "boss@gmail.com",
  RATE_LIMIT_MAX_REQUESTS: "10000",
  AUTH_RATE_LIMIT_MAX_REQUESTS: "300",
});
const theme = {
  background: "#ffffff",
  grid: "#eeeeee",
  cover: "#c92a37",
  accent: "#f4a261",
  text: "#2b2d42",
  header: "#2b2d42",
};
let app: ReturnType<typeof createApp>, owner: string, admin: string;

async function session(email: string) {
  const user = await User.create({
    name: "User",
    email,
    passwordHash: "unused",
    emailVerified: true,
  });
  const jti = randomUUID();
  await AuthSession.create({
    _id: digest(jti),
    userId: user._id,
    authVersion: 0,
    expiresAt: new Date(Date.now() + 3600000),
  });
  return config.JWT_COOKIE_NAME + "=" + (await signSession(config, String(user._id), 0, jti, 3600));
}
const call = (method: "get" | "post" | "delete" | "patch", path: string, cookie = "") =>
  request(app)
    [method]("/api" + path)
    .set("Origin", config.CLIENT_URL)
    .set("Cookie", cookie);
async function book(extra: Record<string, unknown> = {}) {
  const response = await call("post", "/books", owner)
    .send({
      title: "Reported book",
      slug: "b-" + randomUUID().slice(0, 8),
      kind: "personal",
      visibility: "link",
      preset: "crimson",
      theme,
      font: "hand",
      lines: true,
      access: "name",
      photoRequired: false,
      messageRequired: true,
      ...extra,
    })
    .expect(201);
  return response.body.book as { id: string; slug: string };
}
const report = (slug: string, body: Record<string, unknown> = {}) =>
  call("post", `/public/books/${slug}/platform-reports`).send({
    reason: "inappropriate",
    details: "Offensive page",
    ...body,
  });

describe.skipIf(!uri)("admin role and platform reports with real MongoDB", () => {
  beforeAll(async () => {
    mongoose.set("sanitizeFilter", true);
    await mongoose.connect(uri!, { dbName, serverSelectionTimeoutMS: 5000 });
    if (mongoose.connection.name !== dbName) throw new Error("Unexpected database");
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
      Submission.deleteMany({}),
      UploadQuota.deleteMany({}),
      PlatformReport.deleteMany({}),
    ]);
    owner = await session("host@gmail.com");
    admin = await session("boss@gmail.com");
    app = createApp({ config, isDatabaseReady: () => true, logger: testLogger() });
  });
  afterAll(async () => {
    if (
      mongoose.connection.readyState === 1 &&
      mongoose.connection.name === dbName &&
      dbName.startsWith("finchbound_admin_test_")
    )
      await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it("returns the role from server configuration in the session user", async () => {
    expect((await call("get", "/auth/me", admin).expect(200)).body.user.role).toBe("admin");
    expect((await call("get", "/auth/me", owner).expect(200)).body.user.role).toBe("host");
  });

  it("refuses every admin route to hosts, even for their own books", async () => {
    const b = await book({ live: undefined });
    const entry = await Submission.create({
      bookId: b.id,
      draftId: randomUUID(),
      fingerprint: "f",
      status: "approved",
      message: "hi",
    });
    const reportId = String(
      (await PlatformReport.create({ bookId: b.id, reason: "spam", fingerprint: "f" }))._id,
    );
    for (const [method, path] of [
      ["get", "/admin/reports"],
      ["post", `/admin/reports/${reportId}/dismiss`],
      ["post", `/admin/books/${b.id}/unpublish`],
      ["delete", `/admin/submissions/${entry.id}`],
    ] as const) {
      const response = await call(method, path, owner).expect(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    }
    expect(await Submission.exists({ _id: entry._id })).not.toBeNull();
    expect((await PlatformReport.findById(reportId))!.status).toBe("open");
  });

  it("accepts reports only for books a stranger can reach, and hides the reporter", async () => {
    const shared = await book();
    await call("post", `/books/${shared.id}/publish`, owner).expect(200);
    const privateBook = await book({ visibility: "private" });
    const unpublished = await book();
    const event = await book({ kind: "event", status: "open" });
    await report(shared.slug).expect(201);
    await report(event.slug, { reason: "privacy" }).expect(201);
    await report(privateBook.slug).expect(404);
    await report(unpublished.slug).expect(404);
    const other = await Submission.create({
      bookId: event.id,
      draftId: randomUUID(),
      fingerprint: "f",
      status: "approved",
    });
    await report(shared.slug, { submissionId: other.id }).expect(404);

    const list = await call("get", "/admin/reports", admin).expect(200);
    expect(list.body.items).toHaveLength(2);
    expect(list.body.items[0]).toMatchObject({
      reason: "privacy",
      status: "open",
      book: { id: event.id, kind: "event", ownerEmail: "host@gmail.com", deleted: false },
    });
    expect(JSON.stringify(list.body)).not.toContain("fingerprint");
    expect(list.body.nextCursor).toBeNull();
  });

  it("rate limits reports from one device", async () => {
    const event = await book({ kind: "event", status: "open" });
    const first = await report(event.slug).expect(201);
    const device = (first.headers["set-cookie"] as unknown as string[])[0]!.split(";")[0]!;
    for (let i = 0; i < 4; i++) await report(event.slug).set("Cookie", device).expect(201);
    await report(event.slug).set("Cookie", device).expect(429);
  });

  it("lets an admin dismiss, unpublish and remove an entry", async () => {
    const shared = await book();
    await call("post", `/books/${shared.id}/publish`, owner).expect(200);
    await report(shared.slug).expect(201);
    const [first] = (await call("get", "/admin/reports", admin)).body.items;
    await call("post", `/admin/reports/${first.id}/dismiss`, admin).expect(200);
    await call("post", `/admin/reports/${first.id}/dismiss`, admin).expect(404);
    expect((await call("get", "/admin/reports?status=dismissed", admin)).body.items).toHaveLength(
      1,
    );

    await report(shared.slug).expect(201);
    await call("post", `/admin/books/${shared.id}/unpublish`, admin).expect(200);
    await call("get", `/public/books/${shared.slug}`).expect(404);
    expect((await call("get", "/admin/reports?status=actioned", admin)).body.items).toHaveLength(1);
    expect((await call("get", "/admin/reports", admin)).body.items).toHaveLength(0);

    const event = await book({ kind: "event", status: "open" });
    const entry = await Submission.create({
      bookId: event.id,
      draftId: randomUUID(),
      fingerprint: "f",
      status: "in-book",
      message: "rude",
    });
    await Page.create({ bookId: event.id, submissionId: entry._id, order: 0, title: "From guest" });
    await Book.updateOne({ _id: event.id }, { $set: { entriesCount: 1 } });
    await report(event.slug, { submissionId: entry.id }).expect(201);
    const queued = (await call("get", "/admin/reports", admin)).body.items[0];
    expect(queued.submission).toMatchObject({ id: entry.id, message: "rude", status: "in-book" });
    await call("delete", `/admin/submissions/${entry.id}`, admin).expect(204);
    expect(await Submission.exists({ _id: entry._id })).toBeNull();
    expect(await Page.countDocuments({ submissionId: entry._id })).toBe(0);
    expect((await Book.findById(event.id))!.entriesCount).toBe(0);
    expect((await PlatformReport.findOne({ submissionId: entry._id }))!.status).toBe("actioned");
    await call("delete", `/admin/submissions/${entry.id}`, admin).expect(404);
  });

  it("stores and validates the expected guest count on books", async () => {
    const b = await book({ kind: "event", expectedGuests: 300 });
    expect((await call("get", `/books/${b.id}`, owner)).body.book.expectedGuests).toBe(300);
    await call("patch", `/books/${b.id}`, owner).send({ expectedGuests: 5000 }).expect(400);
    await call("patch", `/books/${b.id}`, owner).send({ expectedGuests: 40 }).expect(200);
    expect((await call("get", `/books/${b.id}`, owner)).body.book.expectedGuests).toBe(40);
    const plain = await book();
    expect((await call("get", `/books/${plain.id}`, owner)).body.book.expectedGuests).toBe(100);
  });

  it("slides short sessions forward while the host is active, but not remember-me sessions", async () => {
    const user = await User.findOne({ email: "host@gmail.com" });
    const short = config.JWT_SESSION_MINUTES * 60;
    async function make(lifetime: number, remainingMs: number) {
      const jti = randomUUID();
      await AuthSession.create({
        _id: digest(jti),
        userId: user!._id,
        authVersion: 0,
        expiresAt: new Date(Date.now() + remainingMs),
      });
      const cookie =
        config.JWT_COOKIE_NAME +
        "=" +
        (await signSession(config, String(user!._id), 0, jti, lifetime));
      return { cookie, id: digest(jti) };
    }
    const nearEnd = await make(short, 5 * 60000);
    const renewed = await call("get", "/auth/me", nearEnd.cookie).expect(200);
    const cookie = (renewed.headers["set-cookie"] as unknown as string[])[0]!;
    expect(cookie).toContain(config.JWT_COOKIE_NAME + "=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).not.toContain("Max-Age");
    const extended = (await AuthSession.findById(nearEnd.id))!.expiresAt.getTime();
    expect(extended).toBeGreaterThan(Date.now() + (short - 60) * 1000);
    // The new cookie keeps working.
    await call("get", "/auth/me", cookie.split(";")[0]!).expect(200);

    const fresh = await make(short, (short - 60) * 1000);
    expect((await call("get", "/auth/me", fresh.cookie)).headers["set-cookie"]).toBeUndefined();
    const remembered = await make(30 * 86400, 5 * 60000);
    expect(
      (await call("get", "/auth/me", remembered.cookie)).headers["set-cookie"],
    ).toBeUndefined();
  });
});
