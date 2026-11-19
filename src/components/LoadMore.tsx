import { useEffect, useRef, useState } from "react";
import { Button, type Force } from "../ui";
import { useApp } from "../store";
export function LoadMore({
  loading,
  error,
  hasMore,
  onLoad,
  noun = "items",
  count,
  disabled,
  force,
}: {
  loading: boolean;
  error: boolean;
  hasMore: boolean;
  onLoad: () => void;
  noun?: string;
  count?: number;
  disabled?: boolean;
  force?: Force;
}) {
  const { route } = useApp();
  const box = useRef<HTMLDivElement>(null);
  const message = useRef<HTMLParagraphElement>(null);
  const request = useRef<{ items: Set<Element>; count: number; trigger: Element | null } | null>(
    null,
  );
  const [announcement, setAnnouncement] = useState("");
  const scope = () => box.current?.closest("section, main");
  useEffect(() => {
    const pending = request.current;
    if (!pending || loading) return;
    request.current = null;
    if (error) return;
    const added = Math.max(0, (count ?? 0) - pending.count);
    setAnnouncement(`${added} more ${noun} loaded.`);
    const next = Array.from(
      scope()?.querySelectorAll<HTMLElement>("[data-loadmore-item]") ?? [],
    ).find((item) => !pending.items.has(item));
    // Respect users who moved focus elsewhere while the request was pending.
    if (document.activeElement === pending.trigger || document.activeElement === document.body) {
      const target = next ?? message.current;
      target?.setAttribute("tabindex", "-1");
      target?.focus();
    }
  }, [loading, error, count, noun]);
  const variant = route.query.get("variant");
  useEffect(() => {
    if (variant?.startsWith("more-") || variant === "end")
      box.current?.scrollIntoView({ block: "end" });
  }, [variant, count]);
  return (
    <div ref={box} className="flex flex-col items-center gap-3 py-6" aria-busy={loading}>
      <p
        ref={message}
        tabIndex={-1}
        role={error ? "alert" : "status"}
        className="t-caption text-muted"
      >
        {!error && !loading && announcement && <span className="sr-only">{announcement} </span>}
        {error
          ? `We couldn't load more ${noun}. Your existing items are still here.`
          : loading
            ? `Loading more ${noun}`
            : hasMore
              ? `${count ?? ""} ${noun} shown`
              : `You're all caught up. No more ${noun}.`}
      </p>
      {(hasMore || error) && (
        <Button
          variant="secondary"
          loading={loading}
          disabled={disabled}
          force={force}
          onClick={() => {
            request.current = {
              items: new Set(scope()?.querySelectorAll("[data-loadmore-item]")),
              count: count ?? 0,
              trigger: document.activeElement,
            };
            setAnnouncement("");
            onLoad();
          }}
        >
          {error ? "Retry" : `Load more ${noun}`}
        </Button>
      )}
    </div>
  );
}
