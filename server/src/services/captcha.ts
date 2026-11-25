import { z } from "zod";
import type { Env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { DEV_CAPTCHA_TOKEN } from "../../../shared/constants.js";
export interface CaptchaVerifier {
  verify(token: string, ip: string, binding: string): Promise<void>;
}
/**
 * Local development without Turnstile keys accepts this one token so the guest flow can be
 * exercised. Production refuses to start without TURNSTILE_SECRET, and tests use "test".
 */
export { DEV_CAPTCHA_TOKEN };
export function createCaptchaVerifier(config: Env, fetcher: typeof fetch = fetch): CaptchaVerifier {
  return {
    async verify(token, ip, binding) {
      if (!config.TURNSTILE_SECRET && config.NODE_ENV === "development") {
        if (token === DEV_CAPTCHA_TOKEN) return;
        throw new ApiError("CAPTCHA_FAILED", "Human verification failed.");
      }
      if (!config.TURNSTILE_SECRET)
        throw new ApiError("SERVER", "Human verification is not configured.", undefined, 503);
      try {
        const response = await fetcher(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              secret: config.TURNSTILE_SECRET,
              response: token,
              remoteip: ip,
            }),
            signal: AbortSignal.timeout(8000),
          },
        );
        if (!response.ok) throw new Error();
        const result = z
          .object({
            success: z.boolean(),
            hostname: z.string().optional(),
            action: z.string().optional(),
            cdata: z.string().optional(),
          })
          .parse(await response.json());
        if (
          !result.success ||
          result.hostname !== new URL(config.CLIENT_URL).hostname ||
          result.action !== config.TURNSTILE_ACTION ||
          result.cdata !== binding
        )
          throw new Error();
      } catch {
        throw new ApiError(
          "CAPTCHA_FAILED",
          "Human verification failed. Refresh the challenge and try again.",
        );
      }
    },
  };
}
