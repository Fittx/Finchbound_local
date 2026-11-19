/** Shared API envelope types. The Express backend should import these unchanged. */

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_FAILED"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_LOCKED"
  | "EMAIL_TAKEN"
  | "INVALID_CODE"
  | "CODE_EXPIRED"
  | "TOKEN_EXPIRED"
  | "NOT_FOUND"
  | "PRIVATE"
  | "CONFLICT"
  | "UPLOAD_FAILED"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_FILE_TYPE"
  | "RATE_LIMITED"
  | "CAPTCHA_FAILED"
  | "GUEST_BLOCKED"
  | "OFFLINE"
  | "SERVER";

/** Every non-2xx response body: { error: { code, message, fields? } } */
export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    /** Per-field validation messages, keyed by request field name. */
    fields?: Record<string, string>;
  };
};

/** Cursor pagination for list endpoints (books, pages, submissions). */
export type CursorQuery = { cursor?: string | null; limit?: number };
export type Paginated<T> = { items: T[]; nextCursor: string | null };
