import { Readable } from "node:stream";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { ConfigurationError, type Env } from "./env.js";
import { ApiError } from "../utils/ApiError.js";
export function getStorageConfig(env: Env) {
  if (
    !env.STORAGE_ENDPOINT ||
    !env.STORAGE_BUCKET ||
    !env.STORAGE_ACCESS_KEY_ID ||
    !env.STORAGE_SECRET_ACCESS_KEY
  )
    throw new ConfigurationError([
      "STORAGE_ENDPOINT",
      "STORAGE_BUCKET",
      "STORAGE_ACCESS_KEY_ID",
      "STORAGE_SECRET_ACCESS_KEY",
    ]);
  return {
    endpoint: env.STORAGE_ENDPOINT,
    region: env.STORAGE_REGION,
    bucket: env.STORAGE_BUCKET,
    credentials: {
      accessKeyId: env.STORAGE_ACCESS_KEY_ID,
      secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
    },
    quarantinePrefix: env.STORAGE_QUARANTINE_PREFIX,
    maxPixels: env.UPLOAD_MAX_PIXELS,
    uploadTokenTtlSeconds: env.UPLOAD_TOKEN_TTL_SECONDS,
  };
}
export interface ObjectStorage {
  assertConfigured(): void;
  put(key: string, bytes: Buffer, type: string): Promise<void>;
  remove(key: string): Promise<void>;
  get(key: string): Promise<{ body: Readable; bytes?: number }>;
}
/** Object keys are server-generated; anything else is refused before touching the disk. */
const SAFE_KEY = /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+(?:\.[a-z]+)?)*$/;

/** Development-only storage on this machine, so uploads work without Cloudflare R2. */
function createLocalStorage(config: Env): ObjectStorage {
  const root = resolve(config.STORAGE_LOCAL_DIR);
  const file = (key: string) => {
    const path = resolve(root, key);
    if (!SAFE_KEY.test(key) || !path.startsWith(root + sep)) throw new Error("Unsafe key");
    return path;
  };
  const safe = async <T>(work: () => Promise<T>): Promise<T> => {
    try {
      return await work();
    } catch {
      throw new ApiError("UPLOAD_FAILED", "Image storage is temporarily unavailable.");
    }
  };
  return {
    assertConfigured() {},
    put: (key, bytes) =>
      safe(async () => {
        const path = file(key);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, bytes);
      }),
    remove: (key) => safe(() => rm(file(key), { force: true })),
    get: (key) =>
      safe(async () => {
        const path = file(key);
        const { size } = await stat(path);
        return { body: createReadStream(path), bytes: size };
      }),
  };
}

/** Private R2 only: never sets public ACLs and never returns object URLs. */
export function createObjectStorage(config: Env): ObjectStorage {
  if (config.STORAGE_PROVIDER === "local") return createLocalStorage(config);
  let client: S3Client | undefined;
  const ready = () => {
    try {
      const settings = getStorageConfig(config);
      client ??= new S3Client({
        endpoint: settings.endpoint,
        region: settings.region,
        credentials: settings.credentials,
        maxAttempts: 2,
        requestHandler: { connectionTimeout: 5000, requestTimeout: 15000 },
      });
      return { client, bucket: settings.bucket };
    } catch {
      throw new ApiError("SERVER", "Image storage is not configured.", undefined, 503);
    }
  };
  const safe = async <T>(work: () => Promise<T>): Promise<T> => {
    try {
      return await work();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("UPLOAD_FAILED", "Image storage is temporarily unavailable.");
    }
  };
  return {
    assertConfigured() {
      ready();
    },
    put: (key, bytes, type) =>
      safe(async () => {
        const { client, bucket } = ready();
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: bytes,
            ContentType: type,
            CacheControl: "private, no-store",
          }),
        );
      }),
    remove: (key) =>
      safe(async () => {
        const { client, bucket } = ready();
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      }),
    get: (key) =>
      safe(async () => {
        const { client, bucket } = ready();
        const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (!(response.Body instanceof Readable)) throw new Error();
        return {
          body: response.Body,
          ...(response.ContentLength !== undefined ? { bytes: response.ContentLength } : {}),
        };
      }),
  };
}
