import { z } from "zod";
import {
  ACCESS_MODES,
  BOOK_KINDS,
  BOOK_VISIBILITIES,
  COLLECTION_STATUSES,
  FONT_KEYS,
  PRESET_KEYS,
  LIMITS,
  PAGE_SIZE,
  RESERVED_SLUGS,
} from "../../../shared/constants.js";
export const objectId = z
  .string()
  .regex(/^[a-f0-9]{24}$/i, "Use a valid resource ID")
  .transform((value) => value.toLowerCase());
export const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(LIMITS.slug)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .refine((value) => !RESERVED_SLUGS.includes(value), "That link is reserved");
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const theme = z.strictObject({
  background: color,
  grid: color,
  cover: color,
  accent: color,
  text: color,
  header: color,
});
export const createBookBody = z.strictObject({
  title: z.string().trim().min(1).max(LIMITS.bookTitle),
  slug,
  kind: z.enum(BOOK_KINDS),
  visibility: z.enum(BOOK_VISIBILITIES),
  preset: z.enum(PRESET_KEYS),
  theme,
  font: z.enum(FONT_KEYS),
  lines: z.boolean(),
  access: z.enum(ACCESS_MODES),
  photoRequired: z.boolean(),
  messageRequired: z.boolean(),
  hosts: z.string().trim().max(LIMITS.bookTitle).optional(),
  prompt: z.string().trim().max(LIMITS.message).optional(),
  status: z.enum(COLLECTION_STATUSES).optional(),
  expectedGuests: z
    .number()
    .int()
    .min(LIMITS.expectedGuestsMin)
    .max(LIMITS.expectedGuestsMax)
    .optional(),
});
export const updateBookBody = createBookBody
  .omit({ kind: true })
  .partial()
  .extend({ live: z.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0, "Send at least one change");
const image = z.union([
  z.literal(""),
  z
    .string()
    .regex(
      /^\/api\/uploads\/[a-f0-9]{24}\/(thumbnail|page|lightbox)(?:\?previewToken=[A-Za-z0-9_.%-]+)?$/,
    ),
  z
    .string()
    .max(2048)
    .url()
    .refine((value) => new URL(value).protocol === "https:", "Use an HTTPS image URL"),
]);
export const createPageBody = z.strictObject({
  title: z.string().trim().min(1).max(LIMITS.pageTitle),
  image: image.optional(),
  cardImage: image.optional(),
  caption: z.string().trim().max(LIMITS.photoCaption).optional(),
  header: z.string().trim().max(LIMITS.messageHeader).optional(),
  body: z.string().max(LIMITS.message),
  author: z.string().trim().max(LIMITS.personName).optional(),
});
export const updatePageBody = createPageBody
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Send at least one change");
export const bookParams = z.strictObject({ bookId: objectId });
export const pageParams = z.strictObject({ pageId: objectId });
export const slugParams = z.strictObject({ slug });
const cursor = z.string().min(1).max(2048).optional();
const limit = z.coerce.number().int().min(1).max(100);
export const listBooksQuery = z.strictObject({
  q: z.string().trim().max(LIMITS.bookTitle).optional(),
  cursor,
  limit: limit.default(PAGE_SIZE.books),
});
export const listPagesQuery = z.strictObject({
  q: z.string().trim().max(LIMITS.pageTitle).optional(),
  withPhoto: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  sort: z.enum(["position", "edited"]).default("position"),
  cursor,
  limit: limit.default(PAGE_SIZE.pages),
});
export const reorderBody = z
  .strictObject({
    pageId: objectId,
    beforeId: objectId.optional(),
    afterId: objectId.optional(),
    expectedVersion: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  })
  .refine((v) => Boolean(v.beforeId) !== Boolean(v.afterId), "Provide exactly one anchor")
  .refine((v) => v.pageId !== v.beforeId && v.pageId !== v.afterId, "A page cannot anchor itself");
export type CreateBookInput = z.infer<typeof createBookBody>;
export type UpdateBookInput = z.infer<typeof updateBookBody>;
export type CreatePageInput = z.infer<typeof createPageBody>;
export type UpdatePageInput = z.infer<typeof updatePageBody>;
export type BooksQuery = z.infer<typeof listBooksQuery>;
export type PagesQuery = z.infer<typeof listPagesQuery>;
export type ReorderInput = z.infer<typeof reorderBody>;
