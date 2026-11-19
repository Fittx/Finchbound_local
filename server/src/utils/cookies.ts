import type { CookieOptions, Response } from "express";
import type { Env } from "../config/env.js";

const options = (config: Env): CookieOptions => ({
  httpOnly: true,
  secure: config.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
});
export function readSessionCookie(header: string | undefined, config: Env): string | undefined {
  const values = (header ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(config.JWT_COOKIE_NAME + "="));
  if (values.length !== 1) return undefined;
  try {
    const value = decodeURIComponent(values[0]!.slice(config.JWT_COOKIE_NAME.length + 1));
    return value && value.length <= 4096 ? value : undefined;
  } catch {
    return undefined;
  }
}
export function setSessionCookie(res: Response, config: Env, token: string, remember: boolean) {
  res.cookie(config.JWT_COOKIE_NAME, token, {
    ...options(config),
    ...(remember ? { maxAge: config.JWT_REMEMBER_DAYS * 86400000 } : {}),
  });
}
export const clearSessionCookie = (res: Response, config: Env) =>
  res.clearCookie(config.JWT_COOKIE_NAME, options(config));
