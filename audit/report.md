# Finchbound audit report

Date: 2026-11-25. Commit audited: `845338c` on `main` (working tree clean before and after the audit).
Mode: read-only. No source, config or lockfile was changed. Build output went to a scratch folder, not `dist/`.

Severity scale: **Critical** (exploitable now, severe harm), **High**, **Medium**, **Low**.
"Unverified" means I could not prove it with a run or a test, only by reading code.

---

## 0. Summary

The codebase is in good shape on the fundamentals. I found **no Critical issues**, no committed secrets, no IDOR (every host route checks ownership on the server), and `pnpm audit` reports no known vulnerabilities. Type checks, both builds, 127 unit tests and the build syntax check all pass.

The main risks are about **availability and account abuse** rather than data leaks:

1. Rate limits are keyed per IP and per book, so a busy wedding on shared venue Wi-Fi, or a small attacker, can lock all guests out of a guestbook (SEC-01, High).
2. Anyone who knows a host's Gmail address can keep that account locked (SEC-02, Medium).
3. Account deletion needs only a valid session and the email, no password (SEC-03, Medium).
4. Several flows lose user input: the signup form when opening Terms (verified in a browser), the create wizard when signed out, and Editor saves after the fixed 30-minute session ends (BUG-01..03).

63 of 190 server tests (all the MongoDB integration tests, which are the ones covering auth and authorization end to end) **did not run**, because no MongoDB replica set was running. See section 4.

---

## 1. Project map

**What it does.** Finchbound makes digital guestbooks ("books"). A host signs up, creates a _personal_ book (their own pages) or an _event_ book (guests scan a QR code and add a photo and message). Hosts moderate guest entries in a live "Hub", place approved entries into the book in an Editor, and share a flipbook-style Reader by link. Readers can send private feedback to the host.

**Stack.**

| Layer                      | Tech                                                                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend                   | React 19, Vite 8 (rolldown), Tailwind 4, TypeScript 5.9, custom history router (`src/store.tsx`, `src/lib/routing.ts`)                                     |
| Backend                    | Express 5, Mongoose 9 (MongoDB replica set required for transactions), zod 4 validation, helmet, express-rate-limit, multer + sharp + file-type for images |
| Auth                       | bcrypt (12 rounds), HS256 JWT in an httpOnly cookie, server-side session records (`AuthSession`) that can be revoked                                       |
| Storage / mail / bot check | Private Cloudflare R2 via S3 SDK, SMTP or Brevo HTTPS, Cloudflare Turnstile                                                                                |
| Hosting                    | One Render Free web service serving API + built client (`render.yaml`), MongoDB Atlas                                                                      |
| Tests                      | Vitest + supertest (server), `node --test` (scripts), `scripts/check-scale.mjs` (frontend logic checks)                                                    |

**User roles.** There are no stored roles. Effective roles are:

| Role                       | How identified                                      | Can do                                                         |
| -------------------------- | --------------------------------------------------- | -------------------------------------------------------------- |
| Visitor                    | nothing                                             | Landing, sign up, sign in, legal pages                         |
| Host                       | session cookie (`fb-session`), Gmail address only   | Own books, pages, uploads, moderation, feedback inbox, account |
| Guest                      | Turnstile grant + device cookie, optional email OTP | Add one entry per draft to an open event book, report content  |
| Public reader              | nothing                                             | Read live books with link visibility, send feedback            |
| Admin / platform moderator | **does not exist**                                  | (see GAP-01)                                                   |

**How to run** (from `server/README.md`, `package.json`):

```powershell
corepack pnpm install
# server/.env from server/.env.example, with JWT_SECRET, MONGODB_URI (replica set), SMTP or Brevo, R2, Turnstile
npm run server:dev          # API on 127.0.0.1:3001
npm run dev -- --host 127.0.0.1 --port 5173
```

**How to test**

```powershell
corepack pnpm exec tsc --noEmit            # frontend typecheck
npm run server:typecheck
npm run server:test                         # unit tests; integration tests need TEST_MONGODB_URI
$env:TEST_MONGODB_URI="mongodb://localhost:27018/?replicaSet=rs0"; npm run server:test
npm run check:toolchain; npm run check:frontend
npm run build                               # vite build + generated-JS syntax check
```

---

## 2. Command output (real runs)

| Command                                                                        | Result                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsc --noEmit` (root)                                                          | exit 0, no errors                                                                                                                                                                                                                                                                                       |
| `tsc --noEmit` (server)                                                        | exit 0, no errors                                                                                                                                                                                                                                                                                       |
| `vite build --outDir <scratch>` + `check-build.mjs`                            | built in 2.71s; `Build syntax check: PASS (62 JavaScript files)`                                                                                                                                                                                                                                        |
| `tsc -p tsconfig.build.json --outDir <scratch>` (server)                       | exit 0                                                                                                                                                                                                                                                                                                  |
| `node --test scripts/check-vite-version.test.mjs scripts/check-build.test.mjs` | `tests 4, pass 4, fail 0`                                                                                                                                                                                                                                                                               |
| `node scripts/check-scale.mjs`                                                 | `"result": "PASS"`, 12 check groups, 162 crop cases                                                                                                                                                                                                                                                     |
| `vitest run` (server)                                                          | `Test Files 12 passed \| 4 skipped (16)`, `Tests 127 passed \| 63 skipped (190)`                                                                                                                                                                                                                        |
| `oxfmt --check` (the only lint/format tool configured)                         | **exit 1**: `Format issues found in above 78 files.` Also: `No config found, using defaults.`                                                                                                                                                                                                           |
| `pnpm audit`                                                                   | `No known vulnerabilities found`                                                                                                                                                                                                                                                                        |
| `pnpm outdated -r`                                                             | 18 packages behind, all minor/patch for runtime deps (e.g. `mongoose 9.12.2 → 9.13.0`, `react 19.2.4 → 19.3.1`, `nodemailer 10.6.0 → 10.6.1`, `express-rate-limit 8.7.4 → 8.7.5`, `@aws-sdk/client-s3 3.1171.0 → 3.1176.0`); majors only for dev tooling (`typescript 7`, `vitest 5`, `@types/node 26`) |

Notes:

- The 4 skipped test files are `auth`, `books`, `guests` and `uploads` `*.integration.test.ts`. They are skipped by `describe.skipIf(!uri)` when `TEST_MONGODB_URI` is unset (`server/tests/auth.integration.test.ts:15,62`). The local MongoDB on port 27017 is a standalone (no `setName`), and the README's replica set on 27018 was not running, so I did not run them. **Their results are Unverified.**
- Local Node is v24.19.0; `.mise.toml` pins Node 22 and Render uses `NODE_VERSION=22`. Engines allow `>=22.12.0`, so this is fine but tests ran on a newer Node than production.
- There is no ESLint (or other linter) config in the repo.

---

## 3. Findings

### 3.1 Errors and bugs

| ID     | Sev    | Location                                                                                                                              | What is wrong                                                                                                                                                                                                                                                                                                                                                                              | Why it matters                                                                                                                      | Suggested fix                                                                                                                                                                                                    |
| ------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BUG-01 | Medium | `src/screens/auth/SignUp.tsx:57-60,173-178`; `src/store.tsx:80-89`                                                                    | `rememberLegalDraft` calls `event.stopPropagation()`. That stops the click from reaching the app's document-level link handler, so clicking "Terms of service" does a **full page reload** and the in-memory `legalDraft` is lost. **Verified in a browser**: after typing a name, clicking Terms (page reloaded, JS marker gone) and then "Back to sign up", the Name field was empty.    | The "return to your signup" feature never works; users retype everything, including the password.                                   | Remove `stopPropagation()` (or call `navigate()` explicitly). Do not keep the password in the draft; restore only name/email/terms.                                                                              |
| BUG-02 | Medium | `src/screens/Landing.tsx:71`; `src/screens/Wizard.tsx:111`                                                                            | Landing's "Nest your first book" opens `/create` without checking the session. A signed-out user completes all 3 wizard steps, then `createBook` returns `UNAUTHORIZED` and the app navigates to `/signin?next=/create`, discarding every choice. The slug check also fails silently for them (`Wizard.tsx:63-65` sets `idle`).                                                            | Lost work on the main call to action.                                                                                               | Check the session on Wizard mount and send to sign-in first, or keep the draft in memory and restore it after sign-in.                                                                                           |
| BUG-03 | Medium | `server/src/services/auth.ts:66-68`; `server/src/config/env.ts:61`; `src/screens/Editor.tsx:236-237,248-250`; `src/lib/routing.ts:16` | Sessions without "remember me" last a fixed 30 minutes with no renewal. When it ends, Editor shows a generic "Couldn't save the page" toast; nothing detects `UNAUTHORIZED` and offers to sign in. The `SessionExpired` screen exists but **nothing navigates to it** (grep for `session-expired` finds only the route table).                                                             | A host editing for more than 30 minutes cannot save and is not told why; reloading loses unsaved page text.                         | Add a sliding renewal (re-issue cookie when under half the lifetime is left), and handle `UNAUTHORIZED` centrally in `request()` to route to `/session-expired?next=...` while keeping the open modal's content. |
| BUG-04 | Low    | `src/screens/auth/SignIn.tsx:28,50`; `src/store.tsx:100-103`                                                                          | `next` from the query string is passed straight to `history.pushState`. A cross-origin value (`//evil.example`, `https://...`) is not an open redirect, because `pushState` throws a `SecurityError` for other origins, but the throw happens inside a `setTimeout`, so the screen stays in the "success" state and never leaves sign-in. Unverified in a browser (needs a working login). | Confusing stuck state from a crafted link; fragile pattern if `navigate` ever changes to `location.assign`.                         | Accept `next` only if it starts with a single `/` and not `//` or `/\`; otherwise use `/dashboard`.                                                                                                              |
| BUG-05 | Low    | `server/src/services/moderation.ts:191`                                                                                               | The guest-name search escapes regex characters but omits `^` (compare `services/books.ts:26`, which includes it).                                                                                                                                                                                                                                                                          | Searching a name containing `^` gives wrong results. Not a ReDoS risk (input is max 60 chars and other metacharacters are escaped). | Reuse `literalSearch` from `services/books.ts`.                                                                                                                                                                  |
| BUG-06 | Low    | `server/src/routes/uploads.ts:19-31`; `server/src/services/uploads.ts:77-87`                                                          | `guestIdentity()` increments the grant's `uses` before the IP/book quota and the concurrency slot are checked. A 429 or "busy" response still burns one of the draft's 6 upload uses.                                                                                                                                                                                                      | Guests on a busy event can run out of uploads without having uploaded anything.                                                     | Check quotas and the slot first, or decrement `uses` when the request fails before processing.                                                                                                                   |
| BUG-07 | Low    | `src/screens/Reader.tsx:40-57`                                                                                                        | In preview mode (`?preview=<bookId>`), an expired session produces `UNAUTHORIZED`, which is shown as the generic "unavailable" error instead of sending the host to sign in.                                                                                                                                                                                                               | Confusing for hosts.                                                                                                                | Treat `UNAUTHORIZED` like `useOwnedBook` does (redirect to sign-in with `next`).                                                                                                                                 |
| BUG-08 | Low    | `src/screens/Dashboard.tsx:53-66`; `src/lib/useCursorList.ts:21-58`                                                                   | Book search sends one request per keystroke (query is the reset key, no debounce).                                                                                                                                                                                                                                                                                                         | Fast typing can hit the 120 requests/min API limit and flip the dashboard to its error state.                                       | Debounce by ~300 ms.                                                                                                                                                                                             |
| BUG-09 | Low    | `server/src/validators/books.ts:55-67` vs `server/src/services/assetReferences.ts:6-17`                                               | The page `image` validator accepts any HTTPS URL, but `bindPageImages` later rejects anything that is not `/api/uploads/<id>/<size>`. External URLs never work; they just fail later with a different error.                                                                                                                                                                               | Dead branch and misleading API contract.                                                                                            | Drop the HTTPS-URL branch from the validator, or document that only upload URLs are accepted.                                                                                                                    |

No unhandled promise paths, broken imports or type errors were found: both type checks pass, `asyncHandler` routes every async error to the error handler (`server/src/utils/asyncHandler.ts:7-11`), and the destructive-confirm modal catches failures (`src/components/ConfirmActionModal.tsx:45-54`). Race conditions on books and pages are handled by transactions that write the parent book (`server/src/services/books.ts:85-98`).

### 3.2 Security

#### What is already done well (verified by reading code)

- **Secrets**: no secret is tracked. `git log --all` over all 9 commits shows only `.env.example` files; `.gitignore` ignores `.env*`, keys and dumps. `server/.env` exists locally, is ignored (`git status --ignored`), and contains a 64-char `JWT_SECRET` and an SMTP password (values not printed here). `JWT_SECRET` placeholders are rejected at startup (`server/src/config/env.ts:51-58`).
- **Sessions**: httpOnly, `SameSite=Lax`, `Secure` in production (`server/src/utils/cookies.ts:4-9`); each JWT is tied to a server-side `AuthSession` and `authVersion`, so logout, password change and reset revoke sessions (`services/auth.ts:328-360`, `services/account.ts:76-85`).
- **CSRF**: non-GET `/api` requests must carry `Origin` equal to `CLIENT_URL` (`server/src/middleware/origin.ts:6-13`), plus SameSite cookies and strict CORS (`server/src/app.ts:71-83`).
- **Authorization**: every host route checks ownership on the server: books and pages (`services/books.ts:74-84`), moderation (`services/moderation.ts:31-36`), SSE feed (`services/feed.ts:43`), feedback inbox (`routes/feedback.ts:26`), block guest (`services/guests.ts:339`), uploads (`services/uploads.ts:211-251`). I found no route where changing an ID exposes another host's data.
- **Input**: zod `strictObject` on every route (`middleware/validate.ts`), `mongoose.set("sanitizeFilter", true)` and `strictQuery` (`config/db.ts:11-13`), regex search escaped, body limit 32 KB, JSON only.
- **Uploads**: 10 MB, one file, magic-byte check, pixel limit, sharp re-encode to JPEG (strips EXIF/GPS), private R2, served only through an access-checked proxy (`services/images.ts`, `config/storage.ts`).
- **Passwords**: bcrypt 12, 72-byte guard, dummy hash on unknown emails, timing-safe OTP compare, generic responses on forgot/resend.
- **Headers / data**: helmet with CSP, HSTS in production, `no-store` on API responses, errors return codes only, logger accepts no request data (`utils/logger.ts:18`).
- **XSS**: no `dangerouslySetInnerHTML`, `innerHTML`, `eval` or `localStorage` anywhere in `src/` (grep). All user text is rendered by React.
- **Database rules**: this is MongoDB, not Firebase, so there are no client-side rules; all access goes through the API. Atlas user permissions and IP allowlists are not in the repo: **Unverified**.

#### Findings

| ID     | Sev                                              | Location                                                                                                                                                                                                                                         | What is wrong                                                                                                                                                                                                                              | How it could be exploited                                                                                                                                                                                                                                                                                            | Suggested fix                                                                                                                                                                                                                            |
| ------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-01 | High (availability; real-load impact Unverified) | `server/src/middleware/rateLimit.ts:6-16`; `server/src/app.ts:84`; `server/src/services/guests.ts:37-44`; `server/src/services/uploadQuota.ts:6-30`; `server/src/config/env.ts:76-77`                                                            | Guest endpoints share **per-book** buckets (`guest:event:book:<slug>`, `guest:submit:book:<slug>`, `upload:book:<id>`, `captcha:book:<id>`) with the default limit of 120 per minute, and the global `/api` limiter is 120/min **per IP**. | (a) Attacker: request `GET /api/public/books/<slug>/guest` ~120 times a minute from a couple of IPs; every real guest of that wedding now gets 429. No auth or CAPTCHA is needed for that endpoint. (b) Accidental: 150 guests on venue Wi-Fi (one NAT IP) scanning the QR after an announcement exceed both limits. | Remove or greatly raise per-book limits on read endpoints, key guest limits on the device cookie plus IP, make per-book limits configurable per event size, and cache the public event response. Load-test with an expected guest count. |
| SEC-02 | Medium                                           | `server/src/services/auth.ts:149-161`; `shared/constants.ts:22-23`                                                                                                                                                                               | 5 wrong passwords lock the account for 15 minutes, keyed only on the account.                                                                                                                                                              | Anyone who knows a host's Gmail address can send 5 bad logins every 15 minutes (well under the 30 per 15 min IP limit) and keep the host out, for example on the event day.                                                                                                                                          | Lock per account plus IP, or use progressive delays / CAPTCHA after failures instead of a hard lock; let a verified-email or reset link bypass the lock.                                                                                 |
| SEC-03 | Medium                                           | `server/src/routes/account.ts:43-51`; `server/src/services/account.ts:87-102`                                                                                                                                                                    | Account deletion requires only a session and typing the account email. No password re-entry. Deletion is permanent and cascades to all books and guest content (`jobs/purgeDeleted.ts:39-43`).                                             | Someone with brief access to an unlocked signed-in device (or a stolen session) can wipe all books in one request.                                                                                                                                                                                                   | Require the current password (as `POST /account/password` already does) and send a confirmation email. Consider a grace period.                                                                                                          |
| SEC-04 | Medium                                           | `server/src/routes/auth.ts:21-37`; `server/src/services/auth.ts:97-136,276-295`                                                                                                                                                                  | `register`, `resend-code` and `forgot-password` have no CAPTCHA; only an IP limit (30 per 15 min) and a 30 s per-email cooldown. `register` also answers `EMAIL_TAKEN` (409).                                                              | Distributed requests can make the service send verification/reset emails to arbitrary Gmail addresses (email bombing, sender reputation damage, Brevo quota). `register` lets anyone test whether a Gmail address has a Finchbound account.                                                                          | Add Turnstile to these three forms (already integrated for guests). For enumeration, accept the risk or answer register with a neutral "check your email" response.                                                                      |
| SEC-05 | Low                                              | `server/src/routes/feedback.ts:17-23`; `src/components/BookFeedback.tsx`                                                                                                                                                                         | Public feedback has no CAPTCHA (5 per hour per IP) and hosts have **no way to delete feedback or block a sender** (only `GET` exists).                                                                                                     | Harassment or spam via the "Message the book owner" form, from rotating IPs, that the host can't remove.                                                                                                                                                                                                             | Add Turnstile, a delete endpoint and button, and optionally a per-book on/off switch.                                                                                                                                                    |
| SEC-06 | Low                                              | `server/src/services/tokens.ts:9,29`; `server/src/utils/cursor.ts:12-16`; `server/src/services/uploadQuota.ts:13`; `server/src/services/guestSecurity.ts:31,44,58`; `server/src/services/uploadTokens.ts:21`; `server/src/services/guests.ts:85` | One `JWT_SECRET` signs sessions, guest tokens, upload tokens and cursors, and keys every HMAC. Audiences and purposes separate token types, so no cross-use bug was found.                                                                 | No direct exploit. Rotating the key logs everyone out and voids all OTPs, cursors and guest grants at once; a leak of one use compromises all.                                                                                                                                                                       | Derive per-purpose keys with HKDF from the master secret.                                                                                                                                                                                |
| SEC-07 | Low                                              | `src/screens/auth/ResetPassword.tsx`; `src/api/auth.ts:25-28`; `server/src/routes/auth.ts:36`                                                                                                                                                    | The reset token travels in the page URL (`/reset-password?token=`) and then in an API path (`GET /api/auth/reset-password/<token>`).                                                                                                       | Tokens in URLs can land in browser history and proxy/access logs (Render, Cloudflare). They are single-use and expire in 60 min, so impact is low.                                                                                                                                                                   | Send the token in a POST body for the check, and replace the URL with `history.replaceState` after reading it.                                                                                                                           |
| SEC-08 | Low                                              | `server/src/app.ts:64`                                                                                                                                                                                                                           | CSP `img-src` allows any `https:` source.                                                                                                                                                                                                  | Defense in depth only: the API currently refuses external image URLs (BUG-09), so there is no known injection path.                                                                                                                                                                                                  | Restrict to `'self' data: blob:`.                                                                                                                                                                                                        |
| SEC-09 | Low / Unverified                                 | `render.yaml` (`TRUST_PROXY: "1"`); `docs/deployment.md:137-140`                                                                                                                                                                                 | Rate limiting depends on `req.ip`, which depends on the number of proxy hops in front of Render.                                                                                                                                           | If the hop count is wrong, either everyone shares one bucket (worsens SEC-01) or clients can spoof `X-Forwarded-For` to bypass limits.                                                                                                                                                                               | Verify on the deployed service by logging `req.ip` for a known client once, then remove the log.                                                                                                                                         |
| SEC-10 | Low                                              | `shared/email.ts` (`isGmailAccountEmail`)                                                                                                                                                                                                        | Accounts are Gmail-only, but Gmail ignores dots and `+tags`, so `a.b@gmail.com`, `ab@gmail.com` and `ab+1@gmail.com` are separate accounts for one inbox.                                                                                  | Unlimited accounts per person (plan is "unlimited" by default, `models/User.ts:16`), which multiplies abuse capacity.                                                                                                                                                                                                | Normalize Gmail addresses (strip dots and `+tag`) before uniqueness checks, or drop the Gmail restriction if it is not a product requirement.                                                                                            |
| SEC-11 | Low                                              | `server/tests/helpers.ts:7`                                                                                                                                                                                                                      | A fixed 64-hex `JWT_SECRET` is committed for tests (value redacted here).                                                                                                                                                                  | Test-only; not used by any runtime config. Risk only if someone copies it into a real `.env`.                                                                                                                                                                                                                        | Generate it at test start with `randomBytes`.                                                                                                                                                                                            |

**Dependencies**: `pnpm audit` found no known vulnerabilities (section 2). Keep runtime deps on current minors; `nodemailer`, `mongoose`, `express-rate-limit` and `@aws-sdk/client-s3` have patch releases available.

**HTTPS and cookies**: production refuses a non-HTTPS `CLIENT_URL` (`config/env.ts:158-165`), forces TLS to MongoDB (`config/db.ts:22-28`), and only allows an HTTPS R2 endpoint (`config/env.ts:138-157`). No finding.

### 3.3 Gaps and missing features (not bugs)

| ID     | Sev    | Location                                                             | Gap                                                                                                                                                                                                                                                | Why it matters                                                      | Suggested fix                                                                                                                                |
| ------ | ------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| GAP-01 | Medium | `server/src/services/guests.ts:303-334`; `shared/constants.ts:87-96` | There is no admin or platform moderation. Guest and reader reports (including "A photo of me shared without consent") go only to the **book's own host**. A host who publishes abusive content on a public link cannot be reported to the service. | Legal and trust risk for any public user-generated content service. | Add a platform "report this book" path and an admin review queue, or at least a contact address on the Reader and Legal pages.               |
| GAP-02 | Medium | `src/screens/auth/SessionExpired.tsx`; BUG-03                        | The session-expired screen is built but unreachable; there is no central 401 handling.                                                                                                                                                             | Half-built feature.                                                 | Wire it into `request()` (see BUG-03).                                                                                                       |
| GAP-03 | Low    | `server/src/routes/feedback.ts`                                      | Feedback inbox has no delete, mark-read, or count/notification.                                                                                                                                                                                    | Hosts can't manage it.                                              | Add delete and an unread count on Hub/Editor.                                                                                                |
| GAP-04 | Low    | `server/src/services/auth.ts:350-360`                                | No "sign out of all devices" or session list, even though sessions are stored server-side.                                                                                                                                                         | Hosts can't revoke a lost device without changing their password.   | Add `DELETE /api/account/sessions`.                                                                                                          |
| GAP-05 | Low    | `server/src/services/mail.ts`                                        | No email to the host for new entries, reports or feedback; the Hub must be open to see activity.                                                                                                                                                   | Hosts miss pending approvals in "strict" books.                     | Optional digest email.                                                                                                                       |
| GAP-06 | Low    | `src/screens/Landing.tsx:36-73`                                      | Landing always shows "Sign in / Get started", even when already signed in.                                                                                                                                                                         | Minor confusion.                                                    | Show "Go to your books" when a session exists.                                                                                               |
| GAP-07 | Low    | repo root                                                            | No linter config, no frontend unit/component tests, formatting not enforced (78 files fail `oxfmt --check`), no CI workflow in the repo.                                                                                                           | Regressions like BUG-01 are not caught.                             | Add ESLint (react-hooks rules), commit an `oxfmt` config, add a CI job that runs typecheck, tests with a MongoDB replica set, and the build. |
| GAP-08 | Low    | `server/src/validators/books.ts:50-54`                               | A host can change a book's slug after sharing; old links and printed QR codes then 404. Whether the UI warns about this is Unverified.                                                                                                             | Broken printed QR codes at an event.                                | Warn in settings, or keep old slugs as redirects.                                                                                            |

### 3.4 UI / UX

Checked by reading the screens and by loading the public screens in the in-app browser at 375 x 812 (mobile). No horizontal overflow on `/`, `/signin`, `/signup`, `/terms`, `/forgot-password`, `/session-expired`, a 404 path or a guest join page (`scrollWidth - clientWidth = 0` on each). Signed-in screens (Dashboard, Hub, Editor, Reader with data) need a backend and were **not** checked visually: Unverified.

| ID    | Sev    | Location                                                                  | Issue                                                                                                                                                                                     | Suggested fix                                                               |
| ----- | ------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| UX-01 | Medium | `src/screens/Reader.tsx:132-139`                                          | The Reader's Home button ("Back to Finchbound") always goes to `/dashboard`. For a public reader or guest that means a redirect to sign-in.                                               | Send anonymous readers to `/` (or back to `/<slug>/join` for event guests). |
| UX-02 | Medium | BUG-01, BUG-02, BUG-03                                                    | Three flows lose typed input (signup, wizard, editor after session end).                                                                                                                  | See fixes above.                                                            |
| UX-03 | Low    | `src/screens/Dashboard.tsx:84,212`; `src/screens/account/Profile.tsx:201` | Sign out and Account are only reachable from Dashboard and Profile. Hub, Editor, Wizard and Reader have no account menu.                                                                  | Add the ProfileMenu to the Hub/Editor toolbars.                             |
| UX-04 | Low    | `src/components/BookFeedback.tsx:26`                                      | Every feedback send failure shows the same "wait a moment" message, including 404 (book unpublished) and validation errors.                                                               | Map error codes to messages.                                                |
| UX-05 | Low    | `src/screens/hub/useModeration.ts:298-304`                                | Blocking a guest has no success/error handling of its own; it relies on the confirm modal showing a generic failure. A `CONFLICT` "already blocked" message from the server is not shown. | Show the server's message.                                                  |

Positive notes: buttons and links use 44 px minimum targets (`min-h-11` throughout), icons have `aria-hidden` and buttons have `aria-label`s (123 `aria-label`/`role` uses), toasts use `role="status"` / `role="alert"`, destructive actions use a confirm modal with Cancel focused by default (`ConfirmActionModal.tsx:72-77`), Undo is offered for deletes, images have `alt` text (one decorative `alt=""` in `Editor.tsx:631`), and reduced-motion is respected (`store.tsx:64-66`).

#### Navigation map

```
/ (Landing) ──> /signin, /signup, /create, footer: /terms, /privacy
/signup ──> /verify-email?email=…   links: /signin, /terms?from=signup, /privacy?from=signup
/terms, /privacy ──> back to / (or /signup?return=terms)          [draft restore broken: BUG-01]
/signin ──> ?next or /dashboard     links: /signup, /forgot-password, /verify-email?email=…
/forgot-password ──> (email sent)   link: /signin
/reset-password?token= ──> /signin?reset=1 | /forgot-password
/verify-email ──> /dashboard (or /account when changing email)   link: /signup or /account
/session-expired ──> /signin?next=/dashboard                     [UNREACHABLE: GAP-02]
/dashboard ──> /create, /hub/:id (event) | /editor/:id (personal), /reader/:slug?preview=:id,
               /:slug/join | /reader/:slug (share link), /account, Sign out ──> /signin
/create (Wizard) ──> /dashboard (cancel/back/after create) | /signin?next=/create (signed out)
/hub/:id ──> /dashboard, /editor/:id, /reader/:slug, /:slug/join, feedback modal, reports panel
/editor/:id ──> back (/hub/:id or /dashboard), /reader/:slug?preview=:id, /reader/:slug (after publish)
/reader/:slug ──> Home button ──> /dashboard                     [wrong for anonymous readers: UX-01]
/account ──> /dashboard; password change or delete ──> /signin; email change ──> /verify-email?from=account
/:slug/join (Guest welcome) ──> /:slug/join/form, /reader/:slug, /
/:slug/join/form ──> /:slug/join/verify | /:slug/join/success | back /:slug/join
/:slug/join/verify ──> /:slug/join/success | /:slug/join/form | /:slug/join
/:slug/join/success ──> /:slug/join, /:slug/join/form (another entry), /reader/:slug
404 (NotFound) ──> /, /dashboard, /reader/:slug     Server error ──> retry, /, /reader/:slug
```

Dead ends: `/session-expired` is never reached. No screen is a true dead end; every screen has a way home.

---

## 4. QA

### 4.1 Untested critical paths (in this run)

All end-to-end auth and authorization tests live in the integration files that were skipped. In this run, these were **not exercised**:

- Login lockout, session revocation after password change/reset, email change OTP (`auth.integration.test.ts`)
- Cross-owner access to books, pages, moderation, feedback and SSE (`books.integration.test.ts`)
- Guest captcha grants, email OTP, blocking, reports (`guests.integration.test.ts`)
- Upload authorization and preview tokens (`uploads.integration.test.ts`)

Not covered by any test file at all (grep of `server/tests`):

- Account deletion route end to end (`DELETE /api/account`) apart from a frontend request-shape check in `check-scale`.
- Rate-limit behaviour under shared IPs and per-book buckets (SEC-01).
- Any React component or screen (no frontend test runner); BUG-01 was found only by a browser check.
- `TRUST_PROXY` behaviour on Render (SEC-09).

To run the skipped tests: start the replica set from `server/README.md` (port 27018, `rs0`) and run with `TEST_MONGODB_URI` set. Tests create and drop only `finchbound_*_test_*` databases.

### 4.2 Manual test plan

**Host (signed in)**

| Feature              | Steps                                                                              | Expected                                                      | Edge / negative cases                                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign up              | `/signup`, fill fields, accept terms, submit                                       | Code email sent, `/verify-email`                              | Non-Gmail address rejected; existing email shows "already used"; open Terms then return keeps the form (fails today, BUG-01); weak password rejected |
| Verify email         | Enter 6-digit code                                                                 | Signed in, `/dashboard`                                       | Wrong code 5 times then rate limited; expired code; resend before 30 s refused                                                                       |
| Sign in              | Email + password, with and without "remember me"                                   | Dashboard                                                     | Wrong password 5 times locks 15 min; unverified account prompts to verify; `?next=//evil.example` stays on site (BUG-04)                             |
| Session expiry       | Sign in without remember, wait 31 min, save a page in Editor                       | Clear "signed out" message and sign-in path with content kept | Today: generic error (BUG-03)                                                                                                                        |
| Create book          | `/create`, personal and event                                                      | Book appears on Dashboard                                     | Taken slug; reserved slug (`admin`, `api`); signed-out user (BUG-02)                                                                                 |
| Edit pages           | Editor: add, edit, reorder, delete, upload photo                                   | Saved, order persists after reload                            | 11 MB file; a `.png` renamed `.jpg`; HEIC; two tabs reordering at once (expect CONFLICT refresh)                                                     |
| Publish / visibility | Publish, toggle link/private                                                       | Reader works only when live and link                          | Private book via `/reader/:slug` while signed out shows not found                                                                                    |
| Hub moderation       | Approve, reject, add to book, undo, bulk, block guest                              | Live updates without reload                                   | Block same guest twice (CONFLICT message, UX-05); act after deleting the book                                                                        |
| Feedback inbox       | Open Feedback in Hub                                                               | List with pagination                                          | No delete available (SEC-05)                                                                                                                         |
| Account              | Change name/email/password, delete account                                         | Email change needs code; password change signs out everywhere | Delete with wrong email refused; delete does not ask for password (SEC-03)                                                                           |
| Wrong-owner access   | Host B opens `/editor/<A's book id>` and calls `PATCH /api/books/<A's id>`         | 403/404, no data                                              | Same for `/api/books/<id>/feedback`, `/submissions/stream`, `/api/uploads/<A's id>/page`                                                             |
| CSRF                 | From another origin, `fetch('/api/books', {method:'POST', credentials:'include'})` | 403 "must come from the Finchbound client"                    | Missing Origin header also rejected                                                                                                                  |

**Guest (no account)**

| Feature      | Steps                                                      | Expected                      | Edge / negative cases                                                                                            |
| ------------ | ---------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Join         | Scan QR / open `/<slug>/join`                              | Event title, prompt, rules    | Closed or not-live event shows the closed state; deleted book shows not found                                    |
| Submit       | Pass Turnstile, write message, add photo, submit           | "Added" or "Pending" (strict) | Photo required but missing; message over 600 chars; second submit with same draft refused; blocked guest refused |
| Email verify | Email-access book: request code, enter code                | Can submit                    | Wrong code 5 times; code for another email; token reused for a second entry                                      |
| Report       | Report an entry or the book                                | Host sees it in Reports       | Report on a book from another slug; 31 reports in a minute (rate limited)                                        |
| Crowd load   | 150 phones on one Wi-Fi open the join page within a minute | All load                      | Expected to fail today (SEC-01)                                                                                  |

**Public reader**

| Feature    | Steps            | Expected                            | Edge / negative cases                                                                   |
| ---------- | ---------------- | ----------------------------------- | --------------------------------------------------------------------------------------- |
| Read book  | `/reader/<slug>` | Flipbook, keyboard arrows, lightbox | Private or unpublished book shows not found; pending/rejected guest entries never shown |
| Feedback   | Send a message   | "Sent privately"                    | 6th message in an hour refused; empty message disabled                                  |
| Navigation | Press Home       | Goes to Finchbound home             | Today goes to Dashboard then sign-in (UX-01)                                            |

---

## 5. Prioritized fix list

**Batch 1: security and availability (do first)**

1. SEC-01: rework per-book and per-IP guest limits, load-test at expected event size.
2. SEC-02: replace hard account lockout with per-account+IP throttling.
3. SEC-03: require password re-entry for account deletion.
4. SEC-04: Turnstile on register, resend-code and forgot-password.

**Batch 2: data-loss bugs and test coverage**

1. BUG-03 + GAP-02: sliding session renewal and central 401 handling to `/session-expired`.
2. BUG-01: fix the signup Terms round-trip (and stop holding the password).
3. BUG-02: gate the Wizard on sign-in before step 1.
4. Run the 63 integration tests against a replica set, then add them to CI.

**Batch 3: abuse handling and hardening**

1. GAP-01: platform-level report path and contact for abusive public books.
2. SEC-05 + GAP-03: CAPTCHA on reader feedback, delete/block for hosts.
3. SEC-06: per-purpose keys derived from `JWT_SECRET`.
4. SEC-09: confirm `TRUST_PROXY` on Render.
5. SEC-10: normalize Gmail addresses.

**Batch 4: smaller bugs and UX**

1. UX-01: Reader Home button for anonymous readers.
2. BUG-04: validate `next`.
3. BUG-06: don't burn upload uses on rejected requests.
4. BUG-07, BUG-08, BUG-05: preview 401, search debounce, regex escape.
5. UX-03, UX-04, UX-05: account menu in Hub/Editor, clearer feedback and block messages.

**Batch 5: tooling and low items**

1. GAP-07: ESLint, `oxfmt` config and format the 78 files, CI workflow, frontend tests.
2. SEC-07, SEC-08, SEC-11, BUG-09: reset token in POST body, tighter `img-src`, generated test secret, validator cleanup.
3. Patch-level dependency updates; GAP-04..06, GAP-08.

---

## 5a. Follow-up (2026-11-25)

- Integration tests were run once the local replica set on port 27018 was started: `Test Files 16 passed (16)`, `Tests 190 passed (190)` on `main` at `845338c`. The "Unverified" note in sections 2 and 4.1 about the 63 skipped tests is now resolved.
- SEC-01 and GAP-01 are addressed on branch `feature/guest-count-and-admin` (expected guest count that scales guest limits, and an `ADMIN_EMAILS` admin role with a platform report queue at `/admin`). On that branch: `Tests 210 passed (210)`, both typechecks pass, build syntax check PASS.
- Also fixed on that branch: BUG-01 (sign-up draft), BUG-02 (wizard sign-in gate), BUG-03 and GAP-02 (sliding session renewal, central session-expired screen), BUG-04 (`next` validated), UX-01 (reader Home), UX-03 (account menu on Hub/Admin), Editor and guest form overflow on phones, local photo storage and a development-only human check. `Tests 221 passed (221)`; `oxfmt --check` clean.
- SMTP was verified working (connects, signs in, delivered a sign-up email). `npm run check:env` now validates configuration and the SMTP connection; `npm run setup:env` completes `server/.env` from the example.
- Still open: SEC-02 (account lockout DoS), SEC-03 (delete account without password), SEC-04 (CAPTCHA on sign-up/reset), SEC-05 to SEC-11, GAP-03 to GAP-08.

## 6. Assumptions and open questions

- **Assumed** the audit target is the app as deployed by `render.yaml` (single Render service, Atlas, R2, Brevo).
- **Assumed** Gmail-only sign-up is an intentional product rule. If not, SEC-10 changes.
- Questions for you:
  1. How many guests do you expect per event, and how fast do they arrive? This sets the right limits for SEC-01.
  2. Do you want me to start the local replica set (port 27018) and run the 63 skipped integration tests? That starts a `mongod` process and writes temporary test databases.
  3. Should there be an admin role (GAP-01), or is per-host moderation the intended model?
