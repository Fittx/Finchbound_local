import { Router } from "express";
import { z } from "zod";
import { trusted, Types } from "mongoose";
import type { Env } from "../config/env.js";
import type { AuthService } from "../services/auth.js";
import { requireAuth, principal } from "../middleware/requireAuth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { Book } from "../models/Book.js";
import { Feedback } from "../models/Feedback.js";
import { bookParams, slugParams, objectId } from "../validators/books.js";
import { consumeQuota } from "../services/uploadQuota.js";
export const feedbackBody = z.strictObject({
  name: z.string().trim().max(80).default(""),
  message: z.string().trim().min(1).max(1000),
});
export function createFeedbackRouter(config: Env, auth: AuthService): Router {
  const router = Router();
  router.post(
    "/public/books/:slug/feedback",
    validate({ params: slugParams, body: feedbackBody }),
    asyncHandler(async (req, res) => {
      await consumeQuota(config, "feedback:" + (req.ip ?? "unknown"), 5, 3600000);
      const book = await Book.findOne({
        slug: res.locals.validated.params.slug,
        live: true,
        visibility: "link",
        deletedAt: null,
      }).select("_id");
      if (!book) throw new ApiError("NOT_FOUND");
      await Feedback.create({ bookId: book._id, ...res.locals.validated.body });
      res.status(201).json({ ok: true });
    }),
  );
  router.get(
    "/books/:bookId/feedback",
    requireAuth(config, auth),
    validate({ params: bookParams, query: z.strictObject({ cursor: objectId.optional() }) }),
    asyncHandler(async (_req, res) => {
      const bookId = res.locals.validated.params.bookId;
      if (!(await Book.exists({ _id: bookId, ownerId: principal(res).userId, deletedAt: null })))
        throw new ApiError("NOT_FOUND");
      const cursor = res.locals.validated.query.cursor;
      const items = await Feedback.find({
        bookId,
        ...(cursor ? { _id: trusted({ $lt: new Types.ObjectId(cursor) }) } : {}),
      })
        .sort({ _id: -1 })
        .limit(21)
        .lean();
      const nextCursor = items.length > 20 ? String(items[19]!._id) : null;
      res.json({
        items: items
          .slice(0, 20)
          .map((item) => ({
            id: String(item._id),
            name: item.name,
            message: item.message,
            createdAt: item.createdAt,
          })),
        nextCursor,
      });
    }),
  );
  return router;
}
