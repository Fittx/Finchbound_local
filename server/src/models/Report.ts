import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";
import { LIMITS, REPORT_REASON_VALUES } from "../../../shared/constants.js";
const schema = new Schema(
  {
    bookId: { type: Schema.Types.ObjectId, required: true },
    submissionId: { type: Schema.Types.ObjectId, default: null },
    reason: { type: String, enum: REPORT_REASON_VALUES, required: true },
    details: { type: String, default: "", maxlength: LIMITS.reportDetails },
    status: { type: String, enum: ["open", "kept", "removed"], default: "open", required: true },
  },
  { timestamps: true, strict: "throw" },
);
schema.index({ bookId: 1, status: 1, createdAt: -1 });
schema.index({ submissionId: 1, status: 1 });
export type ReportRecord = InferSchemaType<typeof schema>;
export const Report: Model<ReportRecord> =
  (mongoose.models.Report as Model<ReportRecord> | undefined) ??
  model<ReportRecord>("Report", schema);
