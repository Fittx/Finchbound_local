import type { RequestHandler } from "express";
import { ApiError } from "../utils/ApiError.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
/** CORS controls response access; this check independently protects cookie-authenticated writes. */
export function requireTrustedOrigin(clientOrigin: string): RequestHandler {
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    if (req.get("origin") !== clientOrigin) {
      return next(new ApiError("FORBIDDEN", "This request must come from the Finchbound client."));
    }
    next();
  };
}
