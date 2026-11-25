import { Router, type RequestHandler } from "express";
import type { Env } from "../config/env.js";
import type { AuthService } from "../services/auth.js";
import { principal, requireAuth } from "../middleware/requireAuth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { bookParams, slugParams } from "../validators/books.js";
import {
  adminReportsQuery,
  platformReportBody,
  reportParams,
  submissionParams,
} from "../validators/admin.js";
import {
  createPlatformReport,
  dismissPlatformReport,
  listPlatformReports,
  removeSubmission,
  unpublishBook,
} from "../services/admin.js";
import { consumeQuota } from "../services/uploadQuota.js";
import { guestDevice } from "../services/guestSecurity.js";

/** Checked on the server for every admin request; the role is never read from the client. */
export const requireAdmin: RequestHandler = (_req, res, next) => {
  if (principal(res).user.role !== "admin") return next(new ApiError("FORBIDDEN"));
  next();
};

/** Public platform reports, mounted under /api. */
export function createPlatformReportRouter(config: Env): Router {
  const router = Router();
  router.post(
    "/public/books/:slug/platform-reports",
    validate({ params: slugParams, body: platformReportBody }),
    asyncHandler(async (req, res) => {
      const fingerprint = guestDevice(config, req.get("cookie"), res);
      await consumeQuota(config, "platform-report:device:" + fingerprint, 5, 3600000);
      await consumeQuota(config, "platform-report:ip:" + (req.ip ?? "unknown"), 20, 3600000);
      const { params, body } = res.locals.validated;
      res.status(201).json(await createPlatformReport(params.slug, body, fingerprint));
    }),
  );
  return router;
}

/** Admin-only routes, mounted under /api/admin. */
export function createAdminRouter(config: Env, auth: AuthService): Router {
  const router = Router();
  router.use(requireAuth(config, auth), requireAdmin);
  router.get(
    "/reports",
    validate({ query: adminReportsQuery }),
    asyncHandler(async (_req, res) => {
      res.json(await listPlatformReports(res.locals.validated.query));
    }),
  );
  router.post(
    "/reports/:reportId/dismiss",
    validate({ params: reportParams }),
    asyncHandler(async (_req, res) => {
      await dismissPlatformReport(res.locals.validated.params.reportId);
      res.json({ ok: true });
    }),
  );
  router.post(
    "/books/:bookId/unpublish",
    validate({ params: bookParams }),
    asyncHandler(async (_req, res) => {
      await unpublishBook(res.locals.validated.params.bookId);
      res.json({ ok: true });
    }),
  );
  router.delete(
    "/submissions/:submissionId",
    validate({ params: submissionParams }),
    asyncHandler(async (_req, res) => {
      await removeSubmission(res.locals.validated.params.submissionId);
      res.sendStatus(204);
    }),
  );
  return router;
}
