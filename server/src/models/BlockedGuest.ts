import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";
const schema = new Schema(
  {
    bookId: { type: Schema.Types.ObjectId, required: true },
    email: { type: String, lowercase: true },
    fingerprint: { type: String },
  },
  { timestamps: true, strict: "throw" },
);
schema.index(
  { bookId: 1, email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } },
);
schema.index(
  { bookId: 1, fingerprint: 1 },
  { unique: true, partialFilterExpression: { fingerprint: { $type: "string" } } },
);
export type BlockedGuestRecord = InferSchemaType<typeof schema>;
export const BlockedGuest: Model<BlockedGuestRecord> =
  (mongoose.models.BlockedGuest as Model<BlockedGuestRecord> | undefined) ??
  model<BlockedGuestRecord>("BlockedGuest", schema);
