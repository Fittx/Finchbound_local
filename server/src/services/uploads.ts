import { User } from "../models/User.js";
import { transaction } from "../utils/transaction.js";
import { createHash, randomUUID } from "node:crypto";
import { Types, trusted } from "mongoose";
import type { Env } from "../config/env.js";
import type { ObjectStorage } from "../config/storage.js";
import type { CaptchaVerifier } from "./captcha.js";
import type { AuthPrincipal } from "./auth.js";
import type { Logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";
import { Book } from "../models/Book.js";
import { Upload } from "../models/Upload.js";
import { UploadGrant } from "../models/UploadGrant.js";
import { consumeQuota } from "./uploadQuota.js";
import { PER_GUEST, scaledGuestLimit } from "./guestLimits.js";
import { signUploadToken, verifyUploadToken, type UploadClaims } from "./uploadTokens.js";
import { processImage, type RenditionName } from "./images.js";
import { assetUrl } from "./assetReferences.js";
import { BookService } from "./books.js";
import type { CaptchaInput } from "../validators/uploads.js";
import type { UploadedImage } from "../middleware/upload.js";
import { assertGuestNotBlocked } from "./guestSecurity.js";
import { Submission } from "../models/Submission.js";
export type UploadIdentity =
  | { ownerId: string; bookId?: never; draftId?: never; grant?: never; expectedGuests?: never }
  | {
      ownerId?: never;
      bookId: string;
      draftId: string;
      grant: string;
      expectedGuests?: number | null;
    };
export class UploadService {
  constructor(
    private readonly config: Env,
    private readonly storage: ObjectStorage,
    private readonly captcha: CaptchaVerifier,
    private readonly logger: Logger,
  ) {}
  private async openBook(bookId: string) {
    const book = await Book.findOne({ _id: bookId, deletedAt: null, kind: "event" });
    if (!book) throw new ApiError("NOT_FOUND");
    if (book.collectionStatus !== "open")
      throw new ApiError("CONFLICT", "This event is not collecting entries.");
    return book;
  }
  async issue(input: CaptchaInput, ip: string, fingerprint: string) {
    this.storage.assertConfigured();
    const base = this.config.RATE_LIMIT_MAX_REQUESTS;
    await consumeQuota(this.config, "captcha:device:" + fingerprint, base);
    const book = await Book.findOne({ slug: input.bookSlug, deletedAt: null, kind: "event" });
    const shared = scaledGuestLimit(base, book?.expectedGuests, PER_GUEST.captcha);
    await consumeQuota(this.config, "captcha:ip:" + ip, shared);
    if (!book) throw new ApiError("NOT_FOUND");
    await this.openBook(book._id.toString());
    await assertGuestNotBlocked(book._id, { fingerprint });
    if (await Submission.exists({ bookId: book._id, draftId: input.draftId }))
      throw new ApiError("CONFLICT", "Start a new draft to submit another entry.");
    await consumeQuota(this.config, "captcha:book:" + book._id, shared);
    await this.captcha.verify(input.token, ip, input.bookSlug + "_" + input.draftId);
    const grant = randomUUID(),
      expiresAt = new Date(Date.now() + this.config.UPLOAD_TOKEN_TTL_SECONDS * 1000);
    try {
      await UploadGrant.create({
        _id: grant,
        providerHash: createHash("sha256").update(input.token).digest("hex"),
        bookId: book._id,
        draftId: input.draftId,
        expiresAt,
        fingerprint,
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw new ApiError("CAPTCHA_FAILED", "Refresh the human verification challenge.");
      throw error;
    }
    const value = { bookId: book._id.toString(), draftId: input.draftId, jti: grant };
    return {
      token: signUploadToken(this.config, { ...value, purpose: "guest-captcha" }),
      uploadToken: signUploadToken(this.config, { ...value, purpose: "guest-upload" }),
      expiresAt: expiresAt.toISOString(),
    };
  }
  async guestIdentity(token: string): Promise<UploadIdentity> {
    const claims = verifyUploadToken(this.config, token, "guest-upload");
    const book = await this.openBook(claims.bookId);
    const grant = await UploadGrant.findOneAndUpdate(
      {
        _id: claims.jti,
        consumedAt: null,
        bookId: new Types.ObjectId(claims.bookId),
        draftId: claims.draftId,
        expiresAt: trusted({ $gt: new Date() }),
        uses: trusted({ $lt: this.config.UPLOAD_MAX_PER_DRAFT }),
      },
      { $inc: { uses: 1 } },
    );
    if (!grant)
      throw new ApiError("RATE_LIMITED", "Upload authorization expired or its limit was reached.");
    await assertGuestNotBlocked(grant.bookId, { fingerprint: grant.fingerprint });
    return {
      bookId: claims.bookId,
      draftId: claims.draftId,
      grant: claims.jti,
      expectedGuests: book.expectedGuests ?? null,
    };
  }
  async quota(identity: UploadIdentity, ip: string) {
    this.storage.assertConfigured();
    // Guests at one venue share an IP; their ceiling scales with the event size.
    const limit = identity.ownerId
      ? this.config.RATE_LIMIT_MAX_REQUESTS
      : scaledGuestLimit(
          this.config.RATE_LIMIT_MAX_REQUESTS,
          identity.expectedGuests,
          this.config.UPLOAD_MAX_PER_DRAFT,
        );
    await consumeQuota(this.config, "upload:ip:" + ip, limit);
    await consumeQuota(
      this.config,
      identity.ownerId ? "upload:owner:" + identity.ownerId : "upload:book:" + identity.bookId,
      limit,
    );
    if (identity.bookId)
      await consumeQuota(
        this.config,
        "upload:draft:" + identity.bookId + ":" + identity.draftId,
        this.config.UPLOAD_MAX_PER_DRAFT,
        this.config.UPLOAD_TOKEN_TTL_SECONDS * 1000,
      );
  }
  async save(identity: UploadIdentity, file: UploadedImage) {
    this.storage.assertConfigured();
    if (identity.bookId) await this.assertGuestUpload(identity);
    const id = new Types.ObjectId(),
      quarantine = this.config.STORAGE_QUARANTINE_PREFIX + id;
    const keys = [
      quarantine,
      ...["thumbnail", "page", "lightbox"].map((name) => `validated/${id}/${name}.jpg`),
    ];
    const upload = await transaction(async (session) => {
      if (identity.ownerId) {
        const owner = await User.updateOne(
          { _id: identity.ownerId },
          { $inc: { resourceVersion: 1 } },
          { session, timestamps: false },
        );
        if (!owner.matchedCount) throw new ApiError("UNAUTHORIZED");
      } else {
        const parent = await Book.updateOne(
          { _id: identity.bookId, deletedAt: null, collectionStatus: "open" },
          { $inc: { guestVersion: 1 } },
          { session, timestamps: false },
        );
        if (!parent.matchedCount) throw new ApiError("NOT_FOUND");
      }
      const row = new Upload({
        _id: id,
        ownerId: identity.ownerId ?? null,
        bookId: identity.bookId ?? null,
        draftId: identity.draftId ?? null,
        originalBytes: file.size,
        keys,
      });
      await row.save({ session });
      row.$session(null);
      return row;
    });
    try {
      await this.storage.put(quarantine, file.buffer, "application/octet-stream");
      const images = await processImage(file.buffer, file.mimetype, this.config);
      for (const image of images) {
        const key = `validated/${id}/${image.name}.jpg`;
        await this.storage.put(key, image.buffer, "image/jpeg");
        upload.renditions.set(image.name, {
          key,
          width: image.width,
          height: image.height,
          bytes: image.buffer.length,
        });
      }
      await this.storage.remove(quarantine);
      if (identity.bookId) await this.assertGuestUpload(identity);
      upload.$where = { status: "quarantine" };
      upload.status = "ready";
      upload.keys = keys.slice(1);
      upload.contentHash = createHash("sha256").update(file.buffer).digest("hex");
      await upload.save();
      let url = assetUrl(id.toString());
      if (identity.bookId && identity.draftId && identity.grant) {
        const previewToken = signUploadToken(this.config, {
          purpose: "asset-preview",
          bookId: identity.bookId,
          draftId: identity.draftId,
          jti: identity.grant,
          uploadId: id.toString(),
        });
        url += "?previewToken=" + encodeURIComponent(previewToken);
      }
      return { uploadId: id.toString(), url };
    } catch (error) {
      const removed = await Promise.allSettled(keys.map((key) => this.storage.remove(key)));
      const cleanupNeeded = removed.some((result) => result.status === "rejected");
      // A deletion worker may already have retired the in-flight upload. Recreate
      // only the cleanup record if the last object removal still needs a retry.
      await Upload.updateOne(
        { _id: id },
        {
          $set: { status: "failed", cleanupNeeded, keys },
          $setOnInsert: { originalBytes: file.size },
          $inc: { __v: 1 },
        },
        { upsert: cleanupNeeded },
      ).catch(() =>
        this.logger.warn("upload_failure_state_write_failed", { uploadId: id.toString() }),
      );
      if (cleanupNeeded) this.logger.warn("upload_cleanup_needed", { uploadId: id.toString() });
      if (error instanceof ApiError) throw error;
      throw new ApiError("UPLOAD_FAILED");
    }
  }
  private async assertGuestUpload(identity: UploadIdentity) {
    if (!identity.bookId) return;
    await this.openBook(identity.bookId);
    const grant = await UploadGrant.findOne({
      _id: identity.grant,
      bookId: identity.bookId,
      draftId: identity.draftId,
      consumedAt: null,
      expiresAt: trusted({ $gt: new Date() }),
    });
    if (!grant) throw new ApiError("UNAUTHORIZED");
    await assertGuestNotBlocked(grant.bookId, { fingerprint: grant.fingerprint });
  }
  async read(id: string, size: RenditionName, auth?: AuthPrincipal, previewToken?: string) {
    const upload = await Upload.findOne({ _id: id, status: "ready" });
    if (!upload) throw new ApiError("NOT_FOUND");
    // Admins review reported photos; the role is re-derived from server config per request.
    let allowed =
      auth?.user.role === "admin" ||
      Boolean(auth && upload.ownerId && auth.userId === upload.ownerId.toString());
    if (!allowed && previewToken) {
      const claims = verifyUploadToken(this.config, previewToken, "asset-preview");
      allowed =
        claims.purpose === "asset-preview" &&
        claims.uploadId === id &&
        claims.bookId === upload.bookId?.toString() &&
        claims.draftId === upload.draftId;
      if (allowed)
        allowed = Boolean(
          await UploadGrant.exists({
            _id: claims.jti,
            bookId: new Types.ObjectId(claims.bookId),
            draftId: claims.draftId,
            expiresAt: trusted({ $gt: new Date() }),
          }),
        );
      if (allowed && upload.bookId) await this.openBook(upload.bookId.toString());
    }
    if (!allowed && upload.bookId) {
      const book = await Book.findOne({ _id: upload.bookId, deletedAt: null });
      if (book) {
        if (auth?.userId === book.ownerId.toString()) allowed = true;
        else {
          try {
            const view = await new BookService(this.config.JWT_SECRET).publicBook(book.slug);
            allowed = view.pages.some((p) =>
              [p.image, p.cardImage].some((url) =>
                url?.split("?")[0]?.startsWith(`/api/uploads/${id}/`),
              ),
            );
          } catch (error) {
            if (!(error instanceof ApiError && error.code === "NOT_FOUND")) throw error;
          }
        }
      }
    }
    if (!allowed) throw new ApiError("NOT_FOUND");
    // Deleted books revoke attached assets even for owners.
    if (upload.bookId && !(await Book.exists({ _id: upload.bookId, deletedAt: null })))
      throw new ApiError("NOT_FOUND");
    const rendition = upload.renditions.get(size);
    if (!rendition) throw new ApiError("NOT_FOUND");
    return this.storage.get(rendition.key);
  }
}
