import { purgeDeleted } from "./jobs/purgeDeleted.js";
import { createObjectStorage } from "./config/storage.js";
import { createServer } from "node:http";
import { loadEnvFile } from "node:process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createApp } from "./app.js";
import { createDatabase } from "./config/db.js";
import { ConfigurationError, parseEnv } from "./config/env.js";
import { createLogger } from "./utils/logger.js";
import { initializeAuthModels } from "./models/auth.js";
import { initializeBookModels } from "./models/books.js";
import { initializeUploadModels } from "./models/uploads.js";
import { initializeGuestModels } from "./models/guests.js";

export async function startServer() {
  try {
    loadEnvFile(resolve(process.cwd(), ".env"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const config = parseEnv();
  const logger = createLogger(config.LOG_LEVEL);
  // Fail before listening if installation is incomplete; never run partial auth.
  await Promise.all([import("bcrypt"), import("jsonwebtoken"), import("nodemailer")]);
  const database = createDatabase(config);
  // No HTTP listener is opened until connection and transaction capability checks succeed.
  await database.connect();
  try {
    await initializeAuthModels();
    await initializeBookModels();
    await initializeUploadModels();
    await initializeGuestModels();
  } catch (error) {
    await database.disconnect();
    throw error;
  }
  const storage = createObjectStorage(config);
  const streams = new AbortController();
  let server: ReturnType<typeof createServer>;
  try {
    server = createServer(
      createApp({
        config,
        isDatabaseReady: database.isReady,
        logger,
        storage,
        streamShutdown: streams.signal,
      }),
    );
  } catch (error) {
    await database.disconnect();
    throw error;
  }
  server.requestTimeout = config.REQUEST_TIMEOUT_MS;
  server.headersTimeout = Math.min(60000, config.REQUEST_TIMEOUT_MS);
  try {
    await new Promise<void>((done, reject) => {
      server.once("error", reject);
      server.listen(config.PORT, config.HOST, () => {
        server.removeListener("error", reject);
        done();
      });
    });
  } catch (error) {
    await database.disconnect();
    throw error;
  }
  logger.info("server_started", { port: config.PORT, host: config.HOST });
  server.on("error", () => logger.error("http_server_failed"));
  let running: Promise<void> | undefined;
  const maintenance = setInterval(() => {
    if (running) return;
    running = purgeDeleted(storage)
      .then(({ failed }) => {
        if (failed) logger.warn("storage_cleanup_retry");
      })
      .catch(() => logger.error("maintenance_failed"))
      .finally(() => {
        running = undefined;
      });
  }, config.MAINTENANCE_INTERVAL_MS);
  maintenance.unref();
  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    clearInterval(maintenance);
    streams.abort();
    logger.info("server_stopping", { signal });
    const deadline = setTimeout(() => {
      logger.error("shutdown_timeout");
      process.exit(1);
    }, config.SHUTDOWN_TIMEOUT_MS);
    deadline.unref();
    try {
      await new Promise<void>((done, reject) => {
        server.close((error) => (error ? reject(error) : done()));
        server.closeIdleConnections();
      });
    } catch {
      logger.error("shutdown_failed");
      process.exitCode = 1;
    } finally {
      try {
        await running;
        await database.disconnect();
      } catch {
        logger.error("database_shutdown_failed");
        process.exitCode = 1;
      }
      clearTimeout(deadline);
    }
  };
  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void startServer().catch((error: unknown) => {
    const logger = createLogger();
    // ConfigurationError contains field names only. Other errors may contain DB credentials.
    logger.error(error instanceof ConfigurationError ? error.message : "server_startup_failed");
    process.exitCode = 1;
  });
}
