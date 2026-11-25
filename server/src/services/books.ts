import { User } from "../models/User.js";
import { publishFeed } from "./feed.js";
import { Types, trusted, type ClientSession, type HydratedDocument } from "mongoose";
import { LIMITS } from "../../../shared/constants.js";
import type { Book as BookDto, Page as PageDto } from "../../../shared/types/books.js";
import { Book, type BookRecord } from "../models/Book.js";
import { Submission } from "../models/Submission.js";
import { Page, type PageRecord } from "../models/Page.js";
import { authorizeOwner } from "../middleware/requireOwner.js";
import { ApiError } from "../utils/ApiError.js";
import { CursorCodec } from "../utils/cursor.js";
import { bindPageImages } from "./assetReferences.js";
import type { AuthPrincipal } from "./auth.js";
import type {
  BooksQuery,
  PagesQuery,
  CreateBookInput,
  UpdateBookInput,
  CreatePageInput,
  UpdatePageInput,
  ReorderInput,
} from "../validators/books.js";

type StoredBook = BookRecord & { _id: Types.ObjectId };
type StoredPage = PageRecord & { _id: Types.ObjectId };
const literalSearch = (q: string) => q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
import { transaction } from "../utils/transaction.js";
export const pageDto = (p: StoredPage): PageDto => ({
  id: p._id.toString(),
  title: p.title,
  body: p.body,
  editedAt: p.updatedAt.toISOString(),
  ...(p.imageUrl ? { image: p.imageUrl } : {}),
  ...(p.cardImageUrl ? { cardImage: p.cardImageUrl } : {}),
  ...(p.caption ? { caption: p.caption } : {}),
  ...(p.header ? { header: p.header } : {}),
  ...(p.author ? { author: p.author } : {}),
  ...(p.submissionId ? { submissionId: p.submissionId.toString() } : {}),
});
export const bookDto = (b: StoredBook): Omit<BookDto, "pages"> => ({
  id: b._id.toString(),
  title: b.title,
  slug: b.slug,
  kind: b.kind,
  live: b.live,
  visibility: b.visibility,
  entries: b.entriesCount,
  updated: b.updatedAt.toISOString(),
  preset: b.preset,
  theme: {
    background: b.theme.background,
    grid: b.theme.grid,
    cover: b.theme.cover,
    accent: b.theme.accent,
    text: b.theme.text,
    header: b.theme.header,
  },
  font: b.font,
  lines: b.lines,
  access: b.rules.access,
  photoRequired: b.rules.photoRequired,
  messageRequired: b.rules.messageRequired,
  version: b.version,
  hosts: b.hosts ?? "",
  prompt: b.prompt ?? "",
  status: b.collectionStatus,
  expectedGuests: b.expectedGuests ?? LIMITS.expectedGuestsDefault,
});
export class BookService {
  private readonly cursors: CursorCodec;
  constructor(secret: string) {
    this.cursors = new CursorCodec(secret);
  }

  private async owned(
    id: string,
    auth: AuthPrincipal,
    session?: ClientSession,
    includeDeleted = false,
  ) {
    const book = await Book.findById(id).session(session ?? null);
    if (!book || (!includeDeleted && book.deletedAt)) throw new ApiError("NOT_FOUND");
    authorizeOwner(auth, book.ownerId.toString());
    return book;
  }
  /** Every page mutation writes the parent, serializing membership/order/delete races. */
  private async write<T>(
    id: string,
    auth: AuthPrincipal,
    work: (book: HydratedDocument<BookRecord>, session: ClientSession) => Promise<T>,
  ) {
    return transaction(async (session) => {
      const book = await this.owned(id, auth, session);
      const result = await work(book, session);
      book.version++;
      await book.save({ session });
      return result;
    });
  }
  async list(auth: AuthPrincipal, query: BooksQuery) {
    const scope = JSON.stringify(["books", auth.userId, query.q ?? ""]);
    const cursor = this.cursors.decode(query.cursor, scope);
    if (cursor && typeof cursor.key !== "string") throw new ApiError("VALIDATION_FAILED");
    const filter = {
      ownerId: new Types.ObjectId(auth.userId),
      deletedAt: null,
      ...(query.q ? { title: trusted({ $regex: literalSearch(query.q), $options: "i" }) } : {}),
      ...(cursor
        ? {
            $or: [
              { createdAt: trusted({ $lt: new Date(cursor.key) }) },
              {
                createdAt: new Date(cursor.key),
                _id: trusted({ $lt: new Types.ObjectId(cursor.id) }),
              },
            ],
          }
        : {}),
    };
    const rows = await Book.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(query.limit + 1)
      .lean();
    const visible = rows.slice(0, query.limit),
      last = visible.at(-1);
    return {
      items: visible.map(bookDto),
      nextCursor:
        rows.length > query.limit && last
          ? this.cursors.encode({
              scope,
              id: last._id.toString(),
              key: last.createdAt.toISOString(),
            })
          : null,
    };
  }
  async checkSlug(value: string) {
    return { available: !(await Book.exists({ slug: value })) };
  }
  async create(auth: AuthPrincipal, input: CreateBookInput) {
    const {
      access,
      photoRequired,
      messageRequired,
      status,
      hosts = "",
      prompt = "",
      ...rest
    } = input;
    return transaction(async (session) => {
      const owner = await User.updateOne(
        { _id: auth.userId, authVersion: auth.authVersion },
        { $inc: { resourceVersion: 1 } },
        { session, timestamps: false },
      );
      if (!owner.matchedCount) throw new ApiError("UNAUTHORIZED");
      const book = new Book({
        ...rest,
        hosts,
        prompt,
        ownerId: auth.userId,
        rules: { access, photoRequired, messageRequired },
        collectionStatus: status ?? "not-live",
      });
      await book.save({ session });
      return { book: { ...bookDto(book), pages: [] } };
    });
  }
  async get(auth: AuthPrincipal, id: string) {
    const book = await this.owned(id, auth);
    const pages = await Page.find({ bookId: book._id, deletedAt: null })
      .sort({ order: 1, _id: 1 })
      .lean();
    return { book: { ...bookDto(book), pages: pages.map(pageDto) } };
  }
  async update(auth: AuthPrincipal, id: string, input: UpdateBookInput) {
    await this.write(id, auth, async (book) => {
      const { access, photoRequired, messageRequired, status, ...rest } = input;
      book.set(rest);
      if (access !== undefined) book.rules.access = access;
      if (photoRequired !== undefined) book.rules.photoRequired = photoRequired;
      if (messageRequired !== undefined) book.rules.messageRequired = messageRequired;
      if (status !== undefined) book.collectionStatus = status;
      if (input.live && !book.publishedAt) book.publishedAt = new Date();
    });
    return this.get(auth, id);
  }
  async publish(auth: AuthPrincipal, id: string) {
    return this.update(auth, id, { live: true });
  }
  async remove(auth: AuthPrincipal, id: string) {
    await this.write(id, auth, async (book) => {
      book.deletedAt = new Date();
    });
  }
  async restore(auth: AuthPrincipal, id: string) {
    await transaction(async (session) => {
      const book = await this.owned(id, auth, session, true);
      if (book.deletedAt && Date.now() - book.deletedAt.getTime() >= LIMITS.undoMs)
        throw new ApiError("NOT_FOUND", "The restore window has expired.", undefined, 410);
      if (book.deletedAt) {
        book.deletedAt = null;
        book.version++;
        await book.save({ session });
      }
    });
    return this.get(auth, id);
  }
  async listPages(auth: AuthPrincipal, id: string, query: PagesQuery) {
    const book = await this.owned(id, auth);
    const scope = JSON.stringify([
      "pages",
      auth.userId,
      id,
      query.q ?? "",
      query.withPhoto ?? false,
      query.sort,
      book.version,
    ]);
    const cursor = this.cursors.decode(query.cursor, scope);
    const field = query.sort === "edited" ? "updatedAt" : "order";
    if (cursor && typeof cursor.key !== (field === "order" ? "number" : "string"))
      throw new ApiError("VALIDATION_FAILED");
    const key = cursor
      ? field === "order"
        ? (cursor.key as number)
        : new Date(cursor.key)
      : undefined;
    const op = field === "order" ? "$gt" : "$lt";
    const rows = await Page.find({
      bookId: book._id,
      deletedAt: null,
      ...(query.q ? { title: trusted({ $regex: literalSearch(query.q), $options: "i" }) } : {}),
      ...(query.withPhoto ? { imageUrl: trusted({ $exists: true, $nin: [null, ""] }) } : {}),
      ...(cursor
        ? {
            $or: [
              { [field]: trusted({ [op]: key }) },
              { [field]: key, _id: trusted({ [op]: new Types.ObjectId(cursor.id) }) },
            ],
          }
        : {}),
    })
      .sort(field === "order" ? { order: 1, _id: 1 } : { updatedAt: -1, _id: -1 })
      .limit(query.limit + 1)
      .lean();
    const visible = rows.slice(0, query.limit),
      last = visible.at(-1);
    return {
      items: visible.map(pageDto),
      nextCursor:
        rows.length > query.limit && last
          ? this.cursors.encode({
              scope,
              id: last._id.toString(),
              key: field === "order" ? last.order : last.updatedAt.toISOString(),
            })
          : null,
    };
  }
  private pageFields(input: UpdatePageInput) {
    const fields: {
      title?: string;
      body?: string;
      caption?: string;
      header?: string;
      author?: string;
      imageUrl?: string;
      cardImageUrl?: string;
    } = {};
    if (input.title !== undefined) fields.title = input.title;
    if (input.body !== undefined) fields.body = input.body;
    if (input.caption !== undefined) fields.caption = input.caption;
    if (input.header !== undefined) fields.header = input.header;
    if (input.author !== undefined) fields.author = input.author;
    if (input.image !== undefined) fields.imageUrl = input.image;
    if (input.cardImage !== undefined) fields.cardImageUrl = input.cardImage;
    return fields;
  }
  async createPage(auth: AuthPrincipal, id: string, input: CreatePageInput) {
    const page = await this.write(id, auth, async (book, session) => {
      const last = await Page.findOne({ bookId: book._id, deletedAt: null })
        .sort({ order: -1 })
        .session(session);
      const [page] = await Page.create(
        [
          {
            ...this.pageFields({
              ...input,
              ...(await bindPageImages(auth.userId, book._id, input, session)),
            }),
            bookId: book._id,
            order: (last?.order ?? -1) + 1,
          },
        ],
        { session },
      );
      return page!;
    });
    return { page: pageDto(page) };
  }
  private async pageBook(id: string) {
    const page = await Page.findOne({ _id: id, deletedAt: null }).select("bookId");
    if (!page) throw new ApiError("NOT_FOUND");
    return page.bookId.toString();
  }
  async updatePage(auth: AuthPrincipal, id: string, input: UpdatePageInput) {
    const bookId = await this.pageBook(id);
    const page = await this.write(bookId, auth, async (book, session) => {
      const page = await Page.findOne({ _id: id, bookId: book._id, deletedAt: null }).session(
        session,
      );
      if (!page) throw new ApiError("NOT_FOUND");
      page.set(
        this.pageFields({
          ...input,
          ...(await bindPageImages(
            auth.userId,
            book._id,
            {
              image: input.image === page.imageUrl ? undefined : input.image,
              cardImage: input.cardImage === page.cardImageUrl ? undefined : input.cardImage,
            },
            session,
          )),
        }),
      );
      await page.save({ session });
      return page;
    });
    return { page: pageDto(page) };
  }
  async deletePage(auth: AuthPrincipal, id: string) {
    const bookId = await this.pageBook(id);
    await this.write(bookId, auth, async (book, session) => {
      const removed = await Page.findOneAndDelete(
        { _id: id, bookId: book._id, deletedAt: null },
        { session },
      );
      if (!removed) throw new ApiError("NOT_FOUND");
      if (removed.submissionId) {
        const changed = await Submission.updateOne(
          { _id: removed.submissionId, bookId: book._id, pageId: removed._id, status: "in-book" },
          {
            $set: { status: "approved", pageId: null },
            $unset: { previousStatus: 1, previousPageId: 1, undoUntil: 1 },
          },
          { session },
        );
        if (changed.modifiedCount)
          await publishFeed(book._id, session, "submission:updated", [removed.submissionId]);
      }
    });
  }
  async reorder(auth: AuthPrincipal, id: string, input: ReorderInput) {
    return this.write(id, auth, async (book, session) => {
      if (book.version !== input.expectedVersion) throw new ApiError("CONFLICT");
      const pages = await Page.find({ bookId: book._id, deletedAt: null })
        .sort({ order: 1, _id: 1 })
        .session(session);
      const from = pages.findIndex((p) => p._id.toString() === input.pageId);
      if (from === -1) throw new ApiError("NOT_FOUND");
      const [moving] = pages.splice(from, 1);
      const anchor = pages.findIndex((p) => p._id.toString() === (input.beforeId ?? input.afterId));
      if (anchor === -1) throw new ApiError("NOT_FOUND");
      const order = anchor + (input.afterId ? 1 : 0);
      pages.splice(order, 0, moving!);
      await Page.bulkWrite(
        pages.map((p, index) => ({
          updateOne: {
            filter: { _id: p._id, bookId: book._id },
            update: { $set: { order: index } },
            timestamps: false,
          },
        })),
        { session },
      );
      return { pageId: input.pageId, order, version: book.version + 1 };
    });
  }
  async publicBook(value: string, auth?: AuthPrincipal) {
    // One aggregation joins visibility and publication checks to page eligibility.
    const rows = await Book.aggregate([
      {
        $match: {
          slug: value,
          deletedAt: null,
          $or: [
            { live: true, visibility: "link" },
            ...(auth ? [{ ownerId: new Types.ObjectId(auth.userId) }] : []),
          ],
        },
      },
      {
        $lookup: {
          from: "pages",
          let: { book: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $and: [{ $eq: ["$bookId", "$$book"] }, { $eq: ["$deletedAt", null] }] },
              },
            },
            {
              $lookup: {
                from: "submissions",
                let: { source: "$submissionId", book: "$bookId" },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ["$_id", "$$source"] },
                          { $eq: ["$bookId", "$$book"] },
                          { $eq: ["$status", "in-book"] },
                        ],
                      },
                    },
                  },
                  { $project: { _id: 1 } },
                ],
                as: "eligibleSource",
              },
            },
            {
              $match: { $or: [{ submissionId: null }, { "eligibleSource.0": { $exists: true } }] },
            },
            { $sort: { order: 1, _id: 1 } },
            { $project: { eligibleSource: 0 } },
          ],
          as: "pages",
        },
      },
    ]);
    const book = rows[0] as (StoredBook & { pages: StoredPage[] }) | undefined;
    if (!book) throw new ApiError("NOT_FOUND");
    return { book: bookDto(book), pages: book.pages.map(pageDto) };
  }
}
