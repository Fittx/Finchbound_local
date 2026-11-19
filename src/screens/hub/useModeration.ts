import { useCallback, useEffect, useRef, useState } from "react";
import { useCursorList } from "../../lib/useCursorList";
import { getPreset } from "../../api/previews";
import {
  addSubmissionToBook,
  approveSubmission,
  blockGuest,
  bulkModerate,
  listReports,
  acknowledgeBookReport,
  deleteSubmission,
  dismissReport,
  listSubmissions,
  rejectSubmission,
  restoreSubmission,
  subscribeToSubmissions,
  toggleReaction,
  updateSubmissionStatus,
} from "../../api/submissions";
import { useUndoToast } from "../../components/UndoToast";
import { ANONYMOUS_GUEST, MODERATION_ERRORS } from "../../constants";
import { useApp } from "../../store";
import type { Book } from "../../types/books";
import type { FeedFilter, Submission, SubmissionStatus } from "../../types/submissions";

export type ModerationAction =
  | "approve"
  | "reject"
  | "delete"
  | "addToBook"
  | "restore"
  | "openEditor";
export type ConfirmKind = "reject" | "delete" | "bulk-reject" | "block" | "remove";

/** Which actions fit each status. The first is shown as the main action. */
export const ACTIONS_FOR: Record<
  SubmissionStatus,
  { main: ModerationAction; more: ModerationAction[] }
> = {
  pending: { main: "approve", more: ["reject", "delete"] },
  approved: { main: "addToBook", more: ["reject", "delete"] },
  "in-book": { main: "openEditor", more: ["reject", "delete"] },
  rejected: { main: "restore", more: ["delete"] },
};

export const displayName = (s: Pick<Submission, "name">) => s.name.trim() || ANONYMOUS_GUEST;

export function useModeration(book: Book | undefined) {
  const { route, screenState, setScreenState, toast, navigate } = useApp();
  const undoToast = useUndoToast();
  const variant = route.query.get("variant");
  const preset = getPreset("hub", variant);
  const strict = book?.access === "strict";
  const bookId = book?.id;

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [entries, setEntries] = useState<Submission[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(variant === "more-error");
  const loadingLock = useRef(false);
  const requestVersion = useRef(0);
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<FeedFilter>((preset.filter as FeedFilter) ?? "all");
  const [query, setQuery] = useState(preset.query ?? "");
  const [withPhoto, setWithPhoto] = useState(!!preset.withPhoto);
  const [selectMode, setSelectMode] = useState(!!preset.select);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(preset.select ?? []));
  const [busy, setBusy] = useState<Record<string, string>>({});
  const [bulkBusy, setBulkBusy] = useState<"approve" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<{ kind: ConfirmKind; ids: string[] } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [counts, setCounts] = useState({
    all: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    "in-book": 0,
  });
  const [connected, setConnected] = useState(false);
  const hidden = useRef(new Set<string>());
  const loaded = useRef(0);
  const scope = JSON.stringify([bookId, filter, query, withPhoto]);
  const lastScope = useRef("");
  const refresh = useCallback(() => setAttempt((n) => n + 1), []);
  const reportsLoader = useCallback(
    (cursor?: string | null) =>
      bookId ? listReports(bookId, cursor) : Promise.resolve({ items: [], nextCursor: null }),
    [bookId, attempt],
  );
  const inbox = useCursorList(reportsLoader, null, bookId);
  const reports = inbox.items
    .flatMap((r) => (r.submission ? [r.submission] : []))
    .filter((s, i, a) => a.findIndex((x) => x.id === s.id) === i);
  const bookReports = inbox.items.filter((r) => !r.submission);
  useEffect(() => {
    if (!bookId) return;
    let alive = true;
    requestVersion.current++;
    loadingLock.current = false;
    setLoadingMore(variant === "more-loading");
    setMoreError(variant === "more-error");
    const target = lastScope.current === scope ? loaded.current : 0;
    if (!target) setStatus("loading");
    lastScope.current = scope;
    const load = async () => {
      const options = { status: filter, q: query, withPhoto };
      let page = await listSubmissions(bookId, options);
      const items = [...page.items];
      while (alive && page.nextCursor && items.length < target) {
        page = await listSubmissions(bookId, { ...options, cursor: page.nextCursor });
        items.push(...page.items);
      }
      if (!alive) return;
      loaded.current = items.length;
      setEntries(items.filter((s) => !hidden.current.has(s.id)));
      setCounts(page.counts);
      setNextCursor(page.nextCursor);
      setStatus("ready");
    };
    load().catch(() => alive && setStatus("error"));
    return () => {
      alive = false;
    };
  }, [bookId, attempt, scope, filter, query, withPhoto, variant]);
  useEffect(() => {
    if (bookId) return subscribeToSubmissions(bookId, refresh, setConnected);
  }, [bookId, refresh]);
  const filtered = entries.filter((s) =>
    filter === "all" ? s.status !== "rejected" : s.status === filter,
  );
  const q = query.trim();
  const filtersActive = !!q || withPhoto;
  const detail = entries.find((s) => s.id === detailId) ?? null;
  const selectedPending = [...selected].filter(
    (id) => entries.find((s) => s.id === id)?.status === "pending",
  );

  /* ---------- helpers ---------- */
  const replace = (list: Submission[]) =>
    setEntries((prev) => prev.map((x) => list.find((u) => u.id === x.id) ?? x));
  const run = async (id: string, action: string, fn: () => Promise<void>) => {
    setBusy((b) => ({ ...b, [id]: action }));
    setErrors(({ [id]: _, ...rest }) => rest);
    try {
      await fn();
      refresh();
    } catch {
      setErrors((e) => ({
        ...e,
        [id]: MODERATION_ERRORS[action] ?? "Something went wrong. Try again.",
      }));
    } finally {
      setBusy(({ [id]: _, ...rest }) => rest);
    }
  };
  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  /* ---------- actions ---------- */
  const approve = (id: string) =>
    run(id, "approve", async () => {
      const prev = entries.find((s) => s.id === id)?.status ?? "pending";
      const r = await approveSubmission(id);
      replace([r.submission]);
      undoToast("Entry approved", async () => {
        const u = await updateSubmissionStatus(id, { status: prev });
        replace([u.submission]);
      });
    });

  /** Throws on failure so the confirmation modal can show its error state. */
  const reject = async (ids: string[]) => {
    if (!bookId) return;
    const before = new Map(
      [...entries, ...reports].filter((s) => ids.includes(s.id)).map((s) => [s.id, s]),
    );
    let updated: Submission[];
    if (ids.length === 1) {
      const r = await rejectSubmission(ids[0]!);
      updated = [r.submission];
    } else {
      ({ updated } = await bulkModerate(bookId, { ids, action: "reject" }));
    }
    replace(updated);
    refresh();
    if (ids.length > 1) exitSelect();
    undoToast(
      updated.length === 1 ? "Entry rejected" : `${updated.length} entries rejected`,
      async () => {
        const restored = await Promise.all(
          updated.map((u) => {
            const b = before.get(u.id)!;
            return updateSubmissionStatus(u.id, { status: b.status, pageId: b.pageId });
          }),
        );
        replace(restored.map((r) => r.submission));
      },
    );
  };

  /** Hidden at once; committed with DELETE only after the Undo window closes. */
  const remove = (id: string) => {
    const index = entries.findIndex((s) => s.id === id);
    const entry = entries[index];
    if (!entry) return;
    setEntries((prev) => prev.filter((s) => s.id !== id));
    setSelected((sel) => {
      const n = new Set(sel);
      n.delete(id);
      return n;
    });
    hidden.current.add(id);
    undoToast(
      "Entry deleted",
      () => {
        hidden.current.delete(id);
        refresh();
      },
      async () => {
        try {
          await deleteSubmission(id);
        } catch {
          toast("Couldn't delete the entry.", { tone: "error" });
        } finally {
          hidden.current.delete(id);
          refresh();
        }
      },
    );
  };

  const addToBook = (id: string) =>
    run(id, "addToBook", async () => {
      if (!bookId) return;
      const r = await addSubmissionToBook(id);
      replace([r.submission]);
      toast("Added to book pages", {
        tone: "success",
        action: { label: "Open the editor", onClick: () => navigate(`/editor/${bookId}`) },
      });
    });

  const restore = (id: string) =>
    run(id, "restore", async () => {
      const r = await restoreSubmission(id);
      replace([r.submission]);
      toast("Entry restored to Approved");
    });

  const react = (id: string) => {
    setEntries((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, reacted: !s.reacted, reactions: s.reactions + (s.reacted ? -1 : 1) }
          : s,
      ),
    );
    toggleReaction(id).catch(() => setAttempt((a) => a + 1));
  };

  const bulkApprove = async () => {
    if (!bookId || !selectedPending.length) return;
    setBulkBusy("approve");
    try {
      const { updated } = await bulkModerate(bookId, { ids: selectedPending, action: "approve" });
      replace(updated);
      exitSelect();
      refresh();
      undoToast(
        `${updated.length} ${updated.length === 1 ? "entry" : "entries"} approved`,
        async () => {
          const r = await Promise.all(
            updated.map((u) => updateSubmissionStatus(u.id, { status: "pending" })),
          );
          replace(r.map((x) => x.submission));
        },
      );
    } catch {
      toast("We couldn't approve those entries. Try again.", { tone: "error" });
    } finally {
      setBulkBusy(null);
    }
  };

  const keepReport = (id: string) =>
    run(id, "keep", async () => {
      const r = await dismissReport(id);
      replace([r.submission]);
      toast("Report dismissed. The entry stays as it is");
    });

  const block = async (id: string) => {
    if (!bookId) return;
    const r = await blockGuest(bookId, id);
    setEntries((prev) =>
      prev.map((s) => (r.blockedSubmissionIds.includes(s.id) ? { ...s, guestBlocked: true } : s)),
    );
    toast("Guest blocked. They can't add new pages to this book");
  };

  const confirmAction = async () => {
    if (!confirm) return;
    const { kind, ids } = confirm;
    if (kind === "reject" || kind === "bulk-reject") await reject(ids);
    else if (kind === "delete") remove(ids[0]!);
    else if (kind === "remove") {
      await reject(ids);
      const r = await dismissReport(ids[0]!);
      replace([r.submission]);
    } else if (kind === "block") await block(ids[0]!);
    refresh();
    setConfirm(null);
    if (kind !== "block") setDetailId(null);
  };

  const act = (a: ModerationAction, id: string) => {
    if (a === "approve") return approve(id);
    if (a === "addToBook") return addToBook(id);
    if (a === "restore") return restore(id);
    if (a === "openEditor") return bookId && navigate(`/editor/${bookId}`);
    setConfirm({ kind: a === "reject" ? "reject" : "delete", ids: [id] });
  };

  const loadMore = async () => {
    if (!bookId || !nextCursor || loadingLock.current) return;
    const version = requestVersion.current;
    loadingLock.current = true;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const r = await listSubmissions(bookId, {
        cursor: nextCursor,
        status: filter,
        q: query,
        withPhoto,
      });
      if (version !== requestVersion.current) return;
      setEntries((prev) => [...prev, ...r.items.filter((x) => !prev.some((p) => p.id === x.id))]);
      loaded.current += r.items.length;
      setNextCursor(r.nextCursor);
    } catch {
      if (version === requestVersion.current) setMoreError(true);
    } finally {
      if (version === requestVersion.current) {
        setLoadingMore(false);
        loadingLock.current = false;
      }
    }
  };

  const retry = () => {
    if (screenState !== "default") setScreenState("default");
    setAttempt((a) => a + 1);
  };

  const toggleSelect = useCallback(
    (id: string) =>
      setSelected((sel) => {
        const n = new Set(sel);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      }),
    [],
  );

  return {
    status,
    entries,
    filtered,
    counts,
    reports,
    bookReports,
    inbox,
    acknowledge: async (id: string) => {
      if (bookId)
        try {
          await acknowledgeBookReport(bookId, id);
          refresh();
        } catch {
          toast("Couldn't dismiss the report.", { tone: "error" });
        }
    },
    strict,
    filter,
    setFilter,
    query,
    setQuery,
    withPhoto,
    setWithPhoto,
    filtersActive,
    clearFilters: () => {
      setQuery("");
      setWithPhoto(false);
    },
    selectMode,
    toggleSelectMode: () => (selectMode ? exitSelect() : setSelectMode(true)),
    exitSelect,
    selected,
    selectedPending,
    toggleSelect,
    busy,
    bulkBusy,
    errors,
    confirm,
    setConfirm,
    confirmAction,
    detail,
    setDetailId,
    act,
    react,
    bulkApprove,
    requestBulkReject: () => setConfirm({ kind: "bulk-reject", ids: [...selected] }),
    keepReport,
    requestRemove: (id: string) => setConfirm({ kind: "remove", ids: [id] }),
    requestBlock: (id: string) => setConfirm({ kind: "block", ids: [id] }),
    connected,
    nextCursor,
    loadMore,
    loadingMore,
    moreError,
    retry,
    variant,
  };
}

export type Moderation = ReturnType<typeof useModeration>;
