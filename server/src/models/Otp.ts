import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    email: { type: String, required: true, lowercase: true },
    targetEmail: { type: String },
    purpose: {
      type: String,
      enum: ["host-email", "password-reset", "account-email"],
      required: true,
    },
    codeHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
    lastSentAt: { type: Date, required: true },
    attempts: { type: Number, default: 0, min: 0, required: true },
    consumedAt: { type: Date, default: null },
    authVersion: { type: Number, required: true, default: 0 },
  },
  { timestamps: true, strict: "throw" },
);
schema.index({ email: 1, purpose: 1 }, { unique: true });
schema.index({ codeHash: 1, purpose: 1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export type OtpRecord = InferSchemaType<typeof schema>;
export const Otp: Model<OtpRecord> =
  (mongoose.models.Otp as Model<OtpRecord> | undefined) ?? model<OtpRecord>("Otp", schema);
