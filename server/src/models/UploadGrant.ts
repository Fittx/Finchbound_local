import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";
const schema = new Schema(
  {
    _id: { type: String, required: true },
    providerHash: { type: String, required: true },
    bookId: { type: Schema.Types.ObjectId, required: true },
    draftId: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    uses: { type: Number, default: 0, required: true },
    fingerprint: { type: String, default: null },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: "throw" },
);
schema.index({ providerHash: 1 }, { unique: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export type UploadGrantRecord = InferSchemaType<typeof schema>;
export const UploadGrant: Model<UploadGrantRecord> =
  (mongoose.models.UploadGrant as Model<UploadGrantRecord> | undefined) ??
  model<UploadGrantRecord>("UploadGrant", schema);
