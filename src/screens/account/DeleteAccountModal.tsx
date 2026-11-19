import { useState } from "react";
import { deleteAccount } from "../../api/account";
import { FormAlert } from "../../components/FormAlert";
import { Button, Input, Modal } from "../../ui";
import { useApp } from "../../store";
export function DeleteAccountModal({
  email,
  onClose,
  variant = "",
}: {
  email: string;
  onClose: () => void;
  variant?: string;
}) {
  const { navigate, toast, clearAccountBooks } = useApp();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(variant === "delete-saving");
  const [error, setError] = useState(variant === "delete-error");
  const remove = async () => {
    if (typed !== email || busy) return;
    setBusy(true);
    setError(false);
    try {
      await deleteAccount(typed);
      clearAccountBooks();
      toast("Account deleted");
      navigate("/signin");
    } catch {
      setError(true);
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!busy}
      title="Delete your account?"
      description="Your account, books and guest entries will be permanently removed. This cannot be undone."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy} data-autofocus>
            Cancel
          </Button>
          <Button variant="destructive" disabled={typed !== email} loading={busy} onClick={remove}>
            {busy ? "Deleting" : "Delete account"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <FormAlert>We couldn't delete your account. Try again.</FormAlert>}
        <p className="t-body break-words">
          Type <strong>{email}</strong> to confirm.
        </p>
        <Input
          label="Account email to confirm"
          type="email"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={busy}
          autoComplete="off"
          error={typed && typed !== email ? "The email must match exactly" : undefined}
        />
      </div>
    </Modal>
  );
}
