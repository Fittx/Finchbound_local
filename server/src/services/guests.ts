import { publishFeed } from "./feed.js";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Types, trusted, type ClientSession } from "mongoose";
import type { Env } from "../config/env.js";
import type { AuthMailer } from "./mail.js";
import type { AuthPrincipal } from "./auth.js";
import type { GuestEvent } from "../../../shared/types/guest.js";
import type { GuestEntryInput, GuestReportInput } from "../validators/guests.js";
import { LIMITS } from "../../../shared/constants.js";
import { Book } from "../models/Book.js";
import { Upload } from "../models/Upload.js";
import { UploadGrant } from "../models/UploadGrant.js";
import { Submission } from "../models/Submission.js";
import { Report } from "../models/Report.js";
import { BlockedGuest } from "../models/BlockedGuest.js";
import { GuestOtp } from "../models/GuestOtp.js";
import { GuestVerification } from "../models/GuestVerification.js";
import { ApiError } from "../utils/ApiError.js";
import { transaction } from "../utils/transaction.js";
import { authorizeOwner } from "../middleware/requireOwner.js";
import { consumeQuota } from "./uploadQuota.js";
import { PER_GUEST, scaledGuestLimit } from "./guestLimits.js";
import { verifyUploadToken } from "./uploadTokens.js";
import { assertGuestNotBlocked, guestEmailToken, verifyGuestEmailToken } from "./guestSecurity.js";
import { makeCode, digest } from "./tokens.js";
import { assetUrl } from "./assetReferences.js";
import { bookDto } from "./books.js";
const sameHash = (left: string, right: string) => {
  const a = Buffer.from(left, "hex"),
    b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
};
export class GuestService {
  constructor(
    private readonly config: Env,
    private readonly mailer: AuthMailer,
  ) {}
  /**
   * One device gets the base limit. The venue IP and the whole book share a ceiling sized
   * from the host's expected guest count, so a crowd on one Wi-Fi is not one "client".
   */
  async quota(action: keyof typeof PER_GUEST, ip: string, slug: string, fingerprint: string) {
    const base =
      action === "event" || action === "submit"
        ? this.config.RATE_LIMIT_MAX_REQUESTS
        : this.config.AUTH_RATE_LIMIT_MAX_REQUESTS;
    const book = await Book.findOne({ slug, deletedAt: null }).select("expectedGuests").lean();
    const shared = scaledGuestLimit(base, book?.expectedGuests, PER_GUEST[action]);
    await consumeQuota(this.config, `guest:${action}:device:${fingerprint}`, base);
    await consumeQuota(this.config, `guest:${action}:ip:${ip}`, shared);
    await consumeQuota(this.config, `guest:${action}:book:${slug}`, shared);
  }
  private async book(slug: string, session?: ClientSession, collecting = false) {
    const book = await Book.findOne({ slug, kind: "event", deletedAt: null }).session(
      session ?? null,
    );
    if (!book) throw new ApiError("NOT_FOUND");
    if (collecting && book.collectionStatus !== "open")
      throw new ApiError("CONFLICT", "This event is not collecting entries.");
    return book;
  }
  /** Shared parent write serializes closing/deletion/blocking with guest mutations. */
  private async lock(bookId: Types.ObjectId, session: ClientSession, entries = 0) {
    const result = await Book.updateOne(
      { _id: bookId, deletedAt: null },
      { $inc: { guestVersion: 1, entriesCount: entries } },
      { session, timestamps: false },
    );
    if (!result.matchedCount) throw new ApiError("NOT_FOUND");
  }
  private async proof(slug: string, token: string, session?: ClientSession) {
    let claims;
    try {
      claims = verifyUploadToken(this.config, token, "guest-captcha");
    } catch {
      throw new ApiError("CAPTCHA_FAILED", "Refresh the human verification challenge.");
    }
    const book = await this.book(slug, session, true);
    if (claims.bookId !== book._id.toString()) throw new ApiError("CAPTCHA_FAILED");
    const grant = await UploadGrant.findOne({
      _id: claims.jti,
      bookId: book._id,
      draftId: claims.draftId,
      consumedAt: null,
      expiresAt: trusted({ $gt: new Date() }),
    }).session(session ?? null);
    if (!grant?.fingerprint)
      throw new ApiError("CAPTCHA_FAILED", "Refresh the human verification challenge.");
    await assertGuestNotBlocked(book._id, { fingerprint: grant.fingerprint }, session);
    return { book, grant };
  }
  private codeHash(bookId: string, email: string, draftId: string, grantId: string, code: string) {
    return createHmac("sha256", this.config.JWT_SECRET)
      .update(JSON.stringify(["guest-email", bookId, email, draftId, grantId, code]))
      .digest("hex");
  }
  async event(slug: string): Promise<GuestEvent> {
    const book = await this.book(slug),
      dto = bookDto(book);
    return {
      slug: dto.slug,
      title: dto.title,
      hosts: book.hosts ?? "",
      prompt: book.prompt ?? "",
      theme: dto.theme,
      font: dto.font,
      lines: dto.lines,
      access: dto.access,
      photoRequired: dto.photoRequired,
      messageRequired: dto.messageRequired,
      status: book.collectionStatus,
      readerAvailable: book.live && book.visibility === "link",
    };
  }
  async bookId(slug: string) {
    return (await this.book(slug))._id.toString();
  }
  async sendCode(slug: string, email: string, proof: string) {
    const context = await this.proof(slug, proof);
    await assertGuestNotBlocked(context.book._id, { email });
    this.mailer.assertConfigured();
    const code = makeCode();
    await transaction(async (session) => {
      const { book, grant } = await this.proof(slug, proof, session);
      await assertGuestNotBlocked(book._id, { email }, session);
      await this.lock(book._id, session);
      const previous = await GuestOtp.findOne({ bookId: book._id, email }).session(session);
      const now = new Date();
      if (
        previous &&
        now.getTime() - previous.lastSentAt.getTime() < LIMITS.otpResendSeconds * 1000
      )
        throw new ApiError("RATE_LIMITED");
      await GuestOtp.findOneAndUpdate(
        { bookId: book._id, email },
        {
          $set: {
            draftId: grant.draftId,
            grantId: grant._id,
            codeHash: this.codeHash(book._id.toString(), email, grant.draftId, grant._id, code),
            expiresAt: new Date(now.getTime() + this.config.OTP_TTL_MINUTES * 60000),
            lastSentAt: now,
            attempts: 0,
            consumedAt: null,
          },
        },
        { upsert: true, session },
      );
    });
    try {
      await this.mailer.sendVerification(email, code);
    } catch {
      throw new ApiError(
        "SERVER",
        "The verification email could not be delivered. Try resending the code.",
      );
    }
    return { ok: true as const };
  }
  async confirmCode(slug: string, email: string, code: string, proof: string) {
    const result = await transaction(async (session) => {
      const { book, grant } = await this.proof(slug, proof, session);
      await assertGuestNotBlocked(book._id, { email }, session);
      await this.lock(book._id, session);
      const otp = await GuestOtp.findOne({
        bookId: book._id,
        email,
        draftId: grant.draftId,
        grantId: grant._id,
      })
        .select("+codeHash")
        .session(session);
      if (!otp || otp.consumedAt || otp.expiresAt <= new Date())
        return new ApiError("CODE_EXPIRED");
      if (otp.attempts >= this.config.OTP_MAX_ATTEMPTS) return new ApiError("RATE_LIMITED");
      const hash = this.codeHash(book._id.toString(), email, grant.draftId, grant._id, code);
      if (!sameHash(hash, otp.codeHash)) {
        otp.attempts++;
        await otp.save({ session });
        return new ApiError(
          otp.attempts >= this.config.OTP_MAX_ATTEMPTS ? "RATE_LIMITED" : "INVALID_CODE",
        );
      }
      otp.consumedAt = new Date();
      await otp.save({ session });
      const jti = randomUUID(),
        expiresAt = new Date(
          Math.min(grant.expiresAt.getTime(), Date.now() + this.config.OTP_TTL_MINUTES * 60000),
        );
      await GuestVerification.create(
        [
          {
            _id: digest(jti),
            bookId: book._id,
            draftId: grant.draftId,
            grantId: grant._id,
            email,
            expiresAt,
          },
        ],
        { session },
      );
      return {
        value: {
          purpose: "guest-email" as const,
          bookId: book._id.toString(),
          draftId: grant.draftId,
          email,
          jti,
        },
        expiresAt,
      };
    });
    if (result instanceof ApiError) throw result;
    return {
      token: guestEmailToken(this.config, result.value, result.expiresAt),
      bookId: result.value.bookId,
      expiresAt: result.expiresAt,
    };
  }
  async submit(slug: string, input: GuestEntryInput, emailToken?: string) {
    return transaction(async (session) => {
      const { book, grant } = await this.proof(slug, input.captcha, session);
      await assertGuestNotBlocked(
        book._id,
        { email: input.email, fingerprint: grant.fingerprint },
        session,
      );
      const fields: Record<string, string> = {};
      if (book.rules.access !== "email" && !input.name) fields.name = "Add your name";
      if (book.rules.access !== "name" && !input.email)
        fields.email = "Verify an email before submitting";
      if (book.rules.photoRequired && !input.photo) fields.photo = "Add a photo to continue";
      if (book.rules.messageRequired && !input.message)
        fields.message = "Write a message to continue";
      if (Object.keys(fields).length) throw new ApiError("VALIDATION_FAILED", undefined, fields);
      const submissionId = new Types.ObjectId();
      await this.lock(book._id, session, 1);
      let verified = false;
      if (book.rules.access !== "name") {
        const claims = verifyGuestEmailToken(this.config, emailToken);
        if (
          claims.bookId !== book._id.toString() ||
          claims.draftId !== grant.draftId ||
          claims.email !== input.email
        )
          throw new ApiError("UNAUTHORIZED", "Verify this guest email before submitting.");
        const proof = await GuestVerification.findOneAndUpdate(
          {
            _id: digest(claims.jti),
            bookId: book._id,
            draftId: grant.draftId,
            grantId: grant._id,
            email: input.email,
            consumedAt: null,
            expiresAt: trusted({ $gt: new Date() }),
          },
          { $set: { consumedAt: new Date() } },
          { session },
        );
        if (!proof)
          throw new ApiError("UNAUTHORIZED", "Verify this guest email before submitting.");
        verified = true;
      }
      let photoUrl: string | undefined;
      if (input.photo) {
        const photo = await Upload.findOneAndUpdate(
          {
            _id: input.photo,
            bookId: book._id,
            draftId: grant.draftId,
            ownerId: null,
            status: "ready",
            submissionId: null,
          },
          { $set: { submissionId } },
          { session },
        );
        if (!photo || !photo.renditions.has("page"))
          throw new ApiError("UPLOAD_FAILED", "Upload this draft's photo before submitting.");
        photoUrl = assetUrl(photo._id.toString());
      }
      await Submission.create(
        [
          {
            _id: submissionId,
            bookId: book._id,
            draftId: grant.draftId,
            guestName: input.name,
            ...(input.signoff !== undefined ? { guestSignoff: input.signoff } : {}),
            guestEmail: input.email,
            emailVerified: verified,
            fingerprint: grant.fingerprint!,
            message: input.message,
            ...(photoUrl ? { photoUrl, uploadId: new Types.ObjectId(input.photo) } : {}),
            status: book.rules.access === "strict" ? "pending" : "approved",
          },
        ],
        { session },
      );
      const consumed = await UploadGrant.updateOne(
        { _id: grant._id, consumedAt: null },
        { $set: { consumedAt: new Date() } },
        { session },
      );
      if (!consumed.modifiedCount) throw new ApiError("CAPTCHA_FAILED");
      await publishFeed(book._id, session, "submission", [submissionId]);
      return { status: book.rules.access === "strict" ? ("pending" as const) : ("added" as const) };
    });
  }
  async report(slug: string, input: GuestReportInput, fingerprint: string) {
    return transaction(async (session) => {
      const book = await this.book(slug, session);
      await assertGuestNotBlocked(book._id, { fingerprint }, session);
      if (
        input.submissionId &&
        !(await Submission.exists({ _id: input.submissionId, bookId: book._id }).session(session))
      )
        throw new ApiError("NOT_FOUND");
      await this.lock(book._id, session);
      await Report.create(
        [
          {
            bookId: book._id,
            submissionId: input.submissionId ?? null,
            reason: input.reason,
            details: input.details,
          },
        ],
        { session },
      );
      if (input.submissionId)
        await publishFeed(book._id, session, "submission:updated", [input.submissionId]);
      if (input.submissionId)
        await Submission.updateOne(
          { _id: input.submissionId, bookId: book._id },
          { $inc: { reportedCount: 1 } },
          { session },
        );
      return { ok: true as const };
    });
  }
  async block(auth: AuthPrincipal, bookId: string, submissionId: string) {
    return transaction(async (session) => {
      const book = await Book.findOne({ _id: bookId, deletedAt: null }).session(session);
      if (!book) throw new ApiError("NOT_FOUND");
      authorizeOwner(auth, book.ownerId.toString());
      const submission = await Submission.findOne({ _id: submissionId, bookId: book._id })
        .select("+fingerprint")
        .session(session);
      if (!submission) throw new ApiError("NOT_FOUND");
      await this.lock(book._id, session);
      // Never let an unverified, volunteered address block its real owner.
      const email = submission.emailVerified ? submission.guestEmail : "";
      const matches = [
        ...(email ? [{ email }] : []),
        ...(submission.fingerprint ? [{ fingerprint: submission.fingerprint }] : []),
      ];
      if (!matches.length)
        throw new ApiError("CONFLICT", "There is no verified guest identity to block.");
      const existing = await BlockedGuest.find({ bookId: book._id, $or: matches }).session(session);
      if (
        matches.every((identity) =>
          existing.some((blocked) =>
            "email" in identity
              ? blocked.email === identity.email
              : blocked.fingerprint === identity.fingerprint,
          ),
        )
      )
        throw new ApiError("CONFLICT", "This guest is already blocked.");
      for (const identity of matches)
        await BlockedGuest.updateOne(
          { bookId: book._id, ...identity },
          { $setOnInsert: identity },
          { upsert: true, session },
        );
      const filters = [
        ...(email ? [{ guestEmail: email, emailVerified: true }] : []),
        ...(submission.fingerprint ? [{ fingerprint: submission.fingerprint }] : []),
      ];
      const blocked = await Submission.find({ bookId: book._id, $or: filters })
        .select("_id")
        .session(session);
      await publishFeed(book._id, session, "reset", [null]);
      return { blockedSubmissionIds: blocked.map((row) => row._id.toString()) };
    });
  }
}
