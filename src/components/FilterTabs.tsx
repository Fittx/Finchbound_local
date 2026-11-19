import { useRef } from "react";
import { Skeleton, cx, type Force } from "../ui";

export type Tab<T extends string> = { key: T; label: string; count?: number };

/** Text tabs with a plain count and a crimson underline on the active tab. Scrolls sideways on mobile. */
export function FilterTabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
  loading,
  error,
  disabled,
  force,
}: {
  label: string;
  tabs: Tab<T>[];
  value: T;
  onChange: (v: T) => void;
  loading?: boolean;
  error?: boolean;
  disabled?: boolean;
  force?: { key: T; state: Force };
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (i: number) => {
    const n = (i + tabs.length) % tabs.length;
    refs.current[n]?.focus();
    onChange(tabs[n]!.key);
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0"
    >
      {tabs.map((t, i) => {
        const active = value === t.key;
        const f = force?.key === t.key ? force.state : undefined;
        return (
          <button
            key={t.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            disabled={disabled || loading}
            onClick={() => onChange(t.key)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") (e.preventDefault(), move(i + 1));
              if (e.key === "ArrowLeft") (e.preventDefault(), move(i - 1));
            }}
            className={cx(
              "relative flex min-h-11 shrink-0 items-center gap-2 rounded-sm px-3 t-body whitespace-nowrap transition-colors hover:bg-wash disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent",
              active && "font-bold",
              f === "hover" && "bg-wash",
              f === "focus" && "outline-2 outline-offset-2 outline-slate outline-solid",
            )}
          >
            {t.label}
            <span className={cx("t-caption tabular-nums", !active && "text-muted")}>
              {loading ? <Skeleton className="h-4 w-5" /> : error ? "–" : t.count}
            </span>
            {active && (
              <span
                className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-crimson"
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
