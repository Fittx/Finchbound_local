import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import request, { type Response } from "supertest";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { initializeAuthModels } from "../src/models/auth.js";
import { User } from "../src/models/User.js";
import { Otp } from "../src/models/Otp.js";
import { AuthSession } from "../src/models/AuthSession.js";
import type { AuthMailer } from "../src/services/mail.js";
import { comparePassword } from "../src/services/password.js";
import { signSession, verifySession } from "../src/services/tokens.js";
import { testConfig, testLogger } from "./helpers.js";

const uri = process.env.TEST_MONGODB_URI;
const databaseName = "finchbound_auth_test_" + randomUUID().replaceAll("-", "");
const config = testConfig({
  BCRYPT_ROUNDS: "10",
  RATE_LIMIT_MAX_REQUESTS: "10000",
  AUTH_RATE_LIMIT_MAX_REQUESTS: "300",
});
const origin = config.CLIENT_URL;
const email = "host@gmail.com",
  password = "Password123";
const inbox: { email: string; code?: string; url?: string }[] = [];
const mailer: AuthMailer = {
  assertConfigured() {},
  async sendVerification(email, code) {
    inbox.push({ email, code });
  },
  async sendPasswordReset(email, url) {
    inbox.push({ email, url });
  },
};
const app = () => createApp({ config, isDatabaseReady: () => true, mailer, logger: testLogger() });
let api = app();
const post = (path: string, body: object = {}) =>
  request(api)
    .post("/api/auth/" + path)
    .set("Origin", origin)
    .send(body);
const cookie = (response: Response) =>
  (response.headers["set-cookie"] as unknown as string[])
    .map((value) => value.split(";")[0])
    .join("; ");
const lastCode = (address = email) =>
  inbox.filter((mail) => mail.email === address && mail.code).at(-1)!.code!;
const lastToken = () =>
  decodeURIComponent(
    inbox
      .filter((mail) => mail.url)
      .at(-1)!
      .url!.split("?token=")[1]!,
  );
async function register(address = email) {
  return post("register", { name: "Host", email: address, password }).expect(201);
}
async function verifiedHost() {
  await register();
  return post("verify-email", { email, code: lastCode() }).expect(200);
}
const integration = describe.skipIf(!uri);
integration("auth with real MongoDB transactions, bcrypt and JWT", () => {
  beforeAll(async () => {
    // Never read server/.env or connect to its application database.
    await import("bcrypt");
    await import("jsonwebtoken");
    await mongoose.connect(uri!, { dbName: databaseName, serverSelectionTimeoutMS: 5000 });
    if (mongoose.connection.name !== databaseName)
      throw new Error("Refusing unexpected test database");
    const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== "isdbgrid")
      throw new Error("Auth tests require transactions");
    await initializeAuthModels();
  }, 20000);
  beforeEach(async () => {
    if (mongoose.connection.name !== databaseName)
      throw new Error("Refusing unexpected test database");
    await Promise.all([User.deleteMany({}), Otp.deleteMany({}), AuthSession.deleteMany({})]);
    inbox.length = 0;
    api = app();
  });
  afterAll(async () => {
    if (
      mongoose.connection.readyState === 1 &&
      mongoose.connection.name === databaseName &&
      databaseName.startsWith("finchbound_auth_test_")
    )
      await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it("keeps the old login until the signed-in owner proves the new email, then rotates the session", async () => {
    const oldCookie = cookie(await verifiedHost()),
      address = "new-host@gmail.com";
    const changed = await request(api)
      .patch("/api/account")
      .set("Origin", origin)
      .set("Cookie", oldCookie)
      .send({ name: "New name", email: address })
      .expect(200);
    expect(changed.body.user.email).toBe(email);
    const proof = { email: address, code: lastCode(address) };
    await post("verify-email", proof).expect(410);
    const verified = await post("verify-email", proof).set("Cookie", oldCookie).expect(200);
    expect(verified.body.user.email).toBe(address);
    await request(api).get("/api/account").set("Cookie", oldCookie).expect(401);
    await request(api).get("/api/account").set("Cookie", cookie(verified)).expect(200);
  });
  it("registers, verifies, signs in and retains server sessions across app instances", async () => {
    const created = await register(" HOST@GMAIL.COM ");
    expect(created.body).toEqual({ email });
    const stored = await User.findOne({ email }).select("+passwordHash");
    expect(stored!.emailVerified).toBe(false);
    expect(stored!.passwordHash).not.toBe(password);
    expect(await comparePassword(password, stored!.passwordHash)).toBe(true);
    const rawOtp = await Otp.findOne({ email }).select("+codeHash");
    expect(rawOtp!.codeHash).not.toBe(lastCode());
    await post("login", { email, password, remember: false }).expect(401);
    const verified = await post("verify-email", { email, code: lastCode() }).expect(200);
    expect(Object.keys(verified.body.user).sort()).toEqual(["email", "id", "name", "plan"]);
    expect(verified.body).not.toHaveProperty("token");
    const signed = await post("login", { email, password, remember: true }).expect(200);
    expect(signed.headers["set-cookie"]![0]).toContain("Max-Age=2592000");
    const me = await request(app()).get("/api/auth/me").set("Cookie", cookie(signed)).expect(200);
    expect(me.body.user.email).toBe(email);
    expect(await User.countDocuments()).toBe(1);
  });

  it("enforces unique normalized emails under concurrent registration", async () => {
    const results = await Promise.all([
      post("register", { name: "Host", email, password }),
      post("register", { name: "Other", email: "HOST@gmail.com", password }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await User.countDocuments({ email })).toBe(1);
  });

  it("distinguishes wrong/expired codes and commits limited attempts", async () => {
    await register();
    const wrong = lastCode() === "000000" ? "111111" : "000000";
    for (let i = 0; i < 4; i++) {
      const response = await post("verify-email", { email, code: wrong }).expect(400);
      expect(response.body.error.code).toBe("INVALID_CODE");
    }
    await post("verify-email", { email, code: wrong }).expect(429);
    expect((await Otp.findOne({ email }))!.attempts).toBe(5);
    await post("verify-email", { email, code: lastCode() }).expect(429);
    await Otp.updateOne({ email }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await post("verify-email", { email, code: lastCode() }).expect(410);
    expect(expired.body.error.code).toBe("CODE_EXPIRED");
    expect((await User.findOne({ email }))!.emailVerified).toBe(false);
  });

  it("binds codes to their email and consumes a successful code once", async () => {
    await register();
    await post("verify-email", { email: "other@gmail.com", code: lastCode() }).expect(410);
    const code = lastCode();
    const responses = await Promise.all([
      post("verify-email", { email, code }),
      post("verify-email", { email, code }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 410]);
    expect(await AuthSession.countDocuments()).toBe(1);
  });

  it("enforces the resend cooldown for known and unknown accounts", async () => {
    await register();
    await post("resend-code", { email }).expect(429);
    await post("resend-code", { email: "absent@gmail.com" }).expect(200, { ok: true });
    await post("resend-code", { email: "absent@gmail.com" }).expect(429);
    await Otp.updateOne(
      { email, purpose: "host-email" },
      { $set: { lastSentAt: new Date(Date.now() - 31000) } },
    );
    await post("resend-code", { email }).expect(200, { ok: true });
    await post("verify-email", { email, code: lastCode() }).expect(200);
  });

  it("persists the fifth-attempt lock and clears it after expiration", async () => {
    await verifiedHost();
    for (let i = 0; i < 4; i++)
      await post("login", { email, password: "Wrong123", remember: false }).expect(401);
    const locked = await post("login", { email, password: "Wrong123", remember: false }).expect(
      423,
    );
    expect(locked.body.error.code).toBe("ACCOUNT_LOCKED");
    api = app();
    await post("login", { email, password, remember: false }).expect(423);
    expect((await User.findOne({ email }))!.failedLogins).toBe(5);
    await User.updateOne({ email }, { $set: { lockedUntil: new Date(Date.now() - 1) } });
    await post("login", { email, password, remember: false }).expect(200);
    expect((await User.findOne({ email }))!.failedLogins).toBe(0);
  });

  it("returns the same forgot-password response and cooldown for unknown addresses", async () => {
    await verifiedHost();
    const known = await post("forgot-password", { email }).expect(200);
    const unknown = await post("forgot-password", { email: "absent@gmail.com" }).expect(200);
    expect(known.body).toEqual(unknown.body);
    expect(known.body).toEqual({ ok: true });
    expect(known.body).not.toHaveProperty("token");
    await post("forgot-password", { email }).expect(429);
    await post("forgot-password", { email: "absent@gmail.com" }).expect(429);
    expect(inbox.filter((mail) => mail.url).every((mail) => mail.email === email)).toBe(true);
    expect(inbox.find((mail) => mail.url)!.url).toContain(origin + "/reset-password?token=");
  });

  it("resets once, revokes all sessions, changes credentials and rejects replay", async () => {
    const original = await verifiedHost();
    const second = await post("login", { email, password, remember: false }).expect(200);
    await post("forgot-password", { email }).expect(200);
    const token = lastToken();
    const challenge = await Otp.findOne({ email, purpose: "password-reset" }).select("+codeHash");
    expect(challenge!.codeHash).not.toBe(token);
    await request(api)
      .get("/api/auth/reset-password/" + token)
      .expect(200, { ok: true });
    const responses = await Promise.all([
      post("reset-password", { token, password: "NewPassword123" }),
      post("reset-password", { token, password: "NewPassword123" }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 410]);
    await request(api).get("/api/auth/me").set("Cookie", cookie(original)).expect(401);
    await request(api).get("/api/auth/me").set("Cookie", cookie(second)).expect(401);
    await post("login", { email, password, remember: false }).expect(401);
    await post("login", { email, password: "NewPassword123", remember: false }).expect(200);
    await post("reset-password", { token, password: "AnotherPassword123" }).expect(410);
    await request(api).get("/api/auth/reset-password/unknown").expect(410);
  });

  it("rejects expired reset tokens without changing the password", async () => {
    await verifiedHost();
    await post("forgot-password", { email }).expect(200);
    const token = lastToken();
    await Otp.updateOne(
      { email, purpose: "password-reset" },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    await post("reset-password", { token, password: "NewPassword123" }).expect(410);
    await post("login", { email, password, remember: false }).expect(200);
  });

  it("revokes only the logged-out session and clears its cookie", async () => {
    const first = await verifiedHost();
    const other = await post("login", { email, password, remember: false }).expect(200);
    const out = await post("logout").set("Cookie", cookie(first)).expect(204);
    expect(out.headers["set-cookie"]![0]).toContain("Expires=Thu, 01 Jan 1970");
    await request(api).get("/api/auth/me").set("Cookie", cookie(first)).expect(401);
    await request(api).get("/api/auth/me").set("Cookie", cookie(other)).expect(200);
    await post("logout").expect(204);
  });

  it("rejects tampered, expired and wrong-purpose JWTs", async () => {
    const signed = await verifiedHost();
    const pair = cookie(signed);
    await request(api)
      .get("/api/auth/me")
      .set("Cookie", pair.slice(0, -5) + "xxxxx")
      .expect(401);
    const user = await User.findOne({ email });
    const expired = await signSession(config, user!._id.toString(), 0, randomUUID(), -1);
    await expect(verifySession(config, expired)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const { default: jwt } = await import("jsonwebtoken");
    const wrong = jwt.sign({ purpose: "guest-upload", version: 0 }, config.JWT_SECRET, {
      algorithm: "HS256",
      issuer: config.JWT_ISSUER,
      audience: config.JWT_AUDIENCE,
      subject: user!._id.toString(),
      jwtid: randomUUID(),
      expiresIn: 60,
    });
    await expect(verifySession(config, wrong)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("does not create a user when email delivery is unconfigured", async () => {
    const unconfigured = createApp({ config, isDatabaseReady: () => true, logger: testLogger() });
    await request(unconfigured)
      .post("/api/auth/register")
      .set("Origin", origin)
      .send({ name: "Host", email, password })
      .expect(500);
    expect(await User.countDocuments()).toBe(0);
  });
});
