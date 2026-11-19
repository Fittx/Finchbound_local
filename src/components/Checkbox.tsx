import { useId, type ReactNode } from "react";
import { AlertCircle, Check } from "lucide-react";
import { Spinner, cx, type Force } from "../ui";

export function Checkbox({
  label,
  description,
  checked,
  onChange,
  error,
  disabled,
  loading,
  force,
}: {
  label: ReactNode;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: string;
  disabled?: boolean;
  loading?: boolean;
  force?: Force;
}) {
  const id = useId();
  const off = disabled || loading;
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className={cx(
          "group -mx-2 flex min-h-11 items-start gap-3 rounded-sm px-2 py-2",
          off ? "cursor-not-allowed text-muted" : "cursor-pointer hover:bg-wash",
          force === "hover" && "bg-wash",
        )}
      >
        <span className="relative mt-0.5 flex size-5 shrink-0 items-center justify-center">
          {loading ? (
            <Spinner className="size-5 text-muted" />
          ) : (
            <>
              <input
                id={id}
                type="checkbox"
                checked={checked}
                disabled={off}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-e` : undefined}
                onChange={(e) => onChange(e.target.checked)}
                className={cx(
                  "peer size-5 cursor-pointer appearance-none rounded-xs border-2 bg-linen transition-colors checked:border-crimson checked:bg-crimson disabled:cursor-not-allowed disabled:border-wash-strong disabled:bg-wash",
                  error ? "border-crimson" : "border-stroke group-hover:border-slate",
                  force === "focus" && "outline-2 outline-offset-2 outline-slate outline-solid",
                )}
              />
              <Check
                className="pointer-events-none absolute size-3.5 text-white opacity-0 peer-checked:opacity-100"
                strokeWidth={3.5}
                aria-hidden="true"
              />
            </>
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="t-body">{label}</span>
          {description && <span className="t-caption text-muted">{description}</span>}
        </span>
      </label>
      {error && (
        <p id={`${id}-e`} className="flex items-start gap-2 t-caption">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-crimson" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
