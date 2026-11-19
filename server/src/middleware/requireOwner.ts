import type { Request, RequestHandler } from "express";
import type { AuthPrincipal } from "../services/auth.js";
import { principal } from "./requireAuth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

/** Shared authorization function for future HTTP, SSE and optional socket handlers. */
export function authorizeOwner(auth: AuthPrincipal, ownerId: string) {
  if (auth.userId !== ownerId) throw new ApiError("FORBIDDEN");
}
/** Call after requireAuth and parameter validation. The resolver reads the persisted owner. */
export function requireOwner(
  resolveOwner: (req: Request) => Promise<string | null>,
): RequestHandler {
  return asyncHandler(async (req, res, next) => {
    const auth = principal(res);
    const ownerId = await resolveOwner(req);
    if (!ownerId) throw new ApiError("NOT_FOUND");
    authorizeOwner(auth, ownerId);
    next();
  });
}
