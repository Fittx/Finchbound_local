import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { text } from "node:stream/consumers";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigurationError } from "../src/config/env.js";
import { createObjectStorage } from "../src/config/storage.js";
import { testConfig } from "./helpers.js";

const dirs: string[] = [];
const local = () => {
  const dir = mkdtempSync(join(tmpdir(), "finchbound-storage-"));
  dirs.push(dir);
  return {
    dir,
    store: createObjectStorage(testConfig({ STORAGE_PROVIDER: "local", STORAGE_LOCAL_DIR: dir })),
  };
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("local development storage", () => {
  it("is accepted outside production and refused in production", () => {
    expect(testConfig({ STORAGE_PROVIDER: "local" }).STORAGE_PROVIDER).toBe("local");
    expect(testConfig().STORAGE_PROVIDER).toBe("r2");
    expect(() =>
      testConfig({
        NODE_ENV: "production",
        CLIENT_URL: "https://finchbound.example",
        STORAGE_PROVIDER: "local",
        TURNSTILE_SECRET: "secret",
        SMTP_HOST: "smtp.example",
        SMTP_USER: "user",
        SMTP_PASSWORD: "password",
        SMTP_FROM: "from@example.com",
      }),
    ).toThrow(ConfigurationError);
  });

  it("stores, reads and removes objects without any R2 settings", async () => {
    const { store } = local();
    expect(() => store.assertConfigured()).not.toThrow();
    await store.put("validated/abc/page.jpg", Buffer.from("image-bytes"), "image/jpeg");
    const object = await store.get("validated/abc/page.jpg");
    expect(object.bytes).toBe(11);
    expect(await text(object.body)).toBe("image-bytes");
    await store.remove("validated/abc/page.jpg");
    await store.remove("validated/abc/page.jpg");
    await expect(store.get("validated/abc/page.jpg")).rejects.toMatchObject({
      code: "UPLOAD_FAILED",
    });
  });

  it.each(["../escape", "validated/../../escape", "/absolute", "a\\b", "", "validated//x"])(
    "refuses unsafe key %j",
    async (key) => {
      const { store, dir } = local();
      await expect(store.put(key, Buffer.from("x"), "image/jpeg")).rejects.toMatchObject({
        code: "UPLOAD_FAILED",
      });
      expect(readdirSync(dir)).toEqual([]);
    },
  );
});
