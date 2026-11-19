import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { ApiError } from "../utils/ApiError.js";
import type { Logger } from "../utils/logger.js";
import { validationError } from "./validate.js";

export const notFound: RequestHandler = (_req, _res, next) => next(new ApiError("NOT_FOUND"));

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, req, res, next) => {
    if (res.headersSent) return next(error);
    let safe: ApiError;
    let statusOverride: number | undefined;
    const details =
      typeof error === "object" && error !== null ? (error as Record<string, unknown>) : {};
    if (error instanceof ApiError) safe = error;
    else if (details.name === "MulterError") {
      safe =
        details.code === "LIMIT_FILE_SIZE"
          ? new ApiError("FILE_TOO_LARGE")
          : new ApiError("VALIDATION_FAILED", "Send exactly one image in the file field.", {
              file: "Send exactly one image",
            });
    } else if (error instanceof ZodError) safe = validationError(error);
    else if (details.type === "entity.too.large") {
      safe = new ApiError("FILE_TOO_LARGE", "The request body is too large.");
    } else if (details.type === "entity.parse.failed" || details.type === "request.aborted") {
      safe = new ApiError("VALIDATION_FAILED", "Send a valid UTF-8 JSON request.");
    } else if (details.type === "charset.unsupported" || details.type === "encoding.unsupported") {
      safe = new ApiError("VALIDATION_FAILED", "Send uncompressed UTF-8 JSON.");
      statusOverride = 415;
    } else if (details.code === 11000) {
      const keys =
        typeof details.keyPattern === "object" && details.keyPattern !== null
          ? (details.keyPattern as Record<string, unknown>)
          : {};
      safe = new ApiError("email" in keys ? "EMAIL_TAKEN" : "CONFLICT");
    } else if (details.name === "CastError" || details.name === "ValidationError") {
      safe = new ApiError("VALIDATION_FAILED");
    } else {
      safe = new ApiError("SERVER");
    }
    if (safe.status >= 500) {
      logger.error("request_failed", {
        requestId: String(res.locals.requestId ?? ""),
        code: safe.code,
      });
    }
    res.status(statusOverride ?? safe.status).json(safe.toBody());
  };
}
