import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";
import { LIMITS } from "../../../shared/constants.js";
const schema = new Schema(
  {
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    submissionId: { type: Schema.Types.ObjectId, default: null },
    order: { type: Number, required: true, min: 0 },
    title: { type: String, required: true, trim: true, maxlength: LIMITS.pageTitle },
    imageUrl: { type: String },
    caption: { type: String, maxlength: LIMITS.photoCaption },
    cardImageUrl: { type: String },
    header: { type: String, maxlength: LIMITS.messageHeader },
    body: { type: String, default: "", maxlength: LIMITS.message },
    author: { type: String, maxlength: LIMITS.personName },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: "throw", versionKey: false },
);
schema.index({ bookId: 1, deletedAt: 1, order: 1, _id: 1 });
schema.index({ bookId: 1, deletedAt: 1, updatedAt: -1, _id: -1 });
export type PageRecord = InferSchemaType<typeof schema>;
export const Page: Model<PageRecord> =
  (mongoose.models.Page as Model<PageRecord> | undefined) ?? model<PageRecord>("Page", schema);
