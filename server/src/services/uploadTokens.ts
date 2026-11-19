import jwt from "jsonwebtoken";
import { z } from "zod";
import type { Env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
const base = { bookId: z.string().regex(/^[a-f0-9]{24}$/), draftId: z.uuid(), jti: z.uuid() };
const claims = z.discriminatedUnion("purpose", [
  z.object({ ...base, purpose: z.literal("guest-upload") }),
  z.object({ ...base, purpose: z.literal("guest-captcha") }),
  z.object({
    ...base,
    purpose: z.literal("asset-preview"),
    uploadId: z.string().regex(/^[a-f0-9]{24}$/),
  }),
]);
export type UploadClaims = z.infer<typeof claims>;
export function signUploadToken(
  config: Env,
  value: UploadClaims,
  seconds = config.UPLOAD_TOKEN_TTL_SECONDS,
) {
  return jwt.sign(value, config.JWT_SECRET, {
    algorithm: "HS256",
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE + ":uploads",
    expiresIn: seconds,
  });
}
export function verifyUploadToken(config: Env, token: string, purpose: UploadClaims["purpose"]) {
  try {
    const value = claims.parse(
      jwt.verify(token, config.JWT_SECRET, {
        algorithms: ["HS256"],
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE + ":uploads",
        maxAge: config.UPLOAD_TOKEN_TTL_SECONDS,
      }),
    );
    if (value.purpose !== purpose) throw new Error();
    return value;
  } catch {
    throw new ApiError("UNAUTHORIZED", "Upload authorization expired or is invalid.");
  }
}
