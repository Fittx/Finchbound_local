/** MOCK DATA: original books and themes reused; 48 books for scale previews. */
import { SEED_BOOKS } from "../data";
import { seedPages } from "./pages";
import type { Book } from "../types/books";
export const MOCK_BOOKS: Book[] = Array.from({ length: 48 }, (_, i) => {
  const b = SEED_BOOKS[i % SEED_BOOKS.length]!;
  const id = i < SEED_BOOKS.length ? b.id : `book-${i + 1}`;
  return {
    ...b,
    id,
    title: i < SEED_BOOKS.length ? b.title : `${b.title} · Memory ${i + 1}`,
    slug: i < SEED_BOOKS.length ? b.slug : `${b.slug}-${i + 1}`,
    pages: seedPages(b.pages, id),
  };
});
