import { BookCover, NotebookPage, bookFont, type BookLook } from "../book";
import { FONTS, type FontKey } from "../data";
import { cx } from "../ui";

export const fontOptions = (Object.keys(FONTS) as FontKey[]).map((k) => ({
  value: k,
  label: FONTS[k].name,
  preview: (
    <span className="w-8 shrink-0 text-center" style={bookFont(k, 18)} aria-hidden="true">
      Aa
    </span>
  ),
}));

/** Cover plus an open page on the book's own canvas. Used by the wizard and theme modal. */
export function LivePreview({
  look,
  title,
  className,
  size = "lg",
}: {
  look: BookLook;
  title: string;
  className?: string;
  size?: "sm" | "lg";
}) {
  const { theme, font } = look;
  return (
    <div
      className={cx(
        "canvas-grid flex items-center justify-center gap-[6%] rounded-lg",
        size === "lg" ? "p-[8%]" : "p-6",
        className,
      )}
      style={{
        ["--canvas-bg" as string]: theme.background,
        ["--canvas-line" as string]: `color-mix(in srgb, ${theme.grid} 50%, ${theme.background})`,
      }}
      aria-label={`Preview of ${title || "your book"}`}
      role="img"
    >
      <BookCover look={look} title={title} className="w-[42%] max-w-[280px] shrink-0" />
      <div className="aspect-[3/4] w-[42%] max-w-[280px] shrink-0 overflow-hidden rounded-sm shadow-e2">
        <NotebookPage look={look} feather>
          <div className={cx("flex h-full flex-col pr-4 pl-14", size === "lg" ? "pt-8" : "pt-5")}>
            <p
              style={{
                ...bookFont(font, size === "lg" ? 20 : 15),
                lineHeight: "32px",
                color: theme.header,
              }}
              className="truncate"
            >
              Dear friends
            </p>
            <p
              style={{
                ...bookFont(font, size === "lg" ? 15 : 12),
                lineHeight: "32px",
                color: theme.text,
              }}
              className="line-clamp-4"
            >
              Thank you for filling these pages with laughter and the best kind of chaos.
            </p>
          </div>
        </NotebookPage>
      </div>
    </div>
  );
}
