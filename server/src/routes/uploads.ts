import { Router } from "express";
import { z } from "zod";
import type { Env } from "../config/env.js";
import type { AuthService } from "../services/auth.js";
import type { UploadService } from "../services/uploads.js";
import { uploadControllers } from "../controllers/uploads.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { readSessionCookie } from "../utils/cookies.js";
import { validate } from "../middleware/validate.js";
import { uploadImage, uploadSlots } from "../middleware/upload.js";
import { captchaBody, imageParams, imageQuery } from "../validators/uploads.js";
export function createUploadRouter(config: Env, auth: AuthService, uploads: UploadService): Router {
  const router = Router(),
    handlers = uploadControllers(uploads, config);
  router.post("/public/captcha", validate({ body: captchaBody }), handlers.captcha);
  router.post(
    "/uploads/image",
    validate({ body: z.unknown() }),
    asyncHandler(async (req, res, next) => {
      const authorization = req.get("Authorization");
      if (authorization) {
        const token = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(authorization)?.[1];
        if (!token || token.length > 2048) throw new ApiError("UNAUTHORIZED");
        res.locals.uploadIdentity = await uploads.guestIdentity(token);
      } else {
        const principal = await auth.authenticate(readSessionCookie(req.get("cookie"), config));
        res.locals.uploadIdentity = { ownerId: principal.userId };
      }
      await uploads.quota(res.locals.uploadIdentity, req.ip ?? "unknown");
      next();
    }),
    uploadSlots(config.UPLOAD_CONCURRENCY),
    uploadImage,
    validate(),
    handlers.save,
  );
  router.get(
    "/uploads/:uploadId/:size",
    validate({ params: imageParams, query: imageQuery }),
    asyncHandler(async (req, res, next) => {
      const token = readSessionCookie(req.get("cookie"), config);
      if (token) {
        try {
          res.locals.auth = await auth.authenticate(token);
        } catch (error) {
          if (!(error instanceof ApiError && error.code === "UNAUTHORIZED")) throw error;
        }
      }
      next();
    }),
    handlers.read,
  );
  return router;
}
