import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.js";
import {
  guestCodeBody,
  guestConfirmBody,
  guestEntryBody,
  reportBody,
  blockBody,
} from "../src/validators/guests.js";
import {
  guestCookieName,
  guestDevice,
  readGuestCookie,
  guestEmailToken,
  verifyGuestEmailToken,
} from "../src/services/guestSecurity.js";
import { signSession } from "../src/services/tokens.js";
import { signUploadToken } from "../src/services/uploadTokens.js";
import { testConfig, testLogger } from "./helpers.js";
const config = testConfig(),
  id = "a".repeat(24);
describe("guest validation and credentials", () => {
  it("normalizes guest emails without extending the Gmail-only host restriction", () => {
    expect(guestCodeBody.parse({ email: " Guest@Example.org " }).email).toBe("guest@example.org");
    expect(guestCodeBody.safeParse({ email: { $ne: null } }).success).toBe(false);
    expect(guestConfirmBody.safeParse({ email: "guest@example.org", code: "12x456" }).success).toBe(
      false,
    );
  });
  it.each([
    { ownerId: id },
    { bookId: id },
    { status: "approved" },
    { emailVerified: true },
    { draftId: randomUUID() },
    { name: "a".repeat(61) },
    { message: "a".repeat(601) },
    { photo: "https://example.org/photo.jpg" },
    { name: { $ne: null } },
  ])("rejects untrusted guest input %j", (patch) => {
    expect(
      guestEntryBody.safeParse({
        name: "Guest",
        email: "",
        message: "Hi",
        captcha: "proof",
        ...patch,
      }).success,
    ).toBe(false);
  });
  it("validates report reasons, lengths and optional targets", () => {
    expect(
      reportBody.parse({ reason: "privacy", details: "", submissionId: id }).submissionId,
    ).toBe(id);
    for (const patch of [
      { reason: "invalid" },
      { details: "a".repeat(301) },
      { bookId: id },
      { submissionId: "bad-id" },
    ])
      expect(reportBody.safeParse({ reason: "privacy", details: "", ...patch }).success).toBe(
        false,
      );
    expect(blockBody.safeParse({ submissionId: id, email: "victim@example.org" }).success).toBe(
      false,
    );
  });
  it("uses secure prefixed guest cookies and stable signed device identities", async () => {
    const production = {
      ...config,
      NODE_ENV: "production" as const,
      JWT_COOKIE_NAME: "__Host-finchbound",
    };
    const app = express();
    app.get("/", (req, res) =>
      res.json({ fingerprint: guestDevice(production, req.get("cookie"), res) }),
    );
    const first = await request(app).get("/").expect(200);
    const cookie = first.headers["set-cookie"]![0]!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    const again = await request(app).get("/").set("Cookie", cookie.split(";")[0]!).expect(200);
    expect(again.body.fingerprint).toBe(first.body.fingerprint);
    expect(again.headers["set-cookie"]).toBeUndefined();
    const forged = await request(app)
      .get("/")
      .set("Cookie", production.JWT_COOKIE_NAME + "-guest-device=forged")
      .expect(200);
    expect(forged.body.fingerprint).not.toBe(first.body.fingerprint);
    expect(guestCookieName(config, id)).toContain(id);
    expect(readGuestCookie(config, "x=a; x=b", "x")).toBeUndefined();
  });
  it("separates guest email verification, upload and host sessions", async () => {
    const value = {
      purpose: "guest-email" as const,
      email: "guest@example.org",
      bookId: id,
      draftId: randomUUID(),
      jti: randomUUID(),
    };
    const token = guestEmailToken(config, value, new Date(Date.now() + 600000));
    expect(verifyGuestEmailToken(config, token)).toMatchObject(value);
    expect(() =>
      verifyGuestEmailToken(
        config,
        signUploadToken(config, { ...value, purpose: "guest-captcha" }),
      ),
    ).toThrow();
    expect(() => verifyGuestEmailToken(config, undefined)).toThrow();
    const session = await signSession(config, id, 0, randomUUID(), 600);
    expect(() => verifyGuestEmailToken(config, session)).toThrow();
  });
  it("rejects unauthenticated blocking and verification without CAPTCHA before DB work", async () => {
    const app = createApp({ config, isDatabaseReady: () => true, logger: testLogger() });
    await request(app)
      .post(`/api/books/${id}/blocked-guests`)
      .set("Origin", config.CLIENT_URL)
      .send({ submissionId: id })
      .expect(401);
    for (const path of ["verify-email", "verify-email/confirm"]) {
      const response = await request(app)
        .post(`/api/public/books/event/${path}`)
        .set("Origin", config.CLIENT_URL)
        .send({
          email: "guest@example.org",
          ...(path.endsWith("confirm") ? { code: "123456" } : {}),
        })
        .expect(400);
      expect(response.body.error.code).toBe("CAPTCHA_FAILED");
    }
    await request(app)
      .post("/api/public/books/event/reports")
      .send({ reason: "spam", details: "" })
      .expect(403);
    await request(app)
      .post("/api/public/books/event/submissions")
      .set("Origin", config.CLIENT_URL)
      .send({ name: "Guest", email: "", message: "Hello", captcha: "proof", status: "approved" })
      .expect(400);
  });
});
