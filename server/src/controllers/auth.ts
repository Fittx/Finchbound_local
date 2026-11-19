import type { Env } from "../config/env.js";
import type { AuthService, SessionGrant } from "../services/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { clearSessionCookie, readSessionCookie, setSessionCookie } from "../utils/cookies.js";
import { principal } from "../middleware/requireAuth.js";
import type { Response, RequestHandler } from "express";
import type {
  SignInRequest,
  SignUpRequest,
  VerifyEmailRequest,
  ResetPasswordRequest,
} from "../../../shared/types/auth.js";

export function authControllers(
  config: Env,
  auth: AuthService,
): Record<
  | "register"
  | "login"
  | "verifyEmail"
  | "resendCode"
  | "forgotPassword"
  | "checkReset"
  | "resetPassword"
  | "logout"
  | "me",
  RequestHandler
> {
  const sendGrant = (res: Response, grant: SessionGrant) => {
    setSessionCookie(res, config, grant.token, grant.remember);
    res.json({ user: grant.user });
  };
  return {
    register: asyncHandler(async (_req, res) => {
      res.status(201).json(await auth.register(res.locals.validated.body as SignUpRequest));
    }),
    login: asyncHandler(async (_req, res) =>
      sendGrant(res, await auth.login(res.locals.validated.body as SignInRequest)),
    ),
    verifyEmail: asyncHandler(async (req, res) => {
      const body = res.locals.validated.body as VerifyEmailRequest;
      sendGrant(
        res,
        await auth.verifyEmail(body.email, body.code, readSessionCookie(req.get("cookie"), config)),
      );
    }),
    resendCode: asyncHandler(async (_req, res) =>
      res.json(await auth.resendCode(res.locals.validated.body.email)),
    ),
    forgotPassword: asyncHandler(async (_req, res) =>
      res.json(await auth.forgotPassword(res.locals.validated.body.email)),
    ),
    checkReset: asyncHandler(async (_req, res) =>
      res.json(await auth.checkResetToken(res.locals.validated.params.token)),
    ),
    resetPassword: asyncHandler(async (_req, res) => {
      const body = res.locals.validated.body as ResetPasswordRequest;
      const result = await auth.resetPassword(body.token, body.password);
      clearSessionCookie(res, config);
      res.json(result);
    }),
    logout: asyncHandler(async (req, res) => {
      await auth.logout(readSessionCookie(req.get("cookie"), config));
      clearSessionCookie(res, config);
      res.status(204).end();
    }),
    me: asyncHandler(async (_req, res) => res.json({ user: principal(res).user })),
  };
}
