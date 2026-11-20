import { useMemo, useRef, useState } from "react";
import { NotebookPage } from "../book";
import { LeafContent, useFlowBook, useLeafSize } from "./FlowBook";
import type { GuestEvent } from "../api/guest";
import { Button, cx } from "../ui";
export function GuestPagePreview({ event, name, photo, message, className }: {
  event: GuestEvent; name: string; photo?: string; message: string; className?: string;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const size = useLeafSize(viewport);
  const pages = useMemo(() => [{ id: "guest-preview", title: "", body: message, image: photo, author: name || undefined }], [message, photo, name]);
  const leaves = useFlowBook(pages, event, size);
  const [selected, setSelected] = useState(0);
  const index = Math.min(selected, Math.max(0, leaves.length - 1));
  return <div className={className}>
    <div className={cx("rounded-lg p-2 shadow-e2")} style={{ background: event.theme.cover }}>
      <div ref={viewport} className="h-[600px] overflow-hidden rounded-sm">
        <NotebookPage look={event} number={index + 1}><LeafContent leaf={leaves[index]} look={event} /></NotebookPage>
      </div>
    </div>
    {leaves.length > 1 && <nav aria-label="Preview pages" className="mt-2 flex items-center justify-between gap-2">
      <Button variant="ghost" disabled={!index} onClick={() => setSelected(index - 1)}>Previous</Button>
      <span role="status" className="t-caption">Page {index + 1} of {leaves.length}</span>
      <Button variant="ghost" disabled={index >= leaves.length - 1} onClick={() => setSelected(index + 1)}>Next</Button>
    </nav>}
  </div>;
}
