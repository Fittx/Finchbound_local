// Validates server/.env and tests the email connection without sending mail or printing secrets.
// Run: npm run check:env (from the repository root).
import { loadEnvFile } from "node:process";
import { resolve } from "node:path";
import { ConfigurationError, parseEnv } from "../src/config/env.js";

try {
  loadEnvFile(resolve(import.meta.dirname, "../.env"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  console.error("server/.env is missing. Run: npm run setup:env");
  process.exit(1);
}
let config;
try {
  config = parseEnv();
} catch (error) {
  console.error(error instanceof ConfigurationError ? error.message : "Invalid configuration");
  process.exit(1);
}
console.log("Configuration: OK");
console.log("  Environment:", config.NODE_ENV);
console.log("  Database:", config.MONGODB_DB_NAME);
console.log("  Photo storage:", config.STORAGE_PROVIDER);
console.log("  Admins configured:", config.ADMIN_EMAILS.length);
console.log("  Human check:", config.TURNSTILE_SECRET ? "Turnstile" : "development bypass");

if (config.EMAIL_PROVIDER === "brevo") {
  console.log("Email: Brevo (API key is checked when the first email is sent)");
} else if (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASSWORD || !config.SMTP_FROM) {
  console.error("Email: SMTP_HOST, SMTP_USER, SMTP_PASSWORD and SMTP_FROM are all required");
  process.exit(1);
} else {
  const { default: nodemailer } = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE === "true",
    requireTLS: config.SMTP_SECURE !== "true",
    auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD },
    tls: { rejectUnauthorized: true },
    connectionTimeout: 10000,
  });
  try {
    await transport.verify();
    console.log("Email: SMTP connected and signed in to", config.SMTP_HOST);
  } catch (error) {
    const e = error as { code?: string; responseCode?: number };
    console.error("Email: SMTP failed", e.code ?? "", e.responseCode ?? "");
    if (e.responseCode === 535)
      console.error("  Gmail needs an App Password (Google Account > Security > App passwords).");
    process.exit(1);
  }
}
