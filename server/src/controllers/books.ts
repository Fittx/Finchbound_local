import type { RequestHandler } from "express";
import { principal } from "../middleware/requireAuth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { BookService } from "../services/books.js";
export function bookControllers(
  books: BookService,
): Record<
  | "list"
  | "checkSlug"
  | "create"
  | "get"
  | "update"
  | "publish"
  | "remove"
  | "restore"
  | "listPages"
  | "createPage"
  | "updatePage"
  | "deletePage"
  | "reorder"
  | "publicBook",
  RequestHandler
> {
  return {
    list: asyncHandler(async (_req, res) =>
      res.json(await books.list(principal(res), res.locals.validated.query)),
    ),
    checkSlug: asyncHandler(async (_req, res) =>
      res.json(await books.checkSlug(res.locals.validated.params.slug)),
    ),
    create: asyncHandler(async (_req, res) =>
      res.status(201).json(await books.create(principal(res), res.locals.validated.body)),
    ),
    get: asyncHandler(async (_req, res) =>
      res.json(await books.get(principal(res), res.locals.validated.params.bookId)),
    ),
    update: asyncHandler(async (_req, res) =>
      res.json(
        await books.update(
          principal(res),
          res.locals.validated.params.bookId,
          res.locals.validated.body,
        ),
      ),
    ),
    publish: asyncHandler(async (_req, res) =>
      res.json(await books.publish(principal(res), res.locals.validated.params.bookId)),
    ),
    remove: asyncHandler(async (_req, res) => {
      await books.remove(principal(res), res.locals.validated.params.bookId);
      res.status(204).end();
    }),
    restore: asyncHandler(async (_req, res) =>
      res.json(await books.restore(principal(res), res.locals.validated.params.bookId)),
    ),
    listPages: asyncHandler(async (_req, res) =>
      res.json(
        await books.listPages(
          principal(res),
          res.locals.validated.params.bookId,
          res.locals.validated.query,
        ),
      ),
    ),
    createPage: asyncHandler(async (_req, res) =>
      res
        .status(201)
        .json(
          await books.createPage(
            principal(res),
            res.locals.validated.params.bookId,
            res.locals.validated.body,
          ),
        ),
    ),
    updatePage: asyncHandler(async (_req, res) =>
      res.json(
        await books.updatePage(
          principal(res),
          res.locals.validated.params.pageId,
          res.locals.validated.body,
        ),
      ),
    ),
    deletePage: asyncHandler(async (_req, res) => {
      await books.deletePage(principal(res), res.locals.validated.params.pageId);
      res.status(204).end();
    }),
    reorder: asyncHandler(async (_req, res) =>
      res.json(
        await books.reorder(
          principal(res),
          res.locals.validated.params.bookId,
          res.locals.validated.body,
        ),
      ),
    ),
    publicBook: asyncHandler(async (_req, res) =>
      res.json(await books.publicBook(res.locals.validated.params.slug, res.locals.auth)),
    ),
  };
}
