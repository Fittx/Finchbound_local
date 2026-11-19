import { Readable } from "node:stream";
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
/** Private R2 only: never sets public ACLs and never returns object URLs. */
export function createObjectStorage(config: Env): ObjectStorage {
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
