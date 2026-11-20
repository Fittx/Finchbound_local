import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { FONTS, type FontKey, type Page, type ThemeColors } from "./data";
import { FeatherMark } from "./brand";
import { cx } from "./ui";

export type BookLook = { theme: ThemeColors; font: FontKey; lines: boolean };

const FONT_SCALE: Record<FontKey, number> = { sans: 0.92, hand: 1.12, serif: 1, mono: 0.9 };
export const bookFont = (font: FontKey, px: number): CSSProperties => ({
  fontFamily: FONTS[font].family,
  fontWeight: FONTS[font].weight,
  fontSize: Math.round(px * FONT_SCALE[font] * 10) / 10,
});

/** Notebook cover used for thumbnails and the live wizard preview. */
export function BookCover({
  look,
  title,
  className,
}: {
  look: BookLook;
  title: string;
  className?: string;
}) {
  const { theme, font } = look;
  return (
    <div
      className={cx(
        "relative aspect-[3/4] overflow-hidden rounded-l-[6px] rounded-r-md shadow-e2",
        className,
      )}
      style={{ background: theme.cover, containerType: "inline-size" }}
    >
      <div
        className="absolute inset-y-0 left-0 w-[7%]"
        style={{ background: "rgb(0 0 0 / 0.12)" }}
      />
      <div
        className="absolute inset-y-0 right-[12%] w-[3.5%]"
        style={{ background: "rgb(0 0 0 / 0.1)" }}
      />
      <div
        className="absolute top-[22%] right-[20%] left-[15%] flex min-h-[26%] items-center justify-center rounded-[4px] px-[6%] py-[5%] text-center"
        style={{ background: theme.background }}
      >
        <span
          className="line-clamp-3 break-words"
          style={{
            ...bookFont(font, 1),
            fontSize: `${8.5 * FONT_SCALE[font]}cqw`,
            lineHeight: 1.2,
            color: theme.header,
          }}
        >
          {title || "Your title"}
        </span>
      </div>
      <div className="absolute right-[18%] bottom-[6%]" style={{ width: "13%" }}>
        <FeatherMark className="size-full" color={theme.accent} />
      </div>
    </div>
  );
}

/** A single ruled notebook page with red margin and optional corner feather. */
export function NotebookPage({
  look,
  children,
  feather,
  number,
  className,
  side = "right",
}: {
  look: BookLook;
  children?: ReactNode;
  feather?: boolean;
  number?: number;
  className?: string;
  side?: "left" | "right";
}) {
  const { theme, font, lines } = look;
  return (
    <div
      className={cx("relative size-full overflow-hidden", lines && "ruled", className)}
      style={{ backgroundColor: theme.background, ["--rule" as string]: theme.grid }}
    >
      <div
        className="absolute inset-y-0 left-11 w-[2px]"
        style={{ background: "rgb(230 57 70 / 0.45)" }}
      />
      {side === "left" && (
        <div
          className="absolute inset-y-0 right-0 w-6"
          style={{ background: "rgb(43 45 66 / 0.05)" }}
        />
      )}
      {side === "right" && (
        <div
          className="absolute inset-y-0 left-0 w-4"
          style={{ background: "rgb(43 45 66 / 0.05)" }}
        />
      )}
      <div className="relative size-full">{children}</div>
      {number !== undefined && (
        <span
          className={cx("absolute bottom-4", side === "left" ? "left-14" : "right-14")}
          style={{ ...bookFont(font, 14), color: theme.text }}
        >
          {number}
        </span>
      )}
      {feather && (
        <span className="absolute right-4 bottom-4">
          <FeatherMark className="size-6" color={theme.accent} />
        </span>
      )}
    </div>
  );
}

export function Polaroid({
  src,
  caption,
  look,
  onOpen,
  className,
}: {
  src: string;
  caption?: string;
  look: BookLook;
  onOpen?: () => void;
  className?: string;
}) {
  const inner = (
    <>
      <img
        src={src}
        alt={caption || "Book photo"}
        className="aspect-square w-full object-cover"
        loading="lazy"
      />
      {caption && (
        <span
          className="mt-3 block text-center wrap-anywhere"
          style={{ ...bookFont(look.font, 18), color: "#2B2D42" }}
        >
          {caption}
        </span>
      )}
    </>
  );
  const cls = cx(
    "block w-full -rotate-2 bg-white p-3 pb-4 shadow-e2 transition-transform duration-200",
    onOpen && "cursor-zoom-in hover:rotate-0",
    className,
  );
  return onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      className={cx(cls, "book-control")}
      aria-label={`Open photo full screen${caption ? `, ${caption}` : ""}`}
    >
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function LeftContent({
  page,
  look,
  onOpen,
}: {
  page?: Page;
  look: BookLook;
  onOpen?: () => void;
}) {
  if (!page) return null;
  return (
    <div className="flex size-full items-center justify-center pt-6 pr-10 pb-14 pl-16">
      {page.image ? (
        <Polaroid
          src={page.image}
          caption={page.caption || page.author}
          look={look}
          onOpen={onOpen}
          className="max-w-[300px]"
        />
      ) : (
        <p
          className="text-center"
          style={{ ...bookFont(look.font, 34), lineHeight: "44px", color: look.theme.header }}
        >
          {page.header || page.title}
        </p>
      )}
    </div>
  );
}

export function RightContent({
  page,
  look,
  compact,
}: {
  page?: Page;
  look: BookLook;
  compact?: boolean;
}) {
  if (!page) return null;
  return <div className={cx("flex size-full flex-col pr-8 pl-16", compact ? "py-4" : "py-10")}>
    {(page.header || page.title) && <h3 className="mb-4" style={{ ...bookFont(look.font, 28), lineHeight: "32px", color: look.theme.header }}>{page.header || page.title}</h3>}
    <p className="whitespace-pre-wrap break-words" style={{ ...bookFont(look.font, 18), lineHeight: "32px", color: look.theme.text }}>{page.body}</p>
    {page.author && <p style={{ ...bookFont(look.font, 18), lineHeight: "32px", color: look.theme.text }}>- {page.author}</p>}
  </div>;
}

export const TURN_MS = 760;

/** Two-page spread with an optional turning leaf (animated or frozen at an angle). */
export function Spread({
  look,
  pages,
  index,
  turn,
  angle,
  reduced,
  onOpen,
  width = 920,
  height = 600,
}: {
  look: BookLook;
  pages: Page[];
  index: number;
  turn?: { dir: "next" | "prev"; to: number } | null;
  angle?: number;
  reduced?: boolean;
  onOpen?: (i: number) => void;
  width?: number;
  height?: number;
}) {
  const leftIdx = turn?.dir === "prev" ? turn.to : index;
  const rightIdx = turn?.dir === "next" ? turn.to : index;
  const left = (i: number) => (
    <NotebookPage look={look} side="left" number={pages.length ? i + 1 : undefined}>
      <LeftContent page={pages[i]} look={look} onOpen={onOpen ? () => onOpen(i) : undefined} />
    </NotebookPage>
  );
  const right = (i: number) => (
    <NotebookPage look={look} side="right" feather>
      <RightContent page={pages[i]} look={look} />
    </NotebookPage>
  );
  const face: CSSProperties = { backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" };
  const leafStyle = (dir: "next" | "prev"): CSSProperties => ({
    transformStyle: "preserve-3d",
    transformOrigin: dir === "next" ? "left center" : "right center",
    ...(angle !== undefined
      ? { transform: `rotateY(${dir === "next" ? -angle : angle}deg)` }
      : { animation: `fb-turn-${dir} ${TURN_MS}ms cubic-bezier(0.45, 0.05, 0.25, 1) both` }),
  });
  const leafDir = angle !== undefined ? "next" : turn?.dir;
  return (
    <div
      className="rounded-lg p-2.5 shadow-e3"
      style={{ background: look.theme.cover, width, height }}
    >
      <div
        className="relative grid size-full grid-cols-2 overflow-visible rounded-sm"
        style={{ perspective: 2600 }}
      >
        <div
          key={reduced ? `l${leftIdx}` : "l"}
          className={cx("overflow-hidden rounded-l-sm", reduced && "anim-fade")}
        >
          {left(leftIdx)}
        </div>
        <div
          key={reduced ? `r${rightIdx}` : "r"}
          className={cx("overflow-hidden rounded-r-sm", reduced && "anim-fade")}
        >
          {angle !== undefined ? right(index + 1) : right(rightIdx)}
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2"
          style={{ background: "rgb(43 45 66 / 0.18)" }}
        />
        {leafDir && !reduced && (
          <div
            className={cx(
              "pointer-events-none absolute inset-y-0 w-1/2",
              leafDir === "next" ? "right-0" : "left-0",
            )}
            style={leafStyle(leafDir)}
          >
            <div className="absolute inset-0 overflow-hidden shadow-e2" style={face}>
              {leafDir === "next" ? right(index) : left(index)}
            </div>
            <div
              className="absolute inset-0 overflow-hidden shadow-e2"
              style={{ ...face, transform: "rotateY(180deg)" }}
            >
              {leafDir === "next" ? left(turn?.to ?? index + 1) : right(turn?.to ?? index - 1)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function useFlip(count: number, reduced: boolean) {
  const [index, setIndex] = useState(0);
  const [turn, setTurn] = useState<{ dir: "next" | "prev"; to: number } | null>(null);
  const busy = useRef(false);
  const go = (dir: "next" | "prev") => {
    if (busy.current) return;
    const to = dir === "next" ? index + 1 : index - 1;
    if (to < 0 || to >= count) return;
    if (reduced) return setIndex(to);
    busy.current = true;
    setTurn({ dir, to });
    window.setTimeout(() => {
      setIndex(to);
      setTurn(null);
      busy.current = false;
    }, TURN_MS);
  };
  return { index, setIndex, turn, go };
}

/** Renders fixed-size artwork scaled to its container width (and optionally height). */
export function Scaled({
  w,
  h,
  max = 1,
  fitHeight,
  children,
  className,
}: {
  w: number;
  h: number;
  max?: number;
  fitHeight?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [s, setS] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const byW = el.clientWidth / w;
      const byH = fitHeight ? el.clientHeight / h : Infinity;
      setS(Math.max(0.2, Math.min(max, byW, byH)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w, h, max, fitHeight]);
  return (
    <div
      ref={ref}
      className={cx("relative w-full min-w-0", fitHeight && "h-full", className)}
      style={fitHeight ? undefined : { height: Math.floor(h * s) }}
    >
      {/* Absolutely positioned so the artwork never feeds back into the container's width. */}
      <div
        className="absolute top-1/2 left-1/2"
        style={{
          width: w,
          height: h,
          ["--book-scale" as string]: s || 1,
          opacity: s ? 1 : 0,
          transform: `translate(-50%, -50%) scale(${s})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Floating feathers shown after publishing. Reduced motion: one feather fades in. */
export function FeatherBurst({ reduced, color = "#E63946" }: { reduced: boolean; color?: string }) {
  if (reduced)
    return (
      <div className="anim-fade flex justify-center py-2" aria-hidden="true">
        <FeatherMark className="size-14" color={color} />
      </div>
    );
  const feathers = [
    { x: -120, dx: -60, rot: -50, d: 0, c: color, s: 28 },
    { x: -60, dx: 30, rot: 70, d: 120, c: "#F4A261", s: 22 },
    { x: 0, dx: -20, rot: 40, d: 60, c: color, s: 34 },
    { x: 60, dx: 50, rot: -60, d: 200, c: "#F4A261", s: 24 },
    { x: 120, dx: 70, rot: 90, d: 30, c: color, s: 26 },
    { x: -30, dx: -80, rot: 120, d: 260, c: "#2B2D42", s: 18 },
    { x: 90, dx: -30, rot: -100, d: 320, c: color, s: 20 },
  ];
  return (
    <div className="pointer-events-none relative h-40" aria-hidden="true">
      {feathers.map((f, i) => (
        <span
          key={i}
          className="absolute bottom-0 left-1/2 block"
          style={{
            marginLeft: f.x,
            width: f.s,
            height: f.s,
            ["--dx" as string]: `${f.dx}px`,
            ["--rot" as string]: `${f.rot}deg`,
            animation: `fb-feather 1800ms ${f.d}ms cubic-bezier(0.2, 0.6, 0.3, 1) both`,
          }}
        >
          <FeatherMark className="block size-full" color={f.c} />
        </span>
      ))}
    </div>
  );
}
