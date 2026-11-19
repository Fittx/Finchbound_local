import type { ApiErrorBody, ApiErrorCode } from "../../../shared/types/api.js";

export type ServerErrorCode = Exclude<ApiErrorCode, "OFFLINE">;
const STATUS: Record<ServerErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VALIDATION_FAILED: 400,
  INVALID_CREDENTIALS: 401,
  ACCOUNT_LOCKED: 423,
  EMAIL_TAKEN: 409,
  INVALID_CODE: 400,
  CODE_EXPIRED: 410,
  TOKEN_EXPIRED: 410,
  NOT_FOUND: 404,
  PRIVATE: 403,
  CONFLICT: 409,
  UPLOAD_FAILED: 422,
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_FILE_TYPE: 415,
  RATE_LIMITED: 429,
  CAPTCHA_FAILED: 400,
  GUEST_BLOCKED: 403,
  SERVER: 500,
};
const MESSAGE: Record<ServerErrorCode, string> = {
  UNAUTHORIZED: "Sign in to continue.",
  FORBIDDEN: "You cannot access this resource.",
  VALIDATION_FAILED: "Check the highlighted fields.",
  INVALID_CREDENTIALS: "Email or password did not match.",
  ACCOUNT_LOCKED: "Too many attempts. Try again later.",
  EMAIL_TAKEN: "This email is already used.",
  INVALID_CODE: "That code is not valid.",
  CODE_EXPIRED: "That code has expired.",
  TOKEN_EXPIRED: "That link has expired.",
  NOT_FOUND: "That resource was not found.",
  PRIVATE: "This book is private.",
  CONFLICT: "This item changed. Refresh and try again.",
  UPLOAD_FAILED: "The image could not be processed.",
  FILE_TOO_LARGE: "The file is too large.",
  UNSUPPORTED_FILE_TYPE: "That file type is not supported.",
  RATE_LIMITED: "Too many requests. Try again later.",
  CAPTCHA_FAILED: "Verification failed. Try again.",
  GUEST_BLOCKED: "You cannot submit to this book.",
  SERVER: "Something went wrong. Try again later.",
};

export class ApiError extends Error {
  readonly status: number;
  constructor(
    readonly code: ServerErrorCode,
    message = MESSAGE[code],
    readonly fields?: Record<string, string>,
    status = STATUS[code],
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
  toBody(): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.fields ? { fields: this.fields } : {}),
      },
    };
  }
}
