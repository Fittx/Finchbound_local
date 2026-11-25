import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";
import {
  ACCESS_MODES,
  BOOK_KINDS,
  BOOK_VISIBILITIES,
  COLLECTION_STATUSES,
  FONT_KEYS,
  PRESET_KEYS,
  LIMITS,
  RESERVED_SLUGS,
} from "../../../shared/constants.js";
const color = { type: String, required: true, match: /^#[0-9a-fA-F]{6}$/ };
const theme = new Schema(
  { background: color, grid: color, cover: color, accent: color, text: color, header: color },
  { _id: false, strict: "throw" },
);
const rules = new Schema(
  {
    access: { type: String, enum: ACCESS_MODES, required: true },
    photoRequired: { type: Boolean, required: true },
    messageRequired: { type: Boolean, required: true },
  },
  { _id: false, strict: "throw" },
);
const schema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: LIMITS.bookTitle },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: LIMITS.slug,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      validate: (value: string) => !RESERVED_SLUGS.includes(value),
    },
    kind: { type: String, enum: BOOK_KINDS, immutable: true, required: true },
    live: { type: Boolean, default: false, required: true },
    visibility: { type: String, enum: BOOK_VISIBILITIES, required: true },
    preset: { type: String, enum: PRESET_KEYS, required: true },
    theme: { type: theme, required: true },
    font: { type: String, enum: FONT_KEYS, required: true },
    lines: { type: Boolean, required: true },
    rules: { type: rules, required: true },
    hosts: { type: String, default: "", maxlength: LIMITS.bookTitle },
    prompt: { type: String, default: "", maxlength: LIMITS.message },
    collectionStatus: {
      type: String,
      enum: COLLECTION_STATUSES,
      default: "not-live",
      required: true,
    },
    expectedGuests: {
      type: Number,
      default: LIMITS.expectedGuestsDefault,
      min: LIMITS.expectedGuestsMin,
      max: LIMITS.expectedGuestsMax,
    },
    entriesCount: { type: Number, default: 0, min: 0, required: true },
    version: { type: Number, default: 0, min: 0, required: true },
    feedSequence: { type: Number, default: 0, required: true },
    guestVersion: { type: Number, default: 0, min: 0, required: true },
    deletedAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: "throw", versionKey: false },
);
schema.index({ slug: 1 }, { unique: true });
schema.index({ ownerId: 1, deletedAt: 1, createdAt: -1, _id: -1 });
export type BookRecord = InferSchemaType<typeof schema>;
export const Book: Model<BookRecord> =
  (mongoose.models.Book as Model<BookRecord> | undefined) ?? model<BookRecord>("Book", schema);
