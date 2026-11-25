import type { FeedFilter, ReportReason, SubmissionStatus } from "./types/submissions.js";
import type { Visibility } from "./types/books.js";

export * from "./enums.js";

/** Product limits. The single source of truth for every counter, validator and upload check. */
export const LIMITS = {
  bookTitle: 80,
  pageTitle: 60,
  photoCaption: 60,
  messageHeader: 60,
  message: 600,
  inviteMessage: 120,
  reportDetails: 300,
  personName: 60,
  slug: 60,
  uploadMb: 10,
  uploadBytes: 10 * 1024 * 1024,
  passwordMin: 8,
  otpLength: 6,
  otpResendSeconds: 30,
  signInAttempts: 5,
  lockMinutes: 15,
  rateLimitMinutes: 10,
  sessionMinutes: 30,
  /** How long Undo stays available before a delete is committed. */
  undoMs: 6000,
  /** Event size, used to scale per-book guest rate limits. */
  expectedGuestsMin: 1,
  expectedGuestsMax: 2000,
  expectedGuestsDefault: 100,
} as const;

/** Accepted only by a development server with no Turnstile secret. Never valid in production. */
export const DEV_CAPTCHA_TOKEN = "local-development-only";

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];
export const ACCEPTED_IMAGE_LABEL = "JPG, PNG, WebP or HEIC";

/* ---------- Moderation ---------- */

/** Plain-text status with a dot. Dot colors are tokens; the label carries the meaning. */
export const SUBMISSION_STATUS: Record<SubmissionStatus, { label: string; dot: string }> = {
  pending: { label: "Pending", dot: "#F4A261" },
  approved: { label: "Approved", dot: "#2F7D57" },
  "in-book": { label: "In book", dot: "#2B2D42" },
  rejected: { label: "Rejected", dot: "#8A8C9C" },
};

/** "All" covers every entry that isn't rejected; rejected entries stay hidden until restored. */
export const FEED_FILTERS: { key: FeedFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending approval" },
  { key: "approved", label: "Approved" },
  { key: "in-book", label: "In book" },
  { key: "rejected", label: "Rejected" },
];

export const MODERATION_ACTIONS = {
  approve: "Approve",
  reject: "Reject",
  delete: "Delete",
  addToBook: "Add to book pages",
  restore: "Restore",
  openEditor: "Open in editor",
  approveAll: "Approve all",
  rejectAll: "Reject all",
  select: "Select",
  doneSelecting: "Done",
  reviewPending: "Review pending",
  keep: "Keep",
  remove: "Remove",
  blockGuest: "Block guest",
  clearFilters: "Clear filters",
} as const;

export const MODERATION_ERRORS: Record<string, string> = {
  approve: "We couldn't approve this entry. Try again.",
  addToBook: "We couldn't add this entry to the book. Try again.",
  restore: "We couldn't restore this entry. Try again.",
  keep: "We couldn't dismiss this report. Try again.",
};

export const ANONYMOUS_GUEST = "Anonymous guest";
export const WITH_PHOTO_LABEL = "With photo";
export const SEARCH_GUESTS_PLACEHOLDER = "Search by guest name";

export const REPORT_REASONS: { value: ReportReason; label: string; description: string }[] = [
  {
    value: "inappropriate",
    label: "Inappropriate content",
    description: "Offensive photos or messages",
  },
  { value: "spam", label: "Spam", description: "Ads, links or repeated pages" },
  { value: "privacy", label: "Privacy", description: "A photo of me shared without consent" },
  { value: "other", label: "Something else", description: "Tell us more below" },
];

export const READER_ACCESS_OPTIONS: { value: Visibility; label: string; description: string }[] = [
  { value: "private", label: "Only me", description: "Keep it private while you work" },
  { value: "link", label: "Anyone with the link", description: "Share it with friends and family" },
];

/** Default page sizes for cursor-paginated list endpoints. */
export const PAGE_SIZE = { books: 12, pages: 8, submissions: 12 } as const;
export const CROP_RATIOS = { polaroid: 1, card: 4 / 3 } as const;

/** Existing prototype reservations plus the account, legal and API route names. */
export const RESERVED_SLUGS = [
  "dashboard",
  "create",
  "admin",
  "login",
  "wedding",
  "signin",
  "signup",
  "forgot-password",
  "reset-password",
  "verify-email",
  "session-expired",
  "server-error",
  "hub",
  "editor",
  "reader",
  "system",
  "frames",
  "update",
  "account",
  "terms",
  "privacy",
  "api",
];
