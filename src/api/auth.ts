import { ApiError, request } from "./client";
import { getSessionRevision, setSession } from "./session";
import type {
  SignInRequest,
  SignInResponse,
  SignUpRequest,
  SignUpResponse,
  OkResponse,
} from "../types/auth";

async function authenticate(path: string, body: unknown) {
  const { user } = await request<SignInResponse>(path, "POST", body);
  setSession(user);
  return user;
}
export const signIn = (input: SignInRequest) => authenticate("/auth/login", input);
export const signUp = (input: SignUpRequest) =>
  request<SignUpResponse>("/auth/register", "POST", input);
export const verifyEmail = (email: string, code: string) =>
  authenticate("/auth/verify-email", { email, code });
export const resendCode = (email: string) =>
  request<OkResponse>("/auth/resend-code", "POST", { email });
export const requestPasswordReset = (email: string) =>
  request<OkResponse>("/auth/forgot-password", "POST", { email });
export function checkResetToken(token: string | null) {
  if (!token) return Promise.reject(new ApiError("TOKEN_EXPIRED"));
  return request<OkResponse>("/auth/reset-password/" + encodeURIComponent(token));
}
export async function resetPassword(token: string, password: string) {
  await request("/auth/reset-password", "POST", { token, password });
  setSession(null);
}
export async function signOut() {
  await request("/auth/logout", "POST");
  setSession(null);
}
export async function restoreSession() {
  const revision = getSessionRevision();
  try {
    const { user } = await request<SignInResponse>("/auth/me");
    if (getSessionRevision() === revision) setSession(user);
  } catch {
    // Start signed out if the cookie is absent or the service is unavailable.
  }
}
