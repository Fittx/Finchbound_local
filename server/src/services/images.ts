import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import { ACCEPTED_IMAGE_TYPES, LIMITS } from "../../../shared/constants.js";
import type { Env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
export type RenditionName = "thumbnail" | "page" | "lightbox";
export type ProcessedImage = { name: RenditionName; buffer: Buffer; width: number; height: number };
export async function processImage(
  input: Buffer,
  declaredMime: string,
  config: Env,
): Promise<ProcessedImage[]> {
  if (!input.length) throw new ApiError("UPLOAD_FAILED", "Choose a nonempty image.");
  if (input.length > LIMITS.uploadBytes) throw new ApiError("FILE_TOO_LARGE");
  let detected;
  try {
    detected = await fileTypeFromBuffer(input);
  } catch {
    throw new ApiError("UNSUPPORTED_FILE_TYPE");
  }
  const heif = (mime: string) => mime === "image/heif" || mime === "image/heic";
  if (
    !detected ||
    !ACCEPTED_IMAGE_TYPES.includes(detected.mime) ||
    (detected.mime !== declaredMime && !(heif(detected.mime) && heif(declaredMime)))
  )
    throw new ApiError(
      "UNSUPPORTED_FILE_TYPE",
      "The image bytes do not match a supported file type.",
    );
  try {
    const options = {
      limitInputPixels: config.UPLOAD_MAX_PIXELS,
      failOn: "warning" as const,
      sequentialRead: true,
    };
    const meta = await sharp(input, options).metadata();
    if (
      !meta.width ||
      !meta.height ||
      meta.width * meta.height > config.UPLOAD_MAX_PIXELS ||
      (meta.pages ?? 1) !== 1
    )
      throw new Error();
    const result: ProcessedImage[] = [];
    // Sequential renditions bound peak memory; re-encoding strips EXIF/XMP/ICC by default.
    for (const [name, size] of [
      ["thumbnail", 400],
      ["page", 800],
      ["lightbox", 1800],
    ] as const) {
      const output = await sharp(input, options)
        .rotate()
        .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 85 })
        .timeout({ seconds: config.UPLOAD_PROCESS_TIMEOUT_SECONDS })
        .toBuffer({ resolveWithObject: true });
      result.push({
        name,
        buffer: output.data,
        width: output.info.width,
        height: output.info.height,
      });
    }
    return result;
  } catch {
    throw new ApiError(
      "UPLOAD_FAILED",
      "This image could not be decoded safely. Try JPG, PNG or WebP.",
    );
  }
}
