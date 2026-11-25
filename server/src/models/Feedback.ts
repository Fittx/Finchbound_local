import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";
const schema = new Schema(
  {
    bookId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, default: "", maxlength: 80 },
    message: { type: String, required: true, maxlength: 1000 },
  },
  { timestamps: true, strict: "throw" },
);
schema.index({ bookId: 1, _id: -1 });
type Record = InferSchemaType<typeof schema>;
export const Feedback: Model<Record> =
  (mongoose.models.Feedback as Model<Record> | undefined) ?? model<Record>("Feedback", schema);
