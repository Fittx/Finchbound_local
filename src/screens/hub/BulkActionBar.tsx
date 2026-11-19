import { MODERATION_ACTIONS } from "../../constants";
import { Button } from "../../ui";

/** Sticky on desktop, fixed to the bottom edge on tablet and mobile. */
export function BulkActionBar({
  count,
  pendingCount,
  onApprove,
  onReject,
  onCancel,
  busy,
  inline,
}: {
  count: number;
  pendingCount: number;
  onApprove: () => void;
  onReject: () => void;
  onCancel: () => void;
  busy?: boolean;
  /** Design boards: render in place instead of pinned to the viewport. */
  inline?: boolean;
}) {
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className={
        inline
          ? "rounded-lg bg-linen px-4 py-3 shadow-e3"
          : "anim-sheet fixed inset-x-0 bottom-0 z-40 rounded-t-xl bg-linen px-4 pt-3 pb-4 shadow-[0_-6px_20px_rgb(43_45_66/0.12)] md:px-8 lg:sticky lg:bottom-4 lg:mt-4 lg:rounded-lg lg:px-4 lg:py-3 lg:shadow-e3"
      }
    >
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-2">
        <p className="w-full t-body font-bold sm:mr-auto sm:w-auto" aria-live="polite">
          {count} selected
          {count > 0 && pendingCount !== count && (
            <span className="font-normal text-muted"> · {pendingCount} pending</span>
          )}
        </p>
        <Button variant="ghost" className="px-3" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          className="flex-1 px-3 sm:flex-none sm:px-4"
          disabled={!count || busy}
          onClick={onReject}
        >
          {MODERATION_ACTIONS.rejectAll}
        </Button>
        <Button
          className="flex-1 px-3 sm:flex-none sm:px-4"
          disabled={!pendingCount}
          loading={busy}
          onClick={onApprove}
        >
          {busy ? "Approving" : MODERATION_ACTIONS.approveAll}
        </Button>
      </div>
    </div>
  );
}
