import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { ApiError } from "../utils/ApiError.js";

export function createApiRouter(isDatabaseReady: () => boolean): Router {
  const router = Router();
  router.get("/health", validate(), (_req, res, next) => {
    if (!isDatabaseReady()) {
      const error = new ApiError("SERVER", "The service is not ready.");
      // Readiness failure is transient, unlike an unexpected application failure.
      return res.status(503).json(error.toBody());
    }
    res.json({ ok: true });
  });
  return router;
}
