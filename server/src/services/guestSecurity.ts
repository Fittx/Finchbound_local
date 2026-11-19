import { createHmac, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { z } from "zod";
import type { Response } from "express";
import type { Env } from "../config/env.js";
import { readSessionCookie } from "../utils/cookies.js";
import { ApiError } from "../utils/ApiError.js";
import { BlockedGuest } from "../models/BlockedGuest.js";
import type { ClientSession, Types } from "mongoose";
const deviceClaims = z.object({ purpose: z.literal("guest-device"), id: z.uuid() });
const emailClaims = z.object({
  purpose: z.literal("guest-email"),
  bookId: z.string().regex(/^[a-f0-9]{24}$/),
  draftId: z.uuid(),
  email: z.string().email(),
  jti: z.uuid(),
});
const audience = (config: Env) => config.JWT_AUDIENCE + ":guests";
export const guestCookieName = (config: Env, bookId: string) =>
  config.JWT_COOKIE_NAME + "-guest-" + bookId;
export function readGuestCookie(config: Env, header: string | undefined, name: string) {
  return readSessionCookie(header, { ...config, JWT_COOKIE_NAME: name });
}
export function guestDevice(config: Env, header: string | undefined, res: Response) {
  const name = config.JWT_COOKIE_NAME + "-guest-device";
  let id: string | undefined;
  const previous = readGuestCookie(config, header, name);
  if (previous) {
    try {
      id = deviceClaims.parse(
        jwt.verify(previous, config.JWT_SECRET, {
          algorithms: ["HS256"],
          issuer: config.JWT_ISSUER,
          audience: audience(config),
          maxAge: config.JWT_REMEMBER_DAYS * 86400,
        }),
      ).id;
    } catch {
      /* Invalid device cookies are replaced, never accepted as identities. */
    }
  }
  if (!id) {
    id = randomUUID();
    const token = jwt.sign({ id, purpose: "guest-device" }, config.JWT_SECRET, {
      algorithm: "HS256",
      issuer: config.JWT_ISSUER,
      audience: audience(config),
      expiresIn: config.JWT_REMEMBER_DAYS * 86400,
    });
    res.cookie(name, token, {
      httpOnly: true,
      secure: config.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: config.JWT_REMEMBER_DAYS * 86400000,
    });
  }
  return createHmac("sha256", config.JWT_SECRET)
    .update("guest-device:" + id)
    .digest("hex");
}
export function guestEmailToken(config: Env, value: z.infer<typeof emailClaims>, expiresAt: Date) {
  return jwt.sign(value, config.JWT_SECRET, {
    algorithm: "HS256",
    issuer: config.JWT_ISSUER,
    audience: audience(config),
    expiresIn: Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
  });
}
export function verifyGuestEmailToken(config: Env, token: string | undefined) {
  try {
    if (!token) throw new Error();
    return emailClaims.parse(
      jwt.verify(token, config.JWT_SECRET, {
        algorithms: ["HS256"],
        issuer: config.JWT_ISSUER,
        audience: audience(config),
        maxAge: config.OTP_TTL_MINUTES * 60,
      }),
    );
  } catch {
    throw new ApiError("UNAUTHORIZED", "Verify this guest email before submitting.");
  }
}
export async function assertGuestNotBlocked(
  bookId: Types.ObjectId | string,
  identity: { email?: string | undefined; fingerprint?: string | null | undefined },
  session?: ClientSession,
) {
  const matches = [
    ...(identity.email ? [{ email: identity.email }] : []),
    ...(identity.fingerprint ? [{ fingerprint: identity.fingerprint }] : []),
  ];
  if (
    matches.length &&
    (await BlockedGuest.exists({ bookId, $or: matches }).session(session ?? null))
  )
    throw new ApiError("GUEST_BLOCKED");
}
