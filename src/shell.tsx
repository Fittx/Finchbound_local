import { type ReactNode } from "react";
import { AlertCircle, ArrowLeft, Check, Info, X } from "lucide-react";
import { Logo } from "./brand";
import { useApp } from "./store";
import { cx } from "./ui";

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("mx-auto w-full max-w-[1440px] px-4 md:px-8 lg:px-20", className)}>
      {children}
    </div>
  );
}

export function TopBar({ children, home = "/dashboard" }: { children?: ReactNode; home?: string }) {
  return (
    <header className="sticky top-0 z-40 bg-linen shadow-[0_1px_0_#ECE7DE]">
      <Container className="flex h-16 items-center justify-between gap-4">
        <a
          href={home}
          className="-ml-1 flex min-h-11 items-center rounded-sm px-1"
          aria-label="Finchbound home"
        >
          <Logo />
        </a>
        <div className="flex items-center gap-2 md:gap-4">{children}</div>
      </Container>
    </header>
  );
}

/** The one "go up a level" link used at the top of every inner screen. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="-ml-3 inline-flex min-h-11 items-center gap-2 self-start rounded-md px-3 t-body font-medium hover:bg-wash"
    >
      <ArrowLeft className="size-5" aria-hidden="true" />
      {children}
    </a>
  );
}

export function Toaster() {
  const { toasts, dismissToast } = useApp();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-8"
    >
      {toasts.map((t) => (
        <ToastView key={t.id} {...t} onClose={() => dismissToast(t.id)} />
      ))}
    </div>
  );
}

export function ToastView({
  message,
  tone,
  action,
  onClose,
  static: isStatic,
}: {
  message: string;
  tone: "success" | "error" | "info";
  action?: { label: string; onClick: () => void };
  onClose?: () => void;
  static?: boolean;
}) {
  const icon =
    tone === "success" ? (
      <Check className="size-5 text-gold" aria-hidden="true" />
    ) : tone === "error" ? (
      <AlertCircle className="size-5 text-crimson" aria-hidden="true" />
    ) : (
      <Info className="size-5 text-white" aria-hidden="true" />
    );
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "pointer-events-auto flex min-h-12 w-full max-w-md items-center gap-3 rounded-md bg-slate py-1 pr-1 pl-4 text-white shadow-e3",
        !isStatic && "anim-rise",
      )}
    >
      {icon}
      <span className="flex-1 t-body">{message}</span>
      {action && (
        <button
          type="button"
          onClick={() => {
            action.onClick();
            onClose?.();
          }}
          className="min-h-11 rounded-sm px-3 t-body font-medium text-white underline decoration-2 underline-offset-4 dark-surface-focus"
        >
          {action.label}
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="flex size-11 items-center justify-center rounded-sm hover:bg-white/10 dark-surface-focus"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
