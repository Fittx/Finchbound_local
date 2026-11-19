import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cx, type Force } from "../ui";

/** Underlined link (underline drops on hover). Standalone links keep a 44px target. */
export function TextLink({
  inline,
  force,
  disabled,
  className,
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  inline?: boolean;
  force?: Force;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <a
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      className={cx(
        "rounded-xs font-medium text-slate decoration-2 underline-offset-4",
        "underline hover:no-underline",
        "inline-flex min-h-11 items-center",
        inline && "align-middle",
        force === "hover" && "no-underline",
        force === "focus" && "outline-2 outline-offset-2 outline-slate outline-solid",
        disabled && "pointer-events-none text-muted no-underline",
        className,
      )}
      {...rest}
    >
      {children}
    </a>
  );
}
