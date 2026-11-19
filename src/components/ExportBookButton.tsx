import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import type { Book, Page } from "../data";
import { useApp } from "../store";
import { Button } from "../ui";

export function ExportBookButton({ book, pages }: { book: Book; pages: Page[] }) {
  const [sheet, setSheet] = useState(0);
  const buttonArea = useRef<HTMLSpanElement>(null);
  const { toast } = useApp();
  const active = useRef(false);
  useEffect(
    () => () => {
      active.current = false;
    },
    [],
  );

  async function download() {
    if (active.current) return;
    active.current = true;
    setSheet(1);
    try {
      const { exportDiary } = await import("../lib/exportDiary");
      const pdf = await exportDiary(book, pages, (current) => {
        if (!active.current) throw new Error("Export cancelled");
        setSheet(current);
      });
      if (!buttonArea.current) return;
      const url = URL.createObjectURL(pdf);
      const link = document.createElement("a");
      link.href = url;
      const name = book.title
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
        .trim()
        .replace(/[. ]+$/, "");
      link.download = (name || "Finchbound diary") + ".pdf";
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      if (buttonArea.current)
        toast("Couldn't export your diary. Check that its photos are available and try again.");
    } finally {
      active.current = false;
      if (buttonArea.current) setSheet(0);
    }
  }

  return (
    <span ref={buttonArea}>
      <Button
        variant="inverse"
        onClick={download}
        title="Export PDF"
        aria-label="Export PDF"
        loading={sheet > 0}
        className="max-md:w-11 max-md:px-0"
        icon={<Download className="size-5" aria-hidden="true" />}
      >
        <span className="hidden md:inline">Export PDF</span>
      </Button>
      <span className="sr-only" role="status">
        {sheet > 0 && `Preparing page ${sheet} of ${pages.length + 2}`}
      </span>
    </span>
  );
}
