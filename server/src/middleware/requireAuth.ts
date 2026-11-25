import type { RequestHandler, Response } from "express";
import type { Env } from "../config/env.js";
import type { AuthPrincipal, AuthService } from "../services/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { readSessionCookie, setSessionCookie } from "../utils/cookies.js";

export function requireAuth(config: Env, auth: AuthService): RequestHandler {
  return asyncHandler(async (req, res, next) => {
    const principal = await auth.authenticate(readSessionCookie(req.get("cookie"), config));
    res.locals.auth = principal;
    const renewed = await auth.renew(principal);
    if (renewed) setSessionCookie(res, config, renewed, false);
    next();
  });
}
export function principal(res: Response): AuthPrincipal {
  const auth = res.locals.auth as AuthPrincipal | undefined;
  if (!auth) throw new ApiError("UNAUTHORIZED");
  return auth;
}
