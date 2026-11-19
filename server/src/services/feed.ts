import { Types, trusted, type ClientSession } from "mongoose";
import { Book } from "../models/Book.js";
import { FeedEvent, type FeedEventName } from "../models/FeedEvent.js";
import { Submission } from "../models/Submission.js";
import { authorizeOwner } from "../middleware/requireOwner.js";
import { ApiError } from "../utils/ApiError.js";
import { transaction } from "../utils/transaction.js";
import { hostEntries } from "./hostEntries.js";
import type { AuthPrincipal } from "./auth.js";

// Allocate the whole batch on the parent inside the mutation's transaction.
// Concurrent writes to a book therefore get commit-ordered replay positions.
export async function publishFeed(
  bookId: Types.ObjectId,
  session: ClientSession,
  name: FeedEventName,
  ids: readonly (Types.ObjectId | string | null)[],
) {
  if (!ids.length) return;
  const book = await Book.findOneAndUpdate(
    { _id: bookId },
    { $inc: { feedSequence: ids.length } },
    { session, new: true, timestamps: false },
  ).select("feedSequence");
  if (!book) throw new ApiError("NOT_FOUND");
  await FeedEvent.insertMany(
    ids.map((entryId, i) => ({
      bookId,
      entryId,
      name,
      sequence: book.feedSequence - ids.length + i + 1,
    })),
    { session, ordered: true },
  );
}

export async function readFeed(auth: AuthPrincipal, id: string, after?: number) {
  return transaction(async (session) => {
    const book = await Book.findOne({ _id: id, deletedAt: null })
      .select("ownerId feedSequence")
      .session(session);
    if (!book) throw new ApiError("NOT_FOUND");
    authorizeOwner(auth, String(book.ownerId));
    const head = book.feedSequence ?? 0;
    if (after === undefined || after === head) return { head, reset: false, events: [] };
    const rows = await FeedEvent.find({ bookId: book._id, sequence: trusted({ $gt: after }) })
      .sort({ sequence: 1 })
      .limit(50)
      .session(session)
      .lean();
    if (!rows.length || rows.some((row, i) => row.sequence !== after + i + 1))
      return { head, reset: true, events: [] };
    const entries = await Submission.find({
      bookId: book._id,
      _id: trusted({ $in: rows.flatMap((r) => (r.entryId ? [r.entryId] : [])) }),
    })
      .select("+fingerprint")
      .session(session);
    const byId = new Map((await hostEntries(entries, session)).map((e) => [e.id, e]));
    const events = rows.map((row) => {
      const entry = byId.get(String(row.entryId));
      if (row.name === "reset")
        return { sequence: row.sequence, name: "reset", data: { bookId: id } };
      if (!entry || row.name === "submission:deleted")
        return {
          sequence: row.sequence,
          name: "submission:deleted",
          data: { bookId: id, id: String(row.entryId) },
        };
      return { sequence: row.sequence, name: row.name, data: entry };
    });
    return { head, reset: false, events };
  });
}
