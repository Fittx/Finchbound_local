import { bookFont } from "../book";
import { FONTS, type Book, type Page } from "../data";
import { diaryPdf, type DiaryLine, type DiarySheet } from "./diaryPdf";

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/u)) {
    const next = line ? line + " " + word : word;
    if (ctx.measureText(next).width <= width) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = "";
    for (const char of word) {
      if (line && ctx.measureText(line + char).width > width) {
        lines.push(line);
        line = "";
      }
      line += char;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function exportDiary(book: Book, pages: Page[], progress: (sheet: number) => void) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas unavailable");
  const c = ctx;
  const theme = book.theme;
  const font = FONTS[book.font];
  await document.fonts.load(`${font.weight} 24px ${font.family}`);
  const sheets: DiarySheet[] = [];
  let lines: DiaryLine[] = [];
  function rect(color: string, x: number, y: number, w: number, h: number) {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  }
  function start(width: number) {
    progress(sheets.length + 1);
    canvas.width = width * 2;
    canvas.height = 1200;
    c.scale(2, 2);
    lines = [];
    rect(theme.cover, 0, 0, width, 600);
  }
  async function finish() {
    const jpeg = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Encoding failed"))),
        "image/jpeg",
        0.9,
      ),
    );
    sheets.push({ jpeg, width: canvas.width / 2, height: 600, lines });
  }
  function text(
    value: string,
    x: number,
    top: number,
    width: number,
    height: number,
    px: number,
    leading: number,
    color: string,
    centered = false,
  ) {
    let size = Number(bookFont(book.font, px).fontSize);
    let rows: string[];
    for (;;) {
      c.font = `${font.weight} ${size}px ${font.family}`;
      rows = wrap(c, value, width);
      if (rows.length * leading <= height || size <= 8) break;
      size *= 0.94;
      leading *= 0.94;
    }
    c.fillStyle = color;
    let baseline = top + size + (centered ? (height - rows.length * leading) / 2 : 0);
    for (const row of rows) {
      const w = c.measureText(row).width;
      const left = centered ? x + (width - w) / 2 : x;
      c.fillText(row, left, baseline);
      const point = c.getTransform().transformPoint({ x: left, y: baseline });
      lines.push({ text: row, x: point.x / 2, y: point.y / 2, size, width: w });
      baseline += leading;
    }
    return top + rows.length * leading;
  }
  function feather(x: number, y: number, scale = 1) {
    c.save();
    c.translate(x, y);
    c.scale(scale, scale);
    c.fillStyle = c.strokeStyle = theme.accent;
    c.fill(new Path2D("M19.8 3.2c-6.6.3-12 5.7-12.4 12.2l1.2 1.2c6.4-.4 11.8-5.8 12.1-12.3Z"));
    c.lineWidth = 1.6;
    c.stroke(new Path2D("M3.8 20.2 15.8 8.2"));
    c.restore();
  }
  function cover(front: boolean) {
    start(450);
    rect("rgba(0,0,0,.12)", front ? 0 : 420, 0, 30, 600);
    rect("rgba(0,0,0,.1)", front ? 380 : 54, 0, 16, 600);
    if (front) {
      rect(theme.background, 66, 132, 294, 164);
      text(book.title, 81, 144, 264, 140, 32, 40, theme.header, true);
    }
    feather(front ? 328 : 198, front ? 512 : 268, 2.2);
  }
  cover(true);
  await finish();
  for (const [i, page] of pages.entries()) {
    start(920);
    rect(theme.background, 10, 10, 900, 580);
    if (book.lines) for (let y = 41; y < 590; y += 32) rect(theme.grid, 10, y, 900, 1);
    for (const x of [54, 504]) rect("rgba(230,57,70,.45)", x, 10, 2, 580);
    rect("rgba(43,45,66,.05)", 436, 10, 40, 580);
    if (page.image) {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src = page.image;
      await image.decode();
      const caption = page.caption || page.author || "";
      const height = caption ? 362 : 308;
      c.save();
      c.translate(246, 282);
      c.rotate(-Math.PI / 90);
      c.shadowColor = "rgba(43,45,66,.18)";
      c.shadowBlur = 16;
      rect("#fff", -150, -height / 2, 300, height);
      c.shadowBlur = 0;
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      c.drawImage(
        image,
        (image.naturalWidth - side) / 2,
        (image.naturalHeight - side) / 2,
        side,
        side,
        -138,
        12 - height / 2,
        276,
        276,
      );
      if (caption)
        text(caption, -138, 292 - height / 2, 276, height - 300, 18, 24, "#2B2D42", true);
      c.restore();
    } else text(page.header || page.title, 74, 72, 346, 420, 34, 44, theme.header, true);
    const end = text(page.header || page.title, 524, 54, 354, 124, 28, 32, theme.header);
    const messageTop = end + 32;
    const bodyEnd = text(
      page.body,
      524,
      messageTop,
      354,
      532 - messageTop - (page.author ? 52 : 0),
      18,
      32,
      theme.text,
    );
    if (page.author) text("- " + page.author, 524, bodyEnd, 354, 56, 18, 28, theme.text);
    text(String(i + 1), 66, 552, 88, 24, 14, 20, theme.text);
    feather(868, 548);
    await finish();
  }
  cover(false);
  await finish();
  canvas.width = canvas.height = 1;
  return diaryPdf(sheets);
}
