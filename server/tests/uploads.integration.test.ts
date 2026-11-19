import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import mongoose, { Types } from "mongoose";
import sharp from "sharp";
import request from "supertest";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { initializeAuthModels } from "../src/models/auth.js";
import { initializeBookModels } from "../src/models/books.js";
import { initializeUploadModels } from "../src/models/uploads.js";
import { User } from "../src/models/User.js";
import { Book } from "../src/models/Book.js";
import { Page } from "../src/models/Page.js";
import { Upload } from "../src/models/Upload.js";
import { UploadGrant } from "../src/models/UploadGrant.js";
import { UploadQuota } from "../src/models/UploadQuota.js";
import { AuthSession } from "../src/models/AuthSession.js";
import { signSession, digest } from "../src/services/tokens.js";
import { ApiError } from "../src/utils/ApiError.js";
import type { ObjectStorage } from "../src/config/storage.js";
import type { CaptchaVerifier } from "../src/services/captcha.js";
import { testConfig, testLogger } from "./helpers.js";
const uri = process.env.TEST_MONGODB_URI;
const dbName = "finchbound_uploads_test_" + randomUUID().replaceAll("-", "");
const config = testConfig({
  RATE_LIMIT_MAX_REQUESTS: "10000",
  UPLOAD_MAX_PER_DRAFT: "2",
  UPLOAD_CONCURRENCY: "2",
});
class TestStorage implements ObjectStorage {
  files = new Map<string, Buffer>();
  puts = 0;
  failPutAt = 0;
  failRemove = false;
  hold: (() => Promise<void>) | undefined;
  assertConfigured() {}
  async put(key: string, data: Buffer) {
    this.puts++;
    if (this.hold) await this.hold();
    if (this.puts === this.failPutAt) throw new Error("Simulated provider failure");
    this.files.set(key, Buffer.from(data));
  }
  async remove(key: string) {
    if (this.failRemove) throw new Error("Removal failed");
    this.files.delete(key);
  }
  async get(key: string) {
    const data = this.files.get(key);
    if (!data) throw new ApiError("NOT_FOUND");
    return { body: Readable.from(data), bytes: data.length };
  }
}
let store: TestStorage,
  app: ReturnType<typeof createApp>,
  owner: string,
  other: string,
  ownerId: string,
  image: Buffer;
const verifier: CaptchaVerifier = {
  async verify(token) {
    if (token === "bad-proof") throw new ApiError("CAPTCHA_FAILED");
  },
};
const theme = {
  background: "#ffffff",
  grid: "#eeeeee",
  cover: "#c92a37",
  accent: "#f4a261",
  text: "#2b2d42",
  header: "#2b2d42",
};
const input = (slug = "event") => ({
  title: "Event",
  slug,
  kind: "event",
  visibility: "link",
  preset: "crimson",
  theme,
  font: "hand",
  lines: true,
  access: "strict",
  photoRequired: true,
  messageRequired: true,
  status: "open",
});
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
  return {
    id: user._id.toString(),
    cookie:
      config.JWT_COOKIE_NAME + "=" + (await signSession(config, user._id.toString(), 0, jti, 3600)),
  };
}
const call = (method: "get" | "post" | "patch" | "delete", path: string, cookie = owner) =>
  request(app)[method](path).set("Origin", config.CLIENT_URL).set("Cookie", cookie);
const book = async (slug?: string) =>
  (await call("post", "/api/books").send(input(slug)).expect(201)).body.book;
const sendImage = (cookie = owner) =>
  call("post", "/api/uploads/image", cookie).attach("file", image, {
    filename: "photo.png",
    contentType: "image/png",
  });
const proof = (slug: string, draftId: string = randomUUID(), token: string = randomUUID()) =>
  request(app)
    .post("/api/public/captcha")
    .set("Origin", config.CLIENT_URL)
    .send({ bookSlug: slug, draftId, token });
const guestImage = (token: string) =>
  request(app)
    .post("/api/uploads/image")
    .set("Origin", config.CLIENT_URL)
    .set("Authorization", "Bearer " + token)
    .attach("file", image, { filename: "photo.png", contentType: "image/png" });
describe.skipIf(!uri)("upload authorization, processing and persistence with MongoDB", () => {
  beforeAll(async () => {
    mongoose.set("sanitizeFilter", true);
    await mongoose.connect(uri!, { dbName, serverSelectionTimeoutMS: 5000 });
    if (mongoose.connection.name !== dbName) throw new Error("Unexpected test database");
    const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== "isdbgrid") throw new Error("Replica set required");
    await initializeAuthModels();
    await initializeBookModels();
    await initializeUploadModels();
    image = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "red" } })
      .png()
      .toBuffer();
  }, 20000);
  beforeEach(async () => {
    if (mongoose.connection.name !== dbName) throw new Error("Unexpected test database");
    await Promise.all([
      User.deleteMany({}),
      AuthSession.deleteMany({}),
      Book.deleteMany({}),
      Page.deleteMany({}),
      Upload.deleteMany({}),
      UploadGrant.deleteMany({}),
      UploadQuota.deleteMany({}),
    ]);
    const a = await host("owner@gmail.com"),
      b = await host("other@gmail.com");
    owner = a.cookie;
    ownerId = a.id;
    other = b.cookie;
    store = new TestStorage();
    app = createApp({
      config,
      isDatabaseReady: () => true,
      storage: store,
      captcha: verifier,
      logger: testLogger(),
    });
  });
  afterAll(async () => {
    if (
      mongoose.connection.readyState === 1 &&
      mongoose.connection.name === dbName &&
      dbName.startsWith("finchbound_uploads_test_")
    )
      await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  it("stores ready metadata and three private clean renditions, removing quarantine", async () => {
    const response = await sendImage().expect(201);
    expect(response.body).toEqual({
      uploadId: expect.stringMatching(/^[a-f0-9]{24}$/),
      url: expect.stringMatching(/^\/api\/uploads\//),
    });
    const asset = await Upload.findById(response.body.uploadId);
    expect(asset!.status).toBe("ready");
    expect(asset!.ownerId!.toString()).toBe(ownerId);
    expect(asset!.renditions.size).toBe(3);
    expect(store.files.size).toBe(3);
    expect([...store.files.keys()].some((k) => k.startsWith("quarantine/"))).toBe(false);
    for (const data of store.files.values()) {
      const meta = await sharp(data).metadata();
      expect(meta.format).toBe("jpeg");
      expect(meta.exif).toBeUndefined();
    }
    await call("get", response.body.url)
      .expect(200)
      .expect("Content-Type", /image\/jpeg/);
    await request(app).get(response.body.url).expect(404);
    await call("get", response.body.url, other).expect(404);
  });
  it("binds page images, allows eligible public delivery, and revokes it when unpublished/deleted", async () => {
    const b = await book(),
      upload = (await sendImage().expect(201)).body;
    await call("post", `/api/books/${b.id}/pages`)
      .send({ title: "Photo", body: "", image: upload.url })
      .expect(201);
    expect((await Upload.findById(upload.uploadId))!.bookId!.toString()).toBe(b.id);
    await request(app).get(upload.url).expect(404);
    await call("post", `/api/books/${b.id}/publish`).expect(200);
    await request(app).get(upload.url).expect(200);
    await call("patch", `/api/books/${b.id}`).send({ live: false }).expect(200);
    await request(app).get(upload.url).expect(404);
    await call("delete", `/api/books/${b.id}`).expect(204);
    await call("get", upload.url).expect(404);
  });
  it("rejects foreign, cross-book and unknown image references", async () => {
    const b = await book(),
      second = await book("second"),
      upload = (await sendImage().expect(201)).body;
    await call("post", `/api/books/${b.id}/pages`)
      .send({ title: "A", body: "", image: upload.url })
      .expect(201);
    await call("post", `/api/books/${second.id}/pages`)
      .send({ title: "B", body: "", image: upload.url })
      .expect(403);
    const foreign = (await sendImage(other).expect(201)).body;
    await call("post", `/api/books/${b.id}/pages`)
      .send({ title: "B", body: "", image: foreign.url })
      .expect(403);
    await call("post", `/api/books/${b.id}/pages`)
      .send({ title: "B", body: "", image: "https://evil.test/a.jpg" })
      .expect(400);
    await call("post", `/api/books/${b.id}/pages`)
      .send({ title: "B", body: "", image: `/api/uploads/${new Types.ObjectId()}/page` })
      .expect(403);
  });
  it("issues distinct purpose tokens after CAPTCHA, prevents replay and checks event status", async () => {
    const b = await book(),
      draftId = randomUUID(),
      token = randomUUID();
    const granted = await proof(b.slug, draftId, token).expect(200);
    expect(granted.body.token).not.toBe(granted.body.uploadToken);
    expect(Date.parse(granted.body.expiresAt) - Date.now()).toBeLessThanOrEqual(600000);
    expect((await UploadGrant.findOne())!.draftId).toBe(draftId);
    await proof(b.slug, draftId, token).expect(400);
    await proof(b.slug, draftId, "bad-proof").expect(400);
    await guestImage(granted.body.token).expect(401);
    await call("patch", `/api/books/${b.id}`).send({ status: "closed" }).expect(200);
    await guestImage(granted.body.uploadToken).expect(409);
    await proof(b.slug).expect(409);
  });
  it("keeps guest previews private, bound to the upload/draft/book and expiring grants", async () => {
    const b = await book(),
      granted = (await proof(b.slug).expect(200)).body;
    const upload = (await guestImage(granted.uploadToken).expect(201)).body;
    const privatePath = upload.url.split("?")[0];
    await request(app).get(upload.url).expect(200);
    await request(app).get(privatePath).expect(404);
    const another = (await guestImage(granted.uploadToken).expect(201)).body;
    const stolenPreview = another.url.split("?")[0] + "?" + upload.url.split("?")[1];
    await request(app).get(stolenPreview).expect(404);
    await UploadGrant.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await request(app).get(upload.url).expect(404);
  });
  it("enforces atomic token uses and draft quotas across refreshed CAPTCHA grants", async () => {
    const b = await book(),
      draft = randomUUID(),
      first = (await proof(b.slug, draft).expect(200)).body;
    const attempts = await Promise.all([
      guestImage(first.uploadToken),
      guestImage(first.uploadToken),
      guestImage(first.uploadToken),
    ]);
    expect(attempts.map((r) => r.status).sort()).toEqual([201, 201, 429]);
    expect((await UploadGrant.findOne())!.uses).toBe(2);
    const refreshed = (await proof(b.slug, draft).expect(200)).body;
    await guestImage(refreshed.uploadToken).expect(429);
    expect(await Upload.countDocuments({ status: "ready" })).toBe(2);
  });
  it("rejects malformed multipart, SVG, spoofed bytes and oversized uploads", async () => {
    await call("post", "/api/uploads/image").attach("wrong", image, "photo.png").expect(400);
    await call("post", "/api/uploads/image")
      .attach("file", image, "a.png")
      .attach("file", image, "b.png")
      .expect(400);
    await call("post", "/api/uploads/image")
      .attach("file", Buffer.from("<svg/>"), { filename: "bad.svg", contentType: "image/svg+xml" })
      .expect(415);
    await call("post", "/api/uploads/image")
      .attach("file", Buffer.from("<svg/>"), { filename: "fake.png", contentType: "image/png" })
      .expect(415);
    await call("post", "/api/uploads/image")
      .attach("file", Buffer.alloc(10 * 1024 * 1024 + 1), {
        filename: "huge.png",
        contentType: "image/png",
      })
      .expect(413);
    expect(await Upload.countDocuments({ status: "ready" })).toBe(0);
    expect(store.files.size).toBe(0);
  });
  it("cleans partial provider failures and never exposes quarantine/failed assets", async () => {
    store.failPutAt = 3;
    const response = await sendImage().expect(422);
    expect(response.body.error.code).toBe("UPLOAD_FAILED");
    expect(store.files.size).toBe(0);
    const failed = await Upload.findOne();
    expect(failed!.status).toBe("failed");
    await call("get", `/api/uploads/${failed!._id}/page`).expect(404);
    expect(JSON.stringify(response.body)).not.toMatch(/quarantine|validated|provider/);
  });
  it("records cleanup work when provider removal fails", async () => {
    store.failPutAt = 2;
    store.failRemove = true;
    await sendImage().expect(422);
    const failed = await Upload.findOne();
    expect(failed!.cleanupNeeded).toBe(true);
    await call("get", `/api/uploads/${failed!._id}/page`).expect(404);
  });
  it("rejects a guest upload when collection closes during processing", async () => {
    const b = await book(),
      grant = (await proof(b.slug).expect(200)).body;
    let release!: () => void, started!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve)),
      entered = new Promise<void>((resolve) => (started = resolve));
    store.hold = async () => {
      started();
      await gate;
    };
    const pending = guestImage(grant.uploadToken).then((response) => response);
    await entered;
    await call("patch", `/api/books/${b.id}`).send({ status: "closed" }).expect(200);
    release();
    expect((await pending).status).toBe(409);
    expect(store.files.size).toBe(0);
  });
  it("bounds concurrent processing slots and releases them after completion", async () => {
    app = createApp({
      config: { ...config, UPLOAD_CONCURRENCY: 1 },
      isDatabaseReady: () => true,
      storage: store,
      captcha: verifier,
      logger: testLogger(),
    });
    let release!: () => void, started!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve)),
      entered = new Promise<void>((resolve) => (started = resolve));
    store.hold = async () => {
      started();
      await gate;
    };
    const pending = sendImage().then((response) => response);
    await entered;
    await sendImage().expect(429);
    release();
    expect((await pending).status).toBe(201);
    store.hold = undefined;
    await sendImage().expect(201);
  });
});
