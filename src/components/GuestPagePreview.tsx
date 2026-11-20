import { NotebookPage, Polaroid, RightContent } from "../book";
import type { GuestEvent } from "../api/guest";
import { cx } from "../ui";
export function GuestPagePreview({ event, name, photo, message, className }: {
  event: GuestEvent; name: string; photo?: string; message: string; className?: string;
}) {
  return <div className={cx("rounded-lg p-2 shadow-e2", className)} style={{ background: event.theme.cover }}>
    <div className="h-[600px] overflow-hidden rounded-sm">
      <NotebookPage look={event} feather>
        <div className="flex h-full flex-col">
          {photo && <div className="mx-auto w-32 shrink-0 pt-4"><Polaroid src={photo} look={event} /></div>}
          <div className="min-h-0 flex-1"><RightContent look={event} compact page={{ id: "guest-preview", title: "", body: message, author: name || undefined }} /></div>
        </div>
      </NotebookPage>
    </div>
  </div>;
}
