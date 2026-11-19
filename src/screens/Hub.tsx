import { useSession } from "../api/session";
import { useOwnedBook } from "../hooks/useOwnedBook";
import { guestJoinUrl } from "../lib/routing";
import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { AlertCircle, ArrowLeft, BookOpen, Download, LayoutGrid } from "lucide-react";
import { FeatherMark, LogoMark } from "../brand";
import { bookFont } from "../book";
import { FONTS, initials, type Book } from "../data";
import { Container, TopBar } from "../shell";
import { LIMITS } from "../constants";
import { TextLink } from "../components/TextLink";
import { useApp } from "../store";
import { Button, CopyButton, Dot, ErrorState, Modal, Skeleton, Textarea, Toggle, cx } from "../ui";
import { useModeration } from "./hub/useModeration";
import { ModerationFeed } from "./hub/ModerationFeed";
import { ReportsPanel } from "./hub/ReportsPanel";

/** Plain-text settings line. Strict events add the pending count, e.g. "Approval on · 3 pending". */
export const settingsSummary = (b: Book, pending?: number) =>
  [
    b.access === "name"
      ? "Name required"
      : b.access === "email"
        ? "Email required"
        : "Name and email required",
    b.access === "strict" && "Approval on",
    b.access === "strict" && pending !== undefined && `${pending} pending`,
    b.photoRequired ? "Photo required" : "Photo optional",
    b.status === "open" ? "Flock active" : "Flock paused",
  ]
    .filter(Boolean)
    .join(" · ");

export function Hub() {
  const host = useSession();
  const { route, navigate, screenState, setScreenState, reduced } = useApp();
  const { book, error } = useOwnedBook(route.path[1] ?? "");
  const mod = useModeration(book);
  const [invite, setInvite] = useState(false);

  if (!book && !error)
    return (
      <div role="status" className="p-8">
        Loading book…
      </div>
    );
  if (!book)
    return (
      <div className="min-h-dvh bg-nest">
        <TopBar />
        <ErrorState
          title="We couldn't find that book"
          body="It may have been deleted."
          action="Go to your books"
          onRetry={() => navigate("/dashboard")}
        />
      </div>
    );

  const destination = guestJoinUrl(book.slug);
  const url = `finchbound.com/${book.slug}`;
  return (
    <div className="min-h-dvh bg-nest">
      <TopBar>
        <span
          className="flex size-10 items-center justify-center rounded-full bg-gold t-caption font-bold"
          aria-label={host?.name ?? "Host"}
        >
          AL
        </span>
      </TopBar>
      <main>
        <Container className="pt-6 pb-16 md:pt-8">
          <a
            href="#/dashboard"
            className="-ml-3 inline-flex min-h-11 items-center gap-2 rounded-md px-3 t-body font-medium hover:bg-wash"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
            Your books
          </a>
          <div className="mt-4 mb-8 flex flex-col gap-6 md:mb-10 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 flex-col gap-3">
              <h1 className="t-h1">{book.title}</h1>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="t-body break-all">{url}</span>
                <CopyButton text={destination} compact label="Copy book link" />
              </div>
              <p className="flex items-start gap-2 t-caption text-muted">
                <span className="mt-1.5">
                  <Dot color={book.status === "open" ? "#2F7D57" : "#8A8C9C"} />
                </span>
                {settingsSummary(book, mod.status === "ready" ? mod.counts.pending : undefined)}
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                icon={<LayoutGrid className="size-5" aria-hidden="true" />}
                onClick={() => navigate(`/editor/${book.id}`)}
                className="max-md:flex-1"
              >
                Arrange pages
              </Button>
              <Button
                variant="ghost"
                icon={<BookOpen className="size-5" aria-hidden="true" />}
                onClick={() => navigate(`/reader/${book.slug}`)}
                className="max-md:flex-1"
              >
                View book
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <aside className="flex flex-col gap-6 lg:col-span-4" aria-labelledby="scan-h">
              <div className="flex flex-col gap-6 rounded-lg bg-linen p-6 shadow-e1 md:flex-row md:items-center lg:flex-col lg:items-stretch">
                <div className="flex justify-center rounded-md bg-wash p-5 md:shrink-0 lg:shrink">
                  {mod.status === "loading" ? (
                    <Skeleton className="size-44 bg-wash-strong" />
                  ) : (
                    <div className="rounded-sm bg-white p-3">
                      <QRCodeSVG
                        value={destination}
                        size={168}
                        fgColor="#2B2D42"
                        title={`QR code linking to ${url}`}
                      />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <h2 id="scan-h" className="t-h2">
                      Scan to join
                    </h2>
                    <p className="t-body">Guests point their camera here to add a page.</p>
                  </div>
                  <div className="flex min-h-11 items-center justify-between gap-2 rounded-sm bg-wash pl-3">
                    <span className="truncate t-caption">{url}/join</span>
                    <CopyButton text={destination} compact />
                  </div>
                  <Button full onClick={() => setInvite(true)}>
                    Create invitation card
                  </Button>
                  <TextLink href={`#/${book.slug}/join`} className="self-center">
                    Open guest page
                  </TextLink>
                </div>
              </div>
              <ReportsPanel mod={mod} />
            </aside>

            <ModerationFeed book={book} mod={mod} />
          </div>
        </Container>
      </main>
      {invite && <InviteModal book={book} onClose={() => setInvite(false)} />}
    </div>
  );
}

const PALETTE = [
  { name: "Linen", hex: "#FFFFFF" },
  { name: "Nest white", hex: "#FDFBF7" },
  { name: "Crest gold", hex: "#F4A261" },
  { name: "Crimson", hex: "#E63946" },
  { name: "Pine", hex: "#2F5D46" },
  { name: "Soft slate", hex: "#2B2D42" },
];
const TEXT_COLORS = [
  { name: "Soft slate", hex: "#2B2D42" },
  { name: "White", hex: "#FFFFFF" },
];

const lum = (hex: string) => {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
export const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
};

const VANE = "M19.8 3.2c-6.6.3-12 5.7-12.4 12.2l1.2 1.2c6.4-.4 11.8-5.8 12.1-12.3Z";
const SHAFT = "M3.8 20.2 15.8 8.2";

function InviteModal({ book, onClose }: { book: Book; onClose: () => void }) {
  const { toast } = useApp();
  const [message, setMessage] = useState(`Scan to leave us a note and a photo for ${book.title}`);
  const [bg, setBg] = useState("#FFFFFF");
  const [text, setText] = useState("#2B2D42");
  const [watermark, setWatermark] = useState(true);
  const [busy, setBusy] = useState(false);
  const qrRef = useRef<HTMLCanvasElement>(null);
  const destination = guestJoinUrl(book.slug);
  const url = `finchbound.com/${book.slug}`;
  const ratio = contrast(bg, text);
  const low = ratio < 4.5;
  const f = FONTS[book.font];

  const download = async () => {
    setBusy(true);
    try {
      const W = 1080;
      const H = 1350;
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      if (watermark) {
        ctx.save();
        ctx.globalAlpha = 0.1;
        ctx.translate(560, 620);
        ctx.scale(30, 30);
        ctx.fillStyle = text;
        ctx.strokeStyle = text;
        ctx.lineWidth = 1.6;
        ctx.lineCap = "round";
        ctx.fill(new Path2D(VANE));
        ctx.stroke(new Path2D(SHAFT));
        ctx.restore();
      }
      const size = book.font === "hand" ? 72 : 60;
      await document.fonts.load(`${f.weight} ${size}px ${f.family}`).catch(() => undefined);
      ctx.fillStyle = text;
      ctx.textAlign = "center";
      ctx.font = `${f.weight} ${size}px ${f.family}`;
      const words = message.split(/\s+/);
      const lines: string[] = [];
      let line = "";
      for (const w of words) {
        const t = line ? `${line} ${w}` : w;
        if (ctx.measureText(t).width > 880 && line) {
          lines.push(line);
          line = w;
        } else line = t;
      }
      if (line) lines.push(line);
      lines.slice(0, 4).forEach((l, i) => ctx.fillText(l, W / 2, 190 + i * size * 1.3));
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.roundRect?.(310, 560, 460, 460, 24);
      ctx.fill();
      if (qrRef.current) ctx.drawImage(qrRef.current, 340, 590, 400, 400);
      ctx.fillStyle = text;
      ctx.font = `500 34px 'DM Sans', sans-serif`;
      ctx.fillText(`${url}/join`, W / 2, 1090);
      ctx.font = `500 28px 'DM Sans', sans-serif`;
      ctx.fillText("Made with Finchbound", W / 2 + 22, 1272);
      const mw = ctx.measureText("Made with Finchbound").width;
      ctx.save();
      ctx.translate(W / 2 - mw / 2 - 30, 1240);
      ctx.scale(1.5, 1.5);
      ctx.fillStyle = "#E63946";
      ctx.fill(
        new Path2D(
          "M5.5 13.2 9.6 12c2-1.4 5-2 8-1.9 1.4-1.4 3.4-1.8 5-.9l2.8.6-2.4 1.1c-.6 2.2-3 3.8-6.4 4-3.4.2-6.4-.5-11.1-1.7Z",
        ),
      );
      ctx.fill(new Path2D("M12.4 11c.2-3.4 1.6-6.4 5.4-8.4-.4 3-.6 5.6-.4 8Z"));
      ctx.fillStyle = text;
      ctx.fill(new Path2D("M3 20.5c4-1.5 8.5-1.3 13 1V28c-4.5-2.2-9-2.4-13-1Z"));
      ctx.fill(new Path2D("M29 20.5c-4-1.5-8.5-1.3-13 1V28c4.5-2.2 9-2.4 13-1Z"));
      ctx.restore();
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
      if (!blob) throw new Error("export failed");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${book.slug}-invitation.png`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast("Invitation card downloaded");
    } catch {
      toast("We couldn't create the image. Try again.", { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Invitation card"
      description="Print it or share it so guests can scan and join."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            loading={busy}
            icon={<Download className="size-5" aria-hidden="true" />}
            onClick={download}
          >
            {busy ? "Preparing image" : "Download image"}
          </Button>
        </>
      }
    >
      <QRCodeCanvas
        ref={qrRef}
        value={destination}
        size={400}
        fgColor="#2B2D42"
        className="hidden"
        aria-hidden="true"
      />
      <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:gap-8">
        <div className="flex flex-col gap-6 max-md:order-2">
          <Textarea
            label="Message"
            value={message}
            max={LIMITS.inviteMessage}
            rows={3}
            onChange={(e) => setMessage(e.target.value)}
          />
          <SwatchGroup label="Background" options={PALETTE} value={bg} onChange={setBg} />
          <Toggle
            label="Feather watermark"
            description="A faint feather behind the code"
            checked={watermark}
            onChange={setWatermark}
          />
          <div className="flex flex-col gap-2">
            <SwatchGroup label="Text color" options={TEXT_COLORS} value={text} onChange={setText} />
            {low && (
              <p className="flex items-start gap-2 t-caption" role="status">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-crimson" aria-hidden="true" />
                Low contrast ({ratio.toFixed(1)}:1). Try{" "}
                {text === "#FFFFFF" ? "Soft slate" : "White"} text.
              </p>
            )}
          </div>
        </div>
        <div className="max-md:order-1">
          <div className="md:sticky md:top-0">
            <div
              className="relative mx-auto flex aspect-[4/5] w-full max-w-[380px] flex-col items-center overflow-hidden rounded-md px-[8%] pt-[10%] pb-[6%] text-center shadow-e2"
              style={{ background: bg, color: text }}
              role="img"
              aria-label={`Invitation card preview: ${message}`}
            >
              {watermark && (
                <span
                  className="pointer-events-none absolute -right-[12%] -bottom-[6%] w-[80%] opacity-10"
                  aria-hidden="true"
                >
                  <FeatherMark className="size-full" color={text} />
                </span>
              )}
              <p
                className="relative line-clamp-4"
                style={{ ...bookFont(book.font, 24), lineHeight: 1.3 }}
              >
                {message || " "}
              </p>
              <div className="relative mt-auto rounded-sm bg-white p-3">
                <QRCodeSVG value={destination} size={136} fgColor="#2B2D42" />
              </div>
              <p className="relative mt-3 t-caption font-medium">{url}/join</p>
              <p className="relative mt-auto flex items-center gap-2 pt-4 text-xs font-medium">
                <LogoMark className="size-4" />
                Made with Finchbound
              </p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function SwatchGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { name: string; hex: string }[];
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 t-caption font-medium">{label}</legend>
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        {options.map((o) => (
          <label
            key={o.hex}
            className="group flex w-16 cursor-pointer flex-col items-center gap-1 rounded-sm py-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-slate has-[:focus-visible]:outline-solid"
          >
            <input
              type="radio"
              name={label}
              checked={value === o.hex}
              onChange={() => onChange(o.hex)}
              className="sr-only"
            />
            <span
              className={cx(
                "size-11 rounded-full shadow-[inset_0_0_0_1px_rgb(43_45_66/0.18)] transition-shadow",
                value === o.hex && "ring-2 ring-slate ring-offset-2",
              )}
              style={{ background: o.hex }}
            />
            <span className={cx("text-center text-xs leading-4", value === o.hex && "font-bold")}>
              {o.name}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
