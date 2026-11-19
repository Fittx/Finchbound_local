import { useState } from "react";
import { reportContent } from "../api/guest";
import { LIMITS, REPORT_REASONS } from "../constants";
import type { ReportReason } from "../types/submissions";
import { Button, Modal, RadioGroup, Textarea } from "../ui";
import { FormAlert } from "./FormAlert";

type Reason = ReportReason;
const REASONS = REPORT_REASONS;

export function ReportContentModal({
  open,
  onClose,
  slug,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
}) {
  const [reason, setReason] = useState<Reason | "">("");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [tried, setTried] = useState(false);
  const close = () => {
    onClose();
    window.setTimeout(() => {
      setReason("");
      setDetails("");
      setState("idle");
      setTried(false);
    }, 200);
  };
  const send = async () => {
    setTried(true);
    if (!reason) return;
    setState("sending");
    try {
      await reportContent(slug, { reason, details });
      setState("sent");
    } catch {
      setState("failed");
    }
  };
  if (state === "sent")
    return (
      <Modal
        open={open}
        onClose={close}
        size="sm"
        title="Thanks for telling us"
        description="Our team reviews every report within 24 hours."
        footer={
          <Button onClick={close} data-autofocus>
            Close
          </Button>
        }
      />
    );
  return (
    <Modal
      open={open}
      onClose={close}
      dismissible={state !== "sending"}
      title="Report content"
      description="Reports are private. The host won't see who sent them."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={state === "sending"}>
            Cancel
          </Button>
          <Button onClick={send} loading={state === "sending"}>
            {state === "sending" ? "Sending report" : "Send report"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {state === "failed" && (
          <FormAlert>We couldn't send your report. Try again in a moment.</FormAlert>
        )}
        <div className="flex flex-col gap-2">
          <RadioGroup
            label="What's wrong?"
            value={reason as Reason}
            onChange={setReason}
            options={REASONS}
          />
          {tried && !reason && <FormAlert className="p-3">Choose a reason to continue.</FormAlert>}
        </div>
        <Textarea
          label="Details (optional)"
          value={details}
          max={LIMITS.reportDetails}
          rows={3}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Which page, and what should we look at?"
        />
      </div>
    </Modal>
  );
}
