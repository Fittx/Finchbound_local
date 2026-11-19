import { LIMITS } from "../../../shared/constants.js";
import type { Env } from "../config/env.js";
import { User } from "../models/User.js";
import { AuthSession } from "../models/AuthSession.js";
import { Otp } from "../models/Otp.js";
import { ApiError } from "../utils/ApiError.js";
import { transaction } from "../utils/transaction.js";
import { purgeAccountBooks } from "../jobs/purgeDeleted.js";
import { sessionUser, type AuthPrincipal } from "./auth.js";
import { hashPassword, comparePassword } from "./password.js";
import { hashCode, makeCode } from "./tokens.js";
import type { AuthMailer } from "./mail.js";

export class AccountService {
  constructor(
    private config: Env,
    private mailer: AuthMailer,
  ) {}
  async update(host: AuthPrincipal, input: { name: string; email: string }) {
    const code = makeCode();
    const result = await transaction(async (session) => {
      const user = await User.findOne({ _id: host.userId, authVersion: host.authVersion }).session(
        session,
      );
      if (!user) throw new ApiError("UNAUTHORIZED");
      user.name = input.name;
      const changed = user.email !== input.email;
      if (changed) {
        if (await User.exists({ email: input.email }).session(session))
          throw new ApiError("EMAIL_TAKEN");
        user.resourceVersion++;
        this.mailer.assertConfigured();
        const now = new Date();
        const previous = await Otp.findOne({ userId: user._id, purpose: "account-email" }).session(
          session,
        );
        if (previous && +now - previous.lastSentAt.getTime() < LIMITS.otpResendSeconds * 1000)
          throw new ApiError("RATE_LIMITED");
        await Otp.updateOne(
          { email: user.email, purpose: "account-email" },
          {
            $set: {
              userId: user._id,
              authVersion: user.authVersion,
              targetEmail: input.email,
              codeHash: hashCode(this.config, input.email, code),
              attempts: 0,
              consumedAt: null,
              lastSentAt: now,
              expiresAt: new Date(+now + this.config.OTP_TTL_MINUTES * 60000),
            },
          },
          { upsert: true, session },
        );
      }
      await user.save({ session });
      return { user: sessionUser(user), changed };
    });
    if (result.changed) {
      try {
        await this.mailer.sendVerification(input.email, code);
      } catch {
        throw new ApiError("SERVER", "We couldn't send the verification code. Try again shortly.");
      }
    }
    return result;
  }
  async password(host: AuthPrincipal, current: string, next: string) {
    const user = await User.findOne({ _id: host.userId, authVersion: host.authVersion }).select(
      "+passwordHash",
    );
    if (!user) throw new ApiError("UNAUTHORIZED");
    if (!(await comparePassword(current, user.passwordHash)))
      throw new ApiError("INVALID_CREDENTIALS", "Your current password doesn't match.");
    const passwordHash = await hashPassword(next, this.config.BCRYPT_ROUNDS);
    await transaction(async (session) => {
      const changed = await User.updateOne(
        { _id: user._id, authVersion: host.authVersion, passwordHash: user.passwordHash },
        { $set: { passwordHash, failedLogins: 0, lockedUntil: null }, $inc: { authVersion: 1 } },
        { session },
      );
      if (!changed.modifiedCount) throw new ApiError("UNAUTHORIZED");
      await AuthSession.deleteMany({ userId: user._id }, { session });
      await Otp.deleteMany({ userId: user._id }, { session });
    });
  }
  async remove(host: AuthPrincipal, email: string) {
    await transaction(async (session) => {
      const user = await User.findOne({ _id: host.userId, authVersion: host.authVersion }).session(
        session,
      );
      if (!user) throw new ApiError("UNAUTHORIZED");
      if (email !== user.email)
        throw new ApiError("VALIDATION_FAILED", "Type your account email exactly.", {
          email: "Enter your saved email exactly.",
        });
      await user.deleteOne({ session });
      await purgeAccountBooks(user._id, session);
      await Otp.deleteMany({ userId: user._id }, { session });
      await AuthSession.deleteMany({ userId: user._id }, { session });
    });
  }
}
