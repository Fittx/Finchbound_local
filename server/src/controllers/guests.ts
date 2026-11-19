import type { RequestHandler } from "express";
import type { Env } from "../config/env.js";
import type { GuestService } from "../services/guests.js";
import { guestCookieName, readGuestCookie } from "../services/guestSecurity.js";
import { principal } from "../middleware/requireAuth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
export function guestControllers(
  config: Env,
  guests: GuestService,
): Record<"event" | "sendCode" | "confirmCode" | "submit" | "report" | "block", RequestHandler> {
  return {
    event: asyncHandler(async (_req, res) =>
      res.json(await guests.event(res.locals.validated.params.slug)),
    ),
    sendCode: asyncHandler(async (req, res) =>
      res.json(
        await guests.sendCode(
          res.locals.validated.params.slug,
          res.locals.validated.body.email,
          res.locals.captchaProof as string,
        ),
      ),
    ),
    confirmCode: asyncHandler(async (req, res) => {
      const body = res.locals.validated.body;
      const result = await guests.confirmCode(
        res.locals.validated.params.slug,
        body.email,
        body.code,
        res.locals.captchaProof as string,
      );
      res.cookie(guestCookieName(config, result.bookId), result.token, {
        httpOnly: true,
        secure: config.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: result.expiresAt,
      });
      res.json({ ok: true });
    }),
    submit: asyncHandler(async (req, res) => {
      // Decode no untrusted book ID from the body; resolve the trusted route first.
      const slug = res.locals.validated.params.slug;
      const bookId = await guests.bookId(slug);
      const token = readGuestCookie(config, req.get("cookie"), guestCookieName(config, bookId));
      res.status(201).json(await guests.submit(slug, res.locals.validated.body, token));
    }),
    report: asyncHandler(async (_req, res) =>
      res
        .status(201)
        .json(
          await guests.report(
            res.locals.validated.params.slug,
            res.locals.validated.body,
            res.locals.guestFingerprint,
          ),
        ),
    ),
    block: asyncHandler(async (_req, res) =>
      res
        .status(201)
        .json(
          await guests.block(
            principal(res),
            res.locals.validated.params.bookId,
            res.locals.validated.body.submissionId,
          ),
        ),
    ),
  };
}
