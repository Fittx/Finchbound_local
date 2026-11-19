import { z } from "zod";
import { LIMITS, PAGE_SIZE, SUBMISSION_STATUSES } from "../../../shared/constants.js";
import { listPagesQuery, objectId } from "./books.js";

export const entryParams = z.strictObject({ id: objectId });
export const moderationQuery = listPagesQuery.pick({ cursor: true, withPhoto: true }).extend({
  q: z.string().trim().max(LIMITS.personName).optional(),
  status: z.enum(["all", ...SUBMISSION_STATUSES]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(PAGE_SIZE.submissions),
});
export const statusBody = z
  .strictObject({
    status: z.enum(SUBMISSION_STATUSES),
    pageId: objectId.optional(),
  })
  .refine(
    (value) => value.status === "in-book" || !value.pageId,
    "Only an undo can restore a page",
  );
export const bulkBody = z.strictObject({
  ids: z.array(objectId).min(1).max(100),
  action: z.enum(["approve", "reject"]),
});
export type ModerationQuery = z.infer<typeof moderationQuery>;
