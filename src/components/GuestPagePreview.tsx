import { useMemo, useRef, useState } from "react";
import { NotebookPage } from "../book";
import { LeafContent, useFlowBook, useLeafSize } from "./FlowBook";
import type { GuestEvent } from "../api/guest";
import { Button, cx } from "../ui";
export function GuestPagePreview({
  event,
  name,
  photo,
  message,
  className,
}: {
  event: GuestEvent;
  name: string;
  photo?: string;
  message: string;
  className?: string;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const size = useLeafSize(viewport);
  const pages = useMemo(
    () => [
      { id: "guest-preview", title: "", body: message, image: photo, author: name || undefined },
    ],
    [message, photo, name],
  );
  const leaves = useFlowBook(pages, event, size);
  const [selected, setSelected] = useState(0);
  const index = Math.min(selected, Math.max(0, leaves.length - 1));
  const move = (delta: number) =>
    setSelected(Math.max(0, Math.min(leaves.length - 1, index + delta)));
  return (
    <div
      className={className}
      tabIndex={0}
      aria-label="Book preview"
      onKeyDown={(e) => {
        if (
          e.defaultPrevented ||
          e.altKey ||
          e.ctrlKey ||
          e.metaKey ||
          (e.target as HTMLElement).closest("input,textarea,select,[role=dialog]")
        )
          return;
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          e.stopPropagation();
          move(e.key === "ArrowLeft" ? -1 : 1);
        }
      }}
      onTouchStart={(e) => {
        touch.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
      }}
      onTouchEnd={(e) => {
        if (!touch.current || (e.target as HTMLElement).closest("button")) return;
        const dx = e.changedTouches[0]!.clientX - touch.current.x;
        const dy = e.changedTouches[0]!.clientY - touch.current.y;
        touch.current = null;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1);
      }}
    >
      <div className={cx("rounded-lg p-2 shadow-e2")} style={{ background: event.theme.cover }}>
        <div ref={viewport} className="relative h-[600px] overflow-hidden rounded-sm">
          <NotebookPage look={event} number={index + 1}>
            <LeafContent leaf={leaves[index]} look={event} />
          </NotebookPage>
          <button
            type="button"
            aria-label="Previous preview page"
            disabled={!index}
            onClick={() => move(-1)}
            className="absolute inset-y-0 left-0 hidden w-11 hover:bg-black/5 focus-visible:bg-black/5 disabled:pointer-events-none min-[834px]:block"
          />
          <button
            type="button"
            aria-label="Next preview page"
            disabled={index >= leaves.length - 1}
            onClick={() => move(1)}
            className="absolute inset-y-0 right-0 hidden w-11 hover:bg-black/5 focus-visible:bg-black/5 disabled:pointer-events-none min-[834px]:block"
          />
        </div>
      </div>
      {leaves.length > 1 && (
        <nav aria-label="Preview pages" className="mt-2 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            disabled={!index}
            className="disabled:bg-wash disabled:opacity-40"
            onClick={() => move(-1)}
          >
            Previous
          </Button>
          <span role="status" className="t-caption">
            Page {index + 1} of {leaves.length}
          </span>
          <Button
            variant="ghost"
            disabled={index >= leaves.length - 1}
            className="disabled:bg-wash disabled:opacity-40"
            onClick={() => move(1)}
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}
