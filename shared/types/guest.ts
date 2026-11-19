import type { Access, FontKey, ThemeColors } from "./books.js";
import type { ReportReason } from "./submissions.js";
import type { COLLECTION_STATUSES } from "../enums.js";

/** GET /api/public/books/:slug/guest: the guest-facing view of an event. */
export type GuestEvent = {
  slug: string;
  title: string;
  hosts: string;
  prompt: string;
  theme: ThemeColors;
  font: FontKey;
  lines: boolean;
  access: Access;
  photoRequired: boolean;
  messageRequired: boolean;
  status: (typeof COLLECTION_STATUSES)[number];
  readerAvailable: boolean;
};

export type GuestEntryRequest = {
  name: string;
  email: string;
  /** Upload id returned by POST /api/uploads/image. */
  photo?: string;
  message: string;
  captcha: string;
};
export type SubmitResult = { status: "added" | "pending" };
export type GuestCodeRequest = { email: string };
export type GuestCodeConfirmRequest = { email: string; code: string };
/** bookId comes from the resolved route; an optional submission must belong to it. */
export type ReportRequest = { reason: ReportReason; details: string; submissionId?: string };
export type CaptchaRequest = { token: string; bookSlug: string; draftId: string };
export type CaptchaResponse = { token: string; uploadToken: string; expiresAt: string };
