import { useState } from "react";
import { changePassword } from "../../api/account";
import { PasswordInput } from "../../components/PasswordInput";
import { PasswordStrength } from "../../components/PasswordStrength";
import { FormAlert } from "../../components/FormAlert";
import { passwordStrength, passwordError } from "../../lib/validation";
import { Button, Modal } from "../../ui";
import { useApp } from "../../store";
export function ChangePasswordModal({
  onClose,
  variant = "",
}: {
  onClose: () => void;
  variant?: string;
}) {
  const { toast, navigate } = useApp();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(variant === "password-saving");
  const [error, setError] = useState(
    variant === "password-error" ? "Your current password doesn't match." : "",
  );
  const [tried, setTried] = useState(false);
  const save = async () => {
    setTried(true);
    if (!current || !passwordStrength(next).ok || next !== confirm) return;
    setBusy(true);
    setError("");
    try {
      await changePassword(current, next);
      toast("Password updated. Sign in again.");
      navigate("/signin");
      onClose();
    } catch (e) {
      setError(
        e instanceof Error && e.message !== "SERVER"
          ? e.message
          : "We couldn't change your password. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!busy}
      title="Change password"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            {busy ? "Saving" : "Update password"}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="flex flex-col gap-6"
      >
        {error && <FormAlert>{error}</FormAlert>}
        <PasswordInput
          label="Current password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          disabled={busy}
          error={tried && !current ? "Enter your current password" : undefined}
        />
        <PasswordInput
          label="New password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          disabled={busy}
          error={tried ? passwordError(next) : undefined}
        />
        <PasswordStrength value={next} />
        <PasswordInput
          label="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          disabled={busy}
          error={tried && confirm !== next ? "Passwords don't match" : undefined}
        />
        <button type="submit" className="sr-only" tabIndex={-1}>
          Update password
        </button>
      </form>
    </Modal>
  );
}
