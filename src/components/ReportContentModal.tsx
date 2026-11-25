import { useState } from "react";
import { reportContent } from "../api/guest";
import { reportToPlatform } from "../api/admin";
import { LIMITS, REPORT_REASONS } from "../constants";
import type { ReportReason } from "../types/submissions";
import { Button, Modal, RadioGroup, Textarea } from "../ui";
import { FormAlert } from "./FormAlert";

type Reason = ReportReason;
const REASONS = REPORT_REASONS;

/** `host` reports go to the book's host; `platform` reports go to Finchbound admins. */
export function ReportContentModal({
  open,
  onClose,
  slug,
  target = "host",
  entries = [],
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  target?: "host" | "platform";
  /** Guest pages currently on screen; the reporter can point at one of them. */
  entries?: { submissionId: string; title: string }[];
}) {
  const platform = target === "platform";
  const [about, setAbout] = useState("book");
  const [reason, setReason] = useState<Reason | "">("");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [tried, setTried] = useState(false);
  const close = () => {
    onClose();
    window.setTimeout(() => {
      setReason("");
      setAbout("book");
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
      const entry = entries.find((e) => e.submissionId === about);
      await (platform ? reportToPlatform : reportContent)(slug, {
        reason,
        details,
        ...(entry ? { submissionId: entry.submissionId } : {}),
      });
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
        description={
          platform
            ? "The Finchbound team will review this book."
            : "The host will review your report."
        }
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
      title={platform ? "Report this book to Finchbound" : "Report content"}
      description={
        platform
          ? "Our team reviews it, not the book's host. Reports are private."
          : "Reports are private. The host won't see who sent them."
      }
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
        {entries.length > 0 && (
          <RadioGroup
            label="What are you reporting?"
            value={about}
            onChange={setAbout}
            options={[
              { value: "book", label: "The whole book" },
              ...entries.map((e) => ({ value: e.submissionId, label: `Guest page: ${e.title}` })),
            ]}
          />
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
