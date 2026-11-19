import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

/** Persist only a hash of the random JWT ID, never a bearer token. */
const schema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    authVersion: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, strict: "throw" },
);
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
schema.index({ userId: 1 });
export type AuthSessionRecord = InferSchemaType<typeof schema>;
export const AuthSession: Model<AuthSessionRecord> =
  (mongoose.models.AuthSession as Model<AuthSessionRecord> | undefined) ??
  model<AuthSessionRecord>("AuthSession", schema);
