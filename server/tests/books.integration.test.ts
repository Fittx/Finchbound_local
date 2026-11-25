import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { FeedEvent } from "../src/models/FeedEvent.js";
import { randomUUID } from "node:crypto";
import mongoose, { Types } from "mongoose";
import request from "supertest";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { initializeAuthModels } from "../src/models/auth.js";
import { initializeBookModels } from "../src/models/books.js";
import { Submission } from "../src/models/Submission.js";
import { Report } from "../src/models/Report.js";
import { BlockedGuest } from "../src/models/BlockedGuest.js";
import { initializeGuestModels } from "../src/models/guests.js";
import { Book } from "../src/models/Book.js";
import { Page } from "../src/models/Page.js";
import { User } from "../src/models/User.js";
import { AuthSession } from "../src/models/AuthSession.js";
import { Upload } from "../src/models/Upload.js";
import { digest, signSession } from "../src/services/tokens.js";
import { LIMITS } from "../../shared/constants.js";
import { testConfig, testLogger } from "./helpers.js";
const uri = process.env.TEST_MONGODB_URI;
const dbName = "finchbound_books_test_" + randomUUID().replaceAll("-", "");
const config = testConfig({ RATE_LIMIT_MAX_REQUESTS: "10000" });
const app = createApp({ config, isDatabaseReady: () => true, logger: testLogger() });
const theme = {
  background: "#ffffff",
  grid: "#eeeeee",
  cover: "#c92a37",
  accent: "#f4a261",
  text: "#2b2d42",
  header: "#2b2d42",
};
const input = (slug = "my-book") => ({
  title: "My book",
  slug,
  kind: "event",
  visibility: "link",
  preset: "crimson",
  theme,
  font: "hand",
  lines: true,
  access: "name",
  photoRequired: false,
  messageRequired: true,
});
let owner: string, outsider: string, ownerId: string;
async function host(email: string) {
  const user = await User.create({
    name: "Host",
    email,
    passwordHash: "test-only-unused-hash",
    emailVerified: true,
  });
  const jti = randomUUID();
  const token = await signSession(config, user._id.toString(), 0, jti, 3600);
  await AuthSession.create({
    _id: digest(jti),
    userId: user._id,
    authVersion: 0,
    expiresAt: new Date(Date.now() + 3600000),
  });
  return { id: user._id.toString(), cookie: config.JWT_COOKIE_NAME + "=" + token };
}
const call = (method: "get" | "post" | "patch" | "put" | "delete", path: string, cookie = owner) =>
  request(app)
    [method]("/api" + path)
    .set("Origin", config.CLIENT_URL)
    .set("Cookie", cookie);
const create = async (slug?: string) =>
  (await call("post", "/books").send(input(slug)).expect(201)).body.book;
const add = async (book: string, title: string, extra: Record<string, unknown> = {}) => {
  if (typeof extra.image === "string") {
    const asset = await Upload.create({
      ownerId,
      status: "ready",
      originalBytes: 1,
      renditions: { page: { key: "test-only", width: 1, height: 1, bytes: 1 } },
    });
    extra = { ...extra, image: `/api/uploads/${asset._id}/page` };
  }
  return (
    await call("post", `/books/${book}/pages`)
      .send({ title, body: "Message", ...extra })
      .expect(201)
  ).body.page;
};
const get = async (id: string) => (await call("get", `/books/${id}`).expect(200)).body.book;
const publicGet = (slug: string) => request(app).get("/api/public/books/" + slug);

describe.skipIf(!uri)("books and pages with real MongoDB transactions and sessions", () => {
  it("persists private feedback and restricts inboxes and reader visibility", async () => {
    const book = await create("feedback-book");
    const send = () =>
      request(app)
        .post("/api/public/books/feedback-book/feedback")
        .set("Origin", config.CLIENT_URL)
        .send({ name: "Reader", message: "A lovely book" });
    await send().expect(404);
    await call("post", `/books/${book.id}/publish`).expect(200);
    await send().expect(201);
    const inbox = await call("get", `/books/${book.id}/feedback`).expect(200);
    expect(inbox.body.items[0].message).toBe("A lovely book");
    expect(inbox.body.items[0]).not.toHaveProperty("bookId");
    await call("get", `/books/${book.id}/feedback`, outsider).expect(404);
    await call("patch", `/books/${book.id}`).send({ visibility: "private" }).expect(200);
    await send().expect(404);
  });
  beforeAll(async () => {
    mongoose.set("sanitizeFilter", true);
    mongoose.set("strictQuery", true);
    await mongoose.connect(uri!, { dbName, serverSelectionTimeoutMS: 5000 });
    if (mongoose.connection.name !== dbName) throw new Error("Refusing unexpected test database");
    const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== "isdbgrid") throw new Error("Replica set required");
    await initializeAuthModels();
    await initializeBookModels();
    await initializeGuestModels();
  }, 20000);
  beforeEach(async () => {
    if (mongoose.connection.name !== dbName) throw new Error("Refusing unexpected test database");
    await Promise.all([
      Upload.deleteMany({}),
      Book.deleteMany({}),
      Page.deleteMany({}),
      User.deleteMany({}),
      AuthSession.deleteMany({}),
      mongoose.connection.db!.collection("submissions").deleteMany({}),
    ]);
    const a = await host("owner@gmail.com"),
      b = await host("other@gmail.com");
    owner = a.cookie;
    ownerId = a.id;
    outsider = b.cookie;
  });
  afterAll(async () => {
    if (
      mongoose.connection.readyState === 1 &&
      mongoose.connection.name === dbName &&
      dbName.startsWith("finchbound_books_test_")
    )
      await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  it("creates wire-compatible books, persists guest metadata and denies privileged fields", async () => {
    const b = await create();
    expect(b).toMatchObject({
      ...input(),
      live: false,
      entries: 0,
      pages: [],
      version: 0,
      hosts: "",
      prompt: "",
      status: "not-live",
    });
    expect(b).not.toHaveProperty("ownerId");
    expect((await Book.findById(b.id))!.ownerId.toString()).toBe(ownerId);
    await call("patch", `/books/${b.id}`)
      .send({ hosts: "Our hosts", prompt: "A memory", status: "closed" })
      .expect(200);
    await call("post", `/books/${b.id}/publish`).expect(200);
    expect(await get(b.id)).toMatchObject({
      hosts: "Our hosts",
      prompt: "A memory",
      status: "closed",
      live: true,
    });
    for (const body of [{ ownerId: ownerId }, { kind: "personal" }, { version: 500 }])
      await call("patch", `/books/${b.id}`).send(body).expect(400);
    await call("post", "/books")
      .send({ ...input("extra"), ownerId })
      .expect(400);
  });
  it("enforces ownership for every book and page read/write route", async () => {
    const b = await create(),
      p = await add(b.id, "Page");
    for (const [method, path, body] of [
      ["get", `/books/${b.id}`, {}],
      ["patch", `/books/${b.id}`, { title: "Stolen" }],
      ["post", `/books/${b.id}/publish`, {}],
      ["delete", `/books/${b.id}`, {}],
      ["post", `/books/${b.id}/restore`, {}],
      ["get", `/books/${b.id}/pages`, {}],
      ["post", `/books/${b.id}/pages`, { title: "New", body: "" }],
      ["patch", `/pages/${p.id}`, { body: "Stolen" }],
      ["delete", `/pages/${p.id}`, {}],
      [
        "put",
        `/books/${b.id}/pages/order`,
        { pageId: p.id, beforeId: new Types.ObjectId().toString(), expectedVersion: 1 },
      ],
    ] as const)
      await call(method, path, outsider).send(body).expect(403);
    expect((await get(b.id)).title).toBe("My book");
    expect((await call("get", "/books", outsider)).body.items).toEqual([]);
  });
  it("checks/normalizes slugs and resolves concurrent collisions without duplicate books", async () => {
    expect((await call("get", "/books/check-slug/My-Book").expect(200)).body.available).toBe(true);
    const results = await Promise.all([
      call("post", "/books").send(input("MY-BOOK")),
      call("post", "/books").send(input()),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await call("get", "/books/check-slug/my-book")).body.available).toBe(false);
    await call("get", "/books/check-slug/api").expect(400);
    const other = await create("second");
    await call("patch", `/books/${other.id}`).send({ slug: "my-book" }).expect(409);
    expect((await get(other.id)).slug).toBe("second");
  });
  it("paginates owner books, escapes search syntax, rejects tampering and survives new arrivals", async () => {
    for (const slug of ["first", "second", "third"]) await create(slug);
    const first = (await call("get", "/books?limit=2").expect(200)).body;
    await create("fourth");
    const last = (
      await call("get", "/books").query({ cursor: first.nextCursor, limit: 2 }).expect(200)
    ).body;
    expect(new Set([...first.items, ...last.items].map((x) => x.id)).size).toBe(3);
    expect(last.nextCursor).toBeNull();
    expect(first.items[0]).not.toHaveProperty("pages");
    expect((await call("get", "/books?q=.*").expect(200)).body.items).toEqual([]);
    await call("get", "/books").query({ cursor: first.nextCursor, q: "changed" }).expect(400);
    await call("get", "/books").query({ cursor: "tampered" }).expect(400);
    await call("get", "/books")
      .query({ cursor: first.nextCursor })
      .set("Cookie", outsider)
      .expect(400);
  });
  it("returns 404 to outsiders for unpublished, private and deleted books, but lets owners preview", async () => {
    const b = await create();
    await add(b.id, "Host page");
    await publicGet(b.slug).expect(404);
    await publicGet(b.slug).set("Cookie", outsider).expect(404);
    expect((await publicGet(b.slug).set("Cookie", owner).expect(200)).body.pages).toHaveLength(1);
    await call("post", `/books/${b.id}/publish`).expect(200);
    await publicGet(b.slug).expect(200);
    await publicGet(b.slug)
      .set("Cookie", config.JWT_COOKIE_NAME + "=forged")
      .expect(200);
    await call("patch", `/books/${b.id}`).send({ visibility: "private" }).expect(200);
    await publicGet(b.slug).expect(404);
    await publicGet(b.slug).set("Cookie", owner).expect(200);
    await call("delete", `/books/${b.id}`).expect(204);
    await publicGet(b.slug).set("Cookie", owner).expect(404);
  });
  it("exposes only host-created and same-book In book pages, never moderation or guest email", async () => {
    const b = await create(),
      other = await create("other-book");
    const normal = await add(b.id, "Host page");
    const db = mongoose.connection.db!;
    const approved: string[] = [];
    for (const [i, status] of ["pending", "approved", "rejected", "in-book"].entries()) {
      const source = new Types.ObjectId();
      await db.collection("submissions").insertOne({
        _id: source,
        bookId: new Types.ObjectId(b.id),
        status,
        guestEmail: "private@example.test",
        reportedCount: 3,
      });
      const page = await Page.create({
        bookId: b.id,
        submissionId: source,
        title: status,
        body: "Message",
        order: i + 1,
      });
      if (status === "in-book") approved.push(page._id.toString());
    }
    await Page.create({
      bookId: b.id,
      submissionId: new Types.ObjectId(),
      title: "Unknown source",
      body: "",
      order: 7,
    });
    const cross = new Types.ObjectId();
    await db
      .collection("submissions")
      .insertOne({ _id: cross, bookId: new Types.ObjectId(other.id), status: "in-book" });
    await Page.create({
      bookId: b.id,
      submissionId: cross,
      title: "Cross book source",
      body: "",
      order: 8,
    });
    await call("post", `/books/${b.id}/publish`).expect(200);
    const response = await publicGet(b.slug).expect(200);
    expect(response.body.pages.map((p: { id: string }) => p.id)).toEqual([normal.id, ...approved]);
    expect(JSON.stringify(response.body)).not.toMatch(
      /guestEmail|private@example|reportedCount|ownerId|passwordHash/,
    );
    expect((await publicGet(b.slug).set("Cookie", owner)).body.pages).toHaveLength(2);
  });
  it("soft-deletes/restores within the undo window without losing pages or releasing the slug", async () => {
    const b = await create();
    await add(b.id, "Kept");
    await call("delete", `/books/${b.id}`).expect(204);
    await call("get", `/books/${b.id}`).expect(404);
    expect((await call("get", "/books")).body.items).toEqual([]);
    await call("post", "/books").send(input()).expect(409);
    const restored = await call("post", `/books/${b.id}/restore`).expect(200);
    expect(restored.body.book.pages).toHaveLength(1);
    await call("delete", `/books/${b.id}`).expect(204);
    await Book.updateOne(
      { _id: b.id },
      { $set: { deletedAt: new Date(Date.now() - LIMITS.undoMs - 1) } },
    );
    const gone = await call("post", `/books/${b.id}/restore`).expect(410);
    expect(gone.body.error.code).toBe("NOT_FOUND");
    expect((await Book.findById(b.id))!.deletedAt).not.toBeNull();
  });
  it("creates, edits, filters and paginates pages with server-controlled associations and edited dates", async () => {
    const b = await create();
    const a = await add(b.id, "First", {
      image: "https://example.test/photo.jpg",
      caption: "Before the first toast",
      header: "Hello",
    });
    const p = await add(b.id, "Second");
    await add(b.id, "Third");
    const first = (await call("get", `/books/${b.id}/pages?limit=2`).expect(200)).body;
    const last = (
      await call("get", `/books/${b.id}/pages`)
        .query({ cursor: first.nextCursor, limit: 2 })
        .expect(200)
    ).body;
    expect([...first.items, ...last.items].map((p) => p.title)).toEqual([
      "First",
      "Second",
      "Third",
    ]);
    expect(last.nextCursor).toBeNull();
    expect(first.items[0].caption).toBe("Before the first toast");
    await call("patch", `/pages/${a.id}`)
      .send({ caption: "x".repeat(61) })
      .expect(400);
    expect(
      (await call("get", `/books/${b.id}/pages?withPhoto=true`)).body.items.map(
        (p: { id: string }) => p.id,
      ),
    ).toEqual([a.id]);
    expect((await call("get", `/books/${b.id}/pages?withPhoto=false`)).body.items).toHaveLength(3);
    expect((await call("get", `/books/${b.id}/pages?q=Third`)).body.items[0].title).toBe("Third");
    expect((await call("get", `/books/${b.id}/pages?q=.*`)).body.items).toEqual([]);
    await call("patch", `/pages/${a.id}`)
      .send({ body: "Edited", header: "New", caption: "The toast" })
      .expect(200);
    expect((await call("get", `/books/${b.id}/pages?sort=edited`)).body.items[0]).toMatchObject({
      id: a.id,
      body: "Edited",
      caption: "The toast",
      header: "New",
    });
    expect(a.editedAt).toMatch(/^\d{4}-/);
    await call("patch", `/pages/${a.id}`).send({ image: "", cardImage: "" }).expect(200);
    expect((await call("get", `/books/${b.id}/pages?withPhoto=true`)).body.items).toEqual([]);
    await call("patch", `/pages/${p.id}`).send({ submissionId: a.id }).expect(400);
    await call("delete", `/pages/${p.id}`).expect(204);
    expect((await get(b.id)).pages).toHaveLength(2);
    await call("post", `/books/${b.id}/pages`)
      .send({ title: "Injected", body: "", id: a.id })
      .expect(400);
  });
  it("serializes concurrent appends, anchored reorder and version conflicts", async () => {
    const b = await create();
    const [a, p, c] = await Promise.all([add(b.id, "A"), add(b.id, "B"), add(b.id, "C")]);
    const stored = await Page.find({ bookId: b.id }).sort({ order: 1 });
    expect(stored.map((p) => p.order)).toEqual([0, 1, 2]);
    const version = (await get(b.id)).version;
    const results = await Promise.all([
      call("put", `/books/${b.id}/pages/order`).send({
        pageId: c.id,
        beforeId: a.id,
        expectedVersion: version,
      }),
      call("put", `/books/${b.id}/pages/order`).send({
        pageId: p.id,
        afterId: c.id,
        expectedVersion: version,
      }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const success = results.find((r) => r.status === 200)!;
    expect(success.body.version).toBe(version + 1);
    const next = await get(b.id);
    expect(next.version).toBe(version + 1);
    const index = next.pages.findIndex((p: { id: string }) => p.id === success.body.pageId);
    expect(index).toBe(success.body.order);
    const rows = await Page.find({ bookId: b.id }).sort({ order: 1 });
    expect(rows.map((p) => p.order)).toEqual([0, 1, 2]);
  });
  it("rejects cross-book anchors and stale cursors without changing page order or version", async () => {
    const b = await create(),
      other = await create("other");
    const a = await add(b.id, "A"),
      p = await add(b.id, "B"),
      foreign = await add(other.id, "Other");
    const first = (await call("get", `/books/${b.id}/pages?limit=1`)).body;
    const version = (await get(b.id)).version;
    await call("put", `/books/${b.id}/pages/order`)
      .send({ pageId: a.id, beforeId: foreign.id, expectedVersion: version })
      .expect(404);
    expect((await get(b.id)).version).toBe(version);
    await call("put", `/books/${b.id}/pages/order`)
      .send({ pageId: p.id, beforeId: a.id, expectedVersion: version })
      .expect(200);
    expect((await get(b.id)).pages.map((p: { id: string }) => p.id)).toEqual([p.id, a.id]);
    await call("get", `/books/${b.id}/pages`).query({ cursor: first.nextCursor }).expect(400);
    await call("put", `/books/${b.id}/pages/order`)
      .send({ pageId: foreign.id, beforeId: a.id, expectedVersion: version + 1 })
      .expect(404);
  });
  it("prevents writes under deleted parents and rejects malformed IDs/query operators", async () => {
    const b = await create(),
      p = await add(b.id, "A");
    await call("delete", `/books/${b.id}`).expect(204);
    await call("post", `/books/${b.id}/pages`).send({ title: "Hidden", body: "" }).expect(404);
    await call("patch", `/pages/${p.id}`).send({ title: "Hidden" }).expect(404);
    await call("delete", `/pages/${p.id}`).expect(404);
    await call("get", "/books/bad-id").expect(400);
    await call("get", "/books?q[$ne]=anything").expect(400);
    await call("get", "/books?limit=101").expect(400);
  });
  it("rolls back page moves when the book version write fails", async () => {
    const b = await create(),
      a = await add(b.id, "A"),
      p = await add(b.id, "B");
    const version = (await get(b.id)).version;
    const fail = vi
      .spyOn(Book.prototype, "save")
      .mockRejectedValueOnce(new Error("Injected failure"));
    try {
      await call("put", `/books/${b.id}/pages/order`)
        .send({ pageId: p.id, beforeId: a.id, expectedVersion: version })
        .expect(500);
    } finally {
      fail.mockRestore();
    }
    const result = await get(b.id);
    expect(result.version).toBe(version);
    expect(result.pages.map((page: { id: string }) => page.id)).toEqual([a.id, p.id]);
  });
  it("keeps a published private personal book owner-only", async () => {
    const b = (
      await call("post", "/books")
        .send({ ...input(), kind: "personal", visibility: "private" })
        .expect(201)
    ).body.book;
    await call("post", `/books/${b.id}/publish`).expect(200);
    await publicGet(b.slug).expect(404);
    await publicGet(b.slug).set("Cookie", outsider).expect(404);
    await publicGet(b.slug).set("Cookie", owner).expect(200);
  });
  it("limits account fields, rejects a wrong confirmation and deletes only the signed-in owner's data", async () => {
    const b = await create();
    await add(b.id, "A memory");
    const u = await call("get", "/account").expect(200);
    expect(Object.keys(u.body.user).sort()).toEqual(["email", "id", "name", "plan", "role"]);
    await call("patch", "/account")
      .send({ name: "Host", email: "owner@gmail.com", passwordHash: "forbidden" })
      .expect(400);
    await call("patch", "/account").send({ name: "Host", email: "other@gmail.com" }).expect(409);
    await call("patch", "/account").send({ name: "Updated", email: "owner@gmail.com" }).expect(200);
    await call("delete", "/account").send({ email: "Owner@gmail.com" }).expect(400);
    expect(await Book.exists({ _id: b.id })).toBeTruthy();
    await call("delete", "/account").send({ email: "owner@gmail.com" }).expect(200, { ok: true });
    await call("get", "/account").expect(401);
    await call("get", "/account", outsider).expect(200);
    expect(await Page.countDocuments({ bookId: b.id })).toBe(0);
    expect(await Book.exists({ _id: b.id })).toBeNull();
  });
  it("changes a password only after verifying the current one, and revokes old sessions", async () => {
    const { hashPassword, comparePassword } = await import("../src/services/password.js");
    await User.updateOne(
      { _id: ownerId },
      { $set: { passwordHash: await hashPassword("Before1234", 4) } },
    );
    const path = "/account/password";
    await call("post", path)
      .send({ currentPassword: "Wrong1234", newPassword: "After1234" })
      .expect(401);
    await call("post", path)
      .send({ currentPassword: "Before1234", newPassword: "After1234" })
      .expect(200, { ok: true });
    const saved = await User.findById(ownerId).select("+passwordHash");
    expect(await comparePassword("After1234", saved!.passwordHash)).toBe(true);
    await call("get", "/account").expect(401);
  });
  it("respects the undo window and retries failed storage cleanup", async () => {
    const { purgeDeleted } = await import("../src/jobs/purgeDeleted.js");
    const b = await create();
    const asset = await Upload.create({
      ownerId,
      bookId: b.id,
      status: "ready",
      originalBytes: 1,
      keys: ["test-key"],
    });
    const storage = {
      remove: vi.fn(async (_key: string) => {}),
      put: vi.fn(),
      get: vi.fn(),
      assertConfigured: vi.fn(),
    };
    await call("delete", "/books/" + b.id).expect(204);
    await purgeDeleted(storage);
    expect(await Book.exists({ _id: b.id })).toBeTruthy();
    await Book.updateOne({ _id: b.id }, { $set: { deletedAt: new Date(0) } });
    storage.remove.mockRejectedValueOnce(new Error("storage unavailable"));
    expect((await purgeDeleted(storage)).failed).toBe(1);
    expect(await Book.exists({ _id: b.id })).toBeNull();
    expect(await Upload.findById(asset._id)).toMatchObject({
      status: "failed",
      cleanupNeeded: true,
    });
    expect((await purgeDeleted(storage)).failed).toBe(0);
    expect(await Upload.exists({ _id: asset._id })).toBeNull();
  });
  describe("host moderation", () => {
    async function entry(
      bookId: string,
      status: "pending" | "approved" | "rejected" = "pending",
      name = "Guest",
    ) {
      const doc = await Submission.create({
        bookId,
        draftId: randomUUID(),
        fingerprint: randomUUID(),
        guestName: name,
        status,
        message: "A shared memory",
      });
      await Book.updateOne({ _id: bookId }, { $inc: { entriesCount: 1 } });
      return doc;
    }
    it("streams committed host changes, resumes by book and closes a revoked session", async () => {
      const b = await create(),
        other = await create("other-stream");
      const e = await entry(b.id);
      const path = "/books/" + b.id + "/submissions/stream";
      await request(app)
        .get("/api" + path)
        .expect(401);
      await call("get", path, outsider).expect(403);
      await call("get", path).set("Last-Event-ID", "invalid").expect(400);
      const server = app.listen(0, "127.0.0.1");
      await once(server, "listening");
      const url = "http://127.0.0.1:" + (server.address() as AddressInfo).port + "/api" + path;
      const disconnect = new AbortController();
      const signal = AbortSignal.any([disconnect.signal, AbortSignal.timeout(15000)]);
      async function connect(cursor?: string) {
        const response = await fetch(url, {
          headers: { Cookie: owner, ...(cursor && { "Last-Event-ID": cursor }) },
          signal,
        });
        expect(response.headers.get("content-type")).toContain("text/event-stream");
        const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        return {
          reader,
          async frame() {
            while (!buffer.includes("\n\n")) {
              const part = await reader.read();
              if (part.done) throw new Error("Stream closed before event");
              buffer += part.value;
            }
            const end = buffer.indexOf("\n\n"),
              frame = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            return {
              id: /^id: (.+)$/m.exec(frame)?.[1],
              name: /^event: (.+)$/m.exec(frame)?.[1],
              data: JSON.parse(/^data: (.+)$/m.exec(frame)![1]!),
            };
          },
        };
      }
      try {
        const first = await connect(),
          ready = await first.frame();
        expect(ready.name).toBe("ready");
        await call("post", "/submissions/" + e.id + "/add-to-book").expect(409);
        expect(await FeedEvent.countDocuments({ bookId: b.id })).toBe(0);
        await call("patch", "/submissions/" + e.id)
          .send({ status: "approved" })
          .expect(200);
        const updated = await first.frame();
        expect(updated).toMatchObject({
          name: "submission:updated",
          data: { id: e.id, status: "approved" },
        });
        expect(updated.data).not.toHaveProperty("fingerprint");
        await first.reader.cancel();
        await call("get", "/books/" + other.id + "/submissions/stream")
          .set("Last-Event-ID", updated.id!)
          .expect(400);
        await call("post", "/submissions/" + e.id + "/reaction").expect(200);
        const second = await connect(updated.id);
        expect(await second.frame()).toMatchObject({
          name: "reaction:updated",
          data: { reacted: true, id: e.id },
        });
        await second.reader.cancel();
        await FeedEvent.deleteMany({ bookId: b.id });
        const reset = await connect(ready.id);
        expect(await reset.frame()).toMatchObject({ name: "reset", data: { bookId: b.id } });
        await AuthSession.deleteMany({ userId: ownerId });
        expect((await reset.reader.read()).done).toBe(true);
      } finally {
        disconnect.abort();
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    }, 20000);
    it("checks ownership and validation before changing any rows, including mixed-book bulk input", async () => {
      const b = await create(),
        otherBook = await create("another-book");
      const own = await entry(b.id),
        foreign = await entry(otherBook.id);
      const feed = "/books/" + b.id + "/submissions",
        path = "/submissions/" + own._id;
      await call("get", feed, outsider).expect(403);
      await call("patch", path, outsider).send({ status: "approved" }).expect(403);
      for (const action of ["add-to-book", "reaction"])
        await call("post", path + "/" + action, outsider).expect(403);
      await call("delete", path + "/report", outsider).expect(403);
      await call("delete", path, outsider).expect(403);
      await call("post", feed + "/bulk", outsider)
        .send({ ids: [own.id], action: "approve" })
        .expect(403);
      await call("post", feed + "/bulk")
        .send({ ids: [own.id, foreign.id], action: "approve" })
        .expect(404);
      await call("post", feed + "/bulk")
        .send({ ids: [], action: "approve" })
        .expect(400);
      await call("patch", path).send({ status: "approved", bookId: otherBook.id }).expect(400);
      await call("get", feed + "?limit=101").expect(400);
      expect((await Submission.findById(own.id))?.status).toBe("pending");
      await call("delete", "/books/" + b.id).expect(204);
      await call("post", path + "/reaction").expect(404);
    });
    it("paginates tied timestamps and filters guest names, photos and full-book counts", async () => {
      const b = await create(),
        feed = "/books/" + b.id + "/submissions";
      const a = await entry(b.id, "pending", ""),
        second = await entry(b.id, "approved", "Mia");
      await entry(b.id, "rejected", "June");
      const tied = new Date();
      await Submission.updateMany(
        { bookId: b.id },
        { $set: { createdAt: tied } },
        { timestamps: false, overwriteImmutable: true },
      );
      await Submission.updateOne(
        { _id: a._id },
        { $set: { photoUrl: "/api/uploads/" + a.id + "/page" } },
      );
      const first = (await call("get", feed).query({ status: "all", limit: 1 }).expect(200)).body;
      await entry(b.id, "approved", "New arrival");
      const next = (
        await call("get", feed)
          .query({ status: "all", limit: 1, cursor: first.nextCursor })
          .expect(200)
      ).body;
      expect([first.items[0].id, next.items[0].id].sort()).toEqual([a.id, second.id].sort());
      expect(next.nextCursor).toBeNull();
      await call("get", feed).query({ status: "pending", cursor: first.nextCursor }).expect(400);
      const filtered = (
        await call("get", feed).query({ q: "NONYMOUS", withPhoto: true }).expect(200)
      ).body;
      expect(filtered.items.map((x: { id: string }) => x.id)).toEqual([a.id]);
      expect(filtered.counts).toEqual({
        pending: 1,
        approved: 2,
        rejected: 1,
        "in-book": 0,
        all: 3,
      });
      expect(filtered.items[0]).not.toHaveProperty("fingerprint");
      expect((await call("get", feed).query({ q: ".*" })).body.items).toEqual([]);
    });
    it("promotes exactly once, keeps approval private, and restores only the previously linked page", async () => {
      const b = await create(),
        e = await entry(b.id);
      const path = "/submissions/" + e.id;
      await call("post", "/books/" + b.id + "/publish").expect(200);
      await call("post", path + "/add-to-book").expect(409);
      await call("patch", path).send({ status: "approved" }).expect(200);
      expect((await publicGet(b.slug)).body.pages).toHaveLength(0);
      const attempts = await Promise.all([
        call("post", path + "/add-to-book"),
        call("post", path + "/add-to-book"),
      ]);
      expect(attempts.map((r) => r.status).sort()).toEqual([201, 409]);
      const page = attempts.find((r) => r.status === 201)!.body.page;
      expect(page).toMatchObject({ title: "From Guest", submissionId: e.id, body: e.message });
      expect((await publicGet(b.slug)).body.pages.map((p: { id: string }) => p.id)).toEqual([
        page.id,
      ]);
      const rejected = await call("patch", path).send({ status: "rejected" }).expect(200);
      expect(rejected.body.removedPageId).toBe(page.id);
      expect((await publicGet(b.slug)).body.pages).toEqual([]);
      await call("patch", path)
        .send({ status: "in-book", pageId: new Types.ObjectId().toString() })
        .expect(409);
      await call("patch", path).send({ status: "in-book", pageId: page.id }).expect(200);
      expect((await get(b.id)).pages[0].id).toBe(page.id);
      await call("delete", "/pages/" + page.id).expect(204);
      expect((await Submission.findById(e.id))?.status).toBe("approved");
      await call("post", path + "/add-to-book").expect(201);
      await call("delete", path).expect(204);
      expect(await get(b.id)).toMatchObject({ entries: 0, pages: [] });
      await call("delete", path).expect(404);
    });
    it("skips ineligible bulk items, allows undo only for a matching prior state, and supports later restore", async () => {
      const b = await create(),
        a = await entry(b.id),
        r = await entry(b.id, "rejected");
      const feed = "/books/" + b.id + "/submissions",
        path = "/submissions/" + a.id;
      let response = await call("post", feed + "/bulk")
        .send({ ids: [a.id, a.id, r.id], action: "approve" })
        .expect(200);
      expect(response.body.updated.map((x: { id: string }) => x.id)).toEqual([a.id]);
      await call("patch", path).send({ status: "pending" }).expect(200);
      response = await call("post", feed + "/bulk")
        .send({ ids: [r.id, a.id], action: "reject" })
        .expect(200);
      expect(response.body.updated).toHaveLength(1);
      await Submission.updateOne({ _id: a.id }, { $set: { undoUntil: new Date(0) } });
      await call("patch", path).send({ status: "pending" }).expect(409);
      await call("patch", path).send({ status: "approved" }).expect(200);
    });
    it("toggles host reactions atomically and resolves only reports for the target entry", async () => {
      const b = await create(),
        e = await entry(b.id),
        path = "/submissions/" + e.id;
      await BlockedGuest.create({ bookId: b.id, fingerprint: e.fingerprint });
      await Report.create([
        { bookId: b.id, submissionId: e._id, reason: "spam" },
        { bookId: b.id, reason: "privacy" },
      ]);
      const reactions = await Promise.all([
        call("post", path + "/reaction"),
        call("post", path + "/reaction"),
      ]);
      expect(reactions.map((r) => r.body.reactions).sort()).toEqual([0, 1]);
      const first = (await call("get", "/books/" + b.id + "/submissions")).body.items[0];
      expect(first).toMatchObject({
        guestBlocked: true,
        reacted: false,
        report: { reason: "spam", count: 1 },
      });
      await call("delete", path + "/report").expect(200);
      expect(await Report.countDocuments({ bookId: b.id, status: "kept" })).toBe(1);
      await Report.create({ bookId: b.id, submissionId: e._id, reason: "spam" });
      await call("patch", path).send({ status: "rejected" }).expect(200);
      await call("delete", path + "/report").expect(200);
      expect(await Report.countDocuments({ bookId: b.id, status: "removed" })).toBe(1);
      expect(
        await Report.countDocuments({ bookId: b.id, status: "open", submissionId: null }),
      ).toBe(1);
    });
  });
});
