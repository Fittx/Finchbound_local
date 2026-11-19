import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { CursorCodec } from "../src/utils/cursor.js";
import {
  createBookBody,
  updateBookBody,
  createPageBody,
  listPagesQuery,
  listBooksQuery,
  reorderBody,
  slugParams,
} from "../src/validators/books.js";
import { testConfig, testLogger } from "./helpers.js";
const id = "a".repeat(24),
  other = "b".repeat(24);
const page = { title: "Page", body: "Message" };
describe("books/pages validation and session boundaries", () => {
  it.each([
    { ...page, submissionId: id },
    { ...page, id },
    { ...page, bookId: id },
    { ...page, order: 0 },
    { ...page, editedAt: new Date().toISOString() },
    { ...page, image: "javascript:alert(1)" },
    { ...page, image: "data:image/svg+xml,evil" },
    { ...page, title: "a".repeat(61) },
    { ...page, body: "a".repeat(601) },
    { ...page, title: { $ne: null } },
  ])("rejects untrusted page input %j", (input) =>
    expect(createPageBody.safeParse(input).success).toBe(false),
  );
  it("normalizes and rejects reserved or malformed slugs", () => {
    expect(slugParams.parse({ slug: " MY-BOOK " }).slug).toBe("my-book");
    for (const slug of ["api", "account", "update", "a/b", "a--b", "-book", "book-"])
      expect(slugParams.safeParse({ slug }).success).toBe(false);
  });
  it("rejects privileged fields, kind changes and empty patches", () => {
    expect(updateBookBody.safeParse({ kind: "event" }).success).toBe(false);
    expect(updateBookBody.safeParse({ ownerId: id }).success).toBe(false);
    expect(updateBookBody.safeParse({ version: 20 }).success).toBe(false);
    expect(updateBookBody.safeParse({}).success).toBe(false);
    expect(createBookBody.safeParse({ title: "only" }).success).toBe(false);
  });
  it("requires one distinct anchor and an integer version", () => {
    expect(reorderBody.parse({ pageId: id, beforeId: other, expectedVersion: 0 })).toHaveProperty(
      "beforeId",
      other,
    );
    for (const input of [
      { pageId: id, expectedVersion: 0 },
      { pageId: id, beforeId: id, expectedVersion: 0 },
      { pageId: id, beforeId: other, afterId: other, expectedVersion: 0 },
      { pageId: id, beforeId: other, expectedVersion: -1 },
      { pageId: id, beforeId: other },
    ])
      expect(reorderBody.safeParse(input).success).toBe(false);
  });
  it("validates pagination and treats false as false", () => {
    expect(listPagesQuery.parse({ withPhoto: "false" }).withPhoto).toBe(false);
    for (const input of [{ limit: 101 }, { limit: 0 }, { q: { $ne: null } }, { injected: true }])
      expect(listBooksQuery.safeParse(input).success).toBe(false);
    expect(listPagesQuery.safeParse({ withPhoto: "yes" }).success).toBe(false);
  });
  it("signs cursors and binds them to the owner, filter, book and version scope", () => {
    const codec = new CursorCodec(testConfig().JWT_SECRET);
    const token = codec.encode({ scope: "owner/book/filter/version", id, key: 2 });
    expect(codec.decode(token, "owner/book/filter/version")).toEqual({
      scope: "owner/book/filter/version",
      id,
      key: 2,
    });
    expect(() => codec.decode(token, "other-book")).toThrow();
    const [data, signature] = token.split(".");
    expect(() =>
      codec.decode(data!.slice(0, -1) + "x." + signature, "owner/book/filter/version"),
    ).toThrow();
    expect(() =>
      new CursorCodec("another-secret").decode(token, "owner/book/filter/version"),
    ).toThrow();
  });
  it("protects every host endpoint before any database work", async () => {
    const app = createApp({
      config: testConfig(),
      isDatabaseReady: () => true,
      logger: testLogger(),
    });
    for (const [method, path] of [
      ["get", "/books"],
      ["post", "/books"],
      ["get", `/books/${id}/submissions`],
      ["post", `/books/${id}/submissions/bulk`],
      ["patch", `/submissions/${id}`],
      ["delete", `/submissions/${id}`],
      ["post", `/submissions/${id}/add-to-book`],
      ["post", `/submissions/${id}/reaction`],
      ["delete", `/submissions/${id}/report`],
      ["get", "/books/check-slug/test"],
      ["get", `/books/${id}`],
      ["patch", `/books/${id}`],
      ["delete", `/books/${id}`],
      ["post", `/books/${id}/publish`],
      ["post", `/books/${id}/restore`],
      ["get", `/books/${id}/pages`],
      ["post", `/books/${id}/pages`],
      ["put", `/books/${id}/pages/order`],
      ["patch", `/pages/${id}`],
      ["delete", `/pages/${id}`],
    ] as const) {
      const response = await request(app)
        [method]("/api" + path)
        .set("Origin", testConfig().CLIENT_URL)
        .send({})
        .expect(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    }
  });
});
