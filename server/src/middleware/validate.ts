import type { RequestHandler } from "express";
import { z } from "zod";
import { ApiError } from "../utils/ApiError.js";

export function validationError(error: z.ZodError): ApiError {
  const fields = Object.fromEntries(
    error.issues.slice(0, 20).map((issue) => {
      const path = issue.path[0] === "body" ? issue.path.slice(1) : issue.path;
      return [path.map(String).join(".") || "body", issue.message];
    }),
  );
  return new ApiError("VALIDATION_FAILED", undefined, fields);
}

/** Parsed query values belong in locals; Express 5's req.query is a getter. */
export function validate(
  schemas: {
    body?: z.ZodType;
    params?: z.ZodType;
    query?: z.ZodType;
  } = {},
): RequestHandler {
  const empty = () => z.strictObject({}).default({});
  const requestSchema = z.strictObject({
    body: schemas.body ?? empty(),
    params: schemas.params ?? empty(),
    query: schemas.query ?? empty(),
  });
  return (req, res, next) => {
    const parsed = requestSchema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });
    if (!parsed.success) return next(validationError(parsed.error));
    res.locals.validated = parsed.data;
    next();
  };
}
