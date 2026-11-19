import { z } from "zod";
import { LIMITS } from "../../../shared/constants.js";

const optionalText = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);
const optionalSecret = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);
const integer = (fallback: number, minimum: number, maximum: number) =>
  z.coerce.number().int().min(minimum).max(maximum).default(fallback);
const isOrigin = (value: string) => {
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
};

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    MAINTENANCE_INTERVAL_MS: integer(60000, 1000, 86400000),
    HOST: z.string().trim().min(1).default("127.0.0.1"),
    PORT: integer(3001, 1, 65535),
    SERVE_CLIENT: z.enum(["true", "false"]).default("false"),
    CLIENT_URL: z
      .string()
      .refine(isOrigin, "Must be one HTTP(S) origin without a path or credentials")
      .transform((value) => new URL(value).origin),
    MONGODB_URI: z
      .string()
      .min(1)
      .regex(/^mongodb(?:\+srv)?:\/\/[^\s]+$/, "Must be a MongoDB connection URI"),
    MONGODB_DB_NAME: z
      .string()
      .regex(/^[A-Za-z0-9_-]+$/)
      .default("finchbound"),
    MONGODB_CONNECT_TIMEOUT_MS: integer(5000, 1000, 60000),
    MONGODB_MAX_POOL_SIZE: integer(10, 1, 100),
    JWT_SECRET: z
      .string()
      .refine(
        (value) =>
          Buffer.byteLength(value, "utf8") >= 32 &&
          !/replace|change.?me|example|placeholder/i.test(value),
        "Must be a generated secret of at least 32 bytes; example placeholders are rejected",
      ),
    JWT_ISSUER: z.string().min(1).default("finchbound"),
    JWT_AUDIENCE: z.string().min(1).default("finchbound-client"),
    JWT_SESSION_MINUTES: integer(LIMITS.sessionMinutes, 1, 1440),
    JWT_REMEMBER_DAYS: integer(30, 1, 90),
    JWT_COOKIE_NAME: z
      .string()
      .regex(/^[A-Za-z0-9_-]+$/)
      .default("fb-session"),
    BCRYPT_ROUNDS: integer(12, 10, 15),
    OTP_MAX_ATTEMPTS: integer(5, 1, 10),
    OTP_TTL_MINUTES: integer(10, 1, 10),
    PASSWORD_RESET_TTL_MINUTES: integer(60, 1, 60),
    AUTH_RATE_LIMIT_MAX_REQUESTS: integer(30, 5, 300),
    TRUST_PROXY: z.enum(["false", "loopback", "1"]).default("false"),
    REQUEST_BODY_LIMIT_BYTES: integer(32768, 1024, 1048576),
    REQUEST_TIMEOUT_MS: integer(30000, 1000, 120000),
    SHUTDOWN_TIMEOUT_MS: integer(10000, 1000, 30000),
    RATE_LIMIT_WINDOW_MS: integer(60000, 1000, 3600000),
    RATE_LIMIT_MAX_REQUESTS: integer(120, 1, 10000),
    LOG_LEVEL: z.enum(["info", "warn", "error"]).default("info"),
    STORAGE_PROVIDER: z.literal("r2").default("r2"),
    STORAGE_ENDPOINT: optionalText,
    STORAGE_REGION: z.string().min(1).default("auto"),
    STORAGE_BUCKET: optionalText,
    STORAGE_ACCESS_KEY_ID: optionalText,
    STORAGE_SECRET_ACCESS_KEY: optionalSecret,
    STORAGE_QUARANTINE_PREFIX: z
      .string()
      .regex(/^[A-Za-z0-9_-]+\/$/)
      .default("quarantine/"),
    UPLOAD_TOKEN_TTL_SECONDS: integer(600, 60, 600),
    UPLOAD_MAX_PIXELS: integer(40000000, 1000000, 100000000),
    UPLOAD_MAX_PER_DRAFT: integer(6, 2, 30),
    UPLOAD_CONCURRENCY: integer(2, 1, 8),
    UPLOAD_PROCESS_TIMEOUT_SECONDS: integer(15, 1, 60),
    EMAIL_PROVIDER: z.enum(["smtp", "brevo"]).default("smtp"),
    BREVO_API_KEY: optionalSecret,
    EMAIL_FROM: z.preprocess((value) => (value === "" ? undefined : value), z.email().optional()),
    SMTP_HOST: optionalText,
    SMTP_PORT: integer(587, 1, 65535),
    SMTP_SECURE: z.enum(["true", "false"]).default("false"),
    SMTP_USER: optionalText,
    SMTP_PASSWORD: optionalSecret,
    SMTP_FROM: z.preprocess((value) => (value === "" ? undefined : value), z.email().optional()),
    TURNSTILE_SECRET: optionalText,
    TURNSTILE_ACTION: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,32}$/)
      .default("guest-upload"),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production" && /^__(Host|Secure)-/.test(env.JWT_COOKIE_NAME)) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_COOKIE_NAME"],
        message: "Secure cookie prefixes require production HTTPS",
      });
    }
    const storageKeys = [
      "STORAGE_ENDPOINT",
      "STORAGE_BUCKET",
      "STORAGE_ACCESS_KEY_ID",
      "STORAGE_SECRET_ACCESS_KEY",
    ] as const;
    const smtpKeys = ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"] as const;
    const mailKeys =
      env.EMAIL_PROVIDER === "brevo" ? (["BREVO_API_KEY", "EMAIL_FROM"] as const) : smtpKeys;
    for (const keys of [storageKeys, mailKeys]) {
      if (env.NODE_ENV === "production" || keys.some((key) => Boolean(env[key]))) {
        for (const key of keys) {
          if (!env[key])
            ctx.addIssue({
              code: "custom",
              path: [key],
              message: "Required for this service configuration",
            });
        }
      }
    }
    if (env.STORAGE_ENDPOINT) {
      try {
        const endpoint = new URL(env.STORAGE_ENDPOINT);
        if (
          endpoint.protocol !== "https:" ||
          endpoint.username ||
          endpoint.password ||
          endpoint.search ||
          endpoint.hash ||
          endpoint.pathname !== "/"
        )
          throw new Error();
      } catch {
        ctx.addIssue({
          code: "custom",
          path: ["STORAGE_ENDPOINT"],
          message: "Must be an HTTPS R2 origin without credentials or a path",
        });
      }
    }
    if (env.NODE_ENV === "production") {
      if (!env.CLIENT_URL.startsWith("https://")) {
        ctx.addIssue({
          code: "custom",
          path: ["CLIENT_URL"],
          message: "Production requires HTTPS",
        });
      }
      if (!env.TURNSTILE_SECRET) {
        ctx.addIssue({
          code: "custom",
          path: ["TURNSTILE_SECRET"],
          message: "Required in production",
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export class ConfigurationError extends Error {
  constructor(readonly fields: string[]) {
    super("Invalid server configuration. Check: " + fields.join(", "));
    this.name = "ConfigurationError";
  }
}

export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse({
    ...source,
    // Render supplies its assigned HTTPS origin, including any name suffix.
    CLIENT_URL:
      source.CLIENT_URL ||
      (source.NODE_ENV === "production" ? source.RENDER_EXTERNAL_URL : undefined),
  });
  if (!result.success) {
    // Report names only: never interpolate connection URIs, passwords, or raw Zod inputs.
    throw new ConfigurationError([
      ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
    ]);
  }
  return result.data;
}
