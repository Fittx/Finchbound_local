import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import type { Env } from "../config/env.js";
import type { AuthService } from "../services/auth.js";
import { authControllers } from "../controllers/auth.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { ApiError } from "../utils/ApiError.js";
import {
  emailBody,
  loginBody,
  registerBody,
  resetBody,
  resetParams,
  verifyBody,
} from "../validators/auth.js";

export function createAuthRouter(config: Env, auth: AuthService): Router {
  const router = Router();
  const handlers = authControllers(config, auth);
  router.use(
    rateLimit({
      windowMs: 15 * 60000,
      limit: config.AUTH_RATE_LIMIT_MAX_REQUESTS,
      skip: (req) => req.path === "/me" || req.path === "/logout",
      standardHeaders: "draft-8",
      legacyHeaders: false,
      handler: (_req, res) => res.status(429).json(new ApiError("RATE_LIMITED").toBody()),
    }),
  );
  router.post("/register", validate({ body: registerBody }), handlers.register);
  router.post("/login", validate({ body: loginBody }), handlers.login);
  router.post("/verify-email", validate({ body: verifyBody }), handlers.verifyEmail);
  router.post("/resend-code", validate({ body: emailBody }), handlers.resendCode);
  router.post("/forgot-password", validate({ body: emailBody }), handlers.forgotPassword);
  router.get("/reset-password/:token", validate({ params: resetParams }), handlers.checkReset);
  router.post("/reset-password", validate({ body: resetBody }), handlers.resetPassword);
  router.post("/logout", validate(), handlers.logout);
  router.get("/me", validate(), requireAuth(config, auth), handlers.me);
  return router;
}
