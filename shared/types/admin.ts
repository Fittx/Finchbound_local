import type { PLATFORM_REPORT_STATUSES } from "../enums.js";
import type { BookKind, Visibility } from "./books.js";
import type { ReportReason, SubmissionStatus } from "./submissions.js";

export type PlatformReportStatus = (typeof PLATFORM_REPORT_STATUSES)[number];

/** POST /api/public/books/:slug/platform-reports. Goes to Finchbound admins, not the host. */
export type PlatformReportRequest = {
  reason: ReportReason;
  details: string;
  submissionId?: string;
};

/** One row in the admin queue. `book` is null when the book was purged after the report. */
export type AdminReport = {
  id: string;
  reason: ReportReason;
  details: string;
  status: PlatformReportStatus;
  createdAt: string;
  book: {
    id: string;
    title: string;
    slug: string;
    kind: BookKind;
    live: boolean;
    visibility: Visibility;
    deleted: boolean;
    ownerEmail: string;
  } | null;
  submission?: {
    id: string;
    name: string;
    message: string;
    photo?: string;
    status: SubmissionStatus;
  };
};

export type AdminReportsResponse = { items: AdminReport[]; nextCursor: string | null };
