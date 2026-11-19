import { useState, type ReactNode } from "react";
import {
  BookPlus,
  Ban,
  Check,
  Flag,
  PenSquare,
  RotateCcw,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { FeatherMark } from "../../brand";
import { Checkbox } from "../../components/Checkbox";
import { FormAlert } from "../../components/FormAlert";
import { StatusText } from "../../components/StatusText";
import { MODERATION_ACTIONS, REPORT_REASONS } from "../../constants";
import { initials } from "../../data";
import { timeAgo } from "../../lib/time";
import type { Submission } from "../../types/submissions";
import { Button, OverflowMenu, cx, type Force } from "../../ui";
import { ACTIONS_FOR, displayName, type ModerationAction } from "./useModeration";

export const ACTION_ICON: Record<ModerationAction, ReactNode> = {
  approve: <Check className="size-4" aria-hidden="true" />,
  addToBook: <BookPlus className="size-4" aria-hidden="true" />,
  openEditor: <PenSquare className="size-4" aria-hidden="true" />,
  restore: <RotateCcw className="size-4" aria-hidden="true" />,
  reject: <X className="size-4" aria-hidden="true" />,
  delete: <Trash2 className="size-4" aria-hidden="true" />,
};
export const ACTION_LABEL: Record<ModerationAction, string> = {
  approve: MODERATION_ACTIONS.approve,
  addToBook: MODERATION_ACTIONS.addToBook,
  openEditor: MODERATION_ACTIONS.openEditor,
  restore: MODERATION_ACTIONS.restore,
  reject: MODERATION_ACTIONS.reject,
  delete: MODERATION_ACTIONS.delete,
};
export const reasonLabel = (r: string) => REPORT_REASONS.find((x) => x.value === r)?.label ?? r;

/** Host-only entry card. Guests never see the feed or feathers. */
export function FeedItem({
  s,
  selectMode,
  selected,
  onToggleSelect,
  busy,
  error,
  onOpen,
  onReact,
  onAction,
  reduced,
  force,
  disabled,
}: {
  s: Submission;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  busy?: string;
  error?: string;
  onOpen?: () => void;
  onReact?: () => void;
  onAction?: (a: ModerationAction) => void;
  reduced?: boolean;
  force?: Force;
  disabled?: boolean;
}) {
  const [pop, setPop] = useState(false);
  const name = displayName(s);
  const anonymous = !s.name.trim();
  const { main, more } = ACTIONS_FOR[s.status];
  const long = s.message.length > 220;
  return (
    <article
      data-loadmore-item
      className={cx(
        "relative flex gap-3 rounded-lg bg-linen p-4 shadow-e1 transition-shadow hover:shadow-e2 md:gap-4 md:p-5",
        s.fresh && "anim-highlight",
        selected && "ring-2 ring-slate",
        force === "hover" && "shadow-e2",
      )}
    >
      {selectMode && (
        <div className="-my-1 shrink-0">
          <Checkbox
            label={<span className="sr-only">Select entry from {name}</span>}
            checked={!!selected}
            onChange={() => onToggleSelect?.()}
          />
        </div>
      )}
      <span
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-wash t-caption font-bold"
        aria-hidden="true"
      >
        {anonymous ? <UserRound className="size-5" /> : initials(name)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            <h3 className="t-body font-bold">{name}</h3>
            <span className="t-caption text-muted">{timeAgo(s.createdAt)}</span>
          </div>
          <StatusText status={s.status} />
        </div>
        <button
          type="button"
          onClick={onOpen}
          disabled={disabled}
          aria-label={`Open entry from ${name}`}
          className={cx(
            "-m-2 flex flex-col items-start gap-3 rounded-md p-2 text-left transition-colors hover:bg-wash disabled:cursor-default disabled:hover:bg-transparent",
            force === "focus" && "outline-2 outline-offset-2 outline-slate outline-solid",
          )}
        >
          <p className="line-clamp-3 t-body">{s.message}</p>
          {s.photo && (
            <img
              src={s.photo}
              alt={`Photo from ${name}`}
              className="h-44 w-full max-w-[320px] rounded-md object-cover md:h-48"
              loading="lazy"
            />
          )}
          {(long || s.photo) && (
            <span className="t-caption font-medium underline decoration-2 underline-offset-4">
              {long ? "Read full message" : "View full photo"}
            </span>
          )}
        </button>
        {(s.report || s.guestBlocked) && (
          <div className="flex flex-col gap-1 t-caption">
            {s.report && (
              <p className="flex items-center gap-2">
                <Flag className="size-4 shrink-0 text-crimson" aria-hidden="true" />
                Reported · {reasonLabel(s.report.reason)}
                {s.report.count > 1 && ` · ${s.report.count} reports`}
              </p>
            )}
            {s.guestBlocked && (
              <p className="flex items-center gap-2">
                <Ban className="size-4 shrink-0" aria-hidden="true" />
                Guest blocked
              </p>
            )}
          </div>
        )}
        {error && <FormAlert className="p-3">{error}</FormAlert>}
        {!selectMode && (
          <div className="-ml-2 flex flex-wrap items-center gap-1">
            {s.status !== "rejected" && (
              <button
                type="button"
                aria-pressed={s.reacted}
                disabled={disabled}
                aria-label={`Feather reaction, ${s.reactions} ${s.reactions === 1 ? "feather" : "feathers"}`}
                onClick={() => {
                  onReact?.();
                  if (!reduced && !s.reacted) {
                    setPop(true);
                    window.setTimeout(() => setPop(false), 300);
                  }
                }}
                className={cx(
                  "inline-flex min-h-11 items-center gap-2 rounded-md px-3 t-caption font-medium transition-colors hover:bg-wash disabled:text-muted",
                  s.reacted && "bg-wash",
                )}
              >
                <span
                  className={cx("transition-transform duration-300", pop && "scale-125 -rotate-12")}
                >
                  <FeatherMark className="size-5" color={s.reacted ? "#E63946" : "#8A8C9C"} />
                </span>
                <span className="tabular-nums">{s.reactions}</span>
              </button>
            )}
            <span className="flex-1" />
            <div className="hidden items-center gap-1 md:flex">
              {more.map((a) => (
                <Button
                  key={a}
                  variant="ghost"
                  className="px-3"
                  disabled={disabled || !!busy}
                  icon={ACTION_ICON[a]}
                  onClick={() => onAction?.(a)}
                  aria-label={`${ACTION_LABEL[a]} entry from ${name}`}
                >
                  {ACTION_LABEL[a]}
                </Button>
              ))}
            </div>
            <OverflowMenu
              className="md:hidden"
              label={`More actions for entry from ${name}`}
              items={more.map((a) => ({
                label: ACTION_LABEL[a],
                icon: ACTION_ICON[a],
                onSelect: () => onAction?.(a),
                disabled: disabled || !!busy,
              }))}
            />
            <Button
              variant="secondary"
              className="px-4"
              icon={ACTION_ICON[main]}
              loading={busy === main}
              disabled={disabled || (!!busy && busy !== main)}
              onClick={() => onAction?.(main)}
            >
              {ACTION_LABEL[main]}
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}
