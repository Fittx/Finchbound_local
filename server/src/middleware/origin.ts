import type { RequestHandler } from "express";
import { ApiError } from "../utils/ApiError.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
/** CORS controls response access; this check independently protects cookie-authenticated writes. */
export function requireTrustedOrigin(clientOrigins: readonly string[]): RequestHandler {
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    if (!clientOrigins.includes(req.get("origin") ?? "")) {
      return next(new ApiError("FORBIDDEN", "This request must come from the Finchbound client."));
    }
    next();
  };
}
