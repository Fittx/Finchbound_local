import { randomUUID } from "node:crypto";
import { loadEnvFile } from "node:process";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { parseEnv, ConfigurationError } from "../src/config/env.js";
import { createDatabase } from "../src/config/db.js";
import { initializeAuthModels } from "../src/models/auth.js";
import { initializeBookModels } from "../src/models/books.js";
import { initializeUploadModels } from "../src/models/uploads.js";
import { initializeGuestModels } from "../src/models/guests.js";
async function main() {
  try {
    loadEnvFile(resolve(import.meta.dirname, "../.env"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const config = parseEnv(),
    database = createDatabase(config);
  const probeName = "finchbound_persistence_check_" + randomUUID().replaceAll("-", "");
  const marker = randomUUID();
  let probeWritten = false;
  try {
    await database.connect();
    await mongoose.connection.db!.command({ ping: 1 });
    if (process.argv.includes("--probe")) {
      await initializeAuthModels();
      await initializeBookModels();
      await initializeUploadModels();
      await initializeGuestModels();
      const probe = mongoose.connection.getClient().db(probeName);
      await probe
        .collection<{ _id: string; marker: string }>("persistence")
        .insertOne({ _id: marker, marker }, { writeConcern: { w: "majority", j: true } });
      probeWritten = true;
      await database.disconnect();
      await database.connect();
      const reconnected = mongoose.connection.getClient().db(probeName);
      const stored = await reconnected
        .collection<{ _id: string; marker: string }>("persistence")
        .findOne({ _id: marker });
      if (stored?.marker !== marker) throw new Error("Persistence check failed");
    }
    const counts: Record<string, number> = {};
    for (const name of [
      "users",
      "books",
      "pages",
      "uploads",
      "submissions",
      "reports",
      "blockedguests",
    ])
      counts[name] = await mongoose.connection.db!.collection(name).countDocuments();
    console.log(
      JSON.stringify(
        {
          connected: database.isReady(),
          replicaSetRequired: true,
          persistenceAfterReconnect: probeWritten ? "PASS" : "not requested",
          applicationCollections: counts,
          frontendStillUsesMocks: true,
        },
        null,
        2,
      ),
    );
  } finally {
    if (probeWritten && mongoose.connection.readyState === 1) {
      const probe = mongoose.connection.getClient().db(probeName);
      if (
        probe.databaseName !== probeName ||
        !probeName.startsWith("finchbound_persistence_check_")
      )
        throw new Error("Refusing unexpected cleanup database");
      await probe.dropDatabase();
    }
    await database.disconnect();
  }
}
void main().catch((error) => {
  console.error(
    JSON.stringify({
      connected: false,
      error:
        error instanceof ConfigurationError
          ? "Invalid configuration fields: " + error.fields.join(", ")
          : "Database check failed. Check MongoDB service, replica set, permissions and configuration.",
    }),
  );
  process.exitCode = 1;
});
