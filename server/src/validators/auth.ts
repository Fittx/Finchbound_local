import { z } from "zod";
import { LIMITS } from "../../../shared/constants.js";
import { passwordMeetsPolicy } from "../../../shared/password.js";
import { isGmailAccountEmail, GMAIL_ACCOUNT_MESSAGE } from "../../../shared/email.js";

export const email = z
  .string()
  .trim()
  .max(254)
  .email()
  .transform((value) => value.toLowerCase())
  .refine(isGmailAccountEmail, GMAIL_ACCOUNT_MESSAGE);
const loginPassword = z
  .string()
  .min(1)
  .max(256)
  .refine(
    (value) => Buffer.byteLength(value, "utf8") <= 72,
    "This password is too long. Try a shorter one.",
  );
export const newPassword = loginPassword.refine(
  passwordMeetsPolicy,
  "Use at least 8 characters including a letter and a number.",
);
export const loginBody = z.strictObject({ email, password: loginPassword, remember: z.boolean() });
export const registerBody = z.strictObject({
  name: z.string().trim().min(1).max(LIMITS.personName),
  email,
  password: newPassword,
});
export const emailBody = z.strictObject({ email });
export const verifyBody = z.strictObject({
  email,
  code: z.string().regex(/^\d{6}$/, "Enter all 6 digits"),
});
const token = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z0-9_-]+$/);
export const resetParams = z.strictObject({ token });
export const resetBody = z.strictObject({ token, password: newPassword });
