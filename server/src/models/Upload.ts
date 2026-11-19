import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";
const schema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, default: null },
    bookId: { type: Schema.Types.ObjectId, default: null },
    draftId: { type: String, default: null },
    submissionId: { type: Schema.Types.ObjectId, default: null },
    status: {
      type: String,
      enum: ["quarantine", "ready", "failed"],
      default: "quarantine",
      required: true,
    },
    keys: { type: [String], default: [] },
    originalBytes: { type: Number, required: true },
    contentHash: { type: String },
    renditions: {
      type: Map,
      of: new Schema(
        { key: { type: String, required: true }, width: Number, height: Number, bytes: Number },
        { _id: false },
      ),
      default: () => new Map(),
    },
    cleanupNeeded: { type: Boolean, default: false },
  },
  { timestamps: true, strict: "throw" },
);
schema.index({ ownerId: 1, status: 1 });
schema.index({ bookId: 1, draftId: 1, status: 1 });
export type UploadRecord = InferSchemaType<typeof schema>;
export const Upload: Model<UploadRecord> =
  (mongoose.models.Upload as Model<UploadRecord> | undefined) ??
  model<UploadRecord>("Upload", schema);
