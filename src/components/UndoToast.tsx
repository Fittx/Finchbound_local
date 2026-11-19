import { useCallback } from "react";
import { LIMITS } from "../constants";
import { ToastView } from "../shell";
import { useApp } from "../store";

/**
 * Shows a toast with Undo for LIMITS.undoMs. `onExpire` runs only if Undo wasn't pressed,
 * which is when permanent actions (delete) are committed to the server.
 */
export function useUndoToast() {
  const { toast } = useApp();
  return useCallback(
    (message: string, onUndo: () => unknown, onExpire?: () => unknown) => {
      let undone = false;
      toast(message, {
        tone: "info",
        action: {
          label: "Undo",
          onClick: () => {
            undone = true;
            Promise.resolve().then(onUndo).catch(()=>toast("Couldn't undo that change.",{tone:"error"}));
          },
        },
      });
      if (onExpire) window.setTimeout(() => !undone && onExpire(), LIMITS.undoMs);
    },
    [toast],
  );
}

/** Static rendering for the design-system boards. */
export function UndoToast({ message }: { message: string }) {
  return (
    <ToastView static tone="info" message={message} action={{ label: "Undo", onClick: () => {} }} />
  );
}
