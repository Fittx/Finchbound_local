import { Types, trusted } from "mongoose";
import type { AdminReport, AdminReportsResponse } from "../../../shared/types/admin.js";
import { Book } from "../models/Book.js";
import { Submission } from "../models/Submission.js";
import { User } from "../models/User.js";
import { PlatformReport } from "../models/PlatformReport.js";
import { ApiError } from "../utils/ApiError.js";
import { transaction } from "../utils/transaction.js";
import { publishFeed } from "./feed.js";
import { deleteEntry } from "./moderation.js";
import type { AdminReportsQuery, PlatformReportInput } from "../validators/admin.js";

const PAGE = 20;

/** Public reports go to Finchbound admins. Only books a stranger can reach are reportable. */
export async function createPlatformReport(
  slug: string,
  input: PlatformReportInput,
  fingerprint: string,
) {
  const book = await Book.findOne({
    slug,
    deletedAt: null,
    $or: [{ live: true, visibility: "link" }, { kind: "event" }],
  }).select("_id");
  if (!book) throw new ApiError("NOT_FOUND");
  if (
    input.submissionId &&
    !(await Submission.exists({ _id: input.submissionId, bookId: book._id }))
  )
    throw new ApiError("NOT_FOUND");
  await PlatformReport.create({
    bookId: book._id,
    submissionId: input.submissionId ?? null,
    reason: input.reason,
    details: input.details,
    fingerprint,
  });
  return { ok: true as const };
}

export async function listPlatformReports(query: AdminReportsQuery): Promise<AdminReportsResponse> {
  const rows = await PlatformReport.find({
    status: query.status,
    ...(query.cursor ? { _id: trusted({ $lt: new Types.ObjectId(query.cursor) }) } : {}),
  })
    .sort({ _id: -1 })
    .limit(PAGE + 1)
    .lean();
  const window = rows.slice(0, PAGE);
  const books = await Book.find({ _id: trusted({ $in: window.map((r) => r.bookId) }) }).lean();
  const owners = await User.find({ _id: trusted({ $in: books.map((b) => b.ownerId) }) })
    .select("email")
    .lean();
  const submissionIds = window.flatMap((r) => (r.submissionId ? [r.submissionId] : []));
  const submissions = submissionIds.length
    ? await Submission.find({ _id: trusted({ $in: submissionIds }) }).lean()
    : [];
  const bookById = new Map(books.map((b) => [String(b._id), b]));
  const ownerById = new Map(owners.map((u) => [String(u._id), u.email]));
  const submissionById = new Map(submissions.map((s) => [String(s._id), s]));
  const items = window.map((row): AdminReport => {
    const book = bookById.get(String(row.bookId));
    const entry = row.submissionId ? submissionById.get(String(row.submissionId)) : undefined;
    return {
      id: String(row._id),
      reason: row.reason,
      details: row.details ?? "",
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      book: book
        ? {
            id: String(book._id),
            title: book.title,
            slug: book.slug,
            kind: book.kind,
            live: book.live,
            visibility: book.visibility,
            deleted: Boolean(book.deletedAt),
            ownerEmail: ownerById.get(String(book.ownerId)) ?? "",
          }
        : null,
      ...(entry && {
        submission: {
          id: String(entry._id),
          name: entry.guestName ?? "",
          message: entry.message ?? "",
          ...(entry.photoUrl && { photo: entry.photoUrl }),
          status: entry.status,
        },
      }),
    };
  });
  return {
    items,
    nextCursor: rows.length > PAGE ? String(window.at(-1)!._id) : null,
  };
}

export async function dismissPlatformReport(id: string) {
  const changed = await PlatformReport.updateOne(
    { _id: id, status: "open" },
    { $set: { status: "dismissed" } },
  );
  if (!changed.matchedCount) throw new ApiError("NOT_FOUND");
}

/** Take a book off its public link and stop guest collection. The owner can republish later. */
export async function unpublishBook(bookId: string) {
  await transaction(async (session) => {
    const book = await Book.findOne({ _id: bookId, deletedAt: null }).session(session);
    if (!book) throw new ApiError("NOT_FOUND");
    book.live = false;
    if (book.kind === "event") book.collectionStatus = "closed";
    book.version++;
    book.guestVersion++;
    await book.save({ session });
    await PlatformReport.updateMany(
      { bookId: book._id, status: "open" },
      { $set: { status: "actioned" } },
      { session },
    );
  });
}

export async function removeSubmission(submissionId: string) {
  await transaction(async (session) => {
    const entry = await Submission.findById(submissionId).session(session);
    if (!entry) throw new ApiError("NOT_FOUND");
    const book = await Book.findById(entry.bookId).session(session);
    if (!book) throw new ApiError("NOT_FOUND");
    await deleteEntry(entry, book, session);
    await publishFeed(book._id, session, "submission:deleted", [entry._id]);
    book.guestVersion++;
    await book.save({ session });
    await PlatformReport.updateMany(
      { submissionId: entry._id, status: "open" },
      { $set: { status: "actioned" } },
      { session },
    );
  });
}
