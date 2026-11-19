import { publishFeed } from "./feed.js";
import { Types, trusted, type ClientSession, type HydratedDocument } from "mongoose";
import { ANONYMOUS_GUEST, LIMITS } from "../../../shared/constants.js";
import type {
  AddToBookResponse,
  BulkModerateRequest,
  BulkModerateResponse,
  ListSubmissionsResponse,
  ReactionResponse,
  Submission as HostEntry,
  UpdateSubmissionStatusResponse,
  SubmissionCounts,
  SubmissionStatus,
} from "../../../shared/types/submissions.js";
import { Book, type BookRecord } from "../models/Book.js";
import { Submission } from "../models/Submission.js";
import { Page } from "../models/Page.js";
import { Report } from "../models/Report.js";
import { Upload } from "../models/Upload.js";
import { authorizeOwner } from "../middleware/requireOwner.js";
import { ApiError } from "../utils/ApiError.js";
import { CursorCodec } from "../utils/cursor.js";
import { transaction } from "../utils/transaction.js";
import { pageDto } from "./books.js";
import { hostEntries, type Entry } from "./hostEntries.js";
import type { AuthPrincipal } from "./auth.js";
import type { ModerationQuery } from "../validators/moderation.js";

type Parent = HydratedDocument<BookRecord>;

async function owned(auth: AuthPrincipal, id: string | Types.ObjectId, session: ClientSession) {
  const book = await Book.findOne({ _id: id, deletedAt: null }).session(session);
  if (!book) throw new ApiError("NOT_FOUND");
  authorizeOwner(auth, String(book.ownerId));
  return book;
}

// All moderation writes touch the same parent as page edits, guest writes and book deletion.
async function withEntry<T>(
  auth: AuthPrincipal,
  id: string,
  event: "submission:updated" | "reaction:updated" | "submission:deleted",
  work: (entry: Entry, book: Parent, session: ClientSession) => Promise<T>,
) {
  return transaction(async (session) => {
    const entry = await Submission.findById(id).select("+fingerprint").session(session);
    if (!entry) throw new ApiError("NOT_FOUND");
    const book = await owned(auth, entry.bookId, session);
    const result = await work(entry, book, session);
    await publishFeed(book._id, session, event, [entry._id]);
    book.guestVersion++;
    await book.save({ session });
    return result;
  });
}

async function changeStatus(
  entry: Entry,
  book: Parent,
  session: ClientSession,
  status: SubmissionStatus,
  pageId?: string,
) {
  const before = entry.status;
  const undo =
    entry.previousStatus === status && entry.undoUntil && entry.undoUntil.getTime() >= Date.now();
  const regular =
    (status === "approved" && (before === "pending" || before === "rejected")) ||
    (status === "rejected" && before !== "rejected");
  if (!regular && !undo)
    throw new ApiError("CONFLICT", "This entry has changed. Refresh the feed.");
  let removedPageId: string | undefined;
  if (status === "in-book") {
    if (!undo || !pageId || String(entry.previousPageId) !== pageId) throw new ApiError("CONFLICT");
    const page = await Page.findOne({
      _id: pageId,
      bookId: book._id,
      submissionId: entry._id,
      deletedAt: trusted({ $ne: null }),
    }).session(session);
    if (!page) throw new ApiError("CONFLICT");
    if (
      await Page.exists({ bookId: book._id, deletedAt: null, order: page.order }).session(session)
    )
      await Page.updateMany(
        { bookId: book._id, deletedAt: null, order: trusted({ $gte: page.order }) },
        { $inc: { order: 1 } },
        { session, timestamps: false },
      );
    page.deletedAt = null;
    await page.save({ session });
    entry.pageId = page._id;
    book.version++;
  } else if (before === "in-book") {
    const removed = await Page.findOneAndUpdate(
      { _id: entry.pageId, bookId: book._id, submissionId: entry._id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { session },
    );
    if (!removed) throw new ApiError("CONFLICT");
    removedPageId = String(removed._id);
    entry.pageId = null;
    book.version++;
  }
  if (entry.previousPageId && status !== "in-book") {
    await Page.deleteOne(
      {
        _id: entry.previousPageId,
        bookId: book._id,
        submissionId: entry._id,
        deletedAt: trusted({ $ne: null }),
      },
      { session },
    );
  }
  entry.set({
    status,
    previousPageId: removedPageId,
    previousStatus: undo ? undefined : before,
    undoUntil: undo ? undefined : new Date(Date.now() + LIMITS.undoMs),
  });
  await entry.save({ session });
  return removedPageId;
}

export class ModerationService {
  private readonly cursors: CursorCodec;
  constructor(secret: string) {
    this.cursors = new CursorCodec(secret);
  }

  async reports(auth: AuthPrincipal, id: string, cursor?: string) {
    return transaction(async (session) => {
      const book = await owned(auth, id, session);
      const scope = JSON.stringify(["reports", auth.userId, id]);
      const after = this.cursors.decode(cursor, scope);
      const rows = await Report.find({
        bookId: book._id,
        status: "open",
        ...(after ? { _id: trusted({ $lt: new Types.ObjectId(after.id) }) } : {}),
      })
        .sort({ _id: -1 })
        .limit(26)
        .session(session);
      const window = rows.slice(0, 25);
      const entries = await Submission.find({
        bookId: book._id,
        _id: trusted({ $in: window.flatMap((r) => (r.submissionId ? [r.submissionId] : [])) }),
      })
        .select("+fingerprint")
        .session(session);
      const byId = new Map((await hostEntries(entries, session)).map((s) => [s.id, s]));
      return {
        items: window.map((r) => ({
          id: String(r._id),
          reason: r.reason,
          details: r.details ?? "",
          createdAt: r.createdAt.toISOString(),
          submission: byId.get(String(r.submissionId)),
        })),
        nextCursor:
          rows.length > 25
            ? this.cursors.encode({ id: String(window[24]!._id), key: 0, scope })
            : null,
      };
    });
  }
  async acknowledgeBookReport(auth: AuthPrincipal, id: string, reportId: string) {
    await transaction(async (session) => {
      const book = await owned(auth, id, session);
      const changed = await Report.updateOne(
        { _id: reportId, bookId: book._id, submissionId: null, status: "open" },
        { $set: { status: "kept" } },
        { session },
      );
      if (!changed.modifiedCount) throw new ApiError("NOT_FOUND");
      await publishFeed(book._id, session, "reset", [null]);
    });
  }
  async list(
    auth: AuthPrincipal,
    id: string,
    query: ModerationQuery,
  ): Promise<ListSubmissionsResponse> {
    return transaction(async (session) => {
      const book = await owned(auth, id, session);
      const { q = "", status, withPhoto, limit } = query;
      const scope = JSON.stringify(["submissions", auth.userId, id, status ?? "", q, !!withPhoto]);
      const cursor = this.cursors.decode(query.cursor, scope);
      if (cursor && typeof cursor.key !== "string") throw new ApiError("VALIDATION_FAILED");
      const name = new RegExp(q.replace(/[.*+?${}()|[\]\\]/g, "\\$&"), "i");
      const conditions = [
        ...(q
          ? [
              {
                $or: [
                  { guestName: name },
                  ...(name.test(ANONYMOUS_GUEST) ? [{ guestName: "" }] : []),
                ],
              },
            ]
          : []),
        ...(cursor
          ? [
              {
                $or: [
                  { createdAt: trusted({ $lt: new Date(cursor.key) }) },
                  {
                    createdAt: new Date(cursor.key),
                    _id: trusted({ $gt: new Types.ObjectId(cursor.id) }),
                  },
                ],
              },
            ]
          : []),
      ];
      const rows = await Submission.find({
        bookId: book._id,
        ...(status && { status: status === "all" ? trusted({ $ne: "rejected" }) : status }),
        ...(withPhoto && { photoUrl: trusted({ $gt: "" }) }),
        ...(conditions.length && { $and: conditions }),
      })
        .sort({ createdAt: -1, _id: 1 })
        .select("+fingerprint")
        .limit(limit + 1)
        .session(session);
      const counts: SubmissionCounts = {
        all: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        "in-book": 0,
      };
      const groups = await Submission.aggregate<{ _id: SubmissionStatus; total: number }>([
        { $match: { bookId: book._id } },
        { $group: { _id: "$status", total: { $sum: 1 } } },
      ]).session(session);
      for (const group of groups) {
        counts[group._id] = group.total;
        if (group._id !== "rejected") counts.all += group.total;
      }
      const window = rows.slice(0, limit);
      const last = window.at(-1);
      return {
        items: await hostEntries(window, session),
        counts,
        nextCursor:
          rows.length > limit && last
            ? this.cursors.encode({
                scope,
                id: String(last._id),
                key: last.createdAt.toISOString(),
              })
            : null,
      };
    });
  }

  status(
    auth: AuthPrincipal,
    id: string,
    input: { status: SubmissionStatus; pageId?: string },
  ): Promise<UpdateSubmissionStatusResponse> {
    return withEntry(auth, id, "submission:updated", async (entry, book, session) => {
      const removedPageId = await changeStatus(entry, book, session, input.status, input.pageId);
      const submission = (await hostEntries([entry], session))[0]!;
      return { submission, ...(removedPageId && { removedPageId }) };
    });
  }

  bulk(auth: AuthPrincipal, id: string, input: BulkModerateRequest): Promise<BulkModerateResponse> {
    return transaction(async (session) => {
      const book = await owned(auth, id, session);
      const ids = [...new Set(input.ids)];
      const rows = await Submission.find({ bookId: book._id, _id: trusted({ $in: ids }) })
        .select("+fingerprint")
        .session(session);
      if (rows.length !== ids.length) throw new ApiError("NOT_FOUND");
      const byId = new Map(rows.map((e) => [String(e._id), e]));
      const updated: Entry[] = [],
        removedPageIds: string[] = [];
      for (const key of ids) {
        const entry = byId.get(key)!;
        if (input.action === "approve" ? entry.status !== "pending" : entry.status === "rejected")
          continue;
        const removed = await changeStatus(
          entry,
          book,
          session,
          input.action === "approve" ? "approved" : "rejected",
        );
        if (removed) removedPageIds.push(removed);
        updated.push(entry);
      }
      if (updated.length) {
        await publishFeed(
          book._id,
          session,
          "submission:updated",
          updated.map((e) => e._id),
        );
        book.guestVersion++;
        await book.save({ session });
      }
      return { updated: await hostEntries(updated, session), removedPageIds };
    });
  }

  promote(auth: AuthPrincipal, id: string): Promise<AddToBookResponse> {
    return withEntry(auth, id, "submission:updated", async (entry, book, session) => {
      if (entry.status !== "approved")
        throw new ApiError("CONFLICT", "Only approved entries can be added.");
      const last = await Page.findOne({ bookId: book._id, deletedAt: null })
        .sort({ order: -1 })
        .session(session);
      const author = entry.guestName || ANONYMOUS_GUEST;
      const page = new Page({
        bookId: book._id,
        submissionId: entry._id,
        order: (last?.order ?? -1) + 1,
        title: `From ${author}`.slice(0, LIMITS.pageTitle),
        author,
        body: entry.message,
        imageUrl: entry.photoUrl,
      });
      await page.save({ session });
      entry.set({
        status: "in-book",
        pageId: page._id,
        previousStatus: undefined,
        previousPageId: undefined,
        undoUntil: undefined,
      });
      await entry.save({ session });
      book.version++;
      const submission = (await hostEntries([entry], session))[0]!;
      return { submission, page: pageDto(page) };
    });
  }

  reaction(auth: AuthPrincipal, id: string): Promise<ReactionResponse> {
    return withEntry(auth, id, "reaction:updated", async (entry, _book, session) => {
      entry.reacted = !entry.reacted;
      entry.reactionsCount = Math.max(0, entry.reactionsCount + (entry.reacted ? 1 : -1));
      await entry.save({ session });
      return { reactions: entry.reactionsCount, reacted: entry.reacted };
    });
  }

  dismissReport(auth: AuthPrincipal, id: string): Promise<{ submission: HostEntry }> {
    return withEntry(auth, id, "submission:updated", async (entry, book, session) => {
      await Report.updateMany(
        { bookId: book._id, submissionId: entry._id, status: "open" },
        { $set: { status: entry.status === "rejected" ? "removed" : "kept" } },
        { session },
      );
      entry.reportedCount = 0;
      await entry.save({ session });
      const submission = (await hostEntries([entry], session))[0]!;
      return { submission };
    });
  }

  remove(auth: AuthPrincipal, id: string) {
    return withEntry(auth, id, "submission:deleted", async (entry, book, session) => {
      const scope = { bookId: book._id, submissionId: entry._id };
      await Page.deleteMany(scope, { session });
      await Report.deleteMany(scope, { session });
      await Upload.updateMany(
        { ...scope, ownerId: null },
        { $set: { status: "failed", cleanupNeeded: true } },
        { session },
      );
      await entry.deleteOne({ session });
      if (entry.status === "in-book") book.version++;
      book.entriesCount = Math.max(0, book.entriesCount - 1);
    });
  }
}
