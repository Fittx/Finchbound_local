import { z } from "zod";
import { PLATFORM_REPORT_STATUSES } from "../../../shared/constants.js";
import { reportBody } from "./guests.js";
import { objectId } from "./books.js";

export const platformReportBody = reportBody;
export const adminReportsQuery = z.strictObject({
  status: z.enum(PLATFORM_REPORT_STATUSES).default("open"),
  cursor: objectId.optional(),
});
export const reportParams = z.strictObject({ reportId: objectId });
export const submissionParams = z.strictObject({ submissionId: objectId });
export type AdminReportsQuery = z.infer<typeof adminReportsQuery>;
export type PlatformReportInput = z.infer<typeof platformReportBody>;
