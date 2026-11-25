import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";
import {
  LIMITS,
  PLATFORM_REPORT_STATUSES,
  REPORT_REASON_VALUES,
} from "../../../shared/constants.js";
/** Reports addressed to Finchbound admins rather than the book's host. */
const schema = new Schema(
  {
    bookId: { type: Schema.Types.ObjectId, required: true },
    submissionId: { type: Schema.Types.ObjectId, default: null },
    reason: { type: String, enum: REPORT_REASON_VALUES, required: true },
    details: { type: String, default: "", maxlength: LIMITS.reportDetails },
    status: { type: String, enum: PLATFORM_REPORT_STATUSES, default: "open", required: true },
    /** HMAC of the reporter's device cookie, for abuse review only; never returned. */
    fingerprint: { type: String, required: true, select: false },
  },
  { timestamps: true, strict: "throw" },
);
schema.index({ status: 1, _id: -1 });
schema.index({ bookId: 1, status: 1 });
schema.index({ submissionId: 1, status: 1 });
export type PlatformReportRecord = InferSchemaType<typeof schema>;
export const PlatformReport: Model<PlatformReportRecord> =
  (mongoose.models.PlatformReport as Model<PlatformReportRecord> | undefined) ??
  model<PlatformReportRecord>("PlatformReport", schema);
