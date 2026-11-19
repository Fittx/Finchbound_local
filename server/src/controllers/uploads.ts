import { pipeline } from "node:stream/promises";
import type { RequestHandler } from "express";
import type { UploadService, UploadIdentity } from "../services/uploads.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import type { UploadedImage } from "../middleware/upload.js";
import type { Env } from "../config/env.js";
import { guestDevice } from "../services/guestSecurity.js";
export function uploadControllers(
  uploads: UploadService,
  config: Env,
): Record<"captcha" | "save" | "read", RequestHandler> {
  return {
    captcha: asyncHandler(async (req, res) =>
      res.json(
        await uploads.issue(
          res.locals.validated.body,
          req.ip ?? "unknown",
          guestDevice(config, req.get("cookie"), res),
        ),
      ),
    ),
    save: asyncHandler(async (req, res) => {
      if (res.destroyed) return;
      const file = (req as typeof req & { file?: UploadedImage }).file;
      if (!file)
        throw new ApiError("VALIDATION_FAILED", "Choose one image.", { file: "Choose one image" });
      res.locals.processingUpload = true;
      try {
        res.status(201).json(await uploads.save(res.locals.uploadIdentity as UploadIdentity, file));
      } finally {
        res.locals.releaseUpload?.();
      }
    }),
    read: asyncHandler(async (_req, res) => {
      const { uploadId, size } = res.locals.validated.params;
      const object = await uploads.read(
        uploadId,
        size,
        res.locals.auth,
        res.locals.validated.query.previewToken,
      );
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Content-Disposition", "inline");
      if (object.bytes !== undefined) res.setHeader("Content-Length", object.bytes);
      try {
        await pipeline(object.body, res);
      } catch {
        if (!res.destroyed) res.destroy();
      }
    }),
  };
}
