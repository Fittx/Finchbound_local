import { useState } from "react";
import { signOut } from "../api/auth";
import { useApp } from "../store";
import { Button, Modal } from "../ui";
import { FormAlert } from "./FormAlert";

export function LogoutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { navigate, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const confirm = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await signOut();
      toast("You're signed out");
      navigate("/signin");
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!busy}
      size="sm"
      title="Sign out of Finchbound?"
      description="You'll need to sign in again to manage your books."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy} data-autofocus>
            Cancel
          </Button>
          <Button onClick={confirm} loading={busy}>
            {busy ? "Signing out" : "Sign out"}
          </Button>
        </>
      }
    >
      {failed && (
        <FormAlert>We couldn't sign you out. Check your connection and try again.</FormAlert>
      )}
    </Modal>
  );
}
