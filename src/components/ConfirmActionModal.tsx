import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Ban, EyeOff, Trash2 } from "lucide-react";
import { Button, Modal } from "../ui";
import { FormAlert } from "./FormAlert";

type Kind = "delete" | "hide" | "block";

/**
 * Confirmation for destructive or hiding actions. Warning icon, one consequence line,
 * Cancel focused by default, and the outlined destructive button.
 */
export function ConfirmActionModal({
  open,
  onClose,
  onConfirm,
  title,
  consequence,
  confirmLabel,
  busyLabel,
  kind = "delete",
  forceBusy,
  forceError,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<unknown> | unknown;
  title: string;
  consequence: ReactNode;
  confirmLabel: string;
  busyLabel: string;
  kind?: Kind;
  forceBusy?: boolean;
  forceError?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (open) {
      setBusy(false);
      setFailed(false);
    }
  }, [open]);
  const loading = busy || forceBusy;
  const run = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await onConfirm();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  const icon =
    kind === "block" ? (
      <Ban className="size-5" aria-hidden="true" />
    ) : kind === "hide" ? (
      <EyeOff className="size-5" aria-hidden="true" />
    ) : (
      <Trash2 className="size-5" aria-hidden="true" />
    );
  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!loading}
      size="sm"
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading} data-autofocus>
            Cancel
          </Button>
          <Button variant="destructive" icon={icon} loading={loading} onClick={run}>
            {loading ? busyLabel : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-crimson-wash">
          <AlertTriangle className="size-6 text-crimson" aria-hidden="true" />
        </span>
        <p className="pt-3 t-body">{consequence}</p>
      </div>
      {(failed || forceError) && (
        <FormAlert className="mt-4">Something went wrong. Try again in a moment.</FormAlert>
      )}
    </Modal>
  );
}

/** Inline rendering of the confirmation content for design boards (no overlay). */
export function ConfirmActionPreview({
  title,
  consequence,
  confirmLabel,
  busy,
  error,
}: {
  title: string;
  consequence: string;
  confirmLabel: string;
  busy?: boolean;
  error?: boolean;
}) {
  return (
    <div className="flex flex-col gap-5 rounded-lg bg-linen p-6 shadow-e3">
      <h3 className="t-h2">{title}</h3>
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-crimson-wash">
          <AlertTriangle className="size-6 text-crimson" aria-hidden="true" />
        </span>
        <p className="pt-3 t-body">{consequence}</p>
      </div>
      {error && <FormAlert>Something went wrong. Try again in a moment.</FormAlert>}
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="secondary" force="focus">
          Cancel
        </Button>
        <Button
          variant="destructive"
          icon={<Trash2 className="size-5" aria-hidden="true" />}
          loading={busy}
        >
          {busy ? "Deleting" : confirmLabel}
        </Button>
      </div>
    </div>
  );
}
