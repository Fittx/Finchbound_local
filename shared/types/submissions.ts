import type { CursorQuery, Paginated } from "./api.js";
import type { Page } from "./books.js";
import type { REPORT_REASON_VALUES, SUBMISSION_STATUSES } from "../enums.js";

/** Pending → (Approved | Rejected); Approved → In book. Rejected can be restored. */
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];
export type FeedFilter = "all" | SubmissionStatus;
export type ReportReason = (typeof REPORT_REASON_VALUES)[number];

export type SubmissionReport = {
  reason: ReportReason;
  details?: string;
  count: number;
  lastReportedAt: string;
};

export type Submission = {
  id: string;
  bookId: string;
  /** Empty when an Email only guest skipped it; shown as "Anonymous guest". */
  name: string;
  email?: string;
  message: string;
  photo?: string;
  createdAt: string;
  status: SubmissionStatus;
  /** Host-only feather reactions. Never exposed to guests. */
  reactions: number;
  reacted: boolean;
  pageId?: string;
  report?: SubmissionReport;
  guestBlocked?: boolean;
  /** Client-only: arrived after the feed loaded. */
  fresh?: boolean;
};

export type SubmissionCounts = Record<FeedFilter, number>;

export type ListSubmissionsQuery = CursorQuery & {
  status?: FeedFilter;
  q?: string;
  withPhoto?: boolean;
};
export type ListSubmissionsResponse = Paginated<Submission> & { counts: SubmissionCounts };

export type UpdateSubmissionStatusRequest = { status: SubmissionStatus; pageId?: string };
export type UpdateSubmissionStatusResponse = { submission: Submission; removedPageId?: string };

export type BulkModerateRequest = { ids: string[]; action: "approve" | "reject" };
export type BulkModerateResponse = { updated: Submission[]; removedPageIds: string[] };

export type AddToBookResponse = { submission: Submission; page: Page };
export type ReactionResponse = { reactions: number; reacted: boolean };
export type BlockGuestResponse = { blockedSubmissionIds: string[] };

export type HostReport = {
  id: string;
  reason: ReportReason;
  details: string;
  createdAt: string;
  submission?: Submission;
};
