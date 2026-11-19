import { useState, type ReactNode } from "react";
import { Flag } from "lucide-react";
import { LogoMark } from "../brand";
import { readableOn } from "../lib/color";
import type { GuestEvent } from "../api/guest";
import { ReportContentModal } from "./ReportContentModal";
import { FormAlert } from "./FormAlert";
import { cx } from "../ui";

/** Guest shell: the event's flat page background, Finchbound UI on top. Never shows the host feed. */
export function GuestLayout({
  event,
  slug,
  offline,
  header,
  children,
  reportOpen,
  className,
}: {
  event?: GuestEvent | null;
  slug: string;
  offline?: boolean;
  header?: ReactNode;
  children: ReactNode;
  reportOpen?: boolean;
  className?: string;
}) {
  const [report, setReport] = useState(!!reportOpen);
  const bg = event?.theme.background ?? "#FDFBF7";
  const fg = readableOn(bg);
  return (
    <div className="flex min-h-dvh flex-col" style={{ background: bg, color: fg }}>
      {offline && (
        <div className="px-4 pt-4 text-slate md:px-8">
          <FormAlert
            tone="offline"
            className="mx-auto max-w-[1120px] bg-linen shadow-e1"
            title="You're offline"
          >
            Your page stays on this device. Send it when you're back online.
          </FormAlert>
        </div>
      )}
      {header && <div className="mx-auto w-full max-w-[1120px] px-4 pt-4 md:px-8">{header}</div>}
      <main
        className={cx(
          "mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-4 py-6 md:px-8 md:py-10",
          className,
        )}
      >
        {children}
      </main>
      <footer className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-2 px-4 pb-6 md:px-8">
        <a href="#/" className="flex min-h-11 items-center gap-2 rounded-sm t-caption font-medium">
          <LogoMark className="size-5" />
          Made with Finchbound
        </a>
        {event && (
          <button
            type="button"
            onClick={() => setReport(true)}
            className="flex min-h-11 items-center gap-2 rounded-sm px-2 t-caption font-medium underline decoration-2 underline-offset-4 hover:no-underline"
          >
            <Flag className="size-4" aria-hidden="true" />
            Report content
          </button>
        )}
      </footer>
      <ReportContentModal open={report} onClose={() => setReport(false)} slug={slug} />
    </div>
  );
}
