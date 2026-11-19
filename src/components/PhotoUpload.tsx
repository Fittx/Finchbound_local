import { useId, useRef, useState } from "react";
import { AlertCircle, ImagePlus } from "lucide-react";
import { ACCEPTED_IMAGE_LABEL, ACCEPTED_IMAGE_TYPES, LIMITS } from "../constants";
import { Button, Spinner, cx, type Force } from "../ui";

export const PHOTO_ERRORS = {
  "too-large": `That file is over ${LIMITS.uploadMb} MB. Choose a smaller photo.`,
  "wrong-type": `That file type isn't supported. Use ${ACCEPTED_IMAGE_LABEL}.`,
};

/** Drop or browse for one photo, with preview, replace and remove. */
export function PhotoUpload({
  label = "Photo",
  value,
  onChange,
  onReject,
  error,
  disabled,
  loading,
  force,
}: {
  label?: string;
  value?: string;
  onChange: (url: string | undefined, file?: File) => void;
  onReject?: (message: string) => void;
  error?: string;
  disabled?: boolean;
  loading?: boolean;
  force?: Force;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const working = loading;
  const take = (f?: File) => {
    if (!f) return;
    const typeOk = ACCEPTED_IMAGE_TYPES.includes(f.type) || /\.(heic|heif)$/i.test(f.name);
    if (!typeOk) return onReject?.(PHOTO_ERRORS["wrong-type"]);
    if (f.size > LIMITS.uploadBytes) return onReject?.(PHOTO_ERRORS["too-large"]);
    if (!disabled) onChange(URL.createObjectURL(f), f);
  };

  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-l`} className="t-caption font-medium">
        {label}
      </span>
      {value && !working ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <img
            src={value}
            alt="Selected photo"
            className="aspect-[4/3] w-full rounded-md object-cover sm:w-56"
          />
          <div className="flex gap-2">
            <Button variant="secondary" disabled={disabled} onClick={() => input.current?.click()}>
              Replace
            </Button>
            <Button variant="ghost" disabled={disabled} onClick={() => onChange(undefined)}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || working}
          aria-labelledby={`${id}-l ${id}-cta`}
          aria-describedby={`${id}-h${error ? ` ${id}-e` : ""}`}
          aria-invalid={error ? true : undefined}
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            take(e.dataTransfer.files[0]);
          }}
          className={cx(
            "flex min-h-36 flex-col items-center justify-center gap-2 rounded-md bg-wash px-4 py-6 text-center transition-colors hover:bg-wash-strong disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-wash",
            (over || force === "hover") && "bg-wash-strong",
            over && "ring-2 ring-crimson",
            error && "ring-2 ring-crimson",
            force === "focus" && "outline-2 outline-offset-2 outline-slate outline-solid",
          )}
        >
          {working ? (
            <Spinner className="size-7" />
          ) : (
            <ImagePlus className="size-7" aria-hidden="true" />
          )}
          <span id={`${id}-cta`} className="t-body font-medium">
            {working ? "Preparing photo" : "Add a photo"}
          </span>
          <span id={`${id}-h`} className="t-caption text-muted">
            Drop it here or browse. {ACCEPTED_IMAGE_LABEL}, up to {LIMITS.uploadMb} MB.
          </span>
        </button>
      )}
      {error && (
        <p id={`${id}-e`} className="flex items-start gap-2 t-caption">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-crimson" aria-hidden="true" />
          {error}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept={[...ACCEPTED_IMAGE_TYPES, ".heic", ".heif"].join(",")}
        className="hidden"
        onChange={(e) => {
          take(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
