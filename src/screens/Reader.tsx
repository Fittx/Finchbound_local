import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Home, X } from "lucide-react";
import { NotebookPage, Polaroid, RightContent, Scaled, Spread, bookFont, useFlip } from "../book";
import { FeatherMark } from "../brand";
import { SEED_BOOKS, type Book, type Page } from "../data";
import { useApp } from "../store";
import { ApiError } from "../api/client";
import { getPublicBook } from "../api/books";
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
    getPublicBook(route.path[1] ?? "")
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
  }, [route.path[1], attempt]);
  const book = found ?? SEED_BOOKS[0]!;
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
  const pages = state === "default" && found ? found.pages : [];
  const { index, setIndex, turn, go } = useFlip(pages.length, reduced);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [dir, setDir] = useState<"next" | "prev">("next");
  const touch = useRef<number | null>(null);

  const nav = (d: "next" | "prev") => {
    setDir(d);
    if (mobile) {
      const to = d === "next" ? index + 1 : index - 1;
      if (to >= 0 && to < pages.length) setIndex(to);
    } else go(d);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (lightbox !== null) return;
      if (e.key === "ArrowRight") nav("next");
      if (e.key === "ArrowLeft") nav("prev");
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
  const current = pages[index];

  return (
    <div
      className={cx(
        "reader-layout canvas-grid fixed inset-0 flex flex-col overflow-hidden",
        landscape && "reader-landscape",
      )}
      style={canvasVars}
    >
      <header className="reader-header relative flex h-20 shrink-0 items-center justify-center px-20 md:px-44">
        <Button
          variant="inverse"
          size="icon"
          className="absolute! top-4 left-4 rounded-full shadow-e2"
          aria-label="Back to Finchbound"
          onClick={() => navigate("/dashboard")}
        >
          <Home className="size-5" aria-hidden="true" />
        </Button>
        {state !== "error" && ready && (
          <h1 className="truncate text-center" style={{ color: book.theme.header }}>
            {book.title}
          </h1>
        )}
        {(state === "default" || state === "empty") && found && (
          <div className="absolute right-4">
            <ExportBookButton book={book} pages={pages} />
          </div>
        )}
      </header>

      <main
        className="reader-main relative min-h-0 flex-1 px-4 pb-28 md:px-8"
        onTouchStart={(e) => (touch.current = e.touches[0]!.clientX)}
        onTouchEnd={(e) => {
          if (touch.current === null) return;
          const dx = e.changedTouches[0]!.clientX - touch.current;
          touch.current = null;
          if (Math.abs(dx) > 50) nav(dx < 0 ? "next" : "prev");
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
            <MobilePage book={book} page={undefined} empty />
          ) : (
            <Scaled w={920} h={600} max={1.15} fitHeight>
              <EmptySpread book={book} />
            </Scaled>
          ))}
        {state === "default" &&
          (mobile && !landscape ? (
            <div
              key={index}
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
                page={current}
                number={index + 1}
                onOpen={() => setLightbox(index)}
              />
            </div>
          ) : (
            <Scaled w={920} h={600} max={1.2} fitHeight>
              <Spread
                look={book}
                pages={pages}
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
          total={Math.max(pages.length, 1)}
          accent={book.theme.accent}
          onPrev={() => nav("prev")}
          onNext={() => nav("next")}
          disabled={state === "empty"}
        />
      )}

      {lightbox !== null && pages[lightbox]?.image && (
        <Lightbox page={pages[lightbox]!} onClose={() => setLightbox(null)} />
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
}: {
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
        className="reader-prev shrink-0 px-3 md:pr-4"
        aria-label="Previous spread"
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
        Spread {disabled ? 0 : index + 1} of {disabled ? 0 : total}
      </span>
      <Button
        variant="ghost"
        className="reader-next shrink-0 px-3 md:pl-4"
        aria-label="Next spread"
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
  page,
  number,
  onOpen,
  empty,
}: {
  book: Book;
  page?: Page;
  number?: number;
  onOpen?: () => void;
  empty?: boolean;
}) {
  return (
    <div
      className="mx-auto h-full max-h-[720px] w-full max-w-[440px] rounded-lg p-2 shadow-e3"
      style={{ background: book.theme.cover }}
    >
      <div className="h-full overflow-hidden rounded-sm">
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
            <div className="flex h-full flex-col">
              {page?.image && (
                <div className="flex shrink-0 justify-center pt-6 pr-6 pl-14">
                  <Polaroid
                    src={page.image}
                    caption={page.caption || page.author}
                    look={book}
                    onOpen={onOpen}
                    className="max-w-[min(220px,52vw)]"
                  />
                </div>
              )}
              <div className="min-h-0 flex-1">
                <RightContent page={page} look={book} compact />
              </div>
            </div>
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
