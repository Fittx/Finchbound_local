import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { testConfig, testLogger } from "./helpers.js";

const app = (patch: Record<string, string> = {}, ready = true) =>
  createApp({ config: testConfig(patch), isDatabaseReady: () => ready, logger: testLogger() });
const origin = "http://127.0.0.1:5173";

describe("HTTP foundation", () => {
  it("returns readiness only when the database is available", async () => {
    await request(app()).get("/api/health").expect(200, { ok: true });
    const unavailable = await request(app({}, false)).get("/api/health").expect(503);
    expect(unavailable.body.error.code).toBe("SERVER");
  });
  it("returns security headers and never exposes the framework", async () => {
    const response = await request(app()).get("/api/health").expect(200);
    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers["content-security-policy"]).toBeDefined();
  });
  it("allows exactly the configured CORS origin with credentials", async () => {
    const allowed = await request(app()).get("/api/health").set("Origin", origin).expect(200);
    expect(allowed.headers["access-control-allow-origin"]).toBe(origin);
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");
    const rejected = await request(app())
      .get("/api/health")
      .set("Origin", origin + ".evil.invalid")
      .expect(403);
    expect(rejected.body.error.code).toBe("FORBIDDEN");
    expect(rejected.headers["access-control-allow-origin"]).toBeUndefined();
  });
  it("supports credentialed preflight without inventing domain endpoints", async () => {
    await request(app())
      .options("/api/account")
      .set("Origin", origin)
      .set("Access-Control-Request-Method", "PATCH")
      .expect(204);
  });
  it.each(["post", "patch", "put", "delete"] as const)(
    "rejects an unsafe %s without a trusted Origin",
    async (method) => {
      const response = await request(app())[method]("/api/unknown").expect(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
      await request(app())[method]("/api/unknown").set("Origin", origin).expect(404);
    },
  );
  it("rejects malformed and oversized JSON with the shared error envelope", async () => {
    const malformed = await request(app())
      .post("/api/unknown")
      .set("Origin", origin)
      .set("Content-Type", "application/json")
      .send('{"incomplete":')
      .expect(400);
    expect(malformed.body.error.code).toBe("VALIDATION_FAILED");
    const oversized = await request(app({ REQUEST_BODY_LIMIT_BYTES: "1024" }))
      .post("/api/unknown")
      .set("Origin", origin)
      .send({ text: "x".repeat(2048) })
      .expect(413);
    expect(oversized.body.error.code).toBe("FILE_TOO_LARGE");
  });
  it("rejects unexpected health query parameters, including operator-shaped inputs", async () => {
    const response = await request(app()).get("/api/health?role[$ne]=user").expect(400);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
    expect(response.body.error.fields).toBeDefined();
  });
  it("rejects unsupported request encodings", async () => {
    const response = await request(app())
      .post("/api/unknown")
      .set("Origin", origin)
      .set("Content-Type", "application/json; charset=iso-8859-1")
      .send("{}")
      .expect(415);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
  });
  it("returns JSON for unknown paths without echoing request content", async () => {
    const response = await request(app()).get("/api/not-real").expect(404);
    expect(response.body).toEqual({
      error: { code: "NOT_FOUND", message: "That resource was not found." },
    });
  });
  it("rate limits requests and does not trust spoofed forwarding headers", async () => {
    const limited = app({ RATE_LIMIT_MAX_REQUESTS: "1" });
    await request(limited).get("/api/health").expect(200);
    const response = await request(limited).get("/api/health").expect(429);
    expect(response.body.error.code).toBe("RATE_LIMITED");
    expect(response.headers["retry-after"]).toBeDefined();
    expect(limited.get("trust proxy")).toBe(false);
  });
});
