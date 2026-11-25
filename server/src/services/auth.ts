import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import mongoose, { type ClientSession, type Types } from "mongoose";
import type { Env } from "../config/env.js";
import type {
  SessionUser,
  SignInRequest,
  SignUpRequest,
  UserRole,
} from "../../../shared/types/auth.js";
import { LIMITS } from "../../../shared/constants.js";
import { isGmailAccountEmail } from "../../../shared/email.js";
import { User } from "../models/User.js";
import { Otp } from "../models/Otp.js";
import { AuthSession } from "../models/AuthSession.js";
import { ApiError } from "../utils/ApiError.js";
import type { Logger } from "../utils/logger.js";
import type { AuthMailer } from "./mail.js";
import { comparePassword, hashPassword } from "./password.js";
import { digest, hashCode, makeCode, signSession, verifySession } from "./tokens.js";

type UserIdentity = {
  _id: Types.ObjectId;
  name: string;
  email: string;
  plan: string;
  authVersion: number;
};
export type SessionGrant = { user: SessionUser; token: string; remember: boolean };
export type AuthPrincipal = {
  user: SessionUser;
  userId: string;
  sessionId: string;
  authVersion: number;
  /** Server-only data for sliding renewal; never sent to the client. */
  renewal?: { jti: string; lifetime: number; expiresAt: Date };
};
/** Admin is configuration-only: re-derived on every request, never stored or client-supplied. */
export const roleFor = (config: Pick<Env, "ADMIN_EMAILS">, email: string): UserRole =>
  config.ADMIN_EMAILS.includes(email.trim().toLowerCase()) ? "admin" : "host";
export const sessionUser = (
  user: UserIdentity,
  config: Pick<Env, "ADMIN_EMAILS">,
): SessionUser => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  plan: user.plan === "unlimited" ? "Unlimited books" : "Free",
  role: roleFor(config, user.email),
});
const matches = (left: string, right: string) => {
  const a = Buffer.from(left, "hex"),
    b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
};
async function transaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  // Concurrent first-time upserts can hit a unique key rather than a write conflict.
  for (let attempt = 0; ; attempt++) {
    try {
      return await mongoose.connection.transaction(work);
    } catch (error) {
      if (attempt < 2 && (error as { code?: number }).code === 11000) continue;
      throw error;
    }
  }
}

export class AuthService {
  private dummyHash: Promise<string> | undefined;
  constructor(
    private readonly config: Env,
    private readonly mailer: AuthMailer,
    private readonly logger: Logger,
  ) {}

  private async grant(
    user: UserIdentity,
    remember: boolean,
    session: ClientSession,
  ): Promise<SessionGrant> {
    const seconds = remember
      ? this.config.JWT_REMEMBER_DAYS * 86400
      : this.config.JWT_SESSION_MINUTES * 60;
    const jti = randomUUID();
    const token = await signSession(
      this.config,
      user._id.toString(),
      user.authVersion,
      jti,
      seconds,
    );
    await AuthSession.create(
      [
        {
          _id: digest(jti),
          userId: user._id,
          authVersion: user.authVersion,
          expiresAt: new Date(Date.now() + seconds * 1000),
        },
      ],
      { session },
    );
    return { user: sessionUser(user, this.config), token, remember };
  }
  private backgroundEmail(send: () => Promise<void>) {
    // No recipient, OTP, reset URL, password or provider response goes into logs.
    void Promise.resolve()
      .then(send)
      .catch(() => this.logger.warn("auth_email_delivery_failed"));
  }

  async register(input: SignUpRequest) {
    this.mailer.assertConfigured();
    const passwordHash = await hashPassword(input.password, this.config.BCRYPT_ROUNDS);
    const code = makeCode();
    const result = await transaction(async (session) => {
      if (await User.exists({ email: input.email }).session(session))
        return new ApiError("EMAIL_TAKEN");
      const [user] = await User.create([{ name: input.name, email: input.email, passwordHash }], {
        session,
      });
      const now = new Date();
      await Otp.findOneAndUpdate(
        { email: input.email, purpose: "host-email" },
        {
          $set: {
            userId: user!._id,
            codeHash: hashCode(this.config, input.email, code),
            expiresAt: new Date(now.getTime() + this.config.OTP_TTL_MINUTES * 60000),
            lastSentAt: now,
            attempts: 0,
            consumedAt: null,
            authVersion: user!.authVersion,
          },
        },
        { upsert: true, session },
      );
      return { email: input.email };
    });
    if (result instanceof ApiError) throw result;
    // Never send mail inside a transaction callback, which MongoDB can retry.
    try {
      await this.mailer.sendVerification(input.email, code);
    } catch {
      throw new ApiError(
        "SERVER",
        "Verification email could not be delivered. Try resending the code.",
      );
    }
    return result;
  }

  async login(input: SignInRequest): Promise<SessionGrant> {
    const candidate = await User.findOne({ email: input.email }).select("+passwordHash");
    if (!candidate)
      this.dummyHash ??= hashPassword(randomBytes(32).toString("hex"), this.config.BCRYPT_ROUNDS);
    const hash = candidate?.passwordHash ?? (await this.dummyHash!);
    const correct = await comparePassword(input.password, hash);
    if (!candidate) throw new ApiError("INVALID_CREDENTIALS");
    const result = await transaction(async (session) => {
      const user = await User.findById(candidate._id).select("+passwordHash").session(session);
      if (!user || user.passwordHash !== hash) return new ApiError("INVALID_CREDENTIALS");
      const now = new Date();
      if (user.lockedUntil && user.lockedUntil > now) return new ApiError("ACCOUNT_LOCKED");
      if (user.lockedUntil) {
        user.failedLogins = 0;
        user.lockedUntil = null;
      }
      if (!correct) {
        user.failedLogins += 1;
        if (user.failedLogins >= LIMITS.signInAttempts) {
          user.lockedUntil = new Date(now.getTime() + LIMITS.lockMinutes * 60000);
        }
        await user.save({ session });
        return new ApiError(user.lockedUntil ? "ACCOUNT_LOCKED" : "INVALID_CREDENTIALS");
      }
      if (!user.emailVerified)
        return new ApiError("INVALID_CREDENTIALS", "Verify your email before signing in.");
      user.failedLogins = 0;
      user.lockedUntil = null;
      await user.save({ session });
      return this.grant(user, input.remember, session);
    });
    if (result instanceof ApiError) throw result;
    return result;
  }

  async verifyEmail(email: string, code: string, token?: string): Promise<SessionGrant> {
    let owner: AuthPrincipal | undefined;
    if (token) {
      try {
        owner = await this.authenticate(token);
      } catch (error) {
        if (!(error instanceof ApiError && error.code === "UNAUTHORIZED")) throw error;
      }
    }
    const result = await transaction(async (session) => {
      const pending =
        owner &&
        (await Otp.findOne({ userId: owner.userId, targetEmail: email, purpose: "account-email" })
          .select("+codeHash")
          .session(session));
      const otp =
        pending ||
        (await Otp.findOne({ email, purpose: "host-email" }).select("+codeHash").session(session));
      if (!otp || otp.consumedAt || otp.expiresAt <= new Date())
        return new ApiError("CODE_EXPIRED");
      if (otp.attempts >= this.config.OTP_MAX_ATTEMPTS) return new ApiError("RATE_LIMITED");
      otp.attempts += 1;
      if (!matches(otp.codeHash, hashCode(this.config, email, code))) {
        await otp.save({ session });
        return new ApiError(
          otp.attempts >= this.config.OTP_MAX_ATTEMPTS ? "RATE_LIMITED" : "INVALID_CODE",
        );
      }
      const user = await User.findById(otp.userId).session(session);
      if (
        !user ||
        user.email !== otp.email ||
        (!pending && user.emailVerified) ||
        user.authVersion !== otp.authVersion
      ) {
        return new ApiError("CODE_EXPIRED");
      }
      if (pending && owner) {
        if (
          !(await AuthSession.exists({
            _id: owner.sessionId,
            userId: user._id,
            authVersion: user.authVersion,
          }).session(session))
        )
          return new ApiError("UNAUTHORIZED");
        if (await User.exists({ email }).session(session)) return new ApiError("EMAIL_TAKEN");
        user.email = email;
        user.authVersion++;
        await AuthSession.deleteMany({ userId: user._id }, { session });
        await Otp.deleteMany({ userId: user._id, purpose: "password-reset" }, { session });
      }
      otp.consumedAt = new Date();
      user.emailVerified = true;
      await otp.save({ session });
      await user.save({ session });
      return this.grant(user, false, session);
    });
    if (result instanceof ApiError) throw result;
    return result;
  }

  private async issueChallenge(
    email: string,
    purpose: "host-email" | "password-reset",
    raw: string,
  ) {
    return transaction(async (session) => {
      const now = new Date();
      const previous = await Otp.findOne({ email, purpose }).session(session);
      if (
        previous &&
        now.getTime() - previous.lastSentAt.getTime() < LIMITS.otpResendSeconds * 1000
      ) {
        return new ApiError("RATE_LIMITED");
      }
      const user = await User.findOne({ email }).session(session);
      // Reserve cooldowns for unknown emails too, so response codes do not enumerate accounts.
      const eligible = user && (purpose !== "host-email" || !user.emailVerified) ? user : null;
      await Otp.findOneAndUpdate(
        { email, purpose },
        {
          $set: {
            userId: eligible?._id ?? null,
            authVersion: eligible?.authVersion ?? 0,
            codeHash: purpose === "host-email" ? hashCode(this.config, email, raw) : digest(raw),
            lastSentAt: now,
            consumedAt: null,
            attempts: 0,
            expiresAt: new Date(
              now.getTime() +
                (purpose === "host-email"
                  ? this.config.OTP_TTL_MINUTES
                  : this.config.PASSWORD_RESET_TTL_MINUTES) *
                  60000,
            ),
          },
        },
        { upsert: true, session },
      );
      return Boolean(eligible);
    });
  }
  async resendCode(email: string) {
    this.mailer.assertConfigured();
    const code = makeCode();
    const result = await this.issueChallenge(email, "host-email", code);
    if (result instanceof ApiError) throw result;
    if (result) this.backgroundEmail(() => this.mailer.sendVerification(email, code));
    return { ok: true as const };
  }
  async forgotPassword(email: string) {
    this.mailer.assertConfigured();
    const token = randomBytes(32).toString("hex");
    const result = await this.issueChallenge(email, "password-reset", token);
    if (result instanceof ApiError) throw result;
    if (result) {
      const url = this.config.CLIENT_URL + "/reset-password?token=" + encodeURIComponent(token);
      // Response timing/status is independent of SMTP delivery and account existence.
      this.backgroundEmail(() => this.mailer.sendPasswordReset(email, url));
    }
    return { ok: true as const };
  }
  async checkResetToken(token: string) {
    const otp = await Otp.findOne({ purpose: "password-reset", codeHash: digest(token) });
    if (!otp || !otp.userId || otp.consumedAt || otp.expiresAt <= new Date())
      throw new ApiError("TOKEN_EXPIRED");
    const user = await User.findById(otp.userId);
    if (!user || user.authVersion !== otp.authVersion) throw new ApiError("TOKEN_EXPIRED");
    return { ok: true as const };
  }
  async resetPassword(token: string, password: string) {
    await this.checkResetToken(token);
    const passwordHash = await hashPassword(password, this.config.BCRYPT_ROUNDS);
    const result = await transaction(async (session) => {
      const otp = await Otp.findOne({ purpose: "password-reset", codeHash: digest(token) }).session(
        session,
      );
      if (!otp || !otp.userId || otp.consumedAt || otp.expiresAt <= new Date())
        return new ApiError("TOKEN_EXPIRED");
      const user = await User.findById(otp.userId).session(session);
      if (!user || user.authVersion !== otp.authVersion) return new ApiError("TOKEN_EXPIRED");
      user.passwordHash = passwordHash;
      user.authVersion += 1;
      user.failedLogins = 0;
      user.lockedUntil = null;
      otp.consumedAt = new Date();
      await user.save({ session });
      await otp.save({ session });
      await AuthSession.deleteMany({ userId: user._id }).session(session);
      return { ok: true as const };
    });
    if (result instanceof ApiError) throw result;
    return result;
  }
  async authenticate(token: string | undefined): Promise<AuthPrincipal> {
    if (!token) throw new ApiError("UNAUTHORIZED");
    const claims = await verifySession(this.config, token);
    const sessionId = digest(claims.jti);
    const session = await AuthSession.findById(sessionId);
    if (
      !session ||
      session.userId.toString() !== claims.sub ||
      session.expiresAt <= new Date() ||
      session.authVersion !== claims.version
    )
      throw new ApiError("UNAUTHORIZED");
    const user = await User.findById(claims.sub);
    if (
      !user ||
      !user.emailVerified ||
      !isGmailAccountEmail(user.email) ||
      user.authVersion !== claims.version
    )
      throw new ApiError("UNAUTHORIZED");
    return {
      user: sessionUser(user, this.config),
      userId: claims.sub,
      sessionId,
      authVersion: claims.version,
      renewal: { jti: claims.jti, lifetime: claims.exp - claims.iat, expiresAt: session.expiresAt },
    };
  }
  /**
   * Sliding expiry for short ("don't keep me signed in") sessions: an active host is not
   * signed out mid-edit. Remember-me sessions keep their fixed lifetime. Returns a new
   * token when the session was extended, otherwise undefined.
   */
  async renew(principal: AuthPrincipal): Promise<string | undefined> {
    const short = this.config.JWT_SESSION_MINUTES * 60;
    const info = principal.renewal;
    if (!info || info.lifetime > short) return undefined;
    if (info.expiresAt.getTime() - Date.now() > (short * 1000) / 2) return undefined;
    const expiresAt = new Date(Date.now() + short * 1000);
    const changed = await AuthSession.updateOne(
      { _id: principal.sessionId, authVersion: principal.authVersion, expiresAt: info.expiresAt },
      { $set: { expiresAt } },
    );
    if (!changed.modifiedCount) return undefined;
    return signSession(this.config, principal.userId, principal.authVersion, info.jti, short);
  }
  async logout(token: string | undefined) {
    if (!token) return;
    let claims;
    try {
      claims = await verifySession(this.config, token);
    } catch (error) {
      if (error instanceof ApiError && error.code === "UNAUTHORIZED") return;
      throw error;
    }
    await AuthSession.deleteOne({ _id: digest(claims.jti), userId: claims.sub });
  }
}
