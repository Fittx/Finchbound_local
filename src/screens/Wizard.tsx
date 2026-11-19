import { createBook, checkSlug } from "../api/books";
import { ApiError } from "../api/client";
import { useEffect, useState, type ReactNode } from "react";
import { AlertCircle, ArrowLeft, BookOpen, Check, ChevronUp, QrCode } from "lucide-react";
import {
  COLOR_FIELDS,
  PRESETS,
  RESERVED_SLUGS,
  slugify,
  type Access,
  type BookKind,
  type FontKey,
  type PresetKey,
  type ThemeColors,
} from "../data";
import { TopBar } from "../shell";
import { useApp } from "../store";
import { Button, ColorField, Dot, Input, RadioGroup, Select, Skeleton, Toggle, cx } from "../ui";
import { LivePreview, fontOptions } from "./common";
import { ACCESS_OPTIONS } from "./Dashboard";
import { LIMITS } from "../constants";
import { getPreset } from "../api/previews";
import { ReaderAccessField } from "../components/ReaderAccessField";
import type { Visibility } from "../types/books";

const STEPS = ["Theme", "Details", "Rules"] as const;

export function Wizard() {
  const { navigate, toast, screenState, route } = useApp();
  // Frames can open a specific step (?variant=personal-rules).
  const framePreset = getPreset("wizard", route.query.get("variant"));
  const [step, setStep] = useState(framePreset.step ?? 0);
  const [kind, setKind] = useState<BookKind | null>(
    (framePreset.values?.kind as BookKind | undefined) ?? null,
  );
  const [preset, setPreset] = useState<PresetKey | "custom">("crimson");
  const [theme, setTheme] = useState<ThemeColors>({ ...PRESETS.crimson.colors });
  const [font, setFont] = useState<FontKey>("hand");
  const [lines, setLines] = useState(true);
  const [title, setTitle] = useState(String(framePreset.values?.title ?? ""));
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugState, setSlugState] = useState<"idle" | "checking" | "ok" | "taken">("idle");
  const [access, setAccess] = useState<Access>("name");
  const [visibility, setVisibility] = useState<Visibility>("link");
  const [photoReq, setPhotoReq] = useState(false);
  const [msgReq, setMsgReq] = useState(true);
  const [showErrors, setShowErrors] = useState(false);
  const [creating, setCreating] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sheet, setSheet] = useState(false);

  const look = { theme, font, lines };
  const effectiveSlug = slugEdited ? slug : slugify(title);

  useEffect(() => {
    if (!effectiveSlug) return setSlugState("idle");
    setSlugState("checking");
    let active = true;
    const t = window.setTimeout(async () => {
      try {
        const available =
          !RESERVED_SLUGS.includes(effectiveSlug) && (await checkSlug(effectiveSlug)).available;
        if (active) setSlugState(available ? "ok" : "taken");
      } catch {
        if (active) setSlugState("idle");
      }
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(t);
    };
  }, [effectiveSlug]);

  const titleError = showErrors && !title.trim() ? "Add a title to continue" : undefined;
  const slugError =
    slugState === "taken"
      ? "That link is taken. Try another."
      : showErrors && !effectiveSlug
        ? "Add a link to continue"
        : undefined;

  const next = async () => {
    if (step === 2) {
      if (!title.trim() || !effectiveSlug || slugState === "taken") return setShowErrors(true);
      if (slugState === "checking") return;
    }
    if (step < 3) {
      setShowErrors(false);
      return setStep(step + 1);
    }
    setCreating(true);
    setFailed(false);
    try {
      await createBook({
        title: title.trim(),
        slug: effectiveSlug,
        kind: kind!,
        visibility: kind === "personal" ? visibility : "link",
        preset,
        theme,
        font,
        lines,
        access,
        photoRequired: photoReq,
        messageRequired: msgReq,
      });
      toast(`${title.trim()} is ready`);
      navigate("/dashboard");
    } catch (e) {
      if (e instanceof ApiError && e.code === "UNAUTHORIZED") navigate("/signin?next=/create");
      else if (e instanceof ApiError && e.code === "CONFLICT") {
        setStep(2);
        setSlugState("taken");
      } else setFailed(true);
    } finally {
      setCreating(false);
    }
  };

  const setColor = (k: keyof ThemeColors) => (v: string) => {
    setTheme((t) => ({ ...t, [k]: v }));
    setPreset("custom");
  };

  if (step === 0)
    return (
      <div className="min-h-dvh bg-nest">
        <TopBar>
          <Button variant="ghost" className="px-3" onClick={() => navigate("/dashboard")}>
            Cancel
          </Button>
        </TopBar>
        <main className="mx-auto flex w-full max-w-[1040px] flex-col gap-8 px-4 py-10 md:px-8 md:py-16">
          <div className="flex flex-col gap-2">
            <h1 className="t-h1">What are you making?</h1>
            <p className="t-body">You can change the theme any time, but not the book type.</p>
          </div>
          {screenState === "loading" ? (
            <div className="grid gap-4 md:grid-cols-2 md:gap-6" aria-busy="true">
              <Skeleton className="h-72 rounded-lg" />
              <Skeleton className="h-72 rounded-lg" />
            </div>
          ) : (
            <div
              role="radiogroup"
              aria-label="Book type"
              className="grid gap-4 md:grid-cols-2 md:gap-6"
            >
              <TypeCard
                selected={kind === "event"}
                onSelect={() => setKind("event")}
                icon={<QrCode className="size-7" aria-hidden="true" />}
                title="Event book"
                body="Guests add photos and messages by scanning a QR code."
                points={["Guest submissions", "Moderation", "QR sharing"]}
              />
              <TypeCard
                selected={kind === "personal"}
                onSelect={() => setKind("personal")}
                icon={<BookOpen className="size-7" aria-hidden="true" />}
                title="Personal book"
                body="A private photo album or story journal you fully control."
                points={["Full control", "Photo album", "Story journal"]}
              />
            </div>
          )}
          <div className="flex justify-end">
            <Button size="lg" disabled={!kind} onClick={() => setStep(1)} className="max-md:w-full">
              Continue
            </Button>
          </div>
        </main>
      </div>
    );

  const actions = (
    <>
      <Button
        variant="ghost"
        icon={<ArrowLeft className="size-5" aria-hidden="true" />}
        onClick={() => setStep(step - 1)}
        className="px-4"
      >
        Back
      </Button>
      <Button onClick={next} loading={creating} className="flex-1 lg:flex-none">
        {step === 3 ? (creating ? "Creating book" : "Create book") : "Continue"}
      </Button>
    </>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-nest">
      <TopBar>
        <Button variant="ghost" className="px-3" onClick={() => navigate("/dashboard")}>
          Cancel
        </Button>
      </TopBar>
      <div className="flex-1 lg:grid lg:grid-cols-12">
        <main className="mx-auto w-full max-w-[640px] px-4 pt-8 pb-10 md:px-8 md:pt-12 lg:col-span-5 lg:max-w-none lg:pr-12 lg:pl-20">
          <Progress step={step} onJump={(s) => s < step && setStep(s)} />
          {(failed || (screenState === "error" && step === 3)) && (
            <div role="alert" className="mt-8 flex items-start gap-3 rounded-md bg-wash p-4">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-crimson" aria-hidden="true" />
              <p className="t-body">
                We couldn't create your book. Your choices are saved, so try again in a moment.
              </p>
            </div>
          )}
          <div className="mt-8 flex flex-col gap-8 md:mt-10">
            {screenState === "loading" ? (
              <div className="flex flex-col gap-4" aria-busy="true">
                <Skeleton className="h-9 w-2/3" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-40 w-full rounded-md" />
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
              </div>
            ) : step === 1 ? (
              <>
                <Heading
                  title="Choose a theme"
                  body="Start from a preset, then fine-tune any color."
                />
                <fieldset className="flex flex-col gap-3">
                  <legend className="mb-3 t-caption font-medium">
                    Preset
                    {preset === "custom" && (
                      <span className="font-normal text-muted"> · Custom colors</span>
                    )}
                  </legend>
                  <div className="grid grid-cols-2 gap-3">
                    {(Object.keys(PRESETS) as PresetKey[]).map((k) => (
                      <PresetOption
                        key={k}
                        name={PRESETS[k].name}
                        colors={PRESETS[k].colors}
                        selected={preset === k}
                        onSelect={() => {
                          setPreset(k);
                          setTheme({ ...PRESETS[k].colors });
                        }}
                      />
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="mb-3 t-caption font-medium">Colors</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {COLOR_FIELDS.map((f) => (
                      <ColorField
                        key={f.key}
                        label={f.label}
                        value={theme[f.key]}
                        onChange={setColor(f.key)}
                      />
                    ))}
                  </div>
                </fieldset>
                <Select label="Book font" value={font} options={fontOptions} onChange={setFont} />
                <Toggle
                  label="Notebook lines"
                  description="Show ruled lines on every page"
                  checked={lines}
                  onChange={setLines}
                />
              </>
            ) : step === 2 ? (
              <>
                <Heading
                  title="Name your book"
                  body="The link updates as you type, and you can edit it."
                />
                <Input
                  label={kind === "event" ? "Event title" : "Book title"}
                  placeholder={kind === "event" ? "Maya & Theo's wedding" : "Summer in Lisbon"}
                  value={title}
                  max={LIMITS.bookTitle}
                  onChange={(e) => setTitle(e.target.value)}
                  error={titleError}
                />
                <Input
                  label="Book link"
                  prefix="finchbound.com/"
                  value={effectiveSlug}
                  placeholder="your-book"
                  onChange={(e) => {
                    setSlugEdited(true);
                    setSlug(slugify(e.target.value));
                  }}
                  loading={slugState === "checking"}
                  trailing={
                    slugState === "ok" ? (
                      <Check className="size-5 text-pine" aria-hidden="true" />
                    ) : undefined
                  }
                  error={slugError}
                  helper={
                    <span className="flex flex-wrap items-center gap-x-2">
                      {slugState === "checking" && <span>Checking availability</span>}
                      {slugState === "ok" && (
                        <span className="flex items-center gap-2 text-slate">
                          <Dot color="#2F7D57" />
                          Available
                        </span>
                      )}
                      {slugEdited ? (
                        <button
                          type="button"
                          className="min-h-11 font-medium text-slate underline decoration-2 underline-offset-4"
                          onClick={() => setSlugEdited(false)}
                        >
                          Match title again
                        </button>
                      ) : (
                        slugState === "idle" && (
                          <span>Generated from your title until you edit it</span>
                        )
                      )}
                    </span>
                  }
                />
              </>
            ) : kind === "event" ? (
              <>
                <Heading title="Set the rules" body="Decide what guests share when they join." />
                <RadioGroup<Access>
                  label="Guest access"
                  value={access}
                  onChange={setAccess}
                  options={ACCESS_OPTIONS}
                />
                <div className="flex flex-col gap-2">
                  <Toggle
                    label="Photo required"
                    description="Guests must add a photo"
                    checked={photoReq}
                    onChange={setPhotoReq}
                  />
                  <Toggle
                    label="Message required"
                    description="Guests must write a message"
                    checked={msgReq}
                    onChange={setMsgReq}
                  />
                </div>
              </>
            ) : (
              <>
                <Heading
                  title="Set the rules"
                  body="Choose who can open your book once it's published."
                />
                <ReaderAccessField value={visibility} onChange={setVisibility} />
              </>
            )}
          </div>
          <div className="mt-10 hidden items-center justify-between gap-3 lg:flex">{actions}</div>
        </main>

        <aside aria-label="Live preview" className="hidden bg-wash lg:col-span-7 lg:block">
          <div className="sticky top-16 flex h-[calc(100dvh-4rem)] flex-col justify-center gap-4 p-12">
            <LivePreview look={look} title={title} className="aspect-[4/3] w-full" />
            <p className="text-center t-caption text-muted">
              Live preview · finchbound.com/{effectiveSlug || "your-book"}
            </p>
          </div>
        </aside>
      </div>

      {/* Mobile and tablet: preview collapses into a sticky bottom sheet. */}
      <div className="sticky bottom-0 z-30 rounded-t-xl bg-linen shadow-[0_-6px_20px_rgb(43_45_66/0.1)] lg:hidden">
        <div className="mx-auto max-w-[640px]">
          <button
            type="button"
            aria-expanded={sheet}
            aria-controls="preview-sheet"
            onClick={() => setSheet((s) => !s)}
            className="flex min-h-12 w-full items-center gap-3 px-4 pt-3 md:px-8"
          >
            <span
              className="absolute top-1.5 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-wash-strong"
              aria-hidden="true"
            />
            <span
              className="h-7 w-5 rounded-[3px] shadow-e1"
              style={{ background: theme.cover }}
              aria-hidden="true"
            />
            <span className="t-body font-medium">Preview</span>
            <ChevronUp
              className={cx("ml-auto size-5 transition-transform", sheet && "rotate-180")}
              aria-hidden="true"
            />
          </button>
          {sheet && (
            <div id="preview-sheet" className="anim-fade px-4 pt-2 md:px-8">
              <LivePreview
                look={look}
                title={title}
                size="sm"
                className="aspect-[4/3] max-h-[46dvh] w-full"
              />
            </div>
          )}
          <div className="flex items-center gap-3 px-4 pt-2 pb-4 md:px-8">{actions}</div>
        </div>
      </div>
    </div>
  );
}

function Heading({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="t-h1">{title}</h1>
      <p className="t-body">{body}</p>
    </div>
  );
}

export function Progress({ step, onJump }: { step: number; onJump?: (s: number) => void }) {
  return (
    <nav aria-label="Progress">
      <p className="sr-only">
        Step {step} of 3: {STEPS[step - 1]}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-wash-strong" aria-hidden="true">
        <div
          className="h-full rounded-full bg-crimson transition-[width] duration-300"
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </div>
      <ol className="mt-1 grid grid-cols-3">
        {STEPS.map((s, i) => {
          const n = i + 1;
          const done = n < step;
          return (
            <li key={s} className={cx(i === 1 && "text-center", i === 2 && "text-right")}>
              <button
                type="button"
                disabled={!done}
                aria-current={n === step ? "step" : undefined}
                onClick={() => onJump?.(n)}
                className={cx(
                  "min-h-11 rounded-sm px-1 t-caption disabled:cursor-default",
                  n === step
                    ? "font-bold"
                    : done
                      ? "font-medium underline-offset-4 hover:underline"
                      : "text-muted",
                )}
              >
                {s}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function TypeCard({
  selected,
  onSelect,
  icon,
  title,
  body,
  points,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  body: string;
  points: string[];
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cx(
        "relative flex flex-col gap-5 rounded-lg bg-linen p-6 text-left shadow-e1 transition-shadow hover:shadow-e2 md:p-8",
        selected && "shadow-e2 ring-2 ring-crimson",
      )}
    >
      <span className="flex size-14 items-center justify-center rounded-md bg-wash text-crimson">
        {icon}
      </span>
      <span className="flex flex-col gap-2">
        <span className="t-h2">{title}</span>
        <span className="t-body">{body}</span>
      </span>
      <ul className="flex flex-col gap-2">
        {points.map((p) => (
          <li key={p} className="flex items-center gap-2 t-body">
            <Check className="size-4 text-pine" aria-hidden="true" />
            {p}
          </li>
        ))}
      </ul>
      <span
        className={cx(
          "absolute top-6 right-6 flex size-6 items-center justify-center rounded-full border-2 transition-colors",
          selected ? "border-crimson bg-crimson text-white" : "border-stroke",
        )}
        aria-hidden="true"
      >
        {selected && <Check className="size-4" strokeWidth={3} />}
      </span>
    </button>
  );
}

export function PresetOption({
  name,
  colors,
  selected,
  onSelect,
}: {
  name: string;
  colors: ThemeColors;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={cx(
        "relative flex min-h-11 cursor-pointer items-center gap-3 rounded-md bg-linen p-3 shadow-e1 transition-shadow hover:shadow-e2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-slate has-[:focus-visible]:outline-solid",
        selected && "ring-2 ring-crimson",
      )}
    >
      <input
        type="radio"
        name="preset"
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />
      <span
        className="relative flex h-12 w-10 shrink-0 items-end justify-end overflow-hidden rounded-[3px] p-1"
        style={{ background: colors.cover }}
        aria-hidden="true"
      >
        <span
          className="absolute inset-x-1.5 top-2 h-3 rounded-[2px]"
          style={{ background: colors.background }}
        />
        <span className="size-2 rounded-full" style={{ background: colors.accent }} />
      </span>
      <span className="t-caption font-medium">{name}</span>
      {selected && (
        <Check
          className="absolute top-2 right-2 size-4 text-crimson"
          strokeWidth={3}
          aria-hidden="true"
        />
      )}
    </label>
  );
}
