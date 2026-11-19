import { LIMITS } from "../constants";
import { passwordMeetsPolicy } from "../../shared/password";
import { isGmailAccountEmail } from "../../shared/email";
export { GMAIL_ACCOUNT_MESSAGE } from "../../shared/email";

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
export const isAccountEmail = (value: string) => isEmail(value) && isGmailAccountEmail(value);

export type Strength = { score: 0 | 1 | 2 | 3; label: string; ok: boolean };

/** Strong enough = minimum length plus at least one letter and one number. */
export function passwordStrength(pw: string): Strength {
  if (!pw) return { score: 0, label: "", ok: false };
  const long = pw.length >= LIMITS.passwordMin;
  const mixed = /[a-z]/i.test(pw) && /\d/.test(pw);
  const extra = pw.length >= 12 || /[^a-z0-9]/i.test(pw);
  if (!long || !mixed || !passwordMeetsPolicy(pw))
    return { score: 1, label: "Weak password", ok: false };
  if (!extra) return { score: 2, label: "Fair password", ok: true };
  return { score: 3, label: "Strong password", ok: true };
}

export const PASSWORD_RULE = `Use at least ${LIMITS.passwordMin} characters including a letter and a number.`;

export function passwordError(value: string) {
  if (new TextEncoder().encode(value).length > 72) return "This password is too long. Try a shorter one.";
  return passwordStrength(value).ok ? undefined : PASSWORD_RULE;
}

export const maskEmail = (email: string) => {
  const [user = "", domain = ""] = email.split("@");
  if (!domain) return email;
  return `${user.slice(0, 1)}${"•".repeat(Math.max(2, Math.min(user.length - 1, 6)))}@${domain}`;
};
