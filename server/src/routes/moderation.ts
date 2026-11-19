import { Router } from "express";
import type { Env } from "../config/env.js";
import type { AuthService } from "../services/auth.js";
import { ModerationService } from "../services/moderation.js";
import { principal, requireAuth } from "../middleware/requireAuth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { bookParams, objectId } from "../validators/books.js";
import { bulkBody, entryParams, moderationQuery, statusBody } from "../validators/moderation.js";

export function createModerationRouter(config: Env, auth: AuthService): Router {
  const router = Router();
  const host = requireAuth(config, auth);
  const service = new ModerationService(config.JWT_SECRET);
  const entry = "/submissions/:id",
    feed = "/books/:bookId/submissions";
  router.get(
    "/books/:bookId/reports",
    host,
    validate({ params: bookParams, query: moderationQuery.pick({ cursor: true }) }),
    asyncHandler(async (_req, res) => {
      const { params, query } = res.locals.validated;
      res.json(await service.reports(principal(res), params.bookId, query.cursor));
    }),
  );
  router.delete(
    "/books/:bookId/reports/:reportId",
    host,
    validate({ params: bookParams.extend({ reportId: objectId }) }),
    asyncHandler(async (_req, res) => {
      const { bookId, reportId } = res.locals.validated.params;
      await service.acknowledgeBookReport(principal(res), bookId, reportId);
      res.sendStatus(204);
    }),
  );
  router.get(
    feed,
    host,
    validate({ params: bookParams, query: moderationQuery }),
    asyncHandler(async (_req, res) => {
      const { params, query } = res.locals.validated;
      res.json(await service.list(principal(res), params.bookId, query));
    }),
  );
  router.post(
    feed + "/bulk",
    host,
    validate({ params: bookParams, body: bulkBody }),
    asyncHandler(async (_req, res) => {
      const { params, body } = res.locals.validated;
      res.json(await service.bulk(principal(res), params.bookId, body));
    }),
  );
  router.patch(
    entry,
    host,
    validate({ params: entryParams, body: statusBody }),
    asyncHandler(async (_req, res) => {
      const { params, body } = res.locals.validated;
      res.json(await service.status(principal(res), params.id, body));
    }),
  );
  const target = validate({ params: entryParams });
  router.post(
    entry + "/add-to-book",
    host,
    target,
    asyncHandler(async (_req, res) => {
      res.status(201).json(await service.promote(principal(res), res.locals.validated.params.id));
    }),
  );
  router.post(
    entry + "/reaction",
    host,
    target,
    asyncHandler(async (_req, res) => {
      res.json(await service.reaction(principal(res), res.locals.validated.params.id));
    }),
  );
  router.delete(
    entry + "/report",
    host,
    target,
    asyncHandler(async (_req, res) => {
      res.json(await service.dismissReport(principal(res), res.locals.validated.params.id));
    }),
  );
  router.delete(
    entry,
    host,
    target,
    asyncHandler(async (_req, res) => {
      await service.remove(principal(res), res.locals.validated.params.id);
      res.sendStatus(204);
    }),
  );
  return router;
}
