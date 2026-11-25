import type { ApiErrorBody, ApiErrorCode } from "../types/api";
import { getSessionSnapshot } from "./session";

export type { ApiErrorCode };

/** Thrown for any non-2xx response. Mirrors the wire shape { error: { code, message, fields? } }. */
export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string = code,
    public fields?: Record<string, string>,
  ) {
    super(message);
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
  static fromBody(body: ApiErrorBody) {
    return new ApiError(body.error.code, body.error.message, body.error.fields);
  }
}

/** Preview hook: frames pass ?variant= through to force an outcome. */
export type Simulate = string | null | undefined;

/** Send cookie-authenticated requests through the same-origin API. */
export async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
  bearer?: string,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/api" + path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        ...(body !== undefined && !(body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...(bearer ? { Authorization: "Bearer " + bearer } : {}),
      },
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("OFFLINE");
  }
  if (response.status === 204) return undefined as T;
  const result = await response.json().catch(() => {
    throw new ApiError("SERVER");
  });
  if (!response.ok) {
    const error = result?.error?.code ? ApiError.fromBody(result) : new ApiError("SERVER");
    // A signed-in host lost their session mid-task: tell the app once, centrally.
    if (
      error.code === "UNAUTHORIZED" &&
      !bearer &&
      !path.startsWith("/auth/") &&
      !path.startsWith("/public/") &&
      getSessionSnapshot()
    )
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    throw error;
  }
  return result;
}
export const SESSION_EXPIRED_EVENT = "finchbound:session-expired";

export function queryString(query: Record<string, string | number | boolean | null | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value != null && value !== "") params.set(key, String(value));
  return params.size ? "?" + params.toString() : "";
}
