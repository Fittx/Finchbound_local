import { Router } from "express";
import type { Env } from "../config/env.js";
import type { AuthService } from "../services/auth.js";
import { BookService } from "../services/books.js";
import { bookControllers } from "../controllers/books.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { readSessionCookie } from "../utils/cookies.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import {
  bookParams,
  pageParams,
  slugParams,
  createBookBody,
  updateBookBody,
  createPageBody,
  updatePageBody,
  listBooksQuery,
  listPagesQuery,
  reorderBody,
} from "../validators/books.js";
export function createBookRouter(config: Env, auth: AuthService): Router {
  const router = Router();
  const handlers = bookControllers(new BookService(config.JWT_SECRET));
  const host = requireAuth(config, auth);
  router.get(
    "/public/books/:slug",
    validate({ params: slugParams }),
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
    handlers.publicBook,
  );
  router.get("/books", host, validate({ query: listBooksQuery }), handlers.list);
  router.get("/books/check-slug/:slug", host, validate({ params: slugParams }), handlers.checkSlug);
  router.post("/books", host, validate({ body: createBookBody }), handlers.create);
  router.get("/books/:bookId", host, validate({ params: bookParams }), handlers.get);
  router.patch(
    "/books/:bookId",
    host,
    validate({ params: bookParams, body: updateBookBody }),
    handlers.update,
  );
  router.post("/books/:bookId/publish", host, validate({ params: bookParams }), handlers.publish);
  router.delete("/books/:bookId", host, validate({ params: bookParams }), handlers.remove);
  router.post("/books/:bookId/restore", host, validate({ params: bookParams }), handlers.restore);
  router.get(
    "/books/:bookId/pages",
    host,
    validate({ params: bookParams, query: listPagesQuery }),
    handlers.listPages,
  );
  router.post(
    "/books/:bookId/pages",
    host,
    validate({ params: bookParams, body: createPageBody }),
    handlers.createPage,
  );
  router.put(
    "/books/:bookId/pages/order",
    host,
    validate({ params: bookParams, body: reorderBody }),
    handlers.reorder,
  );
  router.patch(
    "/pages/:pageId",
    host,
    validate({ params: pageParams, body: updatePageBody }),
    handlers.updatePage,
  );
  router.delete("/pages/:pageId", host, validate({ params: pageParams }), handlers.deletePage);
  return router;
}
