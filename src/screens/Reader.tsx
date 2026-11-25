import { bookPageLabel } from "../lib/pagination";
import {
  FlowSpread,
  LeafContent,
  useFlowBook,
  useLeafSize,
  SPREAD_LEAF,
  type BookLeaf,
} from "../components/FlowBook";
import { BookFeedback } from "../components/BookFeedback";
import { listPages } from "../api/pages";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Flag, Home, X } from "lucide-react";
import { ReportContentModal } from "../components/ReportContentModal";
import { useSession } from "../api/session";
import { NotebookPage, Scaled, bookFont, useFlip } from "../book";
import { FeatherMark } from "../brand";
import { PRESETS, type Book, type Page } from "../data";
import { useApp } from "../store";
import { ApiError } from "../api/client";
import { getBook, getPublicBook } from "../api/books";
import { ExportBookButton } from "../components/ExportBookButton";
import { ReaderError } from "./reader/ReaderError";
import { Button, Spinner, cx } from "../ui";

function useMedia(q: string) {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return m;
}

export function Reader() {
  const { route, navigate, screenState, reduced } = useApp();
  const [unavailable, setUnavailable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [found, setFound] = useState<Book>();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    setReady(false);
    setUnavailable(false);
    setFound(undefined);
    const load = async () => {
      const ownerId = route.query.get("preview");
      if (!ownerId) return getPublicBook(route.path[1] ?? "");
      const { book } = await getBook(ownerId);
      const pages: Page[] = [];
      let cursor: string | undefined;
      do {
        const batch = await listPages(ownerId, { cursor, limit: 50, sort: "position" });
        pages.push(...batch.items);
        cursor = batch.nextCursor ?? undefined;
      } while (cursor);
      return { book, pages };
    };
    load()
      .then(({ book, pages }) => {
        if (active) setFound({ ...book, pages });
      })
      .catch((e) => {
        if (active) setUnavailable(!(e instanceof ApiError && e.code === "NOT_FOUND"));
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [route.path[1], route.query.get("preview"), attempt]);
  const book: Book = found ?? {
    id: "",
    title: "",
    slug: "",
    kind: "personal",
    live: false,
    visibility: "private",
    theme: PRESETS.crimson.colors,
    font: "sans",
    lines: true,
    preset: "crimson",
    access: "name",
    photoRequired: false,
    messageRequired: false,
    pages: [],
    entries: 0,
    updated: "",
  };
  const mobile = useMedia("(max-width: 833px)");
  const landscape = useMedia("(max-height: 559px) and (orientation: landscape)");
  // Only published, link-visible books; only spreads that are In book.
  const state =
    screenState !== "default"
      ? screenState
      : !ready
        ? "loading"
        : !found
          ? "error"
          : found.pages.length
            ? "default"
            : "empty";
  const originalPages = useMemo(
    () => (state === "default" && found ? found.pages : []),
    [state, found],
  );
  const leafViewport = useRef<HTMLDivElement>(null);
  const mobileSize = useLeafSize(leafViewport);
  const singlePage = mobile && !landscape;
  const leaves = useFlowBook(originalPages, book, singlePage ? mobileSize : SPREAD_LEAF);
  const total = singlePage ? leaves.length : Math.ceil(leaves.length / 2);
  const { index: rawIndex, setIndex, turn, go } = useFlip(total, reduced);
  const index = Math.min(rawIndex, Math.max(0, total - 1));
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [reporting, setReporting] = useState(false);
  const session = useSession();
  const [dir, setDir] = useState<"next" | "prev">("next");
  const touch = useRef<{ x: number; y: number } | null>(null);

  const nav = (d: "next" | "prev") => {
    setDir(d);
    const to = d === "next" ? index + 1 : index - 1;
    if (to >= 0 && to < total) {
      if (singlePage || rawIndex !== index) setIndex(to);
      else go(d);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey ||
        lightbox !== null ||
        (e.target as HTMLElement)?.closest(
          "input, textarea, select, [contenteditable=true], [role=combobox], [role=dialog]",
        )
      )
        return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        nav("next");
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        nav("prev");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const canvasVars = {
    ["--canvas-bg" as string]: found ? book.theme.background : "#FDFBF7",
    ["--canvas-line" as string]: found
      ? `color-mix(in srgb, ${book.theme.grid} 50%, ${book.theme.background})`
      : "#EFE9DE",
  };
  const current = leaves[index];
  // Guest pages on screen, so a reader can report a specific entry to Finchbound.
  const visibleEntries = (singlePage ? [current] : [leaves[index * 2], leaves[index * 2 + 1]])
    .map((leaf) => leaf?.source)
    .filter((page, i, all): page is Page => !!page?.submissionId && all.indexOf(page) === i)
    .map((page) => ({ submissionId: page.submissionId!, title: page.title }));

  return (
    <div
      className={cx(
        "reader-layout canvas-grid fixed inset-0 flex flex-col overflow-hidden",
        landscape && "reader-landscape",
      )}
      style={canvasVars}
    >
      <header className="reader-header relative flex h-20 shrink-0 items-center justify-center pr-44 pl-20 md:px-48">
        <Button
          variant="inverse"
          size="icon"
          className="absolute! top-4 left-4 rounded-full shadow-e2"
          aria-label={session ? "Back to your books" : "Finchbound home"}
          onClick={() => navigate(session ? "/dashboard" : "/")}
        >
          <Home className="size-5" aria-hidden="true" />
        </Button>
        {state !== "error" && ready && (
          <h1 className="truncate text-center" style={{ color: book.theme.header }}>
            {book.title}
          </h1>
        )}
        {(state === "default" || state === "empty") && found && (
          <div className="absolute right-4 flex items-center gap-2">
            {!route.query.get("preview") && <BookFeedback slug={book.slug} />}
            {!route.query.get("preview") && (
              <Button
                variant="secondary"
                size="icon"
                aria-label="Report this book to Finchbound"
                onClick={() => setReporting(true)}
              >
                <Flag className="size-5" aria-hidden="true" />
              </Button>
            )}
            <ExportBookButton book={book} pages={originalPages} />
          </div>
        )}
      </header>
      {found && (
        <ReportContentModal
          open={reporting}
          onClose={() => setReporting(false)}
          slug={book.slug}
          target="platform"
          entries={visibleEntries}
        />
      )}

      <main
        className="reader-main relative min-h-0 flex-1 px-4 pb-28 md:px-8"
        onTouchStart={(e) => {
          touch.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
        }}
        onTouchEnd={(e) => {
          if (touch.current === null) return;
          const dx = e.changedTouches[0]!.clientX - touch.current.x;
          const dy = e.changedTouches[0]!.clientY - touch.current.y;
          touch.current = null;
          if (
            !(e.target as HTMLElement).closest("button, [role=dialog]") &&
            Math.abs(dx) > 50 &&
            Math.abs(dx) > Math.abs(dy)
          )
            nav(dx < 0 ? "next" : "prev");
        }}
      >
        {state === "loading" && (
          <div className="flex h-full flex-col items-center justify-center gap-3" aria-busy="true">
            <Spinner className="size-7" />
            <p className="t-body">Opening the book</p>
          </div>
        )}
        {state === "error" &&
          (unavailable ? (
            <div className="flex h-full flex-col items-center justify-center gap-4" role="alert">
              <p>Couldn't load the book. Check your connection.</p>
              <Button onClick={() => setAttempt((n) => n + 1)}>Retry</Button>
            </div>
          ) : (
            <ReaderError kind="not-found" />
          ))}
        {state === "empty" &&
          (mobile && !landscape ? (
            <MobilePage book={book} empty />
          ) : (
            <Scaled w={920} h={600} max={1.15} fitHeight>
              <EmptySpread book={book} />
            </Scaled>
          ))}
        {state === "default" &&
          (mobile && !landscape ? (
            <div
              className={cx("h-full", reduced ? "anim-fade" : "")}
              style={
                reduced
                  ? undefined
                  : {
                      animation: `fb-slide-in-${dir === "next" ? "right" : "left"} 260ms ease-out both`,
                    }
              }
            >
              <MobilePage
                book={book}
                leaf={current}
                viewportRef={leafViewport}
                number={index + 1}
                onOpen={() => setLightbox(index)}
              />
            </div>
          ) : (
            <Scaled w={920} h={600} max={1.2} fitHeight>
              <FlowSpread
                onPrev={() => nav("prev")}
                onNext={() => nav("next")}
                look={book}
                leaves={leaves}
                index={index}
                turn={turn}
                reduced={reduced}
                onOpen={(i) => setLightbox(i)}
              />
            </Scaled>
          ))}
      </main>

      {(state === "default" || state === "empty") && (
        <ReaderToolbar
          index={index}
          total={Math.max(total, 1)}
          singlePage={singlePage}
          pageCount={leaves.length}
          accent={book.theme.accent}
          onPrev={() => nav("prev")}
          onNext={() => nav("next")}
          disabled={state === "empty"}
        />
      )}

      {lightbox !== null && leaves[lightbox]?.source.image && (
        <Lightbox page={leaves[lightbox]!.source} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}

export function ReaderToolbar({
  index,
  total,
  accent,
  onPrev,
  onNext,
  disabled,
  className,
  singlePage,
  pageCount,
}: {
  pageCount?: number;
  singlePage?: boolean;
  index: number;
  total: number;
  accent: string;
  onPrev?: () => void;
  onNext?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <nav
      aria-label="Page navigation"
      className={cx(
        "reader-toolbar fixed bottom-6 left-1/2 z-30 flex max-w-[calc(100vw-16px)] -translate-x-1/2 items-center gap-1 rounded-md bg-linen p-2 shadow-e2",
        className,
      )}
    >
      <Button
        variant="ghost"
        className="reader-prev shrink-0 px-3 md:pr-4 disabled:bg-wash disabled:opacity-40"
        aria-label={singlePage ? "Previous page" : "Previous spread"}
        onClick={onPrev}
        disabled={disabled || index === 0}
        icon={<ChevronLeft className="size-5" aria-hidden="true" />}
      >
        Prev
      </Button>
      <span
        className="reader-count flex min-w-0 items-center justify-center gap-2 px-2 t-caption whitespace-nowrap font-medium tabular-nums"
        aria-live="polite"
      >
        <FeatherMark className="reader-feather size-4 shrink-0" color={accent} />
        {bookPageLabel(index, disabled ? 0 : (pageCount ?? total), singlePage)}
      </span>
      <Button
        variant="ghost"
        className="reader-next shrink-0 px-3 md:pl-4 disabled:bg-wash disabled:opacity-40"
        aria-label={singlePage ? "Next page" : "Next spread"}
        onClick={onNext}
        disabled={disabled || index >= total - 1}
        iconRight={<ChevronRight className="size-5" aria-hidden="true" />}
      >
        Next
      </Button>
    </nav>
  );
}

function MobilePage({
  book,
  leaf,
  viewportRef,
  number,
  onOpen,
  empty,
}: {
  book: Book;
  leaf?: BookLeaf;
  viewportRef?: import("react").RefObject<HTMLDivElement | null>;
  number?: number;
  onOpen?: () => void;
  empty?: boolean;
}) {
  return (
    <div
      className="mx-auto h-full max-h-[720px] w-full max-w-[440px] rounded-lg p-2 shadow-e3"
      style={{ background: book.theme.cover }}
    >
      <div ref={viewportRef} className="h-full overflow-hidden rounded-sm">
        <NotebookPage look={book} feather number={number}>
          {empty ? (
            <div className="flex h-full flex-col justify-center pr-6 pl-16">
              <p
                style={{ ...bookFont(book.font, 24), lineHeight: "32px", color: book.theme.header }}
              >
                This book has no pages yet
              </p>
              <p style={{ ...bookFont(book.font, 17), lineHeight: "32px", color: book.theme.text }}>
                Check back after the celebration.
              </p>
            </div>
          ) : (
            <LeafContent leaf={leaf} look={book} onOpen={onOpen} />
          )}
        </NotebookPage>
      </div>
    </div>
  );
}

function EmptySpread({ book }: { book: Book }) {
  return (
    <div
      className="rounded-lg p-2.5 shadow-e3"
      style={{ background: book.theme.cover, width: 920, height: 600 }}
    >
      <div className="grid size-full grid-cols-2 overflow-hidden rounded-sm">
        <NotebookPage look={book} side="left" />
        <NotebookPage look={book} side="right" feather>
          <div className="flex h-full flex-col justify-center pr-10 pl-16">
            <p style={{ ...bookFont(book.font, 28), lineHeight: "32px", color: book.theme.header }}>
              This book has no pages yet
            </p>
            <p
              className="mt-4"
              style={{ ...bookFont(book.font, 18), lineHeight: "32px", color: book.theme.text }}
            >
              Check back after the celebration.
            </p>
          </div>
        </NotebookPage>
      </div>
    </div>
  );
}

function Lightbox({ page, onClose }: { page: Page; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") (e.preventDefault(), close.current?.focus());
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photo: ${page.title}`}
      className="anim-fade fixed inset-0 z-50 flex flex-col bg-slate"
      onClick={onClose}
    >
      <div className="flex h-16 shrink-0 items-center justify-between gap-4 pr-2 pl-5 text-white">
        <p className="truncate t-body font-medium">
          {page.title}
          {page.author && ` · From ${page.author}`}
        </p>
        <button
          ref={close}
          type="button"
          onClick={onClose}
          aria-label="Close photo"
          className="flex size-11 items-center justify-center rounded-full hover:bg-white/10 dark-surface-focus"
        >
          <X className="size-6" aria-hidden="true" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 pb-10 md:p-10">
        <img
          src={page.image!.replace("w=800", "w=1800")}
          alt={page.caption || (page.author ? `Photo from ${page.author}` : page.title)}
          className="max-h-full max-w-full rounded-sm object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}
