import { guestJoinUrl } from "../lib/routing";
import { useCallback, useState } from "react";
import { ProfileMenu } from "../components/ProfileMenu";
import { LoadMore } from "../components/LoadMore";
import { ApiError } from "../api/client";
import {
  listBooks,
  deleteBook,
  restoreBook,
  updateBookSettings,
  type BookSummary,
} from "../api/books";
import { useCursorList } from "../lib/useCursorList";
import { ArrowRight, Link2, Palette, Plus, Search, Settings, Trash2, X } from "lucide-react";
import { BookCover } from "../book";
import { EmptyNest } from "../brand";
import { type Access, type ThemeColors, type FontKey, slugify } from "../data";
import { Container, TopBar } from "../shell";
import { useApp } from "../store";
import {
  Button,
  ColorField,
  ErrorState,
  Input,
  Modal,
  OverflowMenu,
  RadioGroup,
  Select,
  Skeleton,
  Status,
  Toggle,
  cx,
  type Force,
} from "../ui";
import { LivePreview, fontOptions } from "./common";
import { LogoutModal } from "../components/LogoutModal";
import { ConfirmActionModal } from "../components/ConfirmActionModal";
import { FormAlert } from "../components/FormAlert";
import { ReaderAccessField } from "../components/ReaderAccessField";
import { getPreset } from "../api/previews";
import type { Visibility } from "../types/books";
import { useSession } from "../api/session";
import { LIMITS } from "../constants";

export function Dashboard() {
  const { navigate, screenState, setScreenState, toast, route } = useApp();
  const session = useSession();
  const open = getPreset("dashboard", route.query.get("variant")).open ?? "";
  const [logout, setLogout] = useState(open === "logout");
  const accountName = session?.name ?? "Account";

  const [query, setQuery] = useState("");
  const [themeFor, setThemeFor] = useState<BookSummary | null>(null);
  const [settingsFor, setSettingsFor] = useState<BookSummary | null>(null);
  const [deleteFor, setDeleteFor] = useState<BookSummary | null>(null);
  const loader = useCallback(
    async (cursor?: string | null) => {
      try {
        return await listBooks({ cursor, q: query });
      } catch (e) {
        if (e instanceof ApiError && e.code === "UNAUTHORIZED") navigate("/signin?next=/dashboard");
        throw e;
      }
    },
    [navigate, query],
  );
  const list = useCursorList(loader, route.query.get("variant"), query);

  const state =
    screenState !== "default"
      ? screenState
      : list.status === "error"
        ? "error"
        : list.status === "loading"
          ? "loading"
          : !query && list.items.length === 0
            ? "empty"
            : "default";
  const visible = list.items;

  return (
    <div className="min-h-dvh bg-nest">
      <TopBar>
        <ProfileMenu
          name={accountName}
          onSignOut={() => setLogout(true)}
          initiallyOpen={route.query.get("variant") === "profile-menu"}
        />
      </TopBar>

      <main>
        <Container className="py-8 md:py-12">
          <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-center md:justify-between">
            <h1 className="t-h1">Your books</h1>
            {state !== "empty" && (
              <Button
                icon={<Plus className="size-5" aria-hidden="true" />}
                onClick={() => navigate("/create")}
                className="max-md:w-full"
              >
                Create new book
              </Button>
            )}
          </div>

          {state !== "empty" && state !== "error" && (
            <div className="mb-8 md:max-w-[400px]">
              <Input
                label="Search books"
                hideLabel
                type="search"
                placeholder="Search by title"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                leading={<Search className="size-5" aria-hidden="true" />}
                trailing={
                  query && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => setQuery("")}
                      className="-mr-2 flex size-11 items-center justify-center rounded-sm hover:bg-wash"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  )
                }
              />
            </div>
          )}

          {state === "loading" && (
            <ul
              className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
              aria-busy="true"
              aria-label="Loading books"
            >
              {[0, 1, 2].map((i) => (
                <li key={i}>
                  <BookCardSkeleton />
                </li>
              ))}
            </ul>
          )}

          {state === "error" && (
            <div className="rounded-lg bg-linen shadow-e1">
              <ErrorState
                title="We couldn't load your books"
                body="Your books are safe. Check your connection and try again."
                onRetry={() => {
                  setScreenState("default");
                  list.retry();
                }}
              />
            </div>
          )}

          {state === "empty" && (
            <div className="flex flex-col items-center gap-6 rounded-lg bg-linen px-6 py-16 text-center shadow-e1 md:py-24">
              <EmptyNest className="w-44 md:w-56" />
              <div className="flex flex-col gap-2">
                <h2 className="t-h2">Your nest is empty</h2>
                <p className="t-body">Create a book and invite your flock to fill it.</p>
              </div>
              <Button
                size="lg"
                iconRight={<ArrowRight className="size-5" aria-hidden="true" />}
                onClick={() => navigate("/create")}
              >
                Build your first nest
              </Button>
            </div>
          )}

          {state === "default" &&
            (visible.length ? (
              <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {visible.map((b) => (
                  <li key={b.id}>
                    <BookCard
                      book={b}
                      onTheme={() => setThemeFor(b)}
                      onSettings={() => setSettingsFor(b)}
                      onDelete={() => setDeleteFor(b)}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <h2 className="t-h2">No books match "{query}"</h2>
                <p className="t-body">Check the spelling or try a shorter title.</p>
                <Button variant="secondary" onClick={() => setQuery("")}>
                  Clear search
                </Button>
              </div>
            ))}
          {state === "default" && (visible.length > 0 || list.nextCursor) && (
            <LoadMore
              noun="books"
              count={visible.length}
              loading={list.loadingMore}
              error={list.moreError}
              hasMore={!!list.nextCursor}
              onLoad={list.loadMore}
            />
          )}
        </Container>
      </main>

      <LogoutModal open={logout} onClose={() => setLogout(false)} />
      {themeFor && (
        <QuickThemeModal book={themeFor} onClose={() => setThemeFor(null)} onSaved={list.retry} />
      )}
      {settingsFor && (
        <SettingsModal
          book={settingsFor}
          onClose={() => setSettingsFor(null)}
          onSaved={list.retry}
        />
      )}
      <ConfirmActionModal
        open={!!deleteFor}
        onClose={() => setDeleteFor(null)}
        title="Delete this book?"
        consequence={
          deleteFor
            ? `${deleteFor.title} and its ${deleteFor.entries} entries will be removed. You can undo this for a few seconds.`
            : ""
        }
        confirmLabel="Delete book"
        busyLabel="Deleting"
        onConfirm={async () => {
          const b = deleteFor!;
          await deleteBook(b.id);
          list.retry();
          const undo = async () => {
            try {
              await restoreBook(b.id);
              list.retry();
            } catch {
              toast("Couldn’t restore the book.", { tone: "error" });
            }
          };
          setDeleteFor(null);
          toast(`${b.title} deleted`, {
            tone: "info",
            action: { label: "Undo", onClick: undo },
          });
        }}
      />
    </div>
  );
}

export function BookCard({
  book,
  onTheme,
  onSettings,
  onDelete,
  force,
}: {
  book: BookSummary;
  onTheme: () => void;
  onSettings: () => void;
  onDelete: () => void;
  force?: Force;
}) {
  const { navigate } = useApp();
  const href = book.kind === "event" ? `/hub/${book.id}` : `/editor/${book.id}`;
  return (
    <article
      data-loadmore-item
      className={cx(
        "group relative flex h-full flex-col overflow-hidden rounded-lg bg-linen shadow-e1 transition-shadow hover:shadow-e2",
        force === "hover" && "shadow-e2",
      )}
    >
      <div
        className="flex h-48 items-center justify-center py-5 md:h-52"
        style={{ background: book.theme.background }}
      >
        <BookCover
          look={book}
          title={book.title}
          className={cx(
            "h-full transition-transform duration-200 group-hover:-translate-y-1",
            force === "hover" && "-translate-y-1",
          )}
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="t-h2 min-w-0">
            <a
              href={href}
              className="rounded-xs after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-slate focus-visible:after:outline-solid"
            >
              {book.title}
            </a>
          </h3>
          <OverflowMenu
            className="relative z-10 -mt-2 -mr-2 md:hidden"
            label={`Actions for ${book.title}`}
            items={[
              { label: "Preview", onSelect: () => navigate(`/reader/${book.slug}?preview=${book.id}`) },
              {
                label: "Edit theme",
                icon: <Palette className="size-5" aria-hidden="true" />,
                onSelect: onTheme,
              },
              {
                label: "Settings",
                icon: <Settings className="size-5" aria-hidden="true" />,
                onSelect: onSettings,
              },
              {
                label: "Delete",
                icon: <Trash2 className="size-5" aria-hidden="true" />,
                onSelect: onDelete,
              },
            ]}
          />
        </div>
        <p className="flex items-center gap-2 t-caption text-muted">
          <Link2 className="size-4 shrink-0" aria-hidden="true" />
          <a className="relative z-10 flex min-h-11 min-w-0 items-center truncate underline" href={book.kind === "event" ? `/${book.slug}/join` : `/reader/${book.slug}`}>{book.kind === "event" ? guestJoinUrl(book.slug).replace(/^https?:\/\//, "") : `${window.location.host}/reader/${book.slug}`}</a>
        </p>
        <div className="flex flex-col gap-1 t-caption">
          <span className="flex items-center gap-2">
            <Status live={book.live} />
            <span aria-hidden="true">·</span>
            {book.kind === "event" ? "Event book" : "Personal book"}
          </span>
          <span className="text-muted">
            {book.entries} {book.entries === 1 ? "entry" : "entries"} ·{" "}
            {new Date(book.updated).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
        <a href={`/reader/${book.slug}?preview=${book.id}`} className="relative z-10 flex min-h-11 items-center self-start rounded-sm px-3 font-medium underline">Preview</a>
        <div className="relative z-10 mt-auto hidden flex-wrap items-center gap-1 pt-2 md:-ml-3 md:flex">
          <Button
            variant="ghost"
            className="px-3"
            icon={<Palette className="size-4" aria-hidden="true" />}
            onClick={onTheme}
          >
            Edit theme
          </Button>
          <Button
            variant="ghost"
            className="px-3"
            icon={<Settings className="size-4" aria-hidden="true" />}
            onClick={onSettings}
          >
            Settings
          </Button>
          <Button
            variant="ghost"
            className="ml-auto px-3"
            icon={<Trash2 className="size-4" aria-hidden="true" />}
            onClick={onDelete}
            aria-label={`Delete ${book.title}`}
          >
            <span className="lg:sr-only xl:not-sr-only">Delete</span>
          </Button>
        </div>
      </div>
    </article>
  );
}

export function BookCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg bg-linen shadow-e1">
      <Skeleton className="h-48 rounded-none md:h-52" />
      <div className="flex flex-col gap-3 p-5">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="mt-2 h-11 w-full" />
      </div>
    </div>
  );
}

export function QuickThemeModal({
  book,
  onClose,
  onSaved,
}: {
  book: BookSummary;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useApp();
  const [theme, setTheme] = useState<ThemeColors>(book.theme);
  const [font, setFont] = useState<FontKey>(book.font);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof ThemeColors) => (v: string) => setTheme((t) => ({ ...t, [k]: v }));
  const save = async () => {
    setSaving(true);
    try {
      await updateBookSettings(book, { theme, font, preset: "custom" });
      onSaved();
      toast("Theme saved");
      onClose();
    } catch {
      toast("Couldn’t save the theme.", { tone: "error" });
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Edit theme"
      description={book.title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={save}>
            {saving ? "Saving" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:gap-8">
        <div className="flex flex-col gap-5 max-md:order-2">
          <ColorField label="Cover color" value={theme.cover} onChange={set("cover")} />
          <ColorField
            label="Page background"
            value={theme.background}
            onChange={set("background")}
          />
          <ColorField label="Feather accent" value={theme.accent} onChange={set("accent")} />
          <Select label="Book font" value={font} options={fontOptions} onChange={setFont} />
        </div>
        <div className="max-md:order-1">
          <LivePreview
            look={{ theme, font, lines: book.lines }}
            title={book.title}
            size="sm"
            className="md:sticky md:top-0 md:aspect-[4/3.4]"
          />
        </div>
      </div>
    </Modal>
  );
}

function SettingsModal({
  book,
  onClose,
  onSaved,
}: {
  book: BookSummary;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useApp();
  const [title, setTitle] = useState(book.title);
  const [slug, setSlug] = useState(book.slug);
  const [collection, setCollection] = useState(book.status ?? "not-live");
  const [live, setLive] = useState(book.live);
  const [access, setAccess] = useState<Access>(book.access);
  const [visibility, setVisibility] = useState<Visibility>(book.visibility);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const save = async () => {
    setSaving(true);
    setFailed(false);
    try {
      const patch = {
        title: title.trim(),
        slug,
        live,
        access,
        visibility,
        ...(book.kind === "event" ? { status: collection } : {}),
      };
      await updateBookSettings(book, patch);
      onSaved();
      toast("Settings saved");
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.code === "CONFLICT") setTaken(true);
      setFailed(true);
      setSaving(false);
    }
  };
  const [taken, setTaken] = useState(false);
  const titleError = !title.trim() ? "Add a title" : undefined;
  const slugError = !slug ? "Add a link" : taken ? "That link is taken. Try another." : undefined;
  return (
    <Modal
      open
      onClose={onClose}
      title="Book settings"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!!titleError || !!slugError} loading={saving} onClick={save}>
            {saving ? "Saving" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {failed && <FormAlert>We couldn't save your settings. Try again.</FormAlert>}
        <Input
          label="Title"
          value={title}
          max={LIMITS.bookTitle}
          onChange={(e) => setTitle(e.target.value)}
          error={titleError}
        />
        <Input
          label="Book link"
          prefix={`${window.location.host}/`}
          value={slug}
          onChange={(e) => {
            setTaken(false);
            setSlug(slugify(e.target.value));
          }}
          error={slugError}
        />
        <Toggle
          label="Publish book"
          description="Anyone with the link can read it"
          checked={live}
          onChange={setLive}
        />
        {book.kind === "event" && (
          <Select
            label="Guest submissions"
            value={collection}
            onChange={setCollection}
            options={[
              { value: "not-live", label: "Not open yet" },
              { value: "open", label: "Open" },
              { value: "closed", label: "Closed" },
            ]}
          />
        )}
        {book.kind === "event" && (
          <RadioGroup<Access>
            label="Guest access"
            value={access}
            onChange={setAccess}
            options={ACCESS_OPTIONS}
          />
        )}
        {book.kind === "personal" && (
          <ReaderAccessField value={visibility} onChange={setVisibility} />
        )}
      </div>
    </Modal>
  );
}

export const ACCESS_OPTIONS: { value: Access; label: string; description: string }[] = [
  { value: "name", label: "Name only", description: "Guests add a name before posting" },
  { value: "email", label: "Email only", description: "Guests confirm an email address" },
  { value: "strict", label: "Strict", description: "Name and email, and you approve each entry" },
];
