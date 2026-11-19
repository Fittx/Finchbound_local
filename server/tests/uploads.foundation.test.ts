import { Readable } from "node:stream";
import request from "supertest";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createApp } from "../src/app.js";
import { createObjectStorage } from "../src/config/storage.js";
import { createCaptchaVerifier } from "../src/services/captcha.js";
import { processImage } from "../src/services/images.js";
import { signUploadToken, verifyUploadToken } from "../src/services/uploadTokens.js";
import { signSession } from "../src/services/tokens.js";
import { randomUUID } from "node:crypto";
import { LIMITS } from "../../shared/constants.js";
import { testConfig, testLogger } from "./helpers.js";
const config = testConfig();
const value = {
  bookId: "a".repeat(24),
  draftId: randomUUID(),
  jti: randomUUID(),
  purpose: "guest-upload" as const,
};
describe("image processing and upload security", () => {
  it.each(["jpeg", "png", "webp"] as const)(
    "decodes %s and emits clean bounded JPEG renditions",
    async (format) => {
      const input = await sharp({
        create: { width: 2000, height: 1000, channels: 3, background: "red" },
      })
        .toFormat(format)
        .toBuffer();
      const result = await processImage(input, "image/" + format, config);
      expect(result.map((r) => r.name)).toEqual(["thumbnail", "page", "lightbox"]);
      expect(result.map((r) => r.width)).toEqual([400, 800, 1800]);
      for (const r of result) {
        const meta = await sharp(r.buffer).metadata();
        expect(meta.format).toBe("jpeg");
        expect(meta.exif).toBeUndefined();
        expect(meta.icc).toBeUndefined();
        expect(meta.xmp).toBeUndefined();
      }
    },
  );
  it("applies EXIF orientation before stripping metadata", async () => {
    const input = await sharp({
      create: { width: 1600, height: 900, channels: 3, background: "blue" },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const result = await processImage(input, "image/jpeg", config);
    expect(result[1]).toMatchObject({ width: 450, height: 800 });
    expect((await sharp(result[1]!.buffer).metadata()).orientation).toBeUndefined();
  });
  it("rejects SVG, forged MIME, damaged images, byte and pixel overflows", async () => {
    await expect(
      processImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), "image/png", config),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_FILE_TYPE" });
    const input = await sharp({
      create: { width: 1200, height: 1200, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    await expect(processImage(input, "image/jpeg", config)).rejects.toMatchObject({
      code: "UNSUPPORTED_FILE_TYPE",
    });
    await expect(
      processImage(input, "image/png", testConfig({ UPLOAD_MAX_PIXELS: "1000000" })),
    ).rejects.toMatchObject({ code: "UPLOAD_FAILED" });
    await expect(processImage(input.subarray(0, 60), "image/png", config)).rejects.toMatchObject({
      code: "UPLOAD_FAILED",
    });
    await expect(
      processImage(Buffer.alloc(LIMITS.uploadBytes + 1), "image/png", config),
    ).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
  });
  it("never enlarges small inputs", async () => {
    const input = await sharp({
      create: { width: 32, height: 16, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    expect(
      (await processImage(input, "image/png", config)).every(
        (r) => r.width === 32 && r.height === 16,
      ),
    ).toBe(true);
  });
  it("separates upload, submission, preview and session token purposes and checks expiry", async () => {
    const upload = signUploadToken(config, value);
    expect(verifyUploadToken(config, upload, "guest-upload")).toMatchObject(value);
    expect(() => verifyUploadToken(config, upload, "guest-captcha")).toThrow();
    expect(() => verifyUploadToken(config, upload.slice(0, -4) + "fake", "guest-upload")).toThrow();
    expect(() =>
      verifyUploadToken(config, signUploadToken(config, value, -1), "guest-upload"),
    ).toThrow();
    const session = await signSession(config, value.bookId, 0, value.jti, 600);
    expect(() => verifyUploadToken(config, session, "guest-upload")).toThrow();
  });
  it("requires provider success, exact hostname/action and book/draft binding", async () => {
    const configured = testConfig({ TURNSTILE_SECRET: "test-provider-secret" });
    for (const response of [
      { success: false },
      {
        success: true,
        hostname: "evil.test",
        action: configured.TURNSTILE_ACTION,
        cdata: "book_draft",
      },
      { success: true, hostname: "127.0.0.1", action: "wrong", cdata: "book_draft" },
      { success: true, hostname: "127.0.0.1", action: configured.TURNSTILE_ACTION, cdata: "wrong" },
    ]) {
      const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(response)));
      await expect(
        createCaptchaVerifier(configured, fetcher).verify("proof", "127.0.0.1", "book_draft"),
      ).rejects.toMatchObject({ code: "CAPTCHA_FAILED" });
    }
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            hostname: "127.0.0.1",
            action: configured.TURNSTILE_ACTION,
            cdata: "book_draft",
          }),
        ),
      );
    await createCaptchaVerifier(configured, fetcher).verify("proof", "127.0.0.1", "book_draft");
    expect(fetcher.mock.calls[0]![0]).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    );
  });
  it("keeps storage writes private and sanitizes provider errors", async () => {
    const send = vi.spyOn(S3Client.prototype, "send").mockResolvedValue({} as never);
    const store = createObjectStorage(
      testConfig({
        STORAGE_ENDPOINT: "https://account.r2.cloudflarestorage.com",
        STORAGE_BUCKET: "private",
        STORAGE_ACCESS_KEY_ID: "test-key",
        STORAGE_SECRET_ACCESS_KEY: "test-secret",
      }),
    );
    await store.put("quarantine/test", Buffer.from("test"), "application/octet-stream");
    const command = send.mock.calls[0]![0] as PutObjectCommand;
    expect(command.input.ACL).toBeUndefined();
    expect(command.input.CacheControl).toBe("private, no-store");
    send.mockRejectedValueOnce(new Error("provider contains credentials"));
    await expect(store.put("key", Buffer.from("test"), "image/jpeg")).rejects.toMatchObject({
      code: "UPLOAD_FAILED",
      message: "Image storage is temporarily unavailable.",
    });
  });
  it("fails closed without storage and never buffers unauthenticated upload bodies", async () => {
    const app = createApp({ config, isDatabaseReady: () => true, logger: testLogger() });
    await request(app)
      .post("/api/uploads/image")
      .set("Origin", config.CLIENT_URL)
      .attach("file", Buffer.from("fake"), "fake.png")
      .expect(401);
    const response = await request(app)
      .post("/api/public/captcha")
      .set("Origin", config.CLIENT_URL)
      .send({ token: "token", bookSlug: "book", draftId: randomUUID() })
      .expect(503);
    expect(response.body.error.code).toBe("SERVER");
    expect(JSON.stringify(response.body)).not.toMatch(/test-secret|cloudflarestorage/);
  });
});
