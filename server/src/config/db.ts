import mongoose from "mongoose";
import type { Env } from "./env.js";

export interface Database {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isReady(): boolean;
}

export function createDatabase(config: Env): Database {
  mongoose.set("strictQuery", true);
  mongoose.set("sanitizeFilter", true);
  mongoose.set("bufferCommands", false);
  return {
    async connect() {
      try {
        await mongoose.connect(config.MONGODB_URI, {
          dbName: config.MONGODB_DB_NAME,
          serverSelectionTimeoutMS: config.MONGODB_CONNECT_TIMEOUT_MS,
          maxPoolSize: config.MONGODB_MAX_POOL_SIZE,
          autoIndex: config.NODE_ENV !== "production",
          ...(config.NODE_ENV === "production"
            ? {
                tls: true,
                tlsAllowInvalidCertificates: false,
                tlsAllowInvalidHostnames: false,
              }
            : {}),
        });
        const hello = await mongoose.connection.db?.admin().command({ hello: 1 });
        if (!hello?.setName && hello?.msg !== "isdbgrid") {
          throw new Error("MongoDB must be a replica set or sharded cluster for transactions.");
        }
      } catch (error) {
        await mongoose.disconnect().catch(() => undefined);
        throw error;
      }
    },
    async disconnect() {
      await mongoose.disconnect();
    },
    isReady: () => mongoose.connection.readyState === 1,
  };
}
