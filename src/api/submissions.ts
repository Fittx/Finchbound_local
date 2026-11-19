import { request, queryString } from "./client";
import type { Paginated } from "../types/api";
import type {
  AddToBookResponse,
  BlockGuestResponse,
  BulkModerateRequest,
  BulkModerateResponse,
  ListSubmissionsQuery,
  ListSubmissionsResponse,
  ReactionResponse,
  Submission,
  UpdateSubmissionStatusRequest,
  UpdateSubmissionStatusResponse,
  HostReport,
} from "../types/submissions";
export const listSubmissions = (bookId: string, query: ListSubmissionsQuery = {}) =>
  request<ListSubmissionsResponse>("/books/" + bookId + "/submissions" + queryString(query));
const entry = (id: string) => "/submissions/" + id;
export const updateSubmissionStatus = (id: string, body: UpdateSubmissionStatusRequest) =>
  request<UpdateSubmissionStatusResponse>(entry(id), "PATCH", body);
export const approveSubmission = (id: string) => updateSubmissionStatus(id, { status: "approved" });
export const rejectSubmission = (id: string) => updateSubmissionStatus(id, { status: "rejected" });
export const restoreSubmission = approveSubmission;
export const bulkModerate = (bookId: string, body: BulkModerateRequest) =>
  request<BulkModerateResponse>("/books/" + bookId + "/submissions/bulk", "POST", body);
export const deleteSubmission = (id: string) => request<void>(entry(id), "DELETE");
export const addSubmissionToBook = (id: string) =>
  request<AddToBookResponse>(entry(id) + "/add-to-book", "POST");
export const toggleReaction = (id: string) =>
  request<ReactionResponse>(entry(id) + "/reaction", "POST");
export const dismissReport = (id: string) =>
  request<{ submission: Submission }>(entry(id) + "/report", "DELETE");
export const blockGuest = (id: string, submissionId: string) =>
  request<BlockGuestResponse>("/books/" + id + "/blocked-guests", "POST", { submissionId });
export const listReports = (id: string, cursor?: string | null) =>
  request<Paginated<HostReport>>("/books/" + id + "/reports" + queryString({ cursor }));
export const acknowledgeBookReport = (id: string, reportId: string) =>
  request<void>("/books/" + id + "/reports/" + reportId, "DELETE");
export function subscribeToSubmissions(
  bookId: string,
  refresh: () => void,
  connection: (connected: boolean) => void,
) {
  const stream = new EventSource("/api/books/" + bookId + "/submissions/stream");
  stream.onopen = () => connection(true);
  stream.onerror = () => connection(false);
  let timer: number | undefined;
  const changed = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(refresh, 100);
  };
  for (const name of [
    "ready",
    "reset",
    "submission",
    "submission:updated",
    "reaction:updated",
    "submission:deleted",
  ])
    stream.addEventListener(name, changed);
  return () => {
    window.clearTimeout(timer);
    stream.close();
  };
}
