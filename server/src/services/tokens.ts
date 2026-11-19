import { createHash, createHmac, randomInt } from "node:crypto";
import { z } from "zod";
import type { Env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const makeCode = () => String(randomInt(0, 1000000)).padStart(6, "0");
export const hashCode = (config: Env, email: string, code: string) =>
  createHmac("sha256", config.JWT_SECRET)
    .update("host-email\0" + email + "\0" + code)
    .digest("hex");
const claimsSchema = z.object({
  sub: z.string().regex(/^[a-f0-9]{24}$/),
  jti: z.uuid(),
  version: z.number().int().min(0),
  purpose: z.literal("host-session"),
  exp: z.number().int(),
  iat: z.number().int(),
});

export async function signSession(
  config: Env,
  userId: string,
  version: number,
  jti: string,
  seconds: number,
) {
  const { default: jwt } = await import("jsonwebtoken");
  return jwt.sign({ version, purpose: "host-session" }, config.JWT_SECRET, {
    algorithm: "HS256",
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
    subject: userId,
    jwtid: jti,
    expiresIn: seconds,
  });
}
export async function verifySession(config: Env, token: string) {
  try {
    const { default: jwt } = await import("jsonwebtoken");
    return claimsSchema.parse(
      jwt.verify(token, config.JWT_SECRET, {
        algorithms: ["HS256"],
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE,
      }),
    );
  } catch {
    throw new ApiError("UNAUTHORIZED");
  }
}
