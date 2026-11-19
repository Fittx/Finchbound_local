import { Router } from "express";
import { z } from "zod";
import { LIMITS } from "../../../shared/constants.js";
import { email, loginBody, newPassword } from "../validators/auth.js";
import type { Env } from "../config/env.js";
import type { AuthService } from "../services/auth.js";
import type { AccountService } from "../services/account.js";
import { requireAuth, principal } from "../middleware/requireAuth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { clearSessionCookie } from "../utils/cookies.js";
export function createAccountRouter(
  config: Env,
  auth: AuthService,
  account: AccountService,
): Router {
  const router = Router();
  router.use(requireAuth(config, auth));
  router.get("/", validate(), (req, res) => {
    res.json({ user: principal(res).user });
  });
  router.patch(
    "/",
    validate({
      body: z.strictObject({ name: z.string().trim().min(1).max(LIMITS.personName), email }),
    }),
    asyncHandler(async (_req, res) => {
      const result = await account.update(principal(res), res.locals.validated.body);

      res.json({ user: result.user });
    }),
  );
  router.post(
    "/password",
    validate({ body: z.strictObject({ currentPassword: loginBody.shape.password, newPassword }) }),
    asyncHandler(async (_req, res) => {
      const { currentPassword, newPassword } = res.locals.validated.body;
      await account.password(principal(res), currentPassword, newPassword);
      clearSessionCookie(res, config);
      res.json({ ok: true });
    }),
  );
  router.delete(
    "/",
    validate({ body: z.strictObject({ email: z.string().email().max(254) }) }),
    asyncHandler(async (_req, res) => {
      await account.remove(principal(res), res.locals.validated.body.email);
      clearSessionCookie(res, config);
      res.json({ ok: true });
    }),
  );
  return router;
}
