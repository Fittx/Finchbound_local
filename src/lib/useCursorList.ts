import { useEffect, useRef, useState } from "react";
import type { Paginated } from "../types/api";
/** Cancellation, duplicate prevention, recoverable append errors and frame states. */
export function useCursorList<T extends { id: string }>(
  loader: (cursor?: string | null, simulate?: string) => Promise<Paginated<T>>,
  variant: string | null,
  resetKey = "",
) {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadingMore, setLoadingMore] = useState(variant === "more-loading");
  const [moreError, setMoreError] = useState(variant === "more-error");
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const pending = useRef(false);
  const retainCount = useRef(0);
  const snapshot = useRef({ key: resetKey, count: 0, ready: false });
  snapshot.current.count = items.length;
  snapshot.current.ready = status === "ready";
  useEffect(() => {
    const id = ++generation.current;
    pending.current = false;
    const preserve = snapshot.current.key === resetKey && snapshot.current.ready;
    const targetCount = preserve ? Math.max(snapshot.current.count, retainCount.current) : 0;
    if (!preserve) retainCount.current = 0;
    snapshot.current.key = resetKey;
    if (!preserve) setStatus("loading");
    setMoreError(variant === "more-error");
    setLoadingMore(variant === "more-loading");
    (async () => {
      try {
        let r = await loader();
        const all = [...r.items];
        if (variant === "end" || variant === "more-items" || targetCount > all.length) {
          let once = false;
          while (
            r.nextCursor &&
            (variant === "end" || (variant === "more-items" && !once) || all.length < targetCount)
          ) {
            if (generation.current !== id) return;
            r = await loader(r.nextCursor);
            all.push(...r.items);
            once = true;
          }
        }
        if (generation.current !== id) return;
        setItems(all);
        setCursor(r.nextCursor);
        setStatus("ready");
      } catch {
        if (generation.current === id) setStatus("error");
      }
    })();
    return () => {
      generation.current++;
    };
  }, [loader, variant, attempt, resetKey]);
  const loadMore = async () => {
    if (!cursor || pending.current) return;
    const id = generation.current;
    pending.current = true;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const r = await loader(cursor);
      if (generation.current !== id) return;
      setItems((prev) => [...prev, ...r.items.filter((x) => !prev.some((p) => p.id === x.id))]);
      setCursor(r.nextCursor);
    } catch {
      if (generation.current === id) setMoreError(true);
    } finally {
      if (generation.current === id) {
        pending.current = false;
        setLoadingMore(false);
      }
    }
  };
  return {
    items,
    status,
    nextCursor: cursor,
    loadingMore,
    moreError,
    loadMore,
    retry: () => setAttempt((x) => x + 1),
    retainThrough: (count: number) => {
      retainCount.current = Math.max(retainCount.current, count);
    },
  };
}
