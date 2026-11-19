import { createHash } from "node:crypto";
import { loadEnvFile } from "node:process";
import { Types } from "mongoose";
import { MOCK_BOOKS } from "../../src/mocks/books";
import { MOCK_SUBMISSIONS } from "../../src/mocks/submissions";
import { GUEST_EVENTS } from "../../src/mocks/guest";
import { parseEnv } from "../src/config/env.js";
import { createDatabase } from "../src/config/db.js";
import { User } from "../src/models/User.js";
import { Book } from "../src/models/Book.js";
import { Page } from "../src/models/Page.js";
import { Submission } from "../src/models/Submission.js";
import { Report } from "../src/models/Report.js";
import { transaction } from "../src/utils/transaction.js";
import { initializeBookModels } from "../src/models/books.js";
import { initializeGuestModels } from "../src/models/guests.js";

const fixtureId = (...parts: string[]) =>
  new Types.ObjectId(
    createHash("sha256")
      .update(JSON.stringify(["finchbound-seed-v1", ...parts]))
      .digest("hex")
      .slice(0, 24),
  );
async function seed() {
  try {
    loadEnvFile(".env");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const config = parseEnv();
  if (config.NODE_ENV !== "development") throw new Error("Use a development database.");
  const email = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error("Set SEED_OWNER_EMAIL to a verified development account.");
  const db = createDatabase(config);
  await db.connect();
  try {
    const owner = await User.findOne({ email, emailVerified: true }).select("_id");
    if (!owner) throw new Error("Create and verify the seed owner first.");
    await initializeBookModels();
    await initializeGuestModels();
    let created = 0;
    for (const fixture of MOCK_BOOKS) {
      const id = fixtureId(String(owner._id), fixture.id);
      const inserted = await transaction(async (session) => {
        if (await Book.exists({ _id: id, ownerId: owner._id }).session(session)) return false;
        const lock = await User.updateOne(
          { _id: owner._id },
          { $inc: { resourceVersion: 1 } },
          { session, timestamps: false },
        );
        if (!lock.matchedCount) throw new Error("Seed owner is unavailable.");
        const event = GUEST_EVENTS[fixture.slug];
        const entries = MOCK_SUBMISSIONS.filter((e) => e.bookId === fixture.id);
        const source = (entryId: string) => fixtureId(String(id), "entry", entryId);
        const pageId = (key: string) => fixtureId(String(id), "page", key);
        await Book.create(
          [
            {
              _id: id,
              ownerId: owner._id,
              title: fixture.title,
              slug: fixture.slug,
              kind: fixture.kind,
              visibility: fixture.visibility,
              live: fixture.live,
              publishedAt: fixture.live ? new Date() : null,
              preset: fixture.preset,
              font: fixture.font,
              theme: fixture.theme,
              lines: fixture.lines,
              rules: {
                access: fixture.access,
                photoRequired: fixture.photoRequired,
                messageRequired: fixture.messageRequired,
              },
              hosts: event?.hosts,
              prompt: event?.prompt,
              collectionStatus: event?.status,
              entriesCount: entries.length,
            },
          ],
          { session },
        );
        if (fixture.pages.length)
          await Page.insertMany(
            fixture.pages.map((p, order) => ({
              _id: pageId(p.id),
              bookId: id,
              order,
              title: p.title,
              submissionId:
                p.submissionId && entries.some((e) => e.id === p.submissionId)
                  ? source(p.submissionId)
                  : null,
              imageUrl: p.image,
              cardImageUrl: p.cardImage,
              caption: p.caption,
              header: p.header,
              body: p.body,
              author: p.author,
            })),
            { session, ordered: true },
          );
        for (const e of entries) {
          await Submission.create(
            [
              {
                _id: source(e.id),
                bookId: id,
                draftId: e.id,
                fingerprint: String(source(e.id)),
                guestName: e.name,
                guestEmail: e.email,
                emailVerified: !!e.email,
                message: e.message,
                photoUrl: e.photo,
                status: e.status,
                pageId: e.pageId ? pageId(e.pageId) : null,
                reacted: e.reacted,
                reactionsCount: e.reactions,
                reportedCount: e.report?.count ?? 0,
                createdAt: new Date(e.createdAt),
              },
            ],
            { session },
          );
          if (e.report)
            await Report.insertMany(
              Array.from({ length: e.report.count }, () => ({
                bookId: id,
                submissionId: source(e.id),
                reason: e.report!.reason,
                details: e.report!.details,
                createdAt: new Date(e.report!.lastReportedAt),
              })),
              { session, ordered: true },
            );
        }
        return true;
      });
      if (inserted) created++;
    }
    console.log("Seed complete. Books created:", created);
  } finally {
    await db.disconnect();
  }
}
seed().catch(() => {
  console.error(
    "Seed failed. Check development settings, verified owner and available fixture slugs.",
  );
  process.exitCode = 1;
});
