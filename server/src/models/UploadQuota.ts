import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";
const schema = new Schema(
  {
    _id: { type: String, required: true },
    used: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { strict: "throw" },
);
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export type UploadQuotaRecord = InferSchemaType<typeof schema>;
export const UploadQuota: Model<UploadQuotaRecord> =
  (mongoose.models.UploadQuota as Model<UploadQuotaRecord> | undefined) ??
  model<UploadQuotaRecord>("UploadQuota", schema);
