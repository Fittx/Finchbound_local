import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { ConfigurationError } from "../src/config/env.js";
import { testConfig, testLogger } from "./helpers.js";

const lan = "http://192.168.1.7:5173";
const local = "http://127.0.0.1:5173";
const app = (patch: Record<string, string>) =>
  createApp({ config: testConfig(patch), isDatabaseReady: () => true, logger: testLogger() });

describe("extra development origins", () => {
  it("accepts the site from both the network address and this computer", async () => {
    const server = app({
      CLIENT_URL: lan,
      EXTRA_CLIENT_ORIGINS: local + ", http://localhost:5173",
    });
    for (const origin of [lan, local, "http://localhost:5173"]) {
      const response = await request(server).post("/api/unknown").set("Origin", origin).expect(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
    }
    const other = await request(server)
      .post("/api/unknown")
      .set("Origin", "http://evil.example")
      .expect(403);
    expect(other.body.error.code).toBe("FORBIDDEN");
  });

  it("defaults to none, rejects malformed values and is refused in production", () => {
    expect(testConfig().EXTRA_CLIENT_ORIGINS).toEqual([]);
    expect(() => testConfig({ EXTRA_CLIENT_ORIGINS: "not a url" })).toThrow(ConfigurationError);
    expect(() => testConfig({ EXTRA_CLIENT_ORIGINS: "http://127.0.0.1:5173/path" })).toThrow(
      ConfigurationError,
    );
    expect(() =>
      testConfig({
        NODE_ENV: "production",
        CLIENT_URL: "https://finchbound.example",
        EXTRA_CLIENT_ORIGINS: "https://other.example",
        TURNSTILE_SECRET: "secret",
        STORAGE_ENDPOINT: "https://account.r2.cloudflarestorage.com",
        STORAGE_BUCKET: "b",
        STORAGE_ACCESS_KEY_ID: "k",
        STORAGE_SECRET_ACCESS_KEY: "s",
        SMTP_HOST: "smtp.example",
        SMTP_USER: "user",
        SMTP_PASSWORD: "password",
        SMTP_FROM: "from@example.com",
      }),
    ).toThrow(ConfigurationError);
  });
});
