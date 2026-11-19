import { Flag } from "lucide-react";
import { FeatherMark } from "../../brand";
import { FormAlert } from "../../components/FormAlert";
import { StatusText } from "../../components/StatusText";
import { timeAgo } from "../../lib/time";
import type { Submission } from "../../types/submissions";
import { Button, Modal } from "../../ui";
import { ACTION_ICON, ACTION_LABEL, reasonLabel } from "./FeedItem";
import { ACTIONS_FOR, displayName, type ModerationAction } from "./useModeration";

/** Full message and full-size photo, with the same status-aware actions as the card. */
export function EntryDetailModal({
  s,
  onClose,
  onAction,
  busy,
  error,
}: {
  s: Submission | null;
  onClose: () => void;
  onAction: (a: ModerationAction) => void;
  busy?: string;
  error?: string;
}) {
  if (!s) return null;
  const { main, more } = ACTIONS_FOR[s.status];
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={displayName(s)}
      description={`${timeAgo(s.createdAt)}${s.email ? ` · ${s.email}` : ""}`}
      footer={
        <>
          {more.map((a) => (
            <Button
              key={a}
              variant="ghost"
              icon={ACTION_ICON[a]}
              disabled={!!busy}
              onClick={() => onAction(a)}
            >
              {ACTION_LABEL[a]}
            </Button>
          ))}
          <Button
            icon={ACTION_ICON[main]}
            loading={busy === main}
            onClick={() => onAction(main)}
            data-autofocus
          >
            {ACTION_LABEL[main]}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <StatusText status={s.status} />
          <span className="flex items-center gap-2 t-caption">
            <FeatherMark className="size-4" color={s.reacted ? "#E63946" : "#8A8C9C"} />
            {s.reactions} {s.reactions === 1 ? "feather" : "feathers"}
          </span>
          {s.report && (
            <span className="flex items-center gap-2 t-caption">
              <Flag className="size-4 text-crimson" aria-hidden="true" />
              Reported · {reasonLabel(s.report.reason)}
            </span>
          )}
        </div>
        {error && <FormAlert>{error}</FormAlert>}
        {s.photo && (
          <img
            src={s.photo.replace("w=800", "w=1600")}
            alt={`Photo from ${displayName(s)}`}
            className="max-h-[60vh] w-full rounded-md bg-wash object-contain"
          />
        )}
        <p className="t-body whitespace-pre-line">{s.message || "No message"}</p>
      </div>
    </Modal>
  );
}
