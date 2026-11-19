import { createAccountRouter } from "./routes/account.js";
import { AccountService } from "./services/account.js";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import type { Env } from "./config/env.js";
import { ApiError } from "./utils/ApiError.js";
import { createLogger, type Logger } from "./utils/logger.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { requireTrustedOrigin } from "./middleware/origin.js";
import { createApiRateLimit } from "./middleware/rateLimit.js";
import { createApiRouter } from "./routes/index.js";
import { createAuthRouter } from "./routes/auth.js";
import { createBookRouter } from "./routes/books.js";
import { AuthService } from "./services/auth.js";
import { createAuthMailer, type AuthMailer } from "./services/mail.js";
import { createUploadRouter } from "./routes/uploads.js";
import { createObjectStorage, type ObjectStorage } from "./config/storage.js";
import { createCaptchaVerifier, type CaptchaVerifier } from "./services/captcha.js";
import { UploadService } from "./services/uploads.js";
import { GuestService } from "./services/guests.js";
import { createModerationRouter } from "./routes/moderation.js";
import { createFeedRouter } from "./routes/feed.js";
import { createGuestRouter } from "./routes/guests.js";
import { mountClient } from "./middleware/client.js";

export function createApp(options: {
  config: Env;
  isDatabaseReady: () => boolean;
  logger?: Logger;
  streamShutdown?: AbortSignal;
  mailer?: AuthMailer;
  storage?: ObjectStorage;
  captcha?: CaptchaVerifier;
  clientDirectory?: string;
}): Express {
  const { config, isDatabaseReady } = options;
  const logger = options.logger ?? createLogger(config.LOG_LEVEL);
  const app = express();
  app.disable("x-powered-by");
  app.disable("etag");
  app.set(
    "trust proxy",
    config.TRUST_PROXY === "1" ? 1 : config.TRUST_PROXY === "loopback" ? "loopback" : false,
  );
  app.set("query parser", "simple");
  app.use((_req, res, next) => {
    res.locals.requestId = randomUUID();
    res.setHeader("X-Request-Id", res.locals.requestId);
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(
    helmet({
      ...(config.NODE_ENV !== "production" ? { strictTransportSecurity: false } : {}),
      contentSecurityPolicy: {
        directives: {
          scriptSrc: ["'self'", "https://challenges.cloudflare.com"],
          frameSrc: ["'self'", "https://challenges.cloudflare.com"],
          connectSrc: ["'self'", "https://challenges.cloudflare.com"],
          imgSrc: ["'self'", "data:", "blob:", "https:"],
          // Local HTTP must not be upgraded to HTTPS by the browser.
          ...(config.NODE_ENV !== "production" ? { upgradeInsecureRequests: null } : {}),
        },
      },
    }),
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || origin === config.CLIENT_URL) return callback(null, true);
        callback(new ApiError("FORBIDDEN", "This origin is not allowed."));
      },
      credentials: true,
      methods: ["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Last-Event-ID"],
      exposedHeaders: ["X-Request-Id", "Retry-After"],
      maxAge: 600,
    }),
  );
  app.use("/api", createApiRateLimit(config), requireTrustedOrigin(config.CLIENT_URL));
  app.use(express.json({ limit: config.REQUEST_BODY_LIMIT_BYTES, strict: true, inflate: false }));
  const mailer = options.mailer ?? createAuthMailer(config);
  const auth = new AuthService(config, mailer, logger);
  app.use("/api/account", createAccountRouter(config, auth, new AccountService(config, mailer)));
  app.use("/api/auth", createAuthRouter(config, auth));
  app.use("/api", createBookRouter(config, auth));
  app.use("/api", createFeedRouter(config, auth, options.streamShutdown));
  app.use("/api", createModerationRouter(config, auth));
  app.use("/api", createGuestRouter(config, auth, new GuestService(config, mailer)));
  app.use(
    "/api",
    createUploadRouter(
      config,
      auth,
      new UploadService(
        config,
        options.storage ?? createObjectStorage(config),
        options.captcha ?? createCaptchaVerifier(config),
        logger,
      ),
    ),
  );
  app.use("/api", createApiRouter(isDatabaseReady));
  // Missing API endpoints must stay JSON 404s, even when serving the website.
  app.use("/api", notFound);
  if (config.SERVE_CLIENT === "true")
    mountClient(app, options.clientDirectory ?? resolve(process.cwd(), "../dist"));
  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
