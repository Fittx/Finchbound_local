import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

export const eventNames = [
  "submission",
  "submission:updated",
  "reaction:updated",
  "submission:deleted",
  "reset",
] as const;
export type FeedEventName = (typeof eventNames)[number];
const schema = new Schema(
  {
    bookId: { type: Schema.Types.ObjectId, required: true },
    sequence: { type: Number, required: true },
    name: { type: String, enum: eventNames, required: true },
    entryId: { type: Schema.Types.ObjectId, default: null },
    createdAt: { type: Date, default: Date.now, expires: 86400 },
  },
  { versionKey: false },
);
schema.index({ bookId: 1, sequence: 1 }, { unique: true });
type Row = InferSchemaType<typeof schema>;
export const FeedEvent: Model<Row> =
  (mongoose.models.FeedEvent as Model<Row> | undefined) ?? model<Row>("FeedEvent", schema);
