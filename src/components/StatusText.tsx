import { SUBMISSION_STATUS } from "../constants";
import type { SubmissionStatus } from "../types/submissions";
import { Dot, Skeleton } from "../ui";

/** Plain-text entry status with a dot. Display only. */
export function StatusText({ status, loading }: { status: SubmissionStatus; loading?: boolean }) {
  if (loading) return <Skeleton className="h-4 w-20" />;
  const s = SUBMISSION_STATUS[status];
  return (
    <span className="inline-flex shrink-0 items-center gap-2 t-caption font-medium">
      <Dot color={s.dot} />
      {s.label}
    </span>
  );
}
