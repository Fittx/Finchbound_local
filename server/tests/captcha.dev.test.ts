import { describe, expect, it, vi } from "vitest";
import { createCaptchaVerifier, DEV_CAPTCHA_TOKEN } from "../src/services/captcha.js";
import { testConfig } from "./helpers.js";

describe("development human-verification bypass", () => {
  it("accepts only the fixed development token when running locally without Turnstile", async () => {
    const fetcher = vi.fn();
    const verifier = createCaptchaVerifier(testConfig({ NODE_ENV: "development" }), fetcher);
    await verifier.verify(DEV_CAPTCHA_TOKEN, "127.0.0.1", "book_draft");
    await expect(verifier.verify("anything-else", "127.0.0.1", "book_draft")).rejects.toMatchObject(
      {
        code: "CAPTCHA_FAILED",
      },
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("never bypasses outside development or when Turnstile is configured", async () => {
    await expect(
      createCaptchaVerifier(testConfig()).verify(DEV_CAPTCHA_TOKEN, "127.0.0.1", "b"),
    ).rejects.toMatchObject({ code: "SERVER" });
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false })));
    await expect(
      createCaptchaVerifier(
        testConfig({ NODE_ENV: "development", TURNSTILE_SECRET: "real-secret" }),
        fetcher,
      ).verify(DEV_CAPTCHA_TOKEN, "127.0.0.1", "b"),
    ).rejects.toMatchObject({ code: "CAPTCHA_FAILED" });
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
