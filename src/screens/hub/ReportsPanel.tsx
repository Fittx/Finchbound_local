import { ShieldCheck } from "lucide-react";
import { StatusText } from "../../components/StatusText";
import { MODERATION_ACTIONS } from "../../constants";
import { initials } from "../../data";
import { timeAgo } from "../../lib/time";
import { Button, Skeleton } from "../../ui";
import { reasonLabel } from "./FeedItem";
import { displayName, type Moderation } from "./useModeration";

/** Entries guests flagged from the guest page. Keep dismisses, Remove hides, Block stops new pages. */
export function ReportsPanel({ mod }: { mod: Moderation }) {
  const items = mod.reports;
  return (
    <section
      id="reports"
      aria-labelledby="reports-h"
      className="scroll-mt-24 rounded-lg bg-linen p-6 shadow-e1"
    >
      <h2 id="reports-h" className="t-h2">
        Reports{mod.inbox.status === "ready" && ` (${items.length + mod.bookReports.length})`}
      </h2>
      <p className="mt-1 t-caption text-muted">Guests can flag a page from the guest screen.</p>

      {mod.inbox.status === "loading" && (
        <div className="mt-5 flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-28 w-full rounded-md" />
          <Skeleton className="h-28 w-full rounded-md" />
        </div>
      )}
      {mod.inbox.status === "error" && (
        <div className="mt-5 flex flex-col items-start gap-2">
          <p className="t-body">Reports didn't load.</p>
          <Button variant="secondary" onClick={mod.inbox.retry}>
            Try again
          </Button>
        </div>
      )}
      {mod.inbox.status === "ready" && !items.length && !mod.bookReports.length && (
        <p className="mt-5 flex items-center gap-3 t-body">
          <ShieldCheck className="size-5 shrink-0 text-pine" aria-hidden="true" />
          No reports right now.
        </p>
      )}
      {mod.bookReports.map((r) => (
        <div key={r.id} className="mt-4 rounded-md bg-wash p-4">
          <p className="font-bold">Book report</p>
          <p>{reasonLabel(r.reason)}</p>
          {r.details && <p>{r.details}</p>}
          <Button variant="secondary" onClick={() => mod.acknowledge(r.id)}>
            Dismiss report
          </Button>
        </div>
      ))}
      {mod.inbox.status === "ready" && items.length > 0 && (
        <ul className="mt-5 flex flex-col gap-3">
          {items.map((s) => (
            <li key={s.id} className="flex flex-col gap-3 rounded-md bg-wash p-4">
              <div className="flex items-start gap-3">
                {s.photo ? (
                  <img
                    src={s.photo.replace("w=800", "w=200")}
                    alt=""
                    className="size-12 shrink-0 rounded-sm object-cover"
                  />
                ) : (
                  <span
                    className="flex size-12 shrink-0 items-center justify-center rounded-sm bg-linen t-caption font-bold"
                    aria-hidden="true"
                  >
                    {initials(displayName(s))}
                  </span>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-3">
                    <span className="truncate t-body font-bold">{displayName(s)}</span>
                    <StatusText status={s.status} />
                  </div>
                  <p className="t-caption">
                    {reasonLabel(s.report!.reason)} · {s.report!.count}{" "}
                    {s.report!.count === 1 ? "report" : "reports"} ·{" "}
                    {timeAgo(s.report!.lastReportedAt)}
                  </p>
                  <p className="line-clamp-2 t-caption">{s.message}</p>
                </div>
              </div>
              {mod.errors[s.id] && <p className="t-caption">{mod.errors[s.id]}</p>}
              <div className="flex flex-wrap gap-1">
                <Button
                  variant="secondary"
                  className="bg-linen px-4 hover:bg-wash-strong"
                  loading={mod.busy[s.id] === "keep"}
                  onClick={() => mod.keepReport(s.id)}
                >
                  {MODERATION_ACTIONS.keep}
                </Button>
                {s.status !== "rejected" && (
                  <Button variant="ghost" className="px-3" onClick={() => mod.requestRemove(s.id)}>
                    {MODERATION_ACTIONS.remove}
                  </Button>
                )}
                {s.guestBlocked ? (
                  <span className="flex min-h-11 items-center px-3 t-caption font-medium">
                    Guest blocked
                  </span>
                ) : (
                  <Button variant="ghost" className="px-3" onClick={() => mod.requestBlock(s.id)}>
                    {MODERATION_ACTIONS.blockGuest}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {mod.inbox.nextCursor && (
        <Button loading={mod.inbox.loadingMore} onClick={mod.inbox.loadMore}>
          {mod.inbox.moreError ? "Retry" : "Load more reports"}
        </Button>
      )}
    </section>
  );
}
