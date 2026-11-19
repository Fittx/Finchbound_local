import { z } from "zod";
import { LIMITS, REPORT_REASON_VALUES } from "../../../shared/constants.js";
import { objectId } from "./books.js";
export const guestEmail = z
  .string()
  .trim()
  .max(254)
  .email()
  .transform((value) => value.toLowerCase());
export const guestCodeBody = z.strictObject({ email: guestEmail });
export const guestConfirmBody = z.strictObject({
  email: guestEmail,
  code: z.string().regex(/^\d{6}$/),
});
export const guestEntryBody = z.strictObject({
  name: z.string().trim().max(LIMITS.personName),
  email: z.union([z.literal(""), guestEmail]),
  photo: objectId.optional(),
  message: z.string().trim().max(LIMITS.message),
  captcha: z.string().min(1).max(2048),
});
export const reportBody = z.strictObject({
  reason: z.enum(REPORT_REASON_VALUES),
  details: z.string().trim().max(LIMITS.reportDetails),
  submissionId: objectId.optional(),
});
export const blockBody = z.strictObject({ submissionId: objectId });
export type GuestEntryInput = z.infer<typeof guestEntryBody>;
export type GuestReportInput = z.infer<typeof reportBody>;
