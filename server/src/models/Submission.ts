import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";
import { LIMITS, SUBMISSION_STATUSES } from "../../../shared/constants.js";
const schema = new Schema(
  {
    bookId: { type: Schema.Types.ObjectId, required: true },
    draftId: { type: String, required: true },
    guestSignoff: { type: String, maxlength: LIMITS.personName },
    guestName: { type: String, default: "", maxlength: LIMITS.personName },
    guestEmail: { type: String, default: "", lowercase: true, maxlength: 254 },
    emailVerified: { type: Boolean, default: false, required: true },
    fingerprint: { type: String, required: true, select: false },
    message: { type: String, default: "", maxlength: LIMITS.message },
    uploadId: { type: Schema.Types.ObjectId, default: null },
    photoUrl: { type: String },
    status: { type: String, enum: SUBMISSION_STATUSES, required: true },
    pageId: { type: Schema.Types.ObjectId, default: null },
    reacted: { type: Boolean, default: false },
    previousStatus: { type: String, enum: SUBMISSION_STATUSES },
    previousPageId: { type: Schema.Types.ObjectId },
    undoUntil: { type: Date },
    reactionsCount: { type: Number, default: 0, min: 0 },
    reportedCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, strict: "throw" },
);
schema.index(
  { bookId: 1, draftId: 1 },
  { unique: true, partialFilterExpression: { draftId: { $type: "string" } } },
);
schema.index({ bookId: 1, status: 1, createdAt: -1, _id: -1 });
schema.index({ bookId: 1, createdAt: -1, _id: 1 });
schema.index({ guestName: "text", message: "text" });
export type SubmissionRecord = InferSchemaType<typeof schema>;
export const Submission: Model<SubmissionRecord> =
  (mongoose.models.Submission as Model<SubmissionRecord> | undefined) ??
  model<SubmissionRecord>("Submission", schema);
