import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Copy,
  LoaderCircle,
  MoreHorizontal,
  X,
} from "lucide-react";
import { useApp } from "./store";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Design-system preview only: renders a static interaction state. */
export type Force = "hover" | "focus" | "active" | undefined;

/* ---------- Button ---------- */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** destructive: outlined crimson, distinct from the solid primary used for create and publish. */
  variant?: "primary" | "secondary" | "ghost" | "link" | "inverse" | "destructive";
  size?: "md" | "lg" | "icon";
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  full?: boolean;
  force?: Force;
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  icon,
  iconRight,
  full,
  force,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const v = {
    primary: cx(
      "bg-crimson-strong text-white hover:bg-[#A8222D] disabled:bg-wash-strong disabled:text-muted",
      force === "hover" && "bg-[#A8222D]",
    ),
    secondary: cx(
      "bg-wash text-slate hover:bg-wash-strong disabled:text-muted",
      force === "hover" && "bg-wash-strong",
    ),
    ghost: cx("text-slate hover:bg-wash disabled:text-muted", force === "hover" && "bg-wash"),
    link: cx(
      "text-slate underline-offset-4 decoration-2 hover:underline disabled:text-muted",
      force === "hover" && "underline",
    ),
    inverse: cx("bg-white text-slate hover:bg-wash", force === "hover" && "bg-wash"),
    destructive: cx(
      "bg-linen text-crimson-strong shadow-[inset_0_0_0_2px_#C92A37] hover:bg-crimson-wash disabled:text-muted disabled:shadow-[inset_0_0_0_2px_#EBE5DA] disabled:hover:bg-linen",
      force === "hover" && "bg-crimson-wash",
    ),
  }[variant];
  const s = {
    md: variant === "link" ? "min-h-11 px-1" : "min-h-11 px-5",
    lg: "min-h-13 px-6",
    icon: "size-11",
  }[size];
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "relative inline-flex shrink-0 items-center justify-center gap-2 rounded-md t-body font-medium whitespace-nowrap transition-colors duration-150 select-none disabled:cursor-not-allowed",
        v,
        s,
        full && "w-full",
        force === "focus" && "outline-2 outline-offset-2 outline-slate outline-solid",
        loading && variant === "primary" && "disabled:bg-crimson-strong disabled:text-white",
        loading &&
          variant === "destructive" &&
          "disabled:bg-crimson-wash disabled:text-crimson-strong disabled:shadow-[inset_0_0_0_2px_#C92A37]",
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner className="size-5" /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
}

export function Spinner({ className = "size-5" }: { className?: string }) {
  return <LoaderCircle className={cx("anim-spin", className)} aria-hidden="true" />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("anim-pulse rounded-sm bg-wash", className)} aria-hidden="true" />;
}

/* ---------- Field shell ---------- */
type FieldShellProps = {
  id: string;
  label: string;
  helper?: ReactNode;
  error?: string;
  counter?: string;
  hideLabel?: boolean;
  children: ReactNode;
};
function FieldShell({ id, label, helper, error, counter, hideLabel, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className={cx("flex items-end justify-between gap-4", hideLabel && "sr-only")}>
        <label htmlFor={id} className="t-caption font-medium">
          {label}
        </label>
        {counter && (
          <span className="t-caption text-muted tabular-nums" aria-live="polite">
            {counter}
          </span>
        )}
      </div>
      {children}
      {error ? (
        <p id={`${id}-msg`} className="flex items-start gap-2 t-caption">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-crimson" aria-hidden="true" />
          {error}
        </p>
      ) : helper ? (
        <div id={`${id}-msg`} className="t-caption text-muted">
          {helper}
        </div>
      ) : null}
    </div>
  );
}

const boxClass = (error?: string, disabled?: boolean, force?: Force) =>
  cx(
    "flex w-full items-center rounded-sm border bg-linen transition-colors",
    error ? "border-crimson" : "border-stroke hover:border-slate",
    "focus-within:border-slate focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-slate focus-within:outline-solid",
    disabled && "border-wash-strong bg-wash text-muted hover:border-wash-strong",
    force === "hover" && !error && "border-slate",
    force === "focus" && "border-slate outline-2 outline-offset-2 outline-slate outline-solid",
  );

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> & {
  label: string;
  helper?: ReactNode;
  error?: string;
  max?: number;
  prefix?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  loading?: boolean;
  hideLabel?: boolean;
  force?: Force;
};

export function Input({
  label,
  helper,
  error,
  max,
  prefix,
  leading,
  trailing,
  loading,
  hideLabel,
  force,
  className,
  id: idProp,
  disabled,
  ...rest
}: InputProps) {
  const auto = useId();
  const id = idProp ?? auto;
  const len = typeof rest.value === "string" ? rest.value.length : 0;
  return (
    <FieldShell
      id={id}
      label={label}
      helper={helper}
      error={error}
      hideLabel={hideLabel}
      counter={max ? `${len}/${max}` : undefined}
    >
      <div className={cx(boxClass(error, disabled, force), "min-h-11", className)}>
        {leading && <span className="pl-3 text-muted">{leading}</span>}
        {prefix && <span className="shrink-0 pl-3 t-body text-muted select-none">{prefix}</span>}
        <input
          id={id}
          disabled={disabled}
          maxLength={max}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || helper ? `${id}-msg` : undefined}
          className={cx(
            "h-11 min-w-0 flex-1 bg-transparent t-body outline-none placeholder:text-muted disabled:cursor-not-allowed",
            prefix ? "pr-3 pl-1" : leading ? "px-2" : "px-3",
          )}
          {...rest}
        />
        {loading && <Spinner className="mr-3 size-4 text-muted" />}
        {!loading && trailing && <span className="pr-3">{trailing}</span>}
      </div>
    </FieldShell>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  helper?: ReactNode;
  error?: string;
  max?: number;
  force?: Force;
};
export function Textarea({
  label,
  helper,
  error,
  max,
  force,
  id: idProp,
  rows = 4,
  disabled,
  ...rest
}: TextareaProps) {
  const auto = useId();
  const id = idProp ?? auto;
  const len = typeof rest.value === "string" ? rest.value.length : 0;
  return (
    <FieldShell
      id={id}
      label={label}
      helper={helper}
      error={error}
      counter={max ? `${len}/${max}` : undefined}
    >
      <div className={boxClass(error, disabled, force)}>
        <textarea
          id={id}
          rows={rows}
          maxLength={max}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || helper ? `${id}-msg` : undefined}
          className="min-h-11 w-full resize-y bg-transparent px-3 py-2 t-body outline-none placeholder:text-muted"
          {...rest}
        />
      </div>
    </FieldShell>
  );
}

/* ---------- Radio ---------- */
export type RadioOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
};
export function RadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  force,
}: {
  label: string;
  options: RadioOption<T>[];
  value: T;
  onChange: (v: T) => void;
  force?: { value: T; state: Force };
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-2 t-caption font-medium">{label}</legend>
      {options.map((o) => (
        <label
          key={o.value}
          className={cx(
            "flex min-h-11 cursor-pointer items-start gap-3 rounded-sm px-3 py-2 transition-colors hover:bg-wash",
            o.disabled && "cursor-not-allowed text-muted hover:bg-transparent",
            force?.value === o.value && force.state === "hover" && "bg-wash",
          )}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            disabled={o.disabled}
            onChange={() => onChange(o.value)}
            className={cx(
              "mt-0.5 size-5 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-stroke bg-linen transition-[border] checked:border-[6px] checked:border-crimson disabled:border-wash-strong disabled:bg-wash",
              force?.value === o.value &&
                force.state === "focus" &&
                "outline-2 outline-offset-2 outline-slate outline-solid",
            )}
          />
          <span className="flex flex-col">
            <span className="t-body font-medium">{o.label}</span>
            {o.description && <span className="t-caption text-muted">{o.description}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/* ---------- Toggle ---------- */
export function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
  force,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  force?: Force;
}) {
  const id = useId();
  return (
    <div
      className={cx("flex min-h-11 items-center justify-between gap-4", disabled && "text-muted")}
    >
      <label
        htmlFor={id}
        className={cx("flex flex-col", disabled ? "cursor-not-allowed" : "cursor-pointer")}
      >
        <span className="t-body font-medium">{label}</span>
        {description && <span className="t-caption text-muted">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative flex h-11 w-14 shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed",
          force === "focus" && "outline-2 outline-offset-2 outline-slate outline-solid",
        )}
      >
        <span
          className={cx(
            "relative h-7 w-12 rounded-full transition-colors",
            disabled ? "bg-wash-strong" : checked ? "bg-crimson" : "bg-stroke",
            force === "hover" && !disabled && (checked ? "bg-crimson-strong" : "bg-muted"),
          )}
        >
          <span
            className={cx(
              "absolute top-1 left-1 size-5 rounded-full bg-white shadow-e1 transition-transform",
              checked && "translate-x-5",
            )}
          />
        </span>
      </button>
    </div>
  );
}

/* ---------- Color picker ---------- */
const HEX = /^#?([0-9a-f]{6})$/i;
export function ColorField({
  label,
  value,
  onChange,
  force,
  forceError,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  force?: Force;
  forceError?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string>();
  useEffect(() => {
    setDraft(value);
    setError(undefined);
  }, [value]);
  const commit = (raw: string) => {
    const m = raw.trim().match(HEX);
    if (!m) return setError("Use a 6-digit hex, like #E63946");
    setError(undefined);
    onChange(`#${m[1]!.toUpperCase()}`);
  };
  const err = forceError ?? error;
  return (
    <FieldShell id={id} label={label} error={err}>
      <div className="flex items-center gap-2">
        <span
          className="relative size-11 shrink-0 overflow-hidden rounded-sm shadow-[inset_0_0_0_1px_rgb(43_45_66/0.16)] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-slate focus-within:outline-solid"
          style={{ background: value }}
        >
          <input
            type="color"
            value={value}
            aria-label={`${label} swatch`}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </span>
        <div className={cx(boxClass(err, false, force), "min-h-11")}>
          <input
            id={id}
            value={draft}
            spellCheck={false}
            aria-invalid={err ? true : undefined}
            onChange={(e) => {
              setDraft(e.target.value);
              if (HEX.test(e.target.value.trim())) commit(e.target.value);
            }}
            onBlur={() => commit(draft)}
            onKeyDown={(e) => e.key === "Enter" && commit(draft)}
            className="h-11 w-full min-w-0 bg-transparent px-3 t-body uppercase tabular-nums outline-none"
          />
        </div>
      </div>
    </FieldShell>
  );
}

/* ---------- Select (listbox) ---------- */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; preview?: ReactNode }[];
  onChange: (v: T) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0]!;
  useOutside(ref, () => setOpen(false), open);
  const choose = (i: number) => {
    onChange(options[i]!.value);
    setOpen(false);
  };
  return (
    <div className="flex flex-col gap-2" ref={ref}>
      <span id={`${id}-l`} className="t-caption font-medium">
        {label}
      </span>
      <div className="relative">
        <button
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-controls={open ? `${id}-list` : undefined}
          aria-activedescendant={open ? `${id}-o${active}` : undefined}
          aria-expanded={open}
          aria-labelledby={`${id}-l ${id}-b`}
          id={`${id}-b`}
          onClick={() => {
            setActive(options.indexOf(current));
            setOpen((o) => !o);
          }}
          onKeyDown={(e) => {
            if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
              e.preventDefault();
              setActive(options.indexOf(current));
              setOpen(true);
              return;
            }
            if (!open) return;
            if (e.key === "ArrowDown")
              (e.preventDefault(), setActive((a) => Math.min(options.length - 1, a + 1)));
            if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(0, a - 1)));
            if (e.key === "Enter" || e.key === " ") (e.preventDefault(), choose(active));
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            }
            if (e.key === "Home") (e.preventDefault(), setActive(0));
            if (e.key === "End") (e.preventDefault(), setActive(options.length - 1));
            if (e.key === "Tab") setOpen(false);
          }}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-sm border border-stroke bg-linen px-3 text-left t-body hover:border-slate"
        >
          <span className="flex min-w-0 items-center gap-3">
            {current.preview}
            <span className="truncate">{current.label}</span>
          </span>
          <ChevronDown
            className={cx("size-5 shrink-0 transition-transform", open && "rotate-180")}
            aria-hidden="true"
          />
        </button>
        {open && (
          <ul
            id={`${id}-list`}
            role="listbox"
            aria-labelledby={`${id}-l`}
            className="anim-fade absolute inset-x-0 top-full z-30 mt-2 rounded-md bg-linen p-1 shadow-e3"
          >
            {options.map((o, i) => (
              <li
                key={o.value}
                id={`${id}-o${i}`}
                role="option"
                aria-selected={o.value === value}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={cx(
                  "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-sm px-3 t-body",
                  i === active && "bg-wash",
                )}
              >
                <span className="flex items-center gap-3">
                  {o.preview}
                  {o.label}
                </span>
                {o.value === value && <Check className="size-4" aria-hidden="true" />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function useOutside(
  ref: React.RefObject<HTMLElement | null>,
  fn: () => void,
  active: boolean,
) {
  useEffect(() => {
    if (!active) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) fn();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && fn();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, fn, active]);
}

/* ---------- Overflow menu ---------- */
export type MenuItem = {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
};
export function OverflowMenu({
  label,
  items,
  className,
}: {
  label: string;
  items: MenuItem[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useOutside(ref, close, open);
  useEffect(() => {
    if (open) ref.current?.querySelector<HTMLElement>("[role=menuitem]:not([disabled])")?.focus();
  }, [open]);
  return (
    <div ref={ref} className={cx("relative", className)}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
      </Button>
      {open && (
        <div
          role="menu"
          className="anim-fade absolute top-full right-0 z-30 mt-1 min-w-48 rounded-md bg-linen p-1 shadow-e3"
          onKeyDown={(e) => {
            const els = [
              ...(ref.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([disabled])") ??
                []),
            ];
            const i = els.indexOf(document.activeElement as HTMLElement);
            if (e.key === "ArrowDown") (e.preventDefault(), els[(i + 1) % els.length]?.focus());
            if (e.key === "ArrowUp")
              (e.preventDefault(), els[(i - 1 + els.length) % els.length]?.focus());
          }}
        >
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              type="button"
              disabled={it.disabled}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                it.onSelect();
              }}
              className="flex min-h-11 w-full items-center gap-3 rounded-sm px-3 text-left t-body hover:bg-wash focus-visible:bg-wash disabled:text-muted disabled:hover:bg-transparent"
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Modal ---------- */
const modalStack: HTMLDivElement[] = [];
const modalRestore = new WeakMap<HTMLDivElement, HTMLElement | null>();
let bodyOverflow = "";
function refreshModals() {
  modalStack.forEach((panel, index) => {
    const layer = panel.parentElement!;
    const covered = index !== modalStack.length - 1;
    layer.inert = covered;
    layer.setAttribute("aria-hidden", String(covered));
    layer.style.zIndex = String(50 + index);
  });
}
export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
  footer,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  children?: ReactNode;
  footer?: ReactNode;
  dismissible?: boolean;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const latest = useRef({ onClose, dismissible });
  latest.current = { onClose, dismissible };
  useEffect(() => {
    const element = panel.current;
    if (!open || !element) return;
    const prev = document.activeElement as HTMLElement | null;
    modalRestore.set(element, prev);
    if (!modalStack.length) {
      bodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    modalStack.push(element);
    refreshModals();
    const isTop = () => modalStack.at(-1) === element;
    const focusFirst = () => {
      const first =
        element.querySelector<HTMLElement>("[data-autofocus]:not([disabled])") ??
        element.querySelector<HTMLElement>(
          "input:not([type=hidden]):not([disabled]), textarea:not([disabled])",
        );
      (first ?? element).focus();
    };
    const t = window.setTimeout(() => {
      if (isTop()) focusFirst();
    }, 20);
    const onKey = (e: KeyboardEvent) => {
      if (!isTop() || e.defaultPrevented) return;
      if (e.key === "Escape" && latest.current.dismissible) {
        e.preventDefault();
        latest.current.onClose();
      }
      if (e.key === "Tab" && panel.current) {
        const els = [
          ...panel.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), textarea, select, a[href], [tabindex]:not([tabindex="-1"])',
          ),
        ];
        if (!els.length) {
          e.preventDefault();
          element.focus();
          return;
        }
        const first = els[0]!;
        const last = els[els.length - 1]!;
        if (e.shiftKey && (document.activeElement === first || document.activeElement === element))
          (e.preventDefault(), last.focus());
        else if (
          !e.shiftKey &&
          (document.activeElement === last || document.activeElement === element)
        )
          (e.preventDefault(), first.focus());
      }
    };
    const onFocus = (e: FocusEvent) => {
      if (isTop() && !element.contains(e.target as Node)) focusFirst();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
      const wasTop = isTop();
      const index = modalStack.indexOf(element);
      const above = modalStack[index + 1];
      if (above && element.contains(modalRestore.get(above) ?? null))
        modalRestore.set(above, modalRestore.get(element) ?? null);
      modalStack.splice(index, 1);
      refreshModals();
      if (!modalStack.length) document.body.style.overflow = bodyOverflow;
      if (wasTop) {
        const top = modalStack.at(-1);
        const restore = modalRestore.get(element);
        if (restore?.isConnected && (!top || top.contains(restore))) restore.focus();
        else top?.focus();
      }
    };
  }, [open]);
  if (!open) return null;
  const w = { sm: "md:max-w-[480px]", md: "md:max-w-[640px]", lg: "md:max-w-[1000px]" }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-8">
      <div
        className="anim-fade absolute inset-0 bg-slate/50"
        onClick={dismissible ? onClose : undefined}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        aria-describedby={description ? `${id}-d` : undefined}
        tabIndex={-1}
        className={cx(
          "anim-sheet relative flex max-h-[94dvh] w-full flex-col rounded-t-xl bg-linen shadow-e3 outline-none md:anim-rise md:rounded-lg",
          w,
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-2">
          <div className="flex flex-col gap-1">
            <h2 id={`${id}-t`} className="t-h2">
              {title}
            </h2>
            {description && (
              <p id={`${id}-d`} className="t-body text-muted">
                {description}
              </p>
            )}
          </div>
          {dismissible && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close"
              onClick={onClose}
              className="-mt-2 -mr-3"
            >
              <X className="size-5" aria-hidden="true" />
            </Button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-3 px-6 pt-2 pb-6 md:flex-row md:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Status ---------- */
export function Dot({ color }: { color: string }) {
  return (
    <span
      className="inline-block size-2 shrink-0 rounded-full"
      style={{ background: color }}
      aria-hidden="true"
    />
  );
}
export function Status({ live }: { live: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Dot color={live ? "#2F7D57" : "#8A8C9C"} />
      {live ? "Live" : "Draft"}
    </span>
  );
}

/* ---------- Copy ---------- */
export function CopyButton({
  text,
  label = "Copy link",
  compact,
}: {
  text: string;
  label?: string;
  compact?: boolean;
}) {
  const { toast } = useApp();
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard may be blocked in embedded previews; still confirm */
    }
    setDone(true);
    toast("Link copied");
    window.setTimeout(() => setDone(false), 2000);
  };
  const icon = done ? (
    <Check className="size-5" aria-hidden="true" />
  ) : (
    <Copy className="size-5" aria-hidden="true" />
  );
  if (compact)
    return (
      <Button variant="ghost" size="icon" aria-label={done ? "Copied" : label} onClick={copy}>
        {icon}
      </Button>
    );
  return (
    <Button variant="secondary" icon={icon} onClick={copy}>
      {done ? "Copied" : label}
    </Button>
  );
}

/* ---------- Page states ---------- */
export function ErrorState({
  title,
  body,
  onRetry,
  action = "Try again",
}: {
  title: string;
  body: string;
  onRetry?: () => void;
  action?: string;
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-wash">
        <AlertCircle className="size-7 text-crimson" aria-hidden="true" />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <h2 className="t-h2">{title}</h2>
        <p className="t-body text-muted">{body}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          {action}
        </Button>
      )}
    </div>
  );
}
