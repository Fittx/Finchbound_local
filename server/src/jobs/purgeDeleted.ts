import { Feedback } from "../models/Feedback.js";
import { trusted, Types, type ClientSession } from "mongoose";
import { LIMITS } from "../../../shared/constants.js";
import type { ObjectStorage } from "../config/storage.js";
import { Book } from "../models/Book.js";
import { Page } from "../models/Page.js";
import { Submission } from "../models/Submission.js";
import { Report } from "../models/Report.js";
import { BlockedGuest } from "../models/BlockedGuest.js";
import { GuestOtp } from "../models/GuestOtp.js";
import { GuestVerification } from "../models/GuestVerification.js";
import { FeedEvent } from "../models/FeedEvent.js";
import { Upload } from "../models/Upload.js";
import { UploadGrant } from "../models/UploadGrant.js";
import { transaction } from "../utils/transaction.js";

const retired = {
  status: "failed",
  cleanupNeeded: true,
  ownerId: null,
  bookId: null,
  draftId: null,
  submissionId: null,
};
export async function purgeBook(bookId: Types.ObjectId, session: ClientSession) {
  const scope = { bookId };
  await Feedback.deleteMany(scope, { session });
  await Page.deleteMany(scope, { session });
  await Submission.deleteMany(scope, { session });
  await Report.deleteMany(scope, { session });
  await BlockedGuest.deleteMany(scope, { session });
  await GuestOtp.deleteMany(scope, { session });
  await GuestVerification.deleteMany(scope, { session });
  await FeedEvent.deleteMany(scope, { session });
  await UploadGrant.deleteMany(scope, { session });
  await Upload.updateMany(scope, { $set: retired }, { session });
  await Book.deleteOne({ _id: bookId }, { session });
}
export async function purgeAccountBooks(ownerId: Types.ObjectId, session: ClientSession) {
  const books = await Book.find({ ownerId }).select("_id").session(session);
  for (const book of books) await purgeBook(book._id, session);
  await Upload.updateMany({ ownerId }, { $set: retired }, { session });
}
export async function purgeDeleted(storage: ObjectStorage, now = new Date()) {
  const expired = trusted({
    $lte: new Date(now.getTime() - LIMITS.undoMs),
    $type: "date" as const,
  });
  const books = await Book.find({ deletedAt: expired }).select("_id").limit(50);
  for (const book of books)
    await transaction(async (session) => {
      if (await Book.exists({ _id: book._id, deletedAt: expired }).session(session))
        await purgeBook(book._id, session);
    });
  const old = trusted({ $lt: new Date(now.getTime() - 86400000) });
  await Upload.updateMany(
    {
      updatedAt: old,
      status: "ready",
      submissionId: null,
      $or: [{ bookId: null }, { draftId: trusted({ $type: "string" }) }],
    },
    { $set: retired },
  );
  await Upload.updateMany({ updatedAt: old, status: "quarantine" }, { $set: retired });
  // Previously placed host photos can lose their last reference after an edit.
  const attached = await Upload.find({
    status: "ready",
    ownerId: trusted({ $ne: null }),
    bookId: trusted({ $ne: null }),
    updatedAt: old,
  })
    .sort({ updatedAt: 1 })
    .limit(100)
    .select("_id");
  for (const candidate of attached)
    await transaction(async (session) => {
      const asset = await Upload.findOne({
        _id: candidate._id,
        status: "ready",
        updatedAt: old,
      }).session(session);
      if (!asset?.bookId) return;
      // Serialize against page writes before deciding whether any page still uses it.
      await Book.updateOne(
        { _id: asset.bookId },
        { $inc: { guestVersion: 1 } },
        { session, timestamps: false },
      );
      const urls = Array.from(
        asset.renditions.keys(),
        (size) => `/api/uploads/${asset._id}/${size}`,
      );
      const used = await Page.exists({
        bookId: asset.bookId,
        $or: [{ imageUrl: trusted({ $in: urls }) }, { cardImageUrl: trusted({ $in: urls }) }],
      }).session(session);
      await Upload.updateOne(
        { _id: asset._id },
        { $set: used ? { updatedAt: now } : retired },
        { session },
      );
    });
  const queue = await Upload.find({ status: "failed" }).sort({ updatedAt: 1 }).limit(100);
  let failed = 0;
  for (const upload of queue) {
    try {
      if (upload.cleanupNeeded) for (const key of upload.keys) await storage.remove(key);
      await Upload.deleteOne({ _id: upload._id, status: "failed", __v: upload.__v });
    } catch {
      failed++;
      await Upload.updateOne(
        { _id: upload._id, status: "failed" },
        { $set: { cleanupNeeded: true } },
      );
    }
  }
  return { failed };
}
