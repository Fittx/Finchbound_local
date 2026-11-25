import { useEffect, useRef, useState } from "react";
import { CROP_RATIOS } from "../constants";
import { Button, Modal, Spinner } from "../ui";
import { FormAlert } from "./FormAlert";
import { ApiError } from "../api/client";
export type CroppedPhotos = { polaroid: File; card: File };
export function cropRect(
  width: number,
  height: number,
  ratio: number,
  x: number,
  y: number,
  zoom: number,
) {
  const w = Math.min(width, height * ratio) / zoom;
  const h = w / ratio;
  return { sx: ((width - w) * x) / 100, sy: ((height - h) * y) / 100, sw: w, sh: h };
}
export function CropModal({
  src,
  onCancel,
  onApply,
  variant = "",
}: {
  src: string;
  onCancel: () => void;
  onApply: (photos: CroppedPhotos) => Promise<void>;
  variant?: string;
}) {
  const [size, setSize] = useState<{ width: number; height: number }>();
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(variant === "crop-saving");
  const [error, setError] = useState(
    variant === "crop-error" ? "We couldn't prepare your photo. Try Apply again." : "",
  );
  const img = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  useEffect(() => {
    let alive = true;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (alive) {
        img.current = image;
        setSize({ width: image.naturalWidth, height: image.naturalHeight });
      }
    };
    image.onerror = () => {
      if (alive) setError("This browser couldn't open the photo. Try a JPG, PNG or WebP image.");
    };
    image.src = src;
    return () => {
      alive = false;
    };
  }, [src]);
  const preview = (ratio: number) => {
    if (!size)
      return (
        <div className="flex aspect-square items-center justify-center bg-wash">
          <Spinner />
        </div>
      );
    const r = cropRect(size.width, size.height, ratio, x, y, zoom);
    const scale = 400 / r.sw;
    return (
      <svg viewBox={`0 0 400 ${400 / ratio}`} className="block w-full bg-wash" aria-hidden="true">
        <image
          href={src}
          x={-r.sx * scale}
          y={-r.sy * scale}
          width={size.width * scale}
          height={size.height * scale}
        />
      </svg>
    );
  };
  const apply = async () => {
    if (!size || !img.current || busy) return;
    setBusy(true);
    setError("");
    try {
      const output = async (ratio: number, width: number, name: string) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = Math.round(width / ratio);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas unavailable");
        const r = cropRect(size.width, size.height, ratio, x, y, zoom);
        context.drawImage(img.current!, r.sx, r.sy, r.sw, r.sh, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("Crop failed"))),
            "image/jpeg",
            0.9,
          ),
        );
        return new File([blob], name, { type: "image/jpeg" });
      };
      const polaroid = await output(CROP_RATIOS.polaroid, 800, "polaroid.jpg");
      const card = await output(CROP_RATIOS.card, 1200, "page-card.jpg");
      await onApply({ polaroid, card });
    } catch (e) {
      // Server errors (too large, busy, storage unavailable) explain what to do next.
      const reason =
        e instanceof ApiError && e.code === "OFFLINE"
          ? "You're offline."
          : e instanceof ApiError && e.message && e.message !== e.code
            ? e.message
            : "We couldn't prepare or upload your photo.";
      setError(`${reason} Your crop is still here. Try Apply again.`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onCancel}
      dismissible={!busy}
      size="lg"
      title="Crop photo"
      description="Choose what stays in the frame before uploading."
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={!size} loading={busy}>
            {busy ? "Applying crop" : "Apply"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {error && <FormAlert>{error}</FormAlert>}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h3 className="t-body font-medium">Polaroid · Square</h3>
            <div
              role="region"
              aria-label="Reposition photo"
              aria-describedby="crop-help"
              tabIndex={0}
              className="touch-none overflow-hidden rounded-sm cursor-move"
              onKeyDown={(e) => {
                if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
                  e.preventDefault();
                  if (e.key === "ArrowLeft") setX((v) => clamp(v - 2));
                  if (e.key === "ArrowRight") setX((v) => clamp(v + 2));
                  if (e.key === "ArrowUp") setY((v) => clamp(v - 2));
                  if (e.key === "ArrowDown") setY((v) => clamp(v + 2));
                }
              }}
              onPointerDown={(e) => {
                if (busy) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { x: e.clientX, y: e.clientY, startX: x, startY: y };
              }}
              onPointerMove={(e) => {
                if (!drag.current || !size || busy) return;
                const r = cropRect(size.width, size.height, CROP_RATIOS.polaroid, x, y, zoom);
                const scale = e.currentTarget.clientWidth / r.sw;
                setX(
                  clamp(
                    drag.current.startX -
                      ((e.clientX - drag.current.x) / Math.max(1, (size.width - r.sw) * scale)) *
                        100,
                  ),
                );
                setY(
                  clamp(
                    drag.current.startY -
                      ((e.clientY - drag.current.y) / Math.max(1, (size.height - r.sh) * scale)) *
                        100,
                  ),
                );
              }}
              onPointerUp={() => {
                drag.current = null;
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
            >
              {preview(CROP_RATIOS.polaroid)}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="t-body font-medium">Page card · 4:3</h3>
            <div className="overflow-hidden rounded-sm">{preview(CROP_RATIOS.card)}</div>
            <p id="crop-help" className="t-caption text-muted">
              Drag the square preview to reposition. Keyboard: focus it and use arrow keys, or
              adjust the sliders below. Both previews use the same focal point.
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { label: "Horizontal position", value: x, set: setX, min: 0, max: 100, step: 1 },
            { label: "Vertical position", value: y, set: setY, min: 0, max: 100, step: 1 },
            { label: "Zoom", value: zoom, set: setZoom, min: 1, max: 3, step: 0.05 },
          ].map((control) => (
            <label key={control.label} className="flex flex-col gap-2 t-caption font-medium">
              {control.label} ·{" "}
              {control.label === "Zoom"
                ? `${control.value.toFixed(2)}×`
                : `${Math.round(control.value)}%`}
              <input
                className="min-h-11 w-full accent-slate"
                type="range"
                min={control.min}
                max={control.max}
                step={control.step}
                value={control.value}
                disabled={busy || !size}
                onChange={(e) => control.set(Number(e.target.value))}
              />
            </label>
          ))}
        </div>
        <Button
          variant="ghost"
          className="self-start"
          disabled={busy}
          onClick={() => {
            setX(50);
            setY(50);
            setZoom(1);
          }}
        >
          Reset crop
        </Button>
      </div>
    </Modal>
  );
}
