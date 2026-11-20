import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";
import { bookFont, NotebookPage, Polaroid, type BookLook } from "../book";
import type { Page } from "../data";
import { takePage } from "../lib/pagination";

export type LeafSize = { width: number; height: number };
export const SPREAD_LEAF = { width: 450, height: 580 };
export type BookLeaf = { source: Page; kind: "photo" | "text"; body: string; heading: string; author?: string; continues: boolean };
// Measurement and rendering share every layout value. Dimensions are unscaled CSS pixels.
const contentStyle: CSSProperties = { display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box", padding: "40px 32px 40px 64px" };
const textStyle = (look: BookLook): CSSProperties => ({ ...bookFont(look.font, 18), lineHeight: "32px", whiteSpace: "pre-wrap", overflowWrap: "anywhere", margin: 0, color: look.theme.text });
const headingStyle = (look: BookLook): CSSProperties => ({ ...bookFont(look.font, 28), lineHeight: "32px", margin: "0 0 16px", flexShrink: 0, overflowWrap: "anywhere", color: look.theme.header });
const cueStyle: CSSProperties = { height: 16, lineHeight: "16px", marginTop: 8, flexShrink: 0, textAlign: "right", fontFamily: "'DM Sans', sans-serif", fontSize: 12 };

/** Build leaves using an injected measurement function, also exercised in logic tests. */
export function flowPages(pages: Page[], fits: (body: string, heading: string, author?: string) => boolean): BookLeaf[] {
  const leaves: BookLeaf[] = [];
  for (const source of pages) {
    if (source.image) leaves.push({ source, kind: "photo", body: "", heading: "", continues: false });
    if (source.image && !source.body && !source.author && !source.header) continue;
    let remaining = source.body;
    let heading = source.header || source.title;
    do {
      const final = fits(remaining, heading, source.author);
      let body = final ? remaining : takePage(remaining, value => fits(value, heading));
      // Keep the sign-off with the last words instead of creating a signature-only leaf.
      if (!final && body === remaining) {
        const boundary = body.search(/\S+\s*$/u);
        body = boundary > 0 ? body.slice(0, boundary) : Array.from(body).slice(0, -1).join("");
        if (!body) throw new Error("The page is too small for the sign-off.");
      }
      leaves.push({ source, kind: "text", body, heading, ...(final && source.author ? { author: source.author } : {}), continues: !final });
      remaining = remaining.slice(body.length);
      heading = "";
      if (final) break;
    } while (remaining);
  }
  return leaves;
}

export function useLeafSize(ref: RefObject<HTMLElement | null>, fallback = SPREAD_LEAF) {
  const [size, setSize] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      if (!el.clientWidth || !el.clientHeight) return;
      setSize(old => old.width === el.clientWidth && old.height === el.clientHeight ? old : { width: el.clientWidth, height: el.clientHeight });
    };
    measure(); const observer = new ResizeObserver(measure); observer.observe(el);
    return () => observer.disconnect();
  });
  return size;
}

export function useFlowBook(pages: Page[], look: BookLook, size = SPREAD_LEAF) {
  const [leaves, setLeaves] = useState<BookLeaf[]>([]);
  useLayoutEffect(() => {
    let active = true;
    const compile = () => {
      if (!active) return;
      const host = document.createElement("div");
      Object.assign(host.style, { position: "fixed", top: "0", left: "-10000px", visibility: "hidden", pointerEvents: "none", width: `${size.width}px`, height: `${size.height}px` });
      const content = document.createElement("div"); Object.assign(content.style, contentStyle);
      const header = document.createElement("h3"); Object.assign(header.style, headingStyle(look)); header.style.fontSize = `${bookFont(look.font, 28).fontSize}px`;
      const area = document.createElement("div"); Object.assign(area.style, { minHeight: "0", flex: "1", overflow: "hidden" });
      const text = document.createElement("p"); Object.assign(text.style, textStyle(look)); text.style.fontSize = `${bookFont(look.font, 18).fontSize}px`;
      const signature = text.cloneNode() as HTMLParagraphElement;
      const cue = document.createElement("div"); Object.assign(cue.style, cueStyle); cue.style.height = "16px"; cue.style.fontSize = "12px"; cue.style.marginTop = "8px";
      area.append(text, signature); content.append(header, area, cue); host.append(content); document.body.append(host);
      try {
        const result = flowPages(pages, (body, heading, author) => {
          header.textContent = heading; header.style.display = heading ? "block" : "none";
          text.textContent = body; signature.textContent = author ? `- ${author}` : "";
          return area.scrollHeight <= area.clientHeight + 0.5;
        });
        setLeaves(result);
      } finally { host.remove(); }
    };
    compile(); document.fonts.ready.then(compile);
    document.fonts.addEventListener("loadingdone", compile);
    return () => { active = false; document.fonts.removeEventListener("loadingdone", compile); };
  }, [pages, look.font, size.width, size.height]);
  return leaves;
}

export function LeafContent({ leaf, look, onOpen }: { leaf?: BookLeaf; look: BookLook; onOpen?: () => void }) {
  if (!leaf) return null;
  if (leaf.kind === "photo") return <div className="flex size-full items-center justify-center px-12 py-12"><Polaroid src={leaf.source.image!} caption={leaf.source.caption || leaf.source.author} look={look} onOpen={onOpen} className="max-h-full max-w-[300px]" /></div>;
  return <div style={contentStyle} data-book-text-page>
    {leaf.heading && <h3 style={headingStyle(look)}>{leaf.heading}</h3>}
    <div className="min-h-0 flex-1 overflow-hidden" data-book-page-body>
      <p style={textStyle(look)}>{leaf.body}</p>
      {leaf.author && <p style={textStyle(look)}>- {leaf.author}</p>}
    </div>
    <div style={{ ...cueStyle, color: look.theme.text }}>{leaf.continues ? "continued →" : ""}</div>
  </div>;
}

export function FlowSpread({ leaves, index, look, onOpen, turn, reduced }: {
  leaves: BookLeaf[]; index: number; look: BookLook; onOpen?: (index: number) => void;
  turn?: { dir: "next" | "prev"; to: number } | null; reduced?: boolean;
}) {
  const single = !leaves[index * 2 + 1];
  const draw = (spread: number, side: 0 | 1) => {
    const i = spread * 2 + side;
    if (!leaves[i]) return null;
    return <NotebookPage look={look} side={side ? "right" : "left"} number={i + 1}>
      <LeafContent leaf={leaves[i]} look={look} onOpen={onOpen ? () => onOpen(i) : undefined} />
    </NotebookPage>;
  };
  // An unpaired last leaf is shown alone; don't animate a nonexistent reverse face.
  const animate = turn && !reduced && !single && !!leaves[turn.to * 2 + 1];
  const left = animate && turn.dir === "prev" ? turn.to : index;
  const right = animate && turn.dir === "next" ? turn.to : index;
  const face: CSSProperties = { backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" };
  return <div className="flex justify-center" style={{ width: 920, height: 600 }}>
    <div className="rounded-lg shadow-e3" style={{ background: look.theme.cover, padding: 10, width: single ? 470 : 920, height: 600 }}>
      <div className={single ? "size-full overflow-hidden rounded-sm" : "relative grid size-full grid-cols-2 rounded-sm"} style={{ perspective: 2600 }}>
        <div className="size-full overflow-hidden">{draw(left, 0)}</div>
        {!single && <div className="size-full overflow-hidden">{draw(right, 1)}</div>}
        {animate && <div className={`pointer-events-none absolute inset-y-0 w-1/2 ${turn.dir === "next" ? "right-0" : "left-0"}`} style={{
          transformStyle: "preserve-3d", transformOrigin: turn.dir === "next" ? "left center" : "right center",
          animation: `fb-turn-${turn.dir} 760ms cubic-bezier(0.45, 0.05, 0.25, 1) both`,
        }}>
          <div className="absolute inset-0 overflow-hidden shadow-e2" style={face}>{draw(index, turn.dir === "next" ? 1 : 0)}</div>
          <div className="absolute inset-0 overflow-hidden shadow-e2" style={{ ...face, transform: "rotateY(180deg)" }}>{draw(turn.to, turn.dir === "next" ? 0 : 1)}</div>
        </div>}
      </div>
    </div>
  </div>;
}
