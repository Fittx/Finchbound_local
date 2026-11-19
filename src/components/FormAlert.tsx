import type { ReactNode, Ref } from "react";
import { AlertCircle, CheckCircle2, Info, WifiOff } from "lucide-react";
import { cx } from "../ui";

type Tone = "error" | "success" | "info" | "offline";

/** Inline message block. One container level, fill only, plain slate text. */
export function FormAlert({
  tone = "error",
  title,
  children,
  action,
  className,
  ref,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}) {
  const icon = {
    error: <AlertCircle className="size-5 text-crimson" aria-hidden="true" />,
    success: <CheckCircle2 className="size-5 text-pine" aria-hidden="true" />,
    info: <Info className="size-5 text-slate" aria-hidden="true" />,
    offline: <WifiOff className="size-5 text-slate" aria-hidden="true" />,
  }[tone];
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role={tone === "error" || tone === "offline" ? "alert" : "status"}
      className={cx("flex items-start gap-3 rounded-md bg-wash p-4 outline-none", className)}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title && <p className="t-body font-bold">{title}</p>}
        {children && <div className="t-body">{children}</div>}
        {action && <div className="-ml-1 pt-1">{action}</div>}
      </div>
    </div>
  );
}
