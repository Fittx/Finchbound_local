import { describe, expect, it } from "vitest";
import { ConfigurationError, parseEnv } from "../src/config/env.js";
import { getStorageConfig } from "../src/config/storage.js";
import { testConfig, testEnvironment } from "./helpers.js";

describe("environment configuration", () => {
  it("validates the selected HTTPS mail provider without requiring SMTP", () => {
    expect(
      testConfig({
        EMAIL_PROVIDER: "brevo",
        BREVO_API_KEY: "test-key",
        EMAIL_FROM: "sender@example.invalid",
      }).EMAIL_PROVIDER,
    ).toBe("brevo");
    expect(() => testConfig({ EMAIL_PROVIDER: "brevo", BREVO_API_KEY: "test-key" })).toThrow(
      ConfigurationError,
    );
    expect(() => testConfig({ EMAIL_PROVIDER: "unknown" })).toThrow(ConfigurationError);
    expect(() => testConfig({ SERVE_CLIENT: "yes" })).toThrow(ConfigurationError);
  });
  it("uses Render's HTTPS origin in production and still rejects an invalid origin", () => {
    const production = {
      NODE_ENV: "production",
      CLIENT_URL: undefined,
      RENDER_EXTERNAL_URL: "https://finchbound-demo.onrender.com",
      EMAIL_PROVIDER: "brevo",
      BREVO_API_KEY: "test-key",
      EMAIL_FROM: "sender@example.invalid",
      STORAGE_ENDPOINT: "https://account.r2.cloudflarestorage.com",
      STORAGE_BUCKET: "private",
      STORAGE_ACCESS_KEY_ID: "key",
      STORAGE_SECRET_ACCESS_KEY: "secret",
      TURNSTILE_SECRET: "test-secret",
      SERVE_CLIENT: "true",
      TRUST_PROXY: "1",
    };
    expect(testConfig(production).CLIENT_URL).toBe(production.RENDER_EXTERNAL_URL);
    expect(() => testConfig({ ...production, RENDER_EXTERNAL_URL: "http://app.invalid" })).toThrow(
      ConfigurationError,
    );
    expect(() => testConfig({ ...production, BREVO_API_KEY: undefined })).toThrow(
      ConfigurationError,
    );
    expect(() => testConfig({ ...production, STORAGE_BUCKET: undefined })).toThrow(
      ConfigurationError,
    );
    expect(() => testConfig({ ...production, TURNSTILE_SECRET: undefined })).toThrow(
      ConfigurationError,
    );
  });
  it("uses explicit configuration and shared defaults", () => {
    const config = testConfig();
    expect(config.PORT).toBe(3001);
    expect(config.JWT_SESSION_MINUTES).toBe(30);
    expect(config.UPLOAD_TOKEN_TTL_SECONDS).toBe(600);
    expect(config.HOST).toBe("127.0.0.1");
  });
  it.each([
    { PORT: "0" },
    { PORT: "3001junk" },
    { PORT: "65536" },
    { MONGODB_URI: "https://db.invalid" },
    { JWT_SECRET: "short" },
    { JWT_SECRET: "replace-with-a-generated-secret-before-starting" },
    { CLIENT_URL: "https://app.invalid/path" },
    { CLIENT_URL: "https://user:pass@app.invalid" },
    { CLIENT_URL: "https://app.invalid?x=1" },
    { TRUST_PROXY: "true" },
    { UPLOAD_TOKEN_TTL_SECONDS: "601" },
  ])("rejects invalid configuration: %j", (patch) => {
    expect(() => testConfig(patch)).toThrow(ConfigurationError);
  });
  it("reports field names without disclosing secrets or URI credentials", () => {
    const secret = "secret-probe";
    const source = {
      ...testEnvironment,
      JWT_SECRET: secret,
      MONGODB_URI: "bad://user:db-secret@host",
    };
    try {
      parseEnv(source);
      expect.fail("Expected invalid configuration");
    } catch (error) {
      expect(String(error)).toContain("JWT_SECRET");
      expect(String(error)).not.toContain(secret);
      expect(String(error)).not.toContain("db-secret");
    }
  });
  it("does not accept incomplete R2 or SMTP groups", () => {
    expect(() => testConfig({ STORAGE_BUCKET: "private-bucket" })).toThrow(ConfigurationError);
    expect(() => testConfig({ SMTP_HOST: "smtp.invalid" })).toThrow(ConfigurationError);
    expect(() => getStorageConfig(testConfig())).toThrow(ConfigurationError);
  });
  it("requires HTTPS and configured external services in production", () => {
    expect(() => testConfig({ NODE_ENV: "production" })).toThrow(ConfigurationError);
    const config = testConfig({
      NODE_ENV: "production",
      CLIENT_URL: "https://app.invalid",
      STORAGE_ENDPOINT: "https://account.r2.cloudflarestorage.com",
      STORAGE_BUCKET: "private-bucket",
      STORAGE_ACCESS_KEY_ID: "storage-key",
      STORAGE_SECRET_ACCESS_KEY: "storage-secret",
      SMTP_HOST: "smtp.invalid",
      SMTP_USER: "smtp-user",
      SMTP_PASSWORD: "smtp-password",
      SMTP_FROM: "hello@app.invalid",
      TURNSTILE_SECRET: "turnstile-secret",
    });
    expect(config.NODE_ENV).toBe("production");
    expect(getStorageConfig(config).bucket).toBe("private-bucket");
  });
  it("preserves secret whitespace and rejects plaintext storage endpoints", () => {
    const storage = {
      STORAGE_ENDPOINT: "https://account.r2.cloudflarestorage.com",
      STORAGE_BUCKET: "private",
      STORAGE_ACCESS_KEY_ID: "key",
      STORAGE_SECRET_ACCESS_KEY: " secret with spaces ",
    };
    expect(getStorageConfig(testConfig(storage)).credentials.secretAccessKey).toBe(
      " secret with spaces ",
    );
    expect(() =>
      testConfig({ ...storage, STORAGE_ENDPOINT: "http://account.r2.cloudflarestorage.com" }),
    ).toThrow(ConfigurationError);
  });
});
