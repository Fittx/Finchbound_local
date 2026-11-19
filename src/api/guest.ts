import { request } from "./client";
import type {
  CaptchaResponse,
  GuestEvent,
  GuestEntryRequest,
  SubmitResult,
  ReportRequest,
} from "../types/guest";
export type { GuestEvent, SubmitResult };
const base = (slug: string) => "/public/books/" + encodeURIComponent(slug);
export const getEvent = (slug: string) => request<GuestEvent>(base(slug) + "/guest");
export const verifyCaptcha = (bookSlug: string, draftId: string, token: string) =>
  request<CaptchaResponse>("/public/captcha", "POST", { bookSlug, draftId, token });
export const sendGuestCode = (slug: string, email: string, proof: string) =>
  request(base(slug) + "/verify-email", "POST", { email }, proof);
export const verifyGuestCode = (slug: string, email: string, code: string, proof: string) =>
  request(base(slug) + "/verify-email/confirm", "POST", { email, code }, proof);
export const submitEntry = (event: GuestEvent, entry: GuestEntryRequest) =>
  request<SubmitResult>(base(event.slug) + "/submissions", "POST", entry);
export const reportContent = (slug: string, body: ReportRequest) =>
  request(base(slug) + "/reports", "POST", body);
