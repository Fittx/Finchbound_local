import { Clock } from "lucide-react";
import { MODERATION_ACTIONS } from "../../constants";
import { Button, Skeleton } from "../../ui";

/** Strict events only: how many entries wait for approval, with a shortcut to the Pending filter. */
export function ModerationBanner({
  count,
  active,
  onReview,
  loading,
}: {
  count: number;
  active: boolean;
  onReview: () => void;
  loading?: boolean;
}) {
  if (loading) return <Skeleton className="h-[76px] w-full rounded-md" />;
  if (!count) return null;
  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-md bg-wash p-4 md:flex-row md:items-center"
    >
      <div className="flex flex-1 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-linen">
          <Clock className="size-5" aria-hidden="true" />
        </span>
        <p className="t-body">
          <span className="font-bold">
            {count} {count === 1 ? "entry is" : "entries are"} waiting for approval.
          </span>{" "}
          They stay out of the book until you approve them.
        </p>
      </div>
      <Button
        variant="secondary"
        className="bg-linen hover:bg-wash-strong"
        onClick={onReview}
        disabled={active}
      >
        {active ? "Showing pending" : MODERATION_ACTIONS.reviewPending}
      </Button>
    </div>
  );
}
