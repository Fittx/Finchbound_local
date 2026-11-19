import { LIMITS } from "./constants.js";

/** bcrypt consumes at most 72 UTF-8 bytes; never silently truncate a password. */
export function passwordMeetsPolicy(password: string): boolean {
  return (
    password.length >= LIMITS.passwordMin &&
    new TextEncoder().encode(password).length <= 72 &&
    /[a-z]/i.test(password) &&
    /\d/.test(password)
  );
}
