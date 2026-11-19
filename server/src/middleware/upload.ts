import type { RequestHandler } from "express";
import { createRequire } from "node:module";
import { ACCEPTED_IMAGE_TYPES, LIMITS } from "../../../shared/constants.js";
import { ApiError } from "../utils/ApiError.js";
/** The small Multer surface used here; upload buffers never enter untyped services. */
export type UploadedImage = { buffer: Buffer; size: number; mimetype: string };
type MultipartFactory = {
  (options: {
    storage: unknown;
    limits: { fileSize: number; files: number; fields: number; parts: number; headerPairs: number };
    fileFilter: (
      req: unknown,
      file: Pick<UploadedImage, "mimetype">,
      done: (error: Error | null, accept?: boolean) => void,
    ) => void;
  }): { single(field: string): RequestHandler };
  memoryStorage(): unknown;
};
const multer = createRequire(import.meta.url)("multer") as MultipartFactory;
/** Acquire before multipart buffering; each accepted request buffers at most 10 MB. */
export function uploadSlots(maximum: number): RequestHandler {
  let active = 0;
  return (_req, res, next) => {
    if (res.destroyed) return;
    if (active >= maximum)
      return next(new ApiError("RATE_LIMITED", "Image processing is busy. Try again shortly."));
    active++;
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        active--;
      }
    };
    res.locals.releaseUpload = release;
    res.once("finish", () => {
      if (!res.locals.processingUpload) release();
    });
    res.once("close", () => {
      if (!res.locals.processingUpload) release();
    });
    next();
  };
}
export const uploadImage: RequestHandler = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITS.uploadBytes, files: 1, fields: 0, parts: 1, headerPairs: 50 },
  fileFilter: (_req, file, done) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.mimetype))
      return done(new ApiError("UNSUPPORTED_FILE_TYPE"));
    done(null, true);
  },
}).single("file");
