import type { RequestHandler } from "express";
import type { Env } from "../config/env.js";
import { verifyUploadToken } from "../services/uploadTokens.js";
import { ApiError } from "../utils/ApiError.js";
/** Verify token purpose before DB quotas; services also check persisted scope and consumption. */
export function captchaProof(config: Env): RequestHandler {
  return (req, res, next) => {
    try {
      const token = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(req.get("Authorization") ?? "")?.[1];
      if (!token || token.length > 2048) throw new Error();
      verifyUploadToken(config, token, "guest-captcha");
      res.locals.captchaProof = token;
      next();
    } catch {
      next(new ApiError("CAPTCHA_FAILED", "Refresh the human verification challenge."));
    }
  };
}
