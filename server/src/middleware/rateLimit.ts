import { rateLimit } from "express-rate-limit";
import type { Env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

/** Single-process baseline. Endpoint-specific and multi-instance quotas are added with auth/guests. */
export const createApiRateLimit = (config: Env) =>
  rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    limit: config.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => {
      const error = new ApiError("RATE_LIMITED");
      res.status(error.status).json(error.toBody());
    },
  });
