import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { ConfigurationError } from "../src/config/env.js";
import { isGuestQuotaPath } from "../src/middleware/rateLimit.js";
import { scaledGuestLimit } from "../src/services/guestLimits.js";
import { roleFor } from "../src/services/auth.js";
import { createBookBody, updateBookBody } from "../src/validators/books.js";
import { platformReportBody, adminReportsQuery } from "../src/validators/admin.js";
import { LIMITS } from "../../shared/constants.js";
import { testConfig, testLogger } from "./helpers.js";

const origin = "http://127.0.0.1:5173";
const id = "a".repeat(24);
const app = (patch: Record<string, string> = {}) =>
  createApp({ config: testConfig(patch), isDatabaseReady: () => true, logger: testLogger() });
const theme = {
  background: "#ffffff",
  grid: "#eeeeee",
  cover: "#c92a37",
  accent: "#f4a261",
  text: "#2b2d42",
  header: "#2b2d42",
};
const book = {
  title: "Event",
  slug: "event",
  kind: "event",
  visibility: "link",
  preset: "crimson",
  theme,
  font: "hand",
  lines: true,
  access: "name",
  photoRequired: false,
  messageRequired: true,
};

describe("admin configuration", () => {
  it("parses ADMIN_EMAILS into a lowercase list and defaults to nobody", () => {
    expect(testConfig().ADMIN_EMAILS).toEqual([]);
    expect(testConfig({ ADMIN_EMAILS: "" }).ADMIN_EMAILS).toEqual([]);
    expect(
      testConfig({ ADMIN_EMAILS: " Boss@Gmail.com, second@gmail.com ," }).ADMIN_EMAILS,
    ).toEqual(["boss@gmail.com", "second@gmail.com"]);
  });
  it("rejects malformed admin emails at startup without echoing them", () => {
    expect(() => testConfig({ ADMIN_EMAILS: "not-an-email" })).toThrow(ConfigurationError);
    try {
      testConfig({ ADMIN_EMAILS: "not-an-email" });
    } catch (error) {
      expect((error as Error).message).not.toContain("not-an-email");
    }
  });
  it("derives the role from configuration only", () => {
    const config = testConfig({ ADMIN_EMAILS: "boss@gmail.com" });
    expect(roleFor(config, "boss@gmail.com")).toBe("admin");
    expect(roleFor(config, "BOSS@gmail.com")).toBe("admin");
    expect(roleFor(config, "host@gmail.com")).toBe("host");
    expect(roleFor(testConfig(), "boss@gmail.com")).toBe("host");
  });
});

describe("admin and platform report routes", () => {
  it.each([
    ["get", "/api/admin/reports"],
    ["post", `/api/admin/reports/${id}/dismiss`],
    ["post", `/api/admin/books/${id}/unpublish`],
    ["delete", `/api/admin/submissions/${id}`],
  ] as const)("requires a session for %s %s", async (method, path) => {
    const response = await request(app())[method](path).set("Origin", origin).expect(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });
  it("validates public platform reports before touching the database", async () => {
    for (const body of [
      {},
      { reason: "invalid", details: "" },
      { reason: "spam", details: "x".repeat(LIMITS.reportDetails + 1) },
      { reason: "spam", details: "", submissionId: "nope" },
      { reason: "spam", details: "", bookId: id },
    ]) {
      const response = await request(app())
        .post("/api/public/books/some-book/platform-reports")
        .set("Origin", origin)
        .send(body)
        .expect(400);
      expect(response.body.error.code).toBe("VALIDATION_FAILED");
    }
  });
  it("validates admin list filters", () => {
    expect(adminReportsQuery.parse({}).status).toBe("open");
    expect(adminReportsQuery.safeParse({ status: "deleted" }).success).toBe(false);
    expect(adminReportsQuery.safeParse({ cursor: "x" }).success).toBe(false);
    expect(platformReportBody.parse({ reason: "privacy", details: " a " }).details).toBe("a");
  });
});

describe("expected guest count", () => {
  it("accepts a whole number in range when creating or updating a book", () => {
    expect(createBookBody.parse({ ...book, expectedGuests: 250 }).expectedGuests).toBe(250);
    expect(createBookBody.parse(book).expectedGuests).toBeUndefined();
    expect(updateBookBody.parse({ expectedGuests: 1 }).expectedGuests).toBe(1);
    for (const value of [0, -1, 1.5, LIMITS.expectedGuestsMax + 1, "100"])
      expect(createBookBody.safeParse({ ...book, expectedGuests: value }).success).toBe(false);
  });
  it("scales per-book limits with the guest count and never drops below the base limit", () => {
    expect(scaledGuestLimit(120, 10, 3)).toBe(120);
    expect(scaledGuestLimit(120, 500, 3)).toBe(1500);
    expect(scaledGuestLimit(120, undefined, 1)).toBe(Math.max(120, LIMITS.expectedGuestsDefault));
    expect(scaledGuestLimit(5, 1_000_000, 1)).toBe(LIMITS.expectedGuestsMax);
    expect(scaledGuestLimit(5, 0, 1)).toBe(5);
  });
  it("exempts only guest endpoints with their own quotas from the shared IP limiter", () => {
    for (const path of [
      "/public/books/our-day/guest",
      "/public/books/our-day/verify-email",
      "/public/books/our-day/verify-email/confirm",
      "/public/books/our-day/submissions",
      "/public/books/our-day/reports",
      "/public/captcha",
    ])
      expect(isGuestQuotaPath(path)).toBe(true);
    for (const path of [
      "/public/books/our-day",
      "/public/books/our-day/feedback",
      "/public/books/our-day/platform-reports",
      "/auth/login",
      "/books",
      "/public/books/a/b/guest",
      "/uploads/image",
    ])
      expect(isGuestQuotaPath(path)).toBe(false);
  });
  it("still applies the shared IP limiter to host routes", async () => {
    const limited = app({ RATE_LIMIT_MAX_REQUESTS: "1" });
    await request(limited).get("/api/health").expect(200);
    await request(limited).get("/api/health").expect(429);
  });
});
