/** MOCK DATA: extends existing page fixtures for visible cursor pagination. */
import { SEED_BOOKS } from "../data";
import type { Page } from "../types/books";
export function seedPages(seed: Page[], bookId: string): Page[] {
  if (!seed.length) return [];
  return [
    ...seed,
    ...Array.from({ length: Math.max(0, 24 - seed.length) }, (_, i) => {
      const p = seed[i % seed.length]!;
      return {
        ...p,
        id: `${bookId}-memory-${i}`,
        submissionId: undefined,
        title: `Memory ${i + seed.length + 1}: ${p.title}`.slice(0, 60),
        image: i % 3 === 0 ? undefined : p.image,
        editedAt: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString(),
      };
    }),
  ];
}
export const MOCK_PAGES = seedPages(SEED_BOOKS[0]!.pages, "b1");
