import { captchaProof } from "../middleware/captcha.js";
import { Router, type RequestHandler } from "express";
import type { Env } from "../config/env.js";
import type { AuthService } from "../services/auth.js";
import type { GuestService } from "../services/guests.js";
import { guestControllers } from "../controllers/guests.js";
import { guestDevice } from "../services/guestSecurity.js";
import type { PER_GUEST } from "../services/guestLimits.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { slugParams, bookParams } from "../validators/books.js";
import {
  guestCodeBody,
  guestConfirmBody,
  guestEntryBody,
  reportBody,
  blockBody,
} from "../validators/guests.js";
export function createGuestRouter(config: Env, auth: AuthService, guests: GuestService): Router {
  const router = Router(),
    handlers = guestControllers(config, guests);
  const guard = (action: keyof typeof PER_GUEST): RequestHandler =>
    asyncHandler(async (req, res, next) => {
      res.locals.guestFingerprint = guestDevice(config, req.get("cookie"), res);
      await guests.quota(
        action,
        req.ip ?? "unknown",
        res.locals.validated.params.slug,
        res.locals.guestFingerprint,
      );
      next();
    });
  router.get(
    "/public/books/:slug/guest",
    validate({ params: slugParams }),
    guard("event"),
    handlers.event,
  );
  router.post(
    "/public/books/:slug/verify-email",
    validate({ params: slugParams, body: guestCodeBody }),
    captchaProof(config),
    guard("email-send"),
    handlers.sendCode,
  );
  router.post(
    "/public/books/:slug/verify-email/confirm",
    validate({ params: slugParams, body: guestConfirmBody }),
    captchaProof(config),
    guard("email-confirm"),
    handlers.confirmCode,
  );
  router.post(
    "/public/books/:slug/submissions",
    validate({ params: slugParams, body: guestEntryBody }),
    guard("submit"),
    handlers.submit,
  );
  router.post(
    "/public/books/:slug/reports",
    validate({ params: slugParams, body: reportBody }),
    guard("report"),
    handlers.report,
  );
  router.post(
    "/books/:bookId/blocked-guests",
    requireAuth(config, auth),
    validate({ params: bookParams, body: blockBody }),
    handlers.block,
  );
  return router;
}
