import { passwordStrength } from "../lib/validation";
import { cx } from "../ui";

const BAR = ["", "bg-crimson", "bg-gold", "bg-pine"];

/** Three-step meter. Color is reinforced by a plain text label. */
export function PasswordStrength({ value }: { value: string }) {
  const s = passwordStrength(value);
  if (!value) return null;
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <div className="grid flex-1 grid-cols-3 gap-1" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={cx("h-1.5 rounded-full", i <= s.score ? BAR[s.score] : "bg-wash-strong")}
          />
        ))}
      </div>
      <span className="shrink-0 t-caption font-medium">{s.label}</span>
    </div>
  );
}
