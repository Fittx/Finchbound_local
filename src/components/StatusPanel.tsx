import type { ReactNode } from "react";
import { AlertCircle, Clock, Lock, WifiOff } from "lucide-react";
import { EmptyNest, FeatherMark } from "../brand";
import { cx } from "../ui";

type Icon = "feather" | "alert" | "clock" | "lock" | "offline" | "nest";

/** Full-message card for not found, closed, expired and similar states. */
export function StatusPanel({
  icon = "alert",
  title,
  body,
  actions,
  className,
}: {
  icon?: Icon;
  title: string;
  body: string;
  actions?: ReactNode;
  className?: string;
}) {
  const art =
    icon === "nest" ? (
      <EmptyNest className="w-36" />
    ) : (
      <span className="flex size-14 items-center justify-center rounded-full bg-wash">
        {icon === "feather" && <FeatherMark className="size-7" color="#E63946" />}
        {icon === "alert" && <AlertCircle className="size-7 text-crimson" aria-hidden="true" />}
        {icon === "clock" && <Clock className="size-7 text-slate" aria-hidden="true" />}
        {icon === "lock" && <Lock className="size-7 text-slate" aria-hidden="true" />}
        {icon === "offline" && <WifiOff className="size-7 text-slate" aria-hidden="true" />}
      </span>
    );
  return (
    <div
      className={cx(
        "flex flex-col items-center gap-5 rounded-lg bg-linen px-6 py-10 text-center shadow-e1 md:px-10",
        className,
      )}
    >
      {art}
      <div className="flex max-w-sm flex-col gap-2">
        <h1 className="t-h1">{title}</h1>
        <p className="t-body">{body}</p>
      </div>
      {actions && (
        <div className="flex w-full flex-col items-center gap-2 sm:w-auto">{actions}</div>
      )}
    </div>
  );
}
