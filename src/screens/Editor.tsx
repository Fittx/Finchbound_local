import { BookFeedback } from "../components/BookFeedback";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { ExportBookButton } from "../components/ExportBookButton";
import { LoadMore } from "../components/LoadMore";
import { SortSelect } from "../components/SortSelect";
import { Checkbox } from "../components/Checkbox";
import { CropModal } from "../components/CropModal";
import {
  createPage,
  updatePage,
  deletePage,
  reorderPages,
  listPages,
  type PageSort,
} from "../api/pages";
import { publishBook } from "../api/books";
import { useOwnedBook } from "../hooks/useOwnedBook";
import { ConfirmActionModal } from "../components/ConfirmActionModal";
import { uploadHostImage } from "../api/uploads";
import { useCursorList } from "../lib/useCursorList";

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Eye,
  GripVertical,
  ImagePlus,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { FeatherBurst, NotebookPage, bookFont } from "../book";
import { EmptyNest } from "../brand";
import { type Book, type Page } from "../data";
import { useApp } from "../store";
import { ACCEPTED_IMAGE_TYPES, ACCEPTED_IMAGE_LABEL, LIMITS } from "../constants";
import {
  Button,
  CopyButton,
  ErrorState,
  Input,
  Modal,
  OverflowMenu,
  Skeleton,
  Spinner,
  Status,
  Textarea,
  cx,
  type Force,
} from "../ui";

export function Editor() {
  const { route, navigate, screenState, setScreenState, reduced, toast } = useApp();
  const bookId = route.path[1] ?? "";
  const { book, setBook, refresh, error } = useOwnedBook(bookId);
  const [moving, setMoving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Page | null>(null);
  const [previewOrder, setPreviewOrder] = useState<Page[] | null>(null);
  const variant = route.query.get("variant") ?? "";
  const [query, setQuery] = useState(
    variant === "no-results" ? "No matching title" : variant === "search" ? "toast" : "",
  );
  const [withPhoto, setWithPhoto] = useState(variant === "with-photo");
  const [sort, setSort] = useState<PageSort>(variant === "edited" ? "edited" : "position");
  const reorderDisabled = !!query.trim() || withPhoto || sort !== "position";
  const loader = useCallback(
    (cursor?: string | null) => listPages(bookId, { cursor, q: query, withPhoto, sort }),
    [bookId, book?.version, query, withPhoto, sort],
  );
  const list = useCursorList(loader, variant, JSON.stringify([query, withPhoto, sort]));
  const [editing, setEditing] = useState<Page | "new" | null>(
    variant.startsWith("crop") || variant === "page-modal" ? (book?.pages[0] ?? "new") : null,
  );
  const [publish, setPublish] = useState<"closed" | "confirm" | "publishing" | "done">("closed");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [grabbed, setGrabbed] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const original = useRef<Page[] | null>(null);
  const handles = useRef(new Map<string, HTMLButtonElement>());

  if (!book && !error)
    return (
      <div role="status" className="p-8">
        Loading book…
      </div>
    );
  if (!book)
    return (
      <div className="canvas-grid min-h-dvh">
        <ErrorState
          title="We couldn't load that book"
          body="Check your connection and that you have access."
          action="Retry"
          onRetry={refresh}
        />
      </div>
    );

  const pages = previewOrder ?? book.pages;
  const visiblePages = list.items.flatMap((item) => {
    const current = pages.find((p) => p.id === item.id);
    return current ? [current] : [];
  });
  if (sort === "position") visiblePages.sort((a, b) => pages.indexOf(a) - pages.indexOf(b));

  const state =
    screenState !== "default"
      ? screenState
      : list.status === "error"
        ? "error"
        : list.status === "loading"
          ? "loading"
          : pages.length
            ? "default"
            : "empty";
  const backHref = book.kind === "event" ? `/hub/${book.id}` : "/dashboard";

  const commitMove = async (from: number, to: number, ordered: Page[], focusId?: string) => {
    if (moving || from === to || book.version === undefined) return;
    setMoving(true);
    try {
      const result = await reorderPages(book.id, {
        pageId: ordered[from]!.id,
        expectedVersion: book.version,
        ...(to < from ? { beforeId: ordered[to]!.id } : { afterId: ordered[to]!.id }),
      });
      const next = [...ordered];
      next.splice(to, 0, next.splice(from, 1)[0]!);
      list.retainThrough(to + 1);
      setBook({ ...book, pages: next, version: result.version });
      setAnnounce(`${ordered[from]!.title} moved to position ${to + 1}`);
      if (focusId) requestAnimationFrame(() => handles.current.get(focusId)?.focus());
    } catch {
      toast("Couldn’t move the page. Refreshing its position.", { tone: "error" });
      refresh();
    } finally {
      setMoving(false);
    }
  };
  const move = (from: number, to: number, focusId?: string) => {
    if (moving || reorderDisabled || from < 0 || to < 0 || to >= pages.length || from === to)
      return;
    if (grabbed && focusId) {
      const next = [...pages];
      next.splice(to, 0, next.splice(from, 1)[0]!);
      setPreviewOrder(next);
      setAnnounce(`Position ${to + 1}. Press Space to save the move.`);
      requestAnimationFrame(() => handles.current.get(focusId)?.focus());
    } else void commitMove(from, to, pages, focusId);
  };
  const onHandleKey = (e: KeyboardEvent, p: Page, i: number) => {
    if (reorderDisabled) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (grabbed === p.id) {
        setGrabbed(null);
        if (original.current)
          void commitMove(
            original.current.findIndex((x) => x.id === p.id),
            i,
            original.current,
            p.id,
          );
        setPreviewOrder(null);
        original.current = null;
      } else {
        setGrabbed(p.id);
        original.current = pages;
        setAnnounce(
          `Picked up ${p.title}. Use the arrow keys to move, Space to drop, Escape to cancel.`,
        );
      }
    } else if (
      grabbed === p.id &&
      ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].includes(e.key)
    ) {
      e.preventDefault();
      move(i, e.key === "ArrowUp" || e.key === "ArrowLeft" ? i - 1 : i + 1, p.id);
    } else if (e.key === "Escape" && grabbed === p.id) {
      setPreviewOrder(null);
      setGrabbed(null);
      setAnnounce("Move cancelled");
    }
  };

  const onDragOver = (e: DragEvent, i: number) => {
    if (reorderDisabled) return;
    if (!dragId) return;
    e.preventDefault();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const after =
      window.innerWidth < 834 ? e.clientY > r.top + r.height / 2 : e.clientX > r.left + r.width / 2;
    setDropAt(after ? i + 1 : i);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragId !== null && dropAt !== null) {
      const from = pages.findIndex((p) => p.id === dragId);
      move(from, dropAt > from ? dropAt - 1 : dropAt);
    }
    setDragId(null);
    setDropAt(null);
  };

  const savePage = async (p: Page) => {
    if (saving) return;
    setSaving(true);
    const { title, body } = p;
    const patch = {
      title,
      body,
      image: p.image ?? "",
      cardImage: p.cardImage ?? "",
      caption: p.caption ?? "",
      header: p.header ?? "",
      author: p.author ?? "",
    };
    try {
      if (editing === "new") {
        await createPage(book.id, patch);
        list.retainThrough(pages.length + 1);
      } else await updatePage(p.id, patch);
      setEditing(null);
      refresh();
      toast(editing === "new" ? "Page added" : "Page saved");
    } catch {
      toast("Couldn’t save the page. Your changes are still here.", { tone: "error" });
    } finally {
      setSaving(false);
    }
  };
  const doPublish = async () => {
    setPublish("publishing");
    try {
      const result = await publishBook(book.id);
      setBook(result.book);
      setPublish("done");
    } catch {
      setPublish("confirm");
      toast("Couldn’t publish the book.", { tone: "error" });
    }
  };

  return (
    <div className="canvas-grid min-h-dvh">
      <div className="sticky top-0 z-40 px-3 pt-3 md:px-6 md:pt-4">
        <div
          role="toolbar"
          aria-label="Editor controls"
          className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-1 rounded-lg bg-linen p-2 shadow-e2 md:flex-nowrap md:gap-2"
        >
          <Button
            variant="ghost"
            className="max-md:w-11 max-md:px-0 md:px-3"
            icon={<ArrowLeft className="size-5" aria-hidden="true" />}
            onClick={() => navigate(backHref)}
            aria-label={book.kind === "event" ? "Back to hub" : "Back to books"}
          >
            <span className="hidden md:inline">
              {book.kind === "event" ? "Back to hub" : "Back to books"}
            </span>
          </Button>
          {/* On phones the title takes the first row and the actions wrap below it. */}
          <div className="flex min-w-0 flex-1 flex-col px-1 max-md:basis-[calc(100%-3.25rem)] md:px-2">
            <h1 className="truncate t-body font-bold">{book.title}</h1>
            <span className="truncate t-caption whitespace-nowrap text-muted">
              <Status live={book.live} />
              <span className="hidden md:inline">
                {" "}
                · {pages.length} {pages.length === 1 ? "page" : "pages"}
              </span>
            </span>
          </div>
          <BookFeedback bookId={book.id} compact />
          <Button
            variant="secondary"
            className="max-md:w-11 max-md:px-0"
            icon={<Eye className="size-5" aria-hidden="true" />}
            aria-label="Preview"
            onClick={() => navigate(`/reader/${book.slug}?preview=${book.id}`)}
          >
            <span className="hidden md:inline">Preview</span>
          </Button>
          <ExportBookButton book={book} pages={pages} />
          <Button
            variant="secondary"
            className="max-md:w-11 max-md:px-0"
            icon={<Plus className="size-5" aria-hidden="true" />}
            onClick={() => setEditing("new")}
            aria-label="Add page"
          >
            <span className="hidden md:inline">Add page</span>
          </Button>
          <Button
            onClick={() => setPublish("confirm")}
            // Pages of a live book update for readers as you save, so there is nothing to republish.
            disabled={state !== "default" || book.live}
            title={book.live ? "This book is live. Changes appear as you save them." : undefined}
            className="max-md:px-4"
          >
            {book.live ? "Published" : "Publish nest"}
          </Button>
        </div>
      </div>

      <main className="mx-auto max-w-[1440px] px-4 pt-6 pb-24 md:px-8 md:pt-8 lg:px-20">
        <div aria-live="assertive" className="sr-only">
          {announce}
        </div>
        {state !== "empty" && (
          <div className="mb-6 grid items-end gap-4 md:grid-cols-3">
            <Input
              label="Search pages"
              type="search"
              placeholder="Search by page title"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <SortSelect value={sort} onChange={setSort} />
            <Checkbox label="With photo" checked={withPhoto} onChange={setWithPhoto} />
          </div>
        )}
        {reorderDisabled && (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <p className="t-caption text-muted" role="status">
              Reordering is disabled while search, a filter or recently edited sort is active. Clear
              them to change page positions.
            </p>
            <Button
              variant="ghost"
              onClick={() => {
                setQuery("");
                setWithPhoto(false);
                setSort("position");
              }}
            >
              Clear filters and sort
            </Button>
          </div>
        )}
        {state === "default" && !reorderDisabled && (
          <p className="mb-6 t-caption text-muted">
            <span className="hidden lg:inline">
              Drag a handle to reorder, or focus it and use the arrow keys.
            </span>
            <span className="lg:hidden">Use Move up and Move down to reorder pages.</span>
          </p>
        )}
        {state === "loading" && (
          <ul
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
            aria-busy="true"
            aria-label="Loading pages"
          >
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="overflow-hidden rounded-lg bg-linen shadow-e1">
                <Skeleton className="aspect-[4/3] rounded-none" />
                <div className="flex flex-col gap-2 p-4">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </li>
            ))}
          </ul>
        )}
        {state === "error" && (
          <div className="rounded-lg bg-linen shadow-e1">
            <ErrorState
              title="We couldn't load your pages"
              body="Nothing was lost. Try again in a moment."
              onRetry={() => {
                setScreenState("default");
                list.retry();
              }}
            />
          </div>
        )}
        {state === "empty" && (
          <div className="mx-auto flex max-w-xl flex-col items-center gap-5 rounded-lg bg-linen px-6 py-14 text-center shadow-e1">
            <EmptyNest className="w-36" />
            <div className="flex flex-col gap-1">
              <h1 className="t-h2">No pages yet</h1>
              <p className="t-body">Add a page, or wait for your flock to send theirs.</p>
            </div>
            <Button
              variant="secondary"
              icon={<Plus className="size-5" aria-hidden="true" />}
              onClick={() => setEditing("new")}
            >
              Add page
            </Button>
          </div>
        )}
        {state === "default" && (
          <ul
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
            onDragOver={(e) => dragId && e.preventDefault()}
            onDrop={onDrop}
          >
            {visiblePages.map((p) => {
              const i = pages.findIndex((x) => x.id === p.id);
              return (
                <li
                  key={p.id}
                  className="relative"
                  onDragOver={(e) => onDragOver(e, i)}
                  onDrop={onDrop}
                >
                  {dropAt === i && dragId && <DropBar side="before" />}
                  {dropAt === i + 1 && i === pages.length - 1 && dragId && <DropBar side="after" />}
                  <PageCard
                    page={p}
                    index={i}
                    total={pages.length}
                    reorderDisabled={reorderDisabled}
                    book={book}
                    dragging={dragId === p.id}
                    grabbed={grabbed === p.id}
                    handleRef={(el) =>
                      el ? handles.current.set(p.id, el) : handles.current.delete(p.id)
                    }
                    onHandleKey={(e) => onHandleKey(e, p, i)}
                    onHandleBlur={() => {
                      if (grabbed === p.id) {
                        setGrabbed(null);
                        setPreviewOrder(null);
                      }
                    }}
                    onDragStart={(e) => {
                      if (reorderDisabled) {
                        e.preventDefault();
                        return;
                      }
                      setDragId(p.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", p.id);
                      const card = (e.currentTarget as HTMLElement).closest("article");
                      if (card) e.dataTransfer.setDragImage(card, 24, 24);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setDropAt(null);
                    }}
                    onEdit={() => setEditing(p)}
                    onMove={(d) => move(i, i + d)}
                    onDelete={() => setToDelete(p)}
                  />
                </li>
              );
            })}
          </ul>
        )}
        {state === "default" && !list.items.length && (
          <div className="flex flex-col items-center gap-4 py-12">
            <h2 className="t-h2">No pages match</h2>
            <p className="t-body">Try another title or clear the photo filter.</p>
            <Button
              variant="secondary"
              onClick={() => {
                setQuery("");
                setWithPhoto(false);
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
        {state === "default" && (list.items.length > 0 || list.nextCursor) && (
          <LoadMore
            noun="pages"
            count={list.items.length}
            loading={list.loadingMore}
            error={list.moreError}
            hasMore={!!list.nextCursor}
            onLoad={list.loadMore}
          />
        )}
      </main>

      <ConfirmActionModal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Delete this page?"
        consequence="This permanently removes the page from your book."
        confirmLabel="Delete page"
        busyLabel="Deleting"
        onConfirm={async () => {
          if (!toDelete) return;
          await deletePage(toDelete.id);
          setToDelete(null);
          refresh();
          toast("Page deleted");
        }}
      />
      {editing && (
        <PageModal
          page={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          saving={saving}
          onSave={savePage}
          variant={variant}
        />
      )}

      <Modal
        open={publish !== "closed"}
        onClose={() => setPublish("closed")}
        size="sm"
        dismissible={publish !== "publishing"}
        title={publish === "done" ? "Your nest is live" : "Publish this nest?"}
        description={
          publish === "done"
            ? `Your published book is ready to open.`
            : `Your current reader access settings will apply.`
        }
        footer={
          publish === "done" ? (
            <>
              <CopyButton
                text={
                  new URL("/reader/" + encodeURIComponent(book.slug), window.location.href).href
                }
              />
              <Button onClick={() => navigate(`/reader/${book.slug}`)} data-autofocus>
                Open the reader
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={() => setPublish("closed")}
                disabled={publish === "publishing"}
              >
                Cancel
              </Button>
              <Button loading={publish === "publishing"} onClick={doPublish} data-autofocus>
                {publish === "publishing" ? "Publishing" : "Publish nest"}
              </Button>
            </>
          )
        }
      >
        {publish === "done" ? (
          <FeatherBurst
            reduced={reduced}
            color={book.theme.accent === "#F4A261" ? "#E63946" : book.theme.accent}
          />
        ) : (
          <p className="t-body">
            {pages.length} {pages.length === 1 ? "page" : "pages"} will appear in this order. You
            can keep editing after you publish.
          </p>
        )}
      </Modal>
    </div>
  );
}

function DropBar({ side }: { side: "before" | "after" }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "pointer-events-none absolute z-20 rounded-full bg-crimson",
        "max-md:inset-x-0 max-md:h-1",
        side === "before" ? "max-md:-top-3.5 md:-left-3.5" : "max-md:-bottom-3.5 md:-right-3.5",
        "md:inset-y-0 md:w-1",
      )}
    />
  );
}

export function PageCard({
  page,
  index,
  total,
  book,
  dragging,
  grabbed,
  dropTarget,
  reorderDisabled,
  force,
  handleRef,
  onHandleKey,
  onHandleBlur,
  onDragStart,
  onDragEnd,
  onEdit,
  onMove,
  onDelete,
}: {
  page: Page;
  index: number;
  total: number;
  book: Pick<Book, "theme" | "font" | "lines">;
  dragging?: boolean;
  grabbed?: boolean;
  dropTarget?: boolean;
  reorderDisabled?: boolean;
  force?: Force;
  handleRef?: (el: HTMLButtonElement | null) => void;
  onHandleKey?: (e: KeyboardEvent) => void;
  onHandleBlur?: () => void;
  onDragStart?: (e: DragEvent) => void;
  onDragEnd?: () => void;
  onEdit?: () => void;
  onMove?: (d: -1 | 1) => void;
  onDelete?: () => void;
}) {
  return (
    <article
      data-loadmore-item
      className={cx(
        "relative flex h-full flex-col rounded-lg bg-linen shadow-e1 transition-[box-shadow,transform,opacity] duration-150",
        dragging && "opacity-40 outline-2 outline-offset-2 outline-stroke outline-dashed",
        grabbed && "z-10 scale-[1.02] shadow-e4 ring-2 ring-slate",
        dropTarget && "ring-2 ring-crimson",
        force === "hover" && "shadow-e2",
      )}
    >
      <button
        type="button"
        onClick={onEdit}
        className="relative block aspect-[4/3] overflow-hidden rounded-t-lg"
        aria-label={`Edit ${page.title}`}
        tabIndex={-1}
      >
        {page.image ? (
          <img
            src={page.cardImage ?? page.image}
            alt=""
            className="size-full object-cover"
            loading="lazy"
            draggable={false}
          />
        ) : (
          <NotebookPage look={book}>
            <p
              className="px-16 pt-6"
              style={{ ...bookFont(book.font, 20), lineHeight: "32px", color: book.theme.header }}
            >
              {page.header || page.title}
            </p>
          </NotebookPage>
        )}
      </button>
      <div className="flex flex-1 items-start gap-1 p-3 pr-2">
        <button
          ref={handleRef}
          type="button"
          draggable={!reorderDisabled}
          disabled={reorderDisabled}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onKeyDown={onHandleKey}
          onBlur={onHandleBlur}
          aria-pressed={grabbed}
          aria-label={`Reorder ${page.title}, spread ${index + 1} of ${total}`}
          className={cx(
            "flex size-11 shrink-0 cursor-grab items-center justify-center rounded-sm text-muted hover:bg-wash hover:text-slate active:cursor-grabbing",
            grabbed && "bg-slate text-white hover:bg-slate hover:text-white",
            force === "focus" && "outline-2 outline-offset-2 outline-slate outline-solid",
          )}
        >
          <GripVertical className="size-5" aria-hidden="true" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1 py-1">
          <h3 className="truncate t-body font-bold">
            <button
              type="button"
              onClick={onEdit}
              className="min-h-11 max-w-full truncate rounded-xs text-left hover:underline"
            >
              {page.title}
            </button>
          </h3>
          <p className="line-clamp-2 t-caption">{page.body}</p>
          <p className="mt-1 t-caption text-muted">Spread {index + 1}</p>
        </div>
        <OverflowMenu
          label={`More actions for ${page.title}`}
          items={[
            {
              label: "Edit page",
              icon: <Pencil className="size-5" aria-hidden="true" />,
              onSelect: () => onEdit?.(),
            },
            {
              label: "Move up",
              icon: <ArrowUp className="size-5" aria-hidden="true" />,
              onSelect: () => onMove?.(-1),
              disabled: reorderDisabled || index === 0,
            },
            {
              label: "Move down",
              icon: <ArrowDown className="size-5" aria-hidden="true" />,
              onSelect: () => onMove?.(1),
              disabled: reorderDisabled || index === total - 1,
            },
            {
              label: "Delete page",
              icon: <Trash2 className="size-5" aria-hidden="true" />,
              onSelect: () => onDelete?.(),
            },
          ]}
        />
      </div>
      <div className="flex gap-2 px-3 pb-3 lg:hidden">
        <Button
          variant="secondary"
          className="flex-1 px-3"
          disabled={reorderDisabled || index === 0}
          onClick={() => onMove?.(-1)}
          icon={<ArrowUp className="size-4" aria-hidden="true" />}
          aria-label={`Move ${page.title} up`}
        >
          Move up
        </Button>
        <Button
          variant="secondary"
          className="flex-1 px-3"
          disabled={reorderDisabled || index === total - 1}
          onClick={() => onMove?.(1)}
          icon={<ArrowDown className="size-4" aria-hidden="true" />}
          aria-label={`Move ${page.title} down`}
        >
          Move down
        </Button>
      </div>
    </article>
  );
}

function PageModal({
  page,
  onClose,
  onSave,
  saving,
  variant = "",
}: {
  page?: Page;
  onClose: () => void;
  onSave: (p: Page) => void;
  saving: boolean;
  variant?: string;
}) {
  const [title, setTitle] = useState(page?.title ?? "");
  const [image, setImage] = useState<string | undefined>(page?.image);
  const [cardImage, setCardImage] = useState<string | undefined>(page?.cardImage);
  const [crop, setCrop] = useState<string | null>(null);
  const [caption, setCaption] = useState(page?.caption ?? "");
  const [header, setHeader] = useState(page?.header ?? "");
  const [body, setBody] = useState(page?.body ?? "");
  const [author, setAuthor] = useState(page?.author ?? "");
  const [tried, setTried] = useState(false);
  const [fileError, setFileError] = useState<string>();
  const [over, setOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (crop?.startsWith("blob:") && crop !== image && crop !== cardImage && crop !== page?.image)
        URL.revokeObjectURL(crop);
    },
    [crop],
  );

  const take = (f?: File) => {
    if (!f) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(f.type) && !/\.(heic|heif)$/i.test(f.name))
      return setFileError(`Choose a ${ACCEPTED_IMAGE_LABEL} image`);
    if (f.size > LIMITS.uploadBytes)
      return setFileError(`That file is over ${LIMITS.uploadMb} MB. Try a smaller one.`);
    setFileError(undefined);
    setCrop(URL.createObjectURL(f));
  };
  const titleError = tried && !title.trim() ? "Add a page title" : undefined;

  if (crop)
    return (
      <CropModal
        src={crop}
        variant={variant}
        onCancel={() => setCrop(null)}
        onApply={async (photos) => {
          setUploading(true);
          try {
            // The server may allow only one image upload at a time.
            const square = await uploadHostImage(photos.polaroid);
            const card = await uploadHostImage(photos.card);
            setImage(square.url);
            setCardImage(card.url);
            setCrop(null);
          } finally {
            setUploading(false);
          }
        }}
      />
    );

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      title={page ? "Edit page" : "Add page"}
      footer={
        <>
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={uploading || saving}
            onClick={() => {
              setTried(true);
              if (!title.trim()) return;
              onSave({
                id: page?.id ?? `p${Date.now()}`,
                title: title.trim(),
                image,
                cardImage,
                caption: image ? caption.trim() || undefined : undefined,
                header: header.trim() || undefined,
                body: body.trim(),
                author: author.trim(),
                submissionId: page?.submissionId,
              });
            }}
          >
            {saving ? "Saving" : "Save page"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <Input
          label="Sign-off name (optional)"
          value={author}
          max={LIMITS.personName}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Name"
          helper="Leave blank to stay anonymous."
        />
        <Input
          label="Page title"
          value={title}
          max={LIMITS.pageTitle}
          onChange={(e) => setTitle(e.target.value)}
          error={titleError}
          placeholder="Page title"
        />
        <div className="flex flex-col gap-2">
          <span className="t-caption font-medium">Photo</span>
          {image ? (
            <div className="flex flex-col items-start gap-3">
              <img
                src={cardImage ?? image}
                alt="Selected page photo"
                className="aspect-[4/3] w-full max-w-64 rounded-md object-cover"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setCrop(image ?? null)}
                  aria-label="Crop photo"
                >
                  Crop
                </Button>
                <Button variant="secondary" onClick={() => input.current?.click()}>
                  Replace
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setCaption("");
                    setImage(undefined);
                    setCardImage(undefined);
                  }}
                >
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                take(e.dataTransfer.files[0]);
              }}
              aria-describedby="upload-help"
              className={cx(
                "flex min-h-36 flex-col items-center justify-center gap-2 rounded-md bg-wash px-4 py-6 text-center transition-colors hover:bg-wash-strong",
                over && "bg-wash-strong ring-2 ring-crimson",
                fileError && "ring-2 ring-crimson",
              )}
            >
              {uploading ? (
                <Spinner className="size-7" />
              ) : (
                <ImagePlus className="size-7" aria-hidden="true" />
              )}
              <span className="t-body font-medium">
                {uploading ? "Uploading photo" : "Upload a photo"}
              </span>
              <span id="upload-help" className="t-caption text-muted">
                Drop an image here or browse. Up to {LIMITS.uploadMb} MB.
              </span>
            </button>
          )}
          {image && (
            <Input
              label="Photo caption (optional)"
              value={caption}
              max={LIMITS.photoCaption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Photo caption"
            />
          )}
          {fileError && (
            <p className="t-caption" role="alert">
              {fileError}
            </p>
          )}
          <input
            ref={input}
            type="file"
            accept={[...ACCEPTED_IMAGE_TYPES, ".heic", ".heif"].join(",")}
            className="hidden"
            onChange={(e) => {
              take(e.target.files?.[0] ?? undefined);
              // Allow choosing the same file again after Cancel or an error.
              e.target.value = "";
            }}
          />
        </div>
        <Input
          label="Message header (optional)"
          value={header}
          max={LIMITS.messageHeader}
          onChange={(e) => setHeader(e.target.value)}
          placeholder="Message header"
        />
        <Textarea
          label="Message"
          value={body}
          max={LIMITS.message}
          rows={5}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message"
        />
      </div>
    </Modal>
  );
}
