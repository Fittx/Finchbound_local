import type {
  Page,
  CreatePageRequest,
  ReorderPagesRequest,
  ReorderPagesResponse,
} from "../types/books";
import type { CursorQuery, Paginated } from "../types/api";
import { request, queryString } from "./client";
export type PageSort = "position" | "edited";
export type ListPagesQuery = CursorQuery & { q?: string; withPhoto?: boolean; sort?: PageSort };
export const listPages = (bookId: string, query: ListPagesQuery = {}) =>
  request<Paginated<Page>>("/books/" + bookId + "/pages" + queryString(query));
export const createPage = (bookId: string, body: CreatePageRequest) =>
  request<{ page: Page }>("/books/" + bookId + "/pages", "POST", body);
export const updatePage = (id: string, body: CreatePageRequest) =>
  request<{ page: Page }>("/pages/" + id, "PATCH", body);
export const deletePage = (id: string) => request<void>("/pages/" + id, "DELETE");
export const reorderPages = (bookId: string, body: ReorderPagesRequest) =>
  request<ReorderPagesResponse>("/books/" + bookId + "/pages/order", "PUT", body);
