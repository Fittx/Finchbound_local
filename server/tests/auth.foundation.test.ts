import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { testConfig, testLogger } from "./helpers.js";
import {
  newPassword,
  registerBody,
  loginBody,
  verifyBody,
  emailBody,
} from "../src/validators/auth.js";
import { readSessionCookie, setSessionCookie, clearSessionCookie } from "../src/utils/cookies.js";
import { authorizeOwner, requireOwner } from "../src/middleware/requireOwner.js";
import { errorHandler } from "../src/middleware/errorHandler.js";
import { hashCode, makeCode } from "../src/services/tokens.js";
import { createAuthMailer } from "../src/services/mail.js";
import type { AuthPrincipal } from "../src/services/auth.js";

const origin = "http://127.0.0.1:5173";
describe("auth input and HTTP boundaries", () => {
  it.each([
    "host@yahoo.com",
    "host@outlook.com",
    "host@company.com",
    "host@googlemail.com",
    "host@gmail.com.evil.test",
    "host@mail.gmail.com",
    "host@gmail.com@evil.test",
  ])("rejects non-Gmail accounts consistently: %s", (address) => {
    expect(
      registerBody.safeParse({ name: "Host", email: address, password: "Password123" }).success,
    ).toBe(false);
    expect(
      loginBody.safeParse({ email: address, password: "Password123", remember: false }).success,
    ).toBe(false);
    expect(emailBody.safeParse({ email: address }).success).toBe(false);
    expect(verifyBody.safeParse({ email: address, code: "123456" }).success).toBe(false);
  });
  it.each([
    { name: "", email: "host@gmail.com", password: "Password123" },
    { name: "Host", email: { $ne: null }, password: "Password123" },
    { name: "Host", email: "host@gmail.com", password: "password" },
    { name: "Host", email: "host@gmail.com", password: "Password123", plan: "unlimited" },
    { name: "Host", email: "host@gmail.com", password: "Password123", emailVerified: true },
    { name: "Host", email: "host@gmail.com", password: "Password123", ownerId: "someone" },
  ])("rejects invalid input and privilege fields", (body) => {
    expect(registerBody.safeParse(body).success).toBe(false);
  });
  it("normalizes email before database lookup", () => {
    expect(
      loginBody.parse({ email: " HOST@Gmail.com ", password: "Password123", remember: false })
        .email,
    ).toBe("host@gmail.com");
  });
  it("checks bcrypt's UTF-8 byte boundary and OTP format", () => {
    expect(newPassword.safeParse("a1" + "é".repeat(35)).success).toBe(true);
    expect(newPassword.safeParse("a1" + "é".repeat(36)).success).toBe(false);
    expect(verifyBody.safeParse({ email: "host@gmail.com", code: "12345x" }).success).toBe(false);
  });
  it("makes fixed-length codes and keyed email-specific hashes", () => {
    const code = makeCode();
    expect(code).toMatch(/^\d{6}$/);
    expect(hashCode(testConfig(), "a@gmail.com", code)).not.toBe(
      hashCode(testConfig(), "b@gmail.com", code),
    );
    expect(hashCode(testConfig(), "a@gmail.com", code)).toMatch(/^[a-f0-9]{64}$/);
  });
  it("does not authenticate a browser cache or a forged cookie", async () => {
    const app = createApp({
      config: testConfig(),
      isDatabaseReady: () => true,
      logger: testLogger(),
    });
    await request(app).get("/api/auth/me").expect(401);
    await request(app).get("/api/auth/me").set("Cookie", "fb-session=forged").expect(401);
  });
  it("validates before database access and preserves the error envelope", async () => {
    const app = createApp({
      config: testConfig(),
      isDatabaseReady: () => true,
      logger: testLogger(),
    });
    const response = await request(app)
      .post("/api/auth/register")
      .set("Origin", origin)
      .send({ name: "Host", email: { $ne: null }, password: "Password123" })
      .expect(400);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
  });
  it("rate limits auth independently and checks write Origins", async () => {
    const app = createApp({
      config: testConfig({ AUTH_RATE_LIMIT_MAX_REQUESTS: "5" }),
      isDatabaseReady: () => true,
      logger: testLogger(),
    });
    await request(app).post("/api/auth/logout").expect(403);
    for (let n = 0; n < 5; n++)
      await request(app).post("/api/auth/login").set("Origin", origin).send({}).expect(400);
    const response = await request(app)
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({})
      .expect(429);
    expect(response.body.error.code).toBe("RATE_LIMITED");
    await request(app).post("/api/auth/logout").set("Origin", origin).send({}).expect(204);
  });
  it("fails closed without SMTP and never sends a placeholder code", () => {
    expect(() => createAuthMailer(testConfig()).assertConfigured()).toThrow(
      "Email delivery is not configured",
    );
  });
});

describe("cookie and ownership boundaries", () => {
  it("rejects malformed, oversized and duplicate cookies", () => {
    const config = testConfig();
    expect(readSessionCookie("fb-session=abc; other=ok", config)).toBe("abc");
    expect(readSessionCookie("fb-session=%XX", config)).toBeUndefined();
    expect(readSessionCookie("fb-session=a; fb-session=b", config)).toBeUndefined();
    expect(readSessionCookie("fb-session=" + "a".repeat(4097), config)).toBeUndefined();
  });
  it("sets secure production cookies and persistent cookies only when requested", async () => {
    const config = { ...testConfig(), NODE_ENV: "production" as const };
    const app = express();
    app.get("/session", (_req, res) => {
      setSessionCookie(res, config, "token", false);
      res.end();
    });
    app.get("/remember", (_req, res) => {
      setSessionCookie(res, config, "token", true);
      res.end();
    });
    app.get("/clear", (_req, res) => {
      clearSessionCookie(res, config);
      res.end();
    });
    const session = (await request(app).get("/session")).headers["set-cookie"]![0]!;
    expect(session).toContain("HttpOnly");
    expect(session).toContain("Secure");
    expect(session).toContain("SameSite=Lax");
    expect(session).toContain("Path=/");
    expect(session).not.toContain("Max-Age");
    const remembered = (await request(app).get("/remember")).headers["set-cookie"]![0]!;
    expect(remembered).toContain("Max-Age=2592000");
    const cleared = (await request(app).get("/clear")).headers["set-cookie"]![0]!;
    expect(cleared).toContain("HttpOnly");
    expect(cleared).toContain("SameSite=Lax");
  });
  it("uses the persisted owner and rejects cross-account access", async () => {
    const auth: AuthPrincipal = {
      userId: "a".repeat(24),
      authVersion: 0,
      sessionId: "session",
      user: {
        id: "a".repeat(24),
        name: "Host",
        email: "host@gmail.com",
        plan: "Unlimited books",
      },
    };
    expect(() => authorizeOwner(auth, auth.userId)).not.toThrow();
    expect(() => authorizeOwner(auth, "b".repeat(24))).toThrow();
    const app = express();
    app.use((_req, res, next) => {
      res.locals.auth = auth;
      next();
    });
    app.get(
      "/own",
      requireOwner(async () => auth.userId),
      (_req, res) => res.sendStatus(204),
    );
    app.get(
      "/other",
      requireOwner(async () => "b".repeat(24)),
      (_req, res) => res.sendStatus(204),
    );
    app.get(
      "/missing",
      requireOwner(async () => null),
      (_req, res) => res.sendStatus(204),
    );
    app.use(errorHandler(testLogger()));
    await request(app).get("/own").expect(204);
    await request(app).get("/other").expect(403);
    await request(app).get("/missing").expect(404);
  });
});
