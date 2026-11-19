import { Types, trusted, type ClientSession } from "mongoose";
import { Upload } from "../models/Upload.js";
import { ApiError } from "../utils/ApiError.js";
/** Canonical proxy URL, never an R2 object key or expiring signed object URL. */
export const assetUrl = (id: string, size = "page") => `/api/uploads/${id}/${size}`;
export function parseAssetUrl(value: string) {
  try {
    const url = new URL(value, "https://finchbound.invalid");
    if (!["https:", "http:"].includes(url.protocol)) throw new Error();
    const match = /^\/api\/uploads\/([a-f0-9]{24})\/(thumbnail|page|lightbox)$/.exec(url.pathname);
    if (!match) throw new Error();
    return { id: match[1]!, size: match[2]!, url: assetUrl(match[1]!, match[2]!) };
  } catch {
    throw new ApiError("VALIDATION_FAILED", "Use an image returned by the upload API.", {
      image: "Upload this image first",
    });
  }
}
export async function bindPageImages(
  ownerId: string,
  bookId: Types.ObjectId,
  input: { image?: string | undefined; cardImage?: string | undefined },
  session: ClientSession,
) {
  const result: { image?: string; cardImage?: string } = {};
  for (const field of ["image", "cardImage"] as const) {
    const value = input[field];
    if (value === undefined) continue;
    if (value === "") {
      result[field] = "";
      continue;
    }
    const ref = parseAssetUrl(value);
    const upload = await Upload.findOne({
      _id: ref.id,
      status: "ready",
      ownerId: new Types.ObjectId(ownerId),
      $or: [{ bookId: null }, { bookId }],
    }).session(session);
    if (!upload) throw new ApiError("FORBIDDEN", "That image does not belong to this book.");
    if (!upload.renditions.has(ref.size)) throw new ApiError("NOT_FOUND");
    if (!upload.bookId) {
      await Upload.updateOne({ _id: upload._id, bookId: null }, { $set: { bookId } }, { session });
    }
    result[field] = ref.url;
  }
  return result;
}
