import { EmptyNest } from "../../brand";
import { LoadMore } from "../../components/LoadMore";
import { ConfirmActionModal } from "../../components/ConfirmActionModal";
import { FEED_FILTERS, MODERATION_ACTIONS } from "../../constants";
import { useApp } from "../../store";
import type { Book } from "../../types/books";
import { Button, Dot, ErrorState, Skeleton, cx } from "../../ui";
import { BulkActionBar } from "./BulkActionBar";
import { EntryDetailModal } from "./EntryDetailModal";
import { FeedItem } from "./FeedItem";
import { ModerationBanner } from "./ModerationBanner";
import { ModerationToolbar } from "./ModerationToolbar";
import { displayName, type Moderation } from "./useModeration";

/** The Live flock column: banner, filters, entries, bulk bar, confirmations and detail. */
export function ModerationFeed({ book, mod }: { book: Book; mod: Moderation }) {
  const { reduced } = useApp();
  const loading = mod.status === "loading";
  const target = mod.confirm
    ? [...mod.entries, ...mod.reports].find((s) => s.id === mod.confirm!.ids[0])
    : undefined;
  const n = mod.confirm?.ids.length ?? 0;
  const tabLabel = FEED_FILTERS.find((f) => f.key === mod.filter)?.label.toLowerCase();

  return (
    <section
      className={cx("flex min-w-0 flex-col gap-4 lg:col-span-8", mod.selectMode && "max-lg:pb-36")}
      aria-labelledby="feed-h"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="feed-h" className="t-h2">
          Live flock ({mod.status === "ready" ? mod.counts.all : "…"})
        </h2>
        {mod.status === "ready" && (
          <span className="flex items-center gap-2 t-caption text-muted">
            <span className="anim-pulse">
              <Dot color={book.status === "open" ? "#2F7D57" : "#8A8C9C"} />
            </span>
            {book.status !== "open"
              ? "Guest submissions are closed"
              : mod.connected
                ? "Listening for new entries"
                : "Connecting to live updates"}
          </span>
        )}
      </div>

      {mod.strict && (
        <ModerationBanner
          count={mod.counts.pending}
          active={mod.filter === "pending"}
          loading={loading}
          onReview={() => mod.setFilter("pending")}
        />
      )}

      <ModerationToolbar mod={mod} />

      {loading && (
        <ul className="flex flex-col gap-4" aria-busy="true" aria-label="Loading entries">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex gap-4 rounded-lg bg-linen p-5 shadow-e1">
              <Skeleton className="size-11 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-2 h-11 w-40 self-end" />
              </div>
            </li>
          ))}
        </ul>
      )}

      {mod.status === "error" && (
        <div className="rounded-lg bg-linen shadow-e1">
          <ErrorState
            title="The feed paused"
            body="New entries are safe and will appear when you reconnect."
            onRetry={mod.retry}
          />
        </div>
      )}

      {mod.status === "ready" && !mod.filtered.length && (
        <div className="flex flex-col items-center gap-4 rounded-lg bg-linen px-6 py-12 text-center shadow-e1">
          {mod.filtersActive ? (
            <>
              <h3 className="t-h2">No results</h3>
              <p className="t-body">
                {mod.query
                  ? `Nothing matches "${mod.query.trim()}"`
                  : "No entries match these filters"}
                {mod.filter !== "all" && ` in ${tabLabel}`}.
              </p>
              <Button variant="secondary" onClick={mod.clearFilters}>
                {MODERATION_ACTIONS.clearFilters}
              </Button>
            </>
          ) : mod.filter === "pending" ? (
            <>
              <EmptyNest className="w-32" />
              <h3 className="t-h2">No pending entries</h3>
              <p className="t-body">You're all caught up. New entries will appear here.</p>
              <Button variant="secondary" onClick={() => mod.setFilter("all")}>
                Show all entries
              </Button>
            </>
          ) : mod.counts.all + mod.counts.rejected === 0 ? (
            <>
              <EmptyNest className="w-36" />
              <h3 className="t-h2">No entries yet</h3>
              <p className="t-body">
                Share the Scan to join code, and your flock will appear here.
              </p>
              <Button
                variant="secondary"
                onClick={() =>
                  document
                    .getElementById("scan-h")
                    ?.scrollIntoView({ behavior: "smooth", block: "center" })
                }
              >
                Go to Scan to join
              </Button>
            </>
          ) : (
            <>
              <h3 className="t-h2">Nothing in {tabLabel}</h3>
              <p className="t-body">Entries move here as you moderate them.</p>
              <Button variant="secondary" onClick={() => mod.setFilter("all")}>
                Show all entries
              </Button>
            </>
          )}
        </div>
      )}

      {mod.status === "ready" && mod.filtered.length > 0 && (
        <ul className="flex flex-col gap-4">
          {mod.filtered.map((s) => (
            <li key={s.id} className={cx(s.fresh && "anim-rise")}>
              <FeedItem
                s={s}
                reduced={reduced}
                selectMode={mod.selectMode}
                selected={mod.selected.has(s.id)}
                onToggleSelect={() => mod.toggleSelect(s.id)}
                busy={mod.busy[s.id]}
                error={mod.errors[s.id]}
                onOpen={() => (mod.selectMode ? mod.toggleSelect(s.id) : mod.setDetailId(s.id))}
                onReact={() => mod.react(s.id)}
                onAction={(a) => mod.act(a, s.id)}
              />
            </li>
          ))}
        </ul>
      )}
      {mod.status === "ready" && (mod.filtered.length > 0 || mod.nextCursor) && (
        <LoadMore
          noun="entries"
          count={mod.filtered.length}
          hasMore={!!mod.nextCursor}
          loading={mod.loadingMore}
          error={mod.moreError}
          onLoad={mod.loadMore}
        />
      )}

      {mod.selectMode && (
        <BulkActionBar
          count={mod.selected.size}
          pendingCount={mod.selectedPending.length}
          busy={mod.bulkBusy === "approve"}
          onApprove={mod.bulkApprove}
          onReject={mod.requestBulkReject}
          onCancel={mod.exitSelect}
        />
      )}

      <EntryDetailModal
        s={mod.detail}
        onClose={() => mod.setDetailId(null)}
        onAction={(a) => mod.detail && mod.act(a, mod.detail.id)}
        busy={mod.detail ? mod.busy[mod.detail.id] : undefined}
        error={mod.detail ? mod.errors[mod.detail.id] : undefined}
      />

      <ConfirmActionModal
        open={!!mod.confirm}
        onClose={() => mod.setConfirm(null)}
        onConfirm={mod.confirmAction}
        {...confirmCopy(
          mod.confirm?.kind,
          target ? displayName(target) : "this guest",
          n,
          !!target?.pageId,
        )}
      />
    </section>
  );
}

function confirmCopy(kind: string | undefined, name: string, n: number, inBook: boolean) {
  switch (kind) {
    case "delete":
      return {
        kind: "delete" as const,
        title: "Delete this entry?",
        consequence: `${name}'s entry${inBook ? " and its page" : ""} will be removed permanently.`,
        confirmLabel: "Delete entry",
        busyLabel: "Deleting",
      };
    case "bulk-reject":
      return {
        kind: "hide" as const,
        title: `Reject ${n} ${n === 1 ? "entry" : "entries"}?`,
        consequence: "They stay hidden from the book. You can restore them from Rejected.",
        confirmLabel: "Reject all",
        busyLabel: "Rejecting",
      };
    case "remove":
      return {
        kind: "hide" as const,
        title: "Remove this reported entry?",
        consequence: `${name}'s entry is hidden from the book and moves to Rejected. You can restore it.`,
        confirmLabel: "Remove entry",
        busyLabel: "Removing",
      };
    case "block":
      return {
        kind: "block" as const,
        title: `Block ${name}?`,
        consequence:
          "They can't add new pages to this book. Their existing entries stay as they are.",
        confirmLabel: "Block guest",
        busyLabel: "Blocking",
      };
    default:
      return {
        kind: "hide" as const,
        title: "Reject this entry?",
        consequence: inBook
          ? `${name}'s entry and its page leave the book. You can restore it from Rejected.`
          : `${name}'s entry stays hidden from the book. You can restore it from Rejected.`,
        confirmLabel: "Reject entry",
        busyLabel: "Rejecting",
      };
  }
}
