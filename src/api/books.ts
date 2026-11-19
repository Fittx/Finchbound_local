import { request, queryString } from "./client";
import type { Paginated } from "../types/api";
import type {
  Book,
  CreateBookRequest,
  ListBooksQuery,
  PublicBookResponse,
  UpdateBookRequest,
} from "../types/books";

type BookResponse = { book: Book };
export type BookSummary = Omit<Book, "pages">;
export const listBooks = (query: ListBooksQuery = {}) =>
  request<Paginated<BookSummary>>("/books" + queryString(query));
export const getBook = (id: string) => request<BookResponse>("/books/" + encodeURIComponent(id));
export const createBook = (body: CreateBookRequest) =>
  request<BookResponse>("/books", "POST", body);
export const checkSlug = (slug: string) =>
  request<{ available: boolean }>("/books/check-slug/" + encodeURIComponent(slug));
export const updateBookSettings = (book: BookSummary, patch: UpdateBookRequest) =>
  request<BookResponse>("/books/" + book.id, "PATCH", patch);
export const publishBook = (id: string) =>
  request<BookResponse>("/books/" + id + "/publish", "POST");
export const deleteBook = (id: string) => request<void>("/books/" + id, "DELETE");
export const restoreBook = (id: string) =>
  request<BookResponse>("/books/" + id + "/restore", "POST");
export const getPublicBook = (slug: string) =>
  request<PublicBookResponse>("/public/books/" + encodeURIComponent(slug));
