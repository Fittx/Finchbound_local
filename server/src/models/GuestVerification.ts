import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";
const schema = new Schema(
  {
    _id: { type: String, required: true },
    bookId: { type: Schema.Types.ObjectId, required: true },
    draftId: { type: String, required: true },
    grantId: { type: String, required: true },
    email: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: "throw" },
);
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export type GuestVerificationRecord = InferSchemaType<typeof schema>;
export const GuestVerification: Model<GuestVerificationRecord> =
  (mongoose.models.GuestVerification as Model<GuestVerificationRecord> | undefined) ??
  model<GuestVerificationRecord>("GuestVerification", schema);
