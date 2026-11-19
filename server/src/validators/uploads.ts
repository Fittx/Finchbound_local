import { z } from "zod";
import { slug, objectId } from "./books.js";
export const captchaBody = z.strictObject({
  token: z.string().min(1).max(2048),
  bookSlug: slug,
  draftId: z.uuid(),
});
export const imageParams = z.strictObject({
  uploadId: objectId,
  size: z.enum(["thumbnail", "page", "lightbox"]),
});
export const imageQuery = z.strictObject({ previewToken: z.string().min(1).max(2048).optional() });
export type CaptchaInput = z.infer<typeof captchaBody>;
