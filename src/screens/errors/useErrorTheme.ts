import { useApp } from "../../store";
/** Explicit book links and the immediately preceding book route retain their theme. */
export function useErrorTheme() {
  const { books, route } = useApp();
  const candidates = [route.query.get("book"), ...route.path, route.bookContext];
  const book = books.find((b) => candidates.includes(b.id) || candidates.includes(b.slug));
  return {
    book,
    style: book
      ? { background: book.theme.background, borderTop: `8px solid ${book.theme.cover}` }
      : undefined,
  };
}
