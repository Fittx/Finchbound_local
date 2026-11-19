import type { CursorQuery, Paginated } from "../types/api";
/** Mock opaque cursors are item IDs, so live arrivals do not shift offsets. */
export function paginate<T extends { id: string }>(
  items: T[],
  query: CursorQuery,
  defaultLimit: number,
): Paginated<T> {
  const start = query.cursor ? Math.max(0, items.findIndex((x) => x.id === query.cursor) + 1) : 0;
  const limit = Math.max(1, Math.min(100, query.limit ?? defaultLimit));
  const slice = items.slice(start, start + limit);
  return {
    items: slice,
    nextCursor: start + limit < items.length ? slice[slice.length - 1]!.id : null,
  };
}
