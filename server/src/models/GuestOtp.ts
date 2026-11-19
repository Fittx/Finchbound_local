import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";
const schema = new Schema(
  {
    bookId: { type: Schema.Types.ObjectId, required: true },
    email: { type: String, required: true, lowercase: true },
    draftId: { type: String, required: true },
    grantId: { type: String, required: true },
    purpose: { type: String, enum: ["guest-email"], default: "guest-email", required: true },
    codeHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
    lastSentAt: { type: Date, required: true },
    attempts: { type: Number, default: 0, required: true },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: "throw" },
);
schema.index({ bookId: 1, email: 1 }, { unique: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export type GuestOtpRecord = InferSchemaType<typeof schema>;
export const GuestOtp: Model<GuestOtpRecord> =
  (mongoose.models.GuestOtp as Model<GuestOtpRecord> | undefined) ??
  model<GuestOtpRecord>("GuestOtp", schema);
