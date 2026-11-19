import { User } from "./User.js";
import { Otp } from "./Otp.js";
import { AuthSession } from "./AuthSession.js";

/** Explicit security-critical indexes, including when production autoIndex is disabled. */
export async function initializeAuthModels() {
  await Promise.all([User.createIndexes(), Otp.createIndexes(), AuthSession.createIndexes()]);
}
