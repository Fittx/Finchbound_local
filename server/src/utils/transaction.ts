import mongoose, { type ClientSession } from "mongoose";
/** Each retry must rebuild documents; callbacks must contain database work only. */
export async function transaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.connection.startSession();
  try {
    return await session.withTransaction(() => work(session));
  } finally {
    await session.endSession();
  }
}
