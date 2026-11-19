import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";
import { ACCOUNT_PLANS, LIMITS } from "../../../shared/constants.js";
import { isGmailAccountEmail } from "../../../shared/email.js";

const schema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: LIMITS.personName },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      validate: isGmailAccountEmail,
    },
    passwordHash: { type: String, required: true, select: false },
    plan: { type: String, enum: ACCOUNT_PLANS, default: "unlimited", required: true },
    failedLogins: { type: Number, default: 0, min: 0, required: true },
    lockedUntil: { type: Date, default: null },
    emailVerified: { type: Boolean, default: false, required: true },
    resourceVersion: { type: Number, default: 0 },
    authVersion: { type: Number, default: 0, min: 0, required: true },
  },
  { timestamps: true, strict: "throw" },
);
schema.index({ email: 1 }, { unique: true });
export type UserRecord = InferSchemaType<typeof schema>;
export const User: Model<UserRecord> =
  (mongoose.models.User as Model<UserRecord> | undefined) ?? model<UserRecord>("User", schema);
