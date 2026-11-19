import { createHmac } from "node:crypto";
import { trusted } from "mongoose";
import { UploadQuota } from "../models/UploadQuota.js";
import { ApiError } from "../utils/ApiError.js";
import type { Env } from "../config/env.js";
export async function consumeQuota(
  config: Env,
  scope: string,
  limit = config.RATE_LIMIT_MAX_REQUESTS,
  windowMs = config.RATE_LIMIT_WINDOW_MS,
) {
  const window = Math.floor(Date.now() / windowMs);
  const id = createHmac("sha256", config.JWT_SECRET)
    .update("upload-quota:" + scope + ":" + window)
    .digest("hex");
  try {
    await UploadQuota.updateOne(
      { _id: id },
      { $setOnInsert: { used: 0, expiresAt: new Date((window + 2) * windowMs) } },
      { upsert: true },
    );
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
  }
  const quota = await UploadQuota.findOneAndUpdate(
    { _id: id, used: trusted({ $lt: limit }) },
    { $inc: { used: 1 } },
  );
  if (!quota) throw new ApiError("RATE_LIMITED");
}
