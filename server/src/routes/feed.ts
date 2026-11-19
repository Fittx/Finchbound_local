import { Router } from "express";
import { setTimeout as delay } from "node:timers/promises";
import type { Env } from "../config/env.js";
import type { AuthService } from "../services/auth.js";
import { readFeed } from "../services/feed.js";
import { principal, requireAuth } from "../middleware/requireAuth.js";
import { validate } from "../middleware/validate.js";
import { bookParams } from "../validators/books.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { readSessionCookie } from "../utils/cookies.js";
import { CursorCodec } from "../utils/cursor.js";

export function createFeedRouter(config: Env, auth: AuthService, shutdown?: AbortSignal): Router {
  const router = Router();
  const cursors = new CursorCodec(config.JWT_SECRET);
  const clients = new Map<string, number>();
  router.get(
    "/books/:bookId/submissions/stream",
    requireAuth(config, auth),
    validate({ params: bookParams }),
    asyncHandler(async (req, res) => {
      const { bookId } = res.locals.validated.params as { bookId: string };
      const host = principal(res);
      const scope = JSON.stringify(["feed", host.userId, bookId]);
      const raw = req.get("Last-Event-ID");
      if (raw && raw.length > 2048) throw new ApiError("VALIDATION_FAILED");
      const bookmark = cursors.decode(raw, scope);
      if (
        bookmark &&
        (bookmark.id !== bookId ||
          typeof bookmark.key !== "number" ||
          !Number.isSafeInteger(bookmark.key) ||
          bookmark.key < 0)
      )
        throw new ApiError("VALIDATION_FAILED");
      const token = readSessionCookie(req.get("cookie"), config);
      const count = clients.get(host.userId) ?? 0;
      if (count >= 8) throw new ApiError("RATE_LIMITED");
      clients.set(host.userId, count + 1);
      const lifetime = new AbortController();
      const stop = () => lifetime.abort();
      res.once("close", stop);
      shutdown?.addEventListener("abort", stop, { once: true });
      const send = (name: string, sequence: number, data: unknown) => {
        const id = cursors.encode({ id: bookId, key: sequence, scope });
        return res.write(`id: ${id}\nevent: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
      };
      try {
        let position = bookmark?.key as number | undefined;
        let batch = await readFeed(host, bookId, position);
        if (res.destroyed || shutdown?.aborted || lifetime.signal.aborted) return;
        res.set({
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-store, no-transform",
          "X-Accel-Buffering": "no",
        });
        res.flushHeaders();
        if (position === undefined) {
          position = batch.head;
          if (!send("ready", position, { bookId })) return;
        }
        let heartbeat = Date.now();
        while (!lifetime.signal.aborted) {
          if (batch.reset) {
            position = batch.head;
            if (!send("reset", position, { bookId })) break;
          }
          for (const event of batch.events) {
            if (!send(event.name, event.sequence, event.data)) return;
            position = event.sequence;
          }
          if (Date.now() - heartbeat >= 15000) {
            if (!res.write(": heartbeat\n\n")) break;
            heartbeat = Date.now();
          }
          if (position === batch.head) await delay(2000, undefined, { signal: lifetime.signal });
          const current = await auth.authenticate(token);
          batch = await readFeed(current, bookId, position);
        }
      } catch (error) {
        if (!res.headersSent && !lifetime.signal.aborted) throw error;
      } finally {
        res.off("close", stop);
        shutdown?.removeEventListener("abort", stop);
        const remaining = (clients.get(host.userId) ?? 1) - 1;
        if (remaining) clients.set(host.userId, remaining);
        else clients.delete(host.userId);
        if (res.headersSent && !res.destroyed) res.end();
        else if (shutdown?.aborted && !res.destroyed) res.destroy();
      }
    }),
  );
  return router;
}
