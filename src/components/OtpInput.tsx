import { useId, useRef } from "react";
import { AlertCircle } from "lucide-react";
import { LIMITS } from "../constants";
import { Spinner, cx, type Force } from "../ui";

/** Six single-digit boxes with paste, arrow and backspace support. */
export function OtpInput({
  label = "Verification code",
  value,
  onChange,
  onComplete,
  error,
  disabled,
  loading,
  force,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  error?: string;
  disabled?: boolean;
  loading?: boolean;
  force?: Force;
}) {
  const id = useId();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const n = LIMITS.otpLength;
  const digits = Array.from({ length: n }, (_, i) => value[i] ?? "");
  const off = disabled || loading;

  const set = (next: string) => {
    const clean = next.replace(/\D/g, "").slice(0, n);
    onChange(clean);
    if (clean.length === n) onComplete?.(clean);
    return clean;
  };

  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-l`} className="t-caption font-medium">
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={`${id}-l`}
        aria-describedby={error ? `${id}-e` : undefined}
        className="flex gap-2"
      >
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={d}
            disabled={off}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            aria-label={`Digit ${i + 1} of ${n}`}
            aria-invalid={error ? true : undefined}
            maxLength={n}
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "");
              if (v.length > 1) {
                const clean = set(v);
                refs.current[Math.min(clean.length, n - 1)]?.focus();
                return;
              }
              const arr = [...digits];
              arr[i] = v;
              set(arr.join(""));
              if (v && i < n - 1) refs.current[i + 1]?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
              if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
              if (e.key === "ArrowRight" && i < n - 1) refs.current[i + 1]?.focus();
            }}
            className={cx(
              "h-13 w-full min-w-0 rounded-sm border bg-linen text-center t-h2 tabular-nums transition-colors outline-none md:h-14",
              error ? "border-crimson" : "border-stroke hover:border-slate",
              "focus:border-slate focus:outline-2 focus:outline-offset-2 focus:outline-slate focus:outline-solid",
              off &&
                "cursor-not-allowed border-wash-strong bg-wash text-muted hover:border-wash-strong",
              force === "hover" && i === 0 && "border-slate",
              force === "focus" &&
                i === digits.findIndex((x) => !x) &&
                "border-slate outline-2 outline-offset-2 outline-slate outline-solid",
            )}
          />
        ))}
      </div>
      {loading && (
        <p className="flex items-center gap-2 t-caption" role="status">
          <Spinner className="size-4" />
          Checking code
        </p>
      )}
      {error && !loading && (
        <p id={`${id}-e`} className="flex items-start gap-2 t-caption">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-crimson" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
