import { useCallback, useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import {
  adminRemoveSubmission,
  adminUnpublishBook,
  dismissAdminReport,
  listAdminReports,
  type AdminReport,
  type PlatformReportStatus,
} from "../api/admin";
import { ApiError } from "../api/client";
import { ConfirmActionModal } from "../components/ConfirmActionModal";
import { FilterTabs } from "../components/FilterTabs";
import { HostMenu } from "../components/HostMenu";
import { REPORT_REASONS } from "../constants";
import { BackLink, Container, TopBar } from "../shell";
import { useApp } from "../store";
import { Button, ErrorState, Spinner } from "../ui";

const TABS: { key: PlatformReportStatus; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "actioned", label: "Actioned" },
  { key: "dismissed", label: "Dismissed" },
];
type Pending = { kind: "unpublish" | "remove"; report: AdminReport } | null;
const reasonLabel = (value: string) =>
  REPORT_REASONS.find((r) => r.value === value)?.label ?? value;

export function Admin() {
  const { navigate, toast } = useApp();
  const [status, setStatus] = useState<PlatformReportStatus>("open");
  const [items, setItems] = useState<AdminReport[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [attempt, setAttempt] = useState(0);

  const fail = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.code === "UNAUTHORIZED") {
        navigate("/signin?next=/admin");
        return true;
      }
      if (e instanceof ApiError && e.code === "FORBIDDEN") {
        setState("forbidden");
        return true;
      }
      return false;
    },
    [navigate],
  );

  useEffect(() => {
    let active = true;
    setState("loading");
    listAdminReports(status)
      .then((page) => {
        if (!active) return;
        setItems(page.items);
        setCursor(page.nextCursor);
        setState("ready");
      })
      .catch((e) => {
        if (active && !fail(e)) setState("error");
      });
    return () => {
      active = false;
    };
  }, [status, attempt, fail]);

  const loadMore = async () => {
    if (!cursor || more) return;
    setMore(true);
    try {
      const page = await listAdminReports(status, cursor);
      setItems((old) => [...old, ...page.items]);
      setCursor(page.nextCursor);
    } catch (e) {
      if (!fail(e)) toast("Couldn't load more reports.", { tone: "error" });
    } finally {
      setMore(false);
    }
  };

  const dismiss = async (report: AdminReport) => {
    setBusy(report.id);
    try {
      await dismissAdminReport(report.id);
      setItems((old) => old.filter((r) => r.id !== report.id));
      toast("Report dismissed");
    } catch (e) {
      if (!fail(e)) toast("Couldn't dismiss the report. Refresh and try again.", { tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  const confirm = async () => {
    if (!pending) return;
    const { kind, report } = pending;
    if (kind === "unpublish") await adminUnpublishBook(report.book!.id);
    else await adminRemoveSubmission(report.submission!.id);
    setPending(null);
    toast(kind === "unpublish" ? "Book unpublished" : "Entry removed");
    setAttempt((n) => n + 1);
  };

  return (
    <div className="min-h-dvh bg-nest">
      <TopBar>
        <HostMenu />
      </TopBar>
      <Container className="py-8 md:py-12">
        <main className="mx-auto flex max-w-3xl flex-col gap-6">
          <BackLink href="/dashboard">Your books</BackLink>
          <div className="-mt-2 flex flex-col gap-2">
            <h1 className="t-h1">Admin reports</h1>
            <p className="t-body text-muted">
              Books reported by readers and guests. Hosts can't see this queue.
            </p>
          </div>
          {state !== "forbidden" && (
            <FilterTabs label="Report status" tabs={TABS} value={status} onChange={setStatus} />
          )}
          {state === "loading" && (
            <div role="status" className="flex items-center gap-3 py-12 text-muted">
              <Spinner /> Loading reports
            </div>
          )}
          {state === "forbidden" && (
            <ErrorState
              title="Admins only"
              body="This page is for Finchbound admins."
              onRetry={() => navigate("/dashboard")}
              action="Go to your books"
            />
          )}
          {state === "error" && (
            <ErrorState
              title="Couldn't load reports"
              body="Check your connection and try again."
              onRetry={() => setAttempt((n) => n + 1)}
            />
          )}
          {state === "ready" && items.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <ShieldAlert className="size-8 text-muted" aria-hidden="true" />
              <p className="t-body text-muted">No {status} reports.</p>
            </div>
          )}
          {state === "ready" && items.length > 0 && (
            <ul className="flex flex-col gap-4">
              {items.map((report) => (
                <li
                  key={report.id}
                  className="flex flex-col gap-3 rounded-lg bg-linen p-5 shadow-e1"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="t-body font-medium">{reasonLabel(report.reason)}</h2>
                    <span className="t-caption text-muted">
                      {new Date(report.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {report.details && (
                    <p className="whitespace-pre-wrap break-words t-body">{report.details}</p>
                  )}
                  {report.book ? (
                    <p className="t-caption">
                      Book:{" "}
                      <a className="underline" href={`/reader/${report.book.slug}`}>
                        {report.book.title}
                      </a>{" "}
                      · {report.book.kind === "event" ? "Event" : "Personal"} ·{" "}
                      {report.book.deleted
                        ? "Deleted"
                        : report.book.live
                          ? "Published"
                          : "Not published"}{" "}
                      · Owner {report.book.ownerEmail || "unknown"}
                    </p>
                  ) : (
                    <p className="t-caption text-muted">The book no longer exists.</p>
                  )}
                  {report.submission && (
                    <div className="rounded-md bg-wash p-3 t-caption">
                      <p className="font-medium">
                        Entry from {report.submission.name || "Anonymous guest"} (
                        {report.submission.status})
                      </p>
                      {report.submission.message && (
                        <p className="whitespace-pre-wrap break-words">
                          {report.submission.message}
                        </p>
                      )}
                      {report.submission.photo && (
                        <img
                          src={report.submission.photo.replace(/\/page$/, "/thumbnail")}
                          alt={`Photo from ${report.submission.name || "a guest"}`}
                          className="mt-2 max-h-40 rounded-sm"
                        />
                      )}
                    </div>
                  )}
                  {report.status === "open" && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        loading={busy === report.id}
                        onClick={() => dismiss(report)}
                      >
                        Dismiss
                      </Button>
                      {report.book && !report.book.deleted && report.book.live && (
                        <Button
                          variant="destructive"
                          onClick={() => setPending({ kind: "unpublish", report })}
                        >
                          Unpublish book
                        </Button>
                      )}
                      {report.submission && (
                        <Button
                          variant="destructive"
                          onClick={() => setPending({ kind: "remove", report })}
                        >
                          Remove entry
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {state === "ready" && cursor && (
            <Button variant="secondary" loading={more} onClick={loadMore} className="self-center">
              Load more
            </Button>
          )}
        </main>
      </Container>
      <ConfirmActionModal
        open={!!pending}
        onClose={() => setPending(null)}
        kind={pending?.kind === "unpublish" ? "hide" : "delete"}
        title={pending?.kind === "unpublish" ? "Unpublish this book?" : "Remove this entry?"}
        consequence={
          pending?.kind === "unpublish"
            ? "The public link stops working and guest collection closes. The owner can republish."
            : "This permanently deletes the guest entry and its page."
        }
        confirmLabel={pending?.kind === "unpublish" ? "Unpublish" : "Remove entry"}
        busyLabel={pending?.kind === "unpublish" ? "Unpublishing" : "Removing"}
        onConfirm={confirm}
      />
    </div>
  );
}
