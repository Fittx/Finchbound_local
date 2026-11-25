import { request, queryString } from "./client";
import type {
  AdminReportsResponse,
  PlatformReportRequest,
  PlatformReportStatus,
} from "../../shared/types/admin";

export type { AdminReport, PlatformReportStatus } from "../../shared/types/admin";

/** Readers and guests report a book to Finchbound, not to its host. */
export const reportToPlatform = (slug: string, body: PlatformReportRequest) =>
  request("/public/books/" + encodeURIComponent(slug) + "/platform-reports", "POST", body);
export const listAdminReports = (status: PlatformReportStatus, cursor?: string | null) =>
  request<AdminReportsResponse>("/admin/reports" + queryString({ status, cursor }));
export const dismissAdminReport = (id: string) =>
  request("/admin/reports/" + id + "/dismiss", "POST");
export const adminUnpublishBook = (bookId: string) =>
  request("/admin/books/" + bookId + "/unpublish", "POST");
export const adminRemoveSubmission = (submissionId: string) =>
  request<void>("/admin/submissions/" + submissionId, "DELETE");
