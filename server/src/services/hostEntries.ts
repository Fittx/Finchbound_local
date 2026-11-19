import { trusted, type ClientSession, type HydratedDocument } from "mongoose";
import type { Submission as EntryDto } from "../../../shared/types/submissions.js";
import { Report } from "../models/Report.js";
import { BlockedGuest } from "../models/BlockedGuest.js";
import type { SubmissionRecord } from "../models/Submission.js";

export type Entry = HydratedDocument<SubmissionRecord>;

/** Hydrate host-only flags for a single, book-scoped window. */
export async function hostEntries(entries: Entry[], session: ClientSession): Promise<EntryDto[]> {
  if (!entries.length) return [];
  const bookId = entries[0]!.bookId;
  const summaries = await Report.aggregate<{
    _id: Entry["_id"];
    report: NonNullable<EntryDto["report"]>;
    count: number;
    date: Date;
  }>([
    { $match: { bookId, submissionId: { $in: entries.map((e) => e._id) }, status: "open" } },
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $group: {
        _id: "$submissionId",
        report: { $first: { reason: "$reason", details: "$details" } },
        count: { $sum: 1 },
        date: { $first: "$createdAt" },
      },
    },
  ]).session(session);
  const reports = new Map(
    summaries.map((r) => [
      String(r._id),
      {
        reason: r.report.reason,
        ...(r.report.details && { details: r.report.details }),
        count: r.count,
        lastReportedAt: r.date.toISOString(),
      },
    ]),
  );
  const blocks = await BlockedGuest.find({
    bookId,
    $or: [
      { fingerprint: trusted({ $in: entries.map((e) => e.fingerprint).filter(Boolean) }) },
      {
        email: trusted({
          $in: entries.filter((e) => e.emailVerified && e.guestEmail).map((e) => e.guestEmail),
        }),
      },
    ],
  })
    .session(session)
    .lean();
  const devices = new Set(blocks.map((b) => b.fingerprint).filter(Boolean));
  const emails = new Set(blocks.map((b) => b.email).filter(Boolean));
  return entries.map((e) => {
    const report = reports.get(String(e._id));
    return {
      id: String(e._id),
      bookId: String(e.bookId),
      name: e.guestName || "",
      ...(e.guestEmail && { email: e.guestEmail }),
      message: e.message || "",
      ...(e.photoUrl && { photo: e.photoUrl }),
      createdAt: e.createdAt.toISOString(),
      status: e.status,
      reactions: e.reactionsCount || 0,
      reacted: !!e.reacted,
      ...(e.pageId && { pageId: String(e.pageId) }),
      ...(report && { report }),
      guestBlocked: devices.has(e.fingerprint) || (e.emailVerified && emails.has(e.guestEmail)),
    };
  });
}
