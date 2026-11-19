import type { CursorQuery } from "./api.js";
import type { ACCESS_MODES, BOOK_KINDS, BOOK_VISIBILITIES, FONT_KEYS } from "../enums.js";

export type ThemeColors = {
  background: string;
  grid: string;
  cover: string;
  accent: string;
  text: string;
  header: string;
};

export type PresetKey = "golden" | "crimson" | "skyline" | "pine";
export type FontKey = (typeof FONT_KEYS)[number];
export type BookKind = (typeof BOOK_KINDS)[number];
export type Access = (typeof ACCESS_MODES)[number];
/** Who can open the published reader. */
export type Visibility = (typeof BOOK_VISIBILITIES)[number];

/** One Page is one spread in the reader. */
export type Page = {
  id: string;
  title: string;
  image?: string;
  cardImage?: string;
  caption?: string;
  editedAt?: string;
  header?: string;
  body: string;
  author?: string;
  /** Set when the page was created from a guest submission. */
  submissionId?: string;
};

export type Book = {
  id: string;
  title: string;
  slug: string;
  kind: BookKind;
  live: boolean;
  visibility: Visibility;
  entries: number;
  updated: string;
  preset: PresetKey | "custom";
  theme: ThemeColors;
  font: FontKey;
  lines: boolean;
  access: Access;
  photoRequired: boolean;
  messageRequired: boolean;
  /** Owned-book ordering version, read before submitting an anchored move. */
  version?: number;
  /** Guest collection metadata; independent of reader publication. */
  hosts?: string;
  prompt?: string;
  status?: "open" | "not-live" | "closed";
  pages: Page[];
};

export type ListBooksQuery = CursorQuery & { q?: string };
export type CreateBookRequest = Omit<
  Book,
  "id" | "entries" | "updated" | "pages" | "live" | "version"
>;
export type UpdateBookRequest = Partial<
  Pick<
    Book,
    | "title"
    | "slug"
    | "live"
    | "visibility"
    | "access"
    | "photoRequired"
    | "messageRequired"
    | "theme"
    | "font"
    | "lines"
    | "preset"
    | "hosts"
    | "prompt"
    | "status"
  >
>;
/** Trusted IDs, timestamps and submission associations are server-controlled. */
export type CreatePageRequest = Pick<
  Page,
  "title" | "image" | "cardImage" | "caption" | "header" | "body" | "author"
>;
/** Exactly one anchor is required. Version conflicts return 409 CONFLICT. */
export type ReorderPagesRequest = { pageId: string; expectedVersion: number } & (
  | { beforeId: string; afterId?: never }
  | { afterId: string; beforeId?: never }
);
export type ReorderPagesResponse = { pageId: string; order: number; version: number };

/** GET /api/public/books/:slug: only published, link-visible books; only pages in the book. */
export type PublicBookResponse = { book: Omit<Book, "pages">; pages: Page[] };
export type PublicBookResult =
  | { status: "ok"; pages: Page[] }
  | { status: "private" }
  | { status: "not-found" };
