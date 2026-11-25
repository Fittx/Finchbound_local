import { rateLimit } from "express-rate-limit";
import type { Env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Guest endpoints apply their own per-device, per-IP and per-book quotas that scale with
 * the event's expected guest count. Counting them against the shared per-IP limit as
 * well would block a whole venue that shares one Wi-Fi address.
 */
const GUEST_QUOTA_PATH =
  /^\/public\/(?:captcha|books\/[^/]+\/(?:guest|verify-email(?:\/confirm)?|submissions|reports))$/;
export const isGuestQuotaPath = (path: string) => GUEST_QUOTA_PATH.test(path);

/** Single-process baseline for every other API route. */
export const createApiRateLimit = (config: Env) =>
  rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    limit: config.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // Guest photo uploads carry a bearer upload grant and their own scaled quotas.
    skip: (req) =>
      isGuestQuotaPath(req.path) ||
      (req.method === "POST" && req.path === "/uploads/image" && !!req.get("Authorization")),
    handler: (_req, res) => {
      const error = new ApiError("RATE_LIMITED");
      res.status(error.status).json(error.toBody());
    },
  });
