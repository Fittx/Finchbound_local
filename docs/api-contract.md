## QA revision: clean routes, owner previews and feedback

- Browser routes use paths (`/reader/:slug`, `/:slug/join`); legacy hash links migrate on opening. Express serves the app shell for extensionless client paths, while API and asset misses remain 404s.
- My Books Preview uses authenticated book and cursor-paginated page reads. No publication or visibility setting is changed.
- Book messages continue across reader spreads and measured preview sheets without scroll containers. PDF export receives original notes.
- `GuestEntryRequest.signoff?: string` is independent of required guest identity. An explicit empty string requests no visible signature; older requests retain their existing name behavior.
- `POST /api/public/books/:slug/feedback`: `{name?: string (80 max), message: string (1–1000)}` → 201 `{ok:true}`. Only published, link-visible books accept feedback. Five submissions per IP per hour; no owner contact details returned.
- `GET /api/books/:bookId/feedback?cursor=:id`: owner-only, 20 messages per batch, `{items:[{id,name,message,createdAt}],nextCursor}`. Feedback is private, separate from book pages, and deleted with its book/account.
- Removed client mock datasets and the sample-data seed command. Existing database records are not deleted by this code change.

The following older implementation notes are historical and are superseded where they conflict with this revision.

# Finchbound API contract

The prototype's `src/api/` layer describes the Express + MongoDB backend. Each function
carries a comment with its method, route, body, success response and error codes. Request and
response types now live in `shared/types/`, with compatibility exports at `src/types/`, to describe the JSON contract independently of the backend implementation language. `src/mocks/` is
throwaway; nothing outside `src/api/` reads it.

## Conventions

- Implementation status: Steps 1-8 provide foundation, auth, Books/Pages, public reader, uploads, guest events, email verification, submissions, public reports, host blocking and host moderation.
  The host SSE stream is implemented. Account endpoints and scheduled cleanup are implemented. Host auth, account, Dashboard, Wizard, Editor and public Reader call Express. Guest and moderation adapters call Express. Live updates use the owner-authorized SSE stream.
- `GET /api/health`: 200 `{ ok: true }`; 503 standard `SERVER` error when MongoDB is not ready.
- Product limits and wire enums are shared through `shared/constants.ts` and `shared/enums.ts`.

- Base path: `/api`. JSON in and out, except `POST /api/uploads/image` (multipart).
- Host routes need the httpOnly session cookie set by login or email verification. Without it:
  `401 UNAUTHORIZED`. Routes on a book the host doesn't own: `403 FORBIDDEN`.
- Guest routes under `/api/public` need no session. Submissions need a valid captcha token, and
  Email only or Strict events also need the guest token set by email verification.
- **One error shape** for every non-2xx response (`ApiErrorBody` in `src/types/api.ts`):

  ```json
  {
    "error": {
      "code": "VALIDATION_FAILED",
      "message": "Check the highlighted fields.",
      "fields": { "email": "Enter a valid email" }
    }
  }
  ```

  `fields` is present only for validation errors. Codes: see `ApiErrorCode`.

- **Cursor pagination** (`CursorQuery`, `Paginated<T>`): `?cursor=&limit=` in,
  `{ items, nextCursor }` out. `nextCursor` is `null` on the last page. Required for:
  - `GET /api/books` (default limit 12)
  - `GET /api/books/:bookId/pages` (default limit 8)
  - `GET /api/books/:bookId/submissions` (default limit 12, newest first)

## Auth (`src/api/auth.ts`, types in `src/types/auth.ts`)

| Method | Route                             | Body                            | Success                 | Errors                                                                               |
| ------ | --------------------------------- | ------------------------------- | ----------------------- | ------------------------------------------------------------------------------------ |
| POST   | `/api/auth/login`                 | `{ email, password, remember }` | 200 `{ user }` + cookie | 400 VALIDATION_FAILED, 401 INVALID_CREDENTIALS, 423 ACCOUNT_LOCKED, 429 RATE_LIMITED |
| POST   | `/api/auth/register`              | `{ name, email, password }`     | 201 `{ email }`         | 400 VALIDATION_FAILED, 409 EMAIL_TAKEN, 429                                          |
| POST   | `/api/auth/verify-email`          | `{ email, code }`               | 200 `{ user }` + cookie | 400 INVALID_CODE, 410 CODE_EXPIRED, 429                                              |
| POST   | `/api/auth/resend-code`           | `{ email }`                     | 200 `{ ok }`            | 429 RATE_LIMITED                                                                     |
| POST   | `/api/auth/forgot-password`       | `{ email }`                     | 200 `{ ok }` (always)   | 400, 429                                                                             |
| GET    | `/api/auth/reset-password/:token` | none                            | 200 `{ ok }`            | 410 TOKEN_EXPIRED                                                                    |
| POST   | `/api/auth/reset-password`        | `{ token, password }`           | 200 `{ ok }`            | 400 VALIDATION_FAILED, 410 TOKEN_EXPIRED                                             |
| POST   | `/api/auth/logout`                | none                            | 204                     | 500                                                                                  |
| GET    | `/api/auth/me`                    | none                            | 200 `{ user }`          | 401 UNAUTHORIZED (drives the Session expired screen)                                 |

Phase 2 notes:

- Account email addresses must end in exactly @gmail.com (case-insensitive, trimmed).
  Register/login/verification/resend/forgot-password reject other domains with
  400 VALIDATION_FAILED and an email field message. Account profile changes use the
  same shared rule. This is email/password authentication, not Google OAuth.
  Guest contribution email addresses are separate from account registration.

- Registration/verification/login use the documented envelopes; JWTs appear only in the
  httpOnly cookie. Do not copy the mock adapter's direct-user return shape into HTTP responses.
- Email verification is required before login. The fifth failed password attempt returns
  ACCOUNT_LOCKED (423) for 15 minutes. A successful verified login clears the counter.
- Codes expire in 10 minutes, have at most 5 attempts, and resend cooldown is 30 seconds.
  Missing, expired or consumed challenges return CODE_EXPIRED. Exhausted attempts return
  RATE_LIMITED. Failed attempts commit even when verification is rejected.
- Reset links expire in 60 minutes. Unknown, expired, consumed and stale-version reset
  tokens return TOKEN_EXPIRED. Reset atomically revokes all sessions; logout revokes one.
- Password inputs enforce the existing strength rule and bcrypt's 72 UTF-8 byte ceiling.
- All unsafe calls require the configured Origin. All bodies, params and queries are
  strict Zod schemas; unknown fields are rejected.
- SMTP must be configured for register/resend/forgot-password. Missing configuration
  returns 500 SERVER consistently for known/unknown addresses before mutations.
  Resend and forgot-password use the same 30-second per-email cooldown for nonexistent
  and existing users. Successful forgot-password JSON never reveals existence.
- Startup creates required unique/TTL indexes explicitly, including in production.
- See phase-2.md for test commands, remaining verification and mail-delivery limitations.

## Books (`src/api/books.ts`, types in `src/types/books.ts`)

| Method | Route                          | Body                                     | Success                                 | Errors                                      |
| ------ | ------------------------------ | ---------------------------------------- | --------------------------------------- | ------------------------------------------- |
| GET    | `/api/books?q=&cursor=&limit=` | none                                     | 200 `Paginated<Book>` (without pages)   | 401                                         |
| GET    | `/api/books/check-slug/:slug`  | none                                     | 200 `{ available: boolean }`            | 400 VALIDATION_FAILED (reserved slug)       |
| POST   | `/api/books`                   | `CreateBookRequest`                      | 201 `{ book }`                          | 400, 409 CONFLICT (slug)                    |
| GET    | `/api/books/:bookId`           | none                                     | 200 `{ book }`                          | 403, 404                                    |
| PATCH  | `/api/books/:bookId`           | `UpdateBookRequest` (incl. `visibility`) | 200 `{ book }`                          | 400 (fields), 403, 404, 409 CONFLICT (slug) |
| POST   | `/api/books/:bookId/publish`   | none                                     | 200 `{ book }` (`live: true`)           | 403, 404                                    |
| DELETE | `/api/books/:bookId`           | none                                     | 204 (soft delete)                       | 403, 404                                    |
| POST   | `/api/books/:bookId/restore`   | none                                     | 200 `{ book }` (within the Undo window) | 403, 404, 410                               |
| GET    | `/api/public/books/:slug`      | none                                     | 200 `PublicBookResponse`                | 404 NOT_FOUND for outsiders                 |

`GET /api/public/books/:slug` returns only published books with `visibility: "link"` to outsiders.
Unpublished, private and missing books all return 404 to outsiders; authenticated owners may
preview their own books. Host-created pages remain eligible; submission-backed pages require
an existing **In book** source entry. Approved, Pending, Rejected and unknown-source entries
remain private. Public responses exclude guest emails, reports and host reactions.

### Phase 3 wire details

- Owned Book responses add `version`, `hosts`, `prompt` and `status`. `version` is read-only;
  read it from GET /api/books/:bookId immediately before submitting a reorder.
- Create/update accept optional `hosts` (up to 80), `prompt` (up to 600) and `status`
  (`open`, `not-live`, `closed`). Omitted metadata defaults to empty strings and `not-live`.
  Publishing the reader does not open guest collection. Guest status enforcement arrives in Step 5.
- Rules stay flat on the wire (`access`, `photoRequired`, `messageRequired`), nested internally.
- Lists return no MongoDB internals, owner IDs or private guest/moderation data.
- New pages append; `order` in reorder responses is zero-based. Create/edit/delete/reorder
  increment the Book version transactionally. Other Book changes also invalidate that version.
- Book cursors encode creation time and ID (newest first). Page cursors encode position or
  edit time plus ID, and are scoped to book version; reload after a page/book mutation.
  Cursors are signed and bound to owner, book, sort and filters; invalid/stale cursors return 400.
- Page images must be ready owned upload API URLs or an empty string to clear an existing image. Omitting a
  PATCH field retains its value. URLs are not fetched from arbitrary hosts. Step 4 binds uploads to the owner/book and
  stores canonical private delivery paths, stripping guest preview query tokens.
- Book deletion hides its pages without deleting them. Slugs remain reserved until purge.
  Restore is permitted for LIMITS.undoMs (six seconds); expired restore returns HTTP 410
  with `NOT_FOUND`. Physical purge is deferred to Step 8.
- Public reader eligibility is checked against the submissions collection without exposing it.
  Source entries must exist in the same book with wire status `in-book`; no submission
  creation/moderation endpoints are introduced in this phase.

## Pages

One Page is one spread in the reader.

| Method | Route                                                         | Body                              | Success                                                   | Errors                         |
| ------ | ------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------- | ------------------------------ |
| GET    | `/api/books/:bookId/pages?q=&withPhoto=&sort=&cursor=&limit=` | none                              | 200 `Paginated<Page>` (position or recently edited order) | 403, 404                       |
| POST   | `/api/books/:bookId/pages`                                    | `CreatePageRequest`               | 201 `{ page }` (appended)                                 | 400 (fields: title, body), 403 |
| PATCH  | `/api/pages/:pageId`                                          | `Partial<CreatePageRequest>`      | 200 `{ page }`                                            | 400, 403, 404                  |
| DELETE | `/api/pages/:pageId`                                          | none                              | 204                                                       | 403, 404                       |
| PUT    | `/api/books/:bookId/pages/order`                              | `ReorderPagesRequest { pageId, beforeId? , afterId?, expectedVersion }` | 200 `{ pageId, order, version }` | 400, 403, 404, 409 CONFLICT |

## Submissions: host moderation (`src/api/submissions.ts`, types in `src/types/submissions.ts`)

Statuses: `pending` → `approved` | `rejected`; `approved` → `in-book`; `rejected` can be restored
to `approved`. Strict events store new entries as `pending`; Name only and Email only events store
them as `approved`. Reactions are host-only and never returned by public routes.

| Method | Route                                                                 | Body                                     | Success                                                     | Errors                                |
| ------ | --------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------- | ------------------------------------- |
| GET    | `/api/books/:bookId/submissions?status=&q=&withPhoto=&cursor=&limit=` | none                                     | 200 `ListSubmissionsResponse { items, nextCursor, counts }` | 401, 403, 404                         |
| GET    | `/api/books/:bookId/submissions/stream`                               | none (SSE)                               | event `submission`: `Submission`                            | 401, 403                              |
| PATCH  | `/api/submissions/:id`                                                | `{ status, pageId? }`                    | 200 `{ submission, removedPageId? }`                        | 400, 403, 404, 409 CONFLICT           |
| POST   | `/api/books/:bookId/submissions/bulk`                                 | `{ ids, action: "approve" \| "reject" }` | 200 `{ updated, removedPageIds }`                           | 400 (empty or > 100 ids), 403         |
| DELETE | `/api/submissions/:id`                                                | none                                     | 204 (permanent, called after the Undo window)               | 403, 404                              |
| POST   | `/api/submissions/:id/add-to-book`                                    | none                                     | 201 `{ submission, page }`                                  | 403, 404, 409 CONFLICT (not Approved) |
| POST   | `/api/submissions/:id/reaction`                                       | none                                     | 200 `{ reactions, reacted }`                                | 403, 404                              |
| DELETE | `/api/submissions/:id/report`                                         | none                                     | 200 `{ submission }` (Keep)                                 | 403, 404                              |
| POST   | `/api/books/:bookId/blocked-guests`                                   | `{ submissionId }`                       | 201 `{ blockedSubmissionIds }`                              | 403, 404, 409 CONFLICT                |

Notes:

- `q` matches the guest name case-insensitively; entries with an empty name also match
  "Anonymous guest".
- Rejecting or deleting an In book entry deletes its page in the same transaction.
- "Remove" in the reports panel is `PATCH { status: "rejected" }` followed by
  `DELETE /api/submissions/:id/report`.

### Phase 6 moderation details

- The feed matches the prototype. Omitting status includes rejected entries. Explicit
  `status=all` excludes them. The `all` count always excludes rejected entries. Counts
  cover the whole book, including when searching, filtering photos or loading another window.
- The signed cursor is scoped to the host, book, search and filters. Newest entries come
  first, with ascending ID for equal timestamps. Search matches the displayed guest name.
- PATCH can undo the last change to Pending or In book during the shared six-second undo
  window. Restoring In book requires the exact removed page ID and its matching book and
  submission. Ordinary restoration from Rejected to Approved remains available afterward.
- Promotion, rejection and permanent deletion update the page and submission together.
  Deleting a linked page in the editor returns its submission to Approved. Permanent entry
  deletion also resolves the entry's stored data by deleting its reports and marking its
  guest upload unavailable and pending storage cleanup.
- Report dismissal applies to the entry's open reports only. Dismissal on a rejected entry
  records Removed. On other entries it records Kept. Book-only reports remain separate.
- The browser still uses the prototype moderation adapter.

### Phase 7 host stream

Open `GET /api/books/:bookId/submissions/stream` with the host session cookie.
A fresh connection starts at the current book sequence. On `ready`, fetch the normal
feed and merge arrivals by ID. On reconnect, EventSource sends the last delivered ID.
The signed ID belongs to one host and book. Invalid or foreign IDs return HTTP 400.

| SSE event | Payload | Client behavior |
| --- | --- | --- |
| `ready` | `{bookId}` | Load the current feed |
| `submission` | Host Submission | Insert or update by ID |
| `submission:updated`, `reaction:updated` | Host Submission | Update by ID and refresh affected filters or counts |
| `submission:deleted` | `{bookId,id}` | Remove by ID |
| `reset` | `{bookId}` | Reload the feed, counts and reports |

MongoDB records each event in the same transaction as the change. All server instances
read the same per-book sequence. The log keeps IDs for about 24 hours and resolves
the current host view during delivery. Replayed updates may therefore carry a newer
state, and a previously deleted entry yields a deletion event. Gaps and guest blocking
trigger a reset. Book-only reports have no submission payload.

The stream checks the session and current ownership before each batch. While caught up,
it checks again every two seconds. Heartbeats run about every 15 seconds. Slow clients
reconnect using their last delivered ID. Each server allows eight connections per host.
Disable response buffering for this route when configuring a reverse proxy.

## Guest and public (`src/api/guest.ts`, types in `src/types/guest.ts`)

| Method | Route                                          | Body                  | Success                                | Errors                                                                                                 |
| ------ | ---------------------------------------------- | --------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| GET    | `/api/public/books/:slug/guest`                | none                  | 200 `GuestEvent`                       | 404 NOT_FOUND                                                                                          |
| POST   | `/api/public/captcha`                          | `{ token, bookSlug, draftId }` | 200 `{ token, uploadToken, expiresAt }`                        | 400 CAPTCHA_FAILED, 429                                                                                |
| POST   | `/api/public/books/:slug/verify-email`         | `{ email }`           | 200 `{ ok }`                           | 400, 403 GUEST_BLOCKED, 429                                                                            |
| POST   | `/api/public/books/:slug/verify-email/confirm` | `{ email, code }`     | 200 `{ ok }` + guest token             | 400 INVALID_CODE, 410 CODE_EXPIRED                                                                     |
| POST   | `/api/public/books/:slug/submissions`          | `GuestEntryRequest`   | 201 `{ status: "added" \| "pending" }` | 400 (fields), 400 CAPTCHA_FAILED, 403 GUEST_BLOCKED, 409 CONFLICT, 422 UPLOAD_FAILED, 429 RATE_LIMITED |
| POST   | `/api/public/books/:slug/reports`              | `{ reason, details, submissionId? }` | 201 `{ ok }`                           | 400, 404, 429                                                                                          |

### Phase 5 guest credentials and behavior

- Email request and confirmation use `Authorization: Bearer <captcha proof>` from the Phase 4
  CAPTCHA response; their JSON bodies stay unchanged. A successful confirmation sets a separate
  book-specific httpOnly guest cookie. Submissions send the CAPTCHA proof in `captcha` and must
  include that cookie for Email-only/Strict events. See phase-5.md for exact scope and lifetimes.
- The host account Gmail-only restriction does not apply to guest emails. All Email/Strict emails
  are normalized and verified against their own book/draft/grant. OTP resend cooldown spans drafts.
- Submission proof, verification, photo attachment and entry count are committed once together.
  Duplicate/used CAPTCHA returns CAPTCHA_FAILED; a newly issued proof cannot reuse a saved draft.
  Required name/photo/message fields and current collection status are checked inside the transaction.
- Approved remains private; `added` is the legacy wire acknowledgement, not a public Page. No guest
  emails, device identities, reports or reactions are exposed through guest event/public reader DTOs.
- Public reports are rate-limited and may target closed event books, with optional same-book entry.
  They do not require CAPTCHA, preserving the documented anonymous report body and closed-event flow.
- Host blocking uses verified email and/or a signed pseudonymous guest-device cookie identity.
  Unverified volunteered email cannot block its actual owner. Clearing cookies can evade a device-only
  block; this is not a hardware fingerprint ban. Blocking never changes other books or existing status.
- All guest writes keep the existing Origin checks. Shared durable IP/book quotas supplement the
  process-local HTTP limiter. No additional free-plan entry cap is defined by the contract.

## Uploads (`src/api/uploads.ts`)

| Method | Route                | Body                                                | Success                 | Errors                                                                |
| ------ | -------------------- | --------------------------------------------------- | ----------------------- | --------------------------------------------------------------------- |
| POST   | `/api/uploads/image` | multipart `file` (JPG, PNG, WebP, HEIC up to 10 MB) | 201 `{ uploadId, url }` | 413 FILE_TOO_LARGE, 415 UNSUPPORTED_FILE_TYPE, 422 UPLOAD_FAILED, 429 |

The server strips metadata, validates magic bytes and decoded pixels, and stores 400, 800 and
1800 px JPEG renditions privately in R2. URL is a stable relative API delivery path; guest preview
URLs add a short-lived asset-specific previewToken query. Do not persist preview query tokens.

GET /api/uploads/:uploadId/:size (`thumbnail`, `page`, `lightbox`) returns JPEG bytes only after
owner/guest-preview/public-page authorization. Unavailable or unauthorized assets return 404;
invalid preview tokens return 401. Raw/quarantine objects are never delivered. Host uploads use
the session cookie; guests send Authorization: Bearer <uploadToken>. Multipart accepts only file.

POST /api/public/captcha requires a Turnstile action matching TURNSTILE_ACTION and cData
bookSlug_draftId. It checks an open event and issues two separate signed tokens plus ISO expiry.
Upload tokens last at most 600 seconds and have atomic use/draft/IP/book limits. Missing R2 or
Turnstile configuration fails closed (503 SERVER); provider challenge failures return CAPTCHA_FAILED.
See phase-4.md for setup, quota values, CPU/memory bounds and live-service limitations.

## Not yet wired to `src/api/`

The prototype still keeps books and pages in the client store (`src/store.tsx`). These screens call
the store directly today and should switch to the endpoints above when the backend lands:
Dashboard list, delete and restore; Wizard create and slug check; Editor page create, edit,
delete, reorder and publish; Quick-edit theme.

## Account and scale additions

These contracts target the existing MERN backend (MongoDB, Express, React and Node).
TypeScript in this frontend is inherited from the supplied scaffold; the wire protocol is JSON
and does not require TypeScript on the server. Prototype routes remain accessible without signing
in. A production implementation must enforce host sessions and ownership for account and book APIs.

| Method | Route                   | Body                               | Success                                   | Errors                                                                |
| ------ | ----------------------- | ---------------------------------- | ----------------------------------------- | --------------------------------------------------------------------- |
| GET    | `/api/account`          | none                               | 200 `{ user: { id, name, email, plan } }` | 401 UNAUTHORIZED, 500 SERVER                                          |
| PATCH  | `/api/account`          | `{ name, email }`                  | 200 `{ user }`                            | 400 VALIDATION_FAILED (fields), 401, 409 EMAIL_TAKEN, 500             |
| POST   | `/api/account/password` | `{ currentPassword, newPassword }` | 200 `{ ok: true }`                        | 400 VALIDATION_FAILED, 401 INVALID_CREDENTIALS, 401 UNAUTHORIZED, 500 |
| DELETE | `/api/account`          | `{ email }`                        | 200 `{ ok: true }`, session cleared       | 400 VALIDATION_FAILED (confirmation mismatch), 401, 500               |

- Name: nonempty, at most `LIMITS.personName`. Email: normalized and unique. Plan is read-only,
  displayed as **Unlimited books**. Successful profile updates refresh the session cache.
- An email change requires verification. PATCH saves the name and returns the current verified address
  while the new address is pending. Submit the emailed code and new address to the existing
  verify-email endpoint with the owner's session cookie. Confirmation switches the login and rotates
  the session. Repeating PATCH requests another code after the resend cooldown.
- A successful password change clears the cookie and revokes all existing sessions.
- Password changes verify the current password, use the existing password strength policy, and
  update the same account used by sign-in. Password confirmation is client validation only.
- Deletion requires typing the exact saved account email, including case. The server verifies
  this independently of the disabled client button, cascades owned books, pages and submissions,
  invalidates sessions and never accepts an arbitrary client-supplied account ID. Production
  deletion should use a MongoDB transaction or a durable deletion job. Prototype deletion clears
  the current in-memory mock data; reloading resets the demo fixtures.
- `taken@example.com` produces the mock `EMAIL_TAKEN` response. Existing auth fixtures also count
  as taken if owned by another account. Mock failures can be forced with `simulate="server-error"`
  or `simulate="offline"` in the service layer; screen frames show recoverable failure states.

### Cursor behavior

| List        | Default limit | Query options                                 | Order                                           |
| ----------- | ------------- | --------------------------------------------- | ----------------------------------------------- |
| Books       | 12            | `q`, `cursor`, `limit`                        | Existing stable book order                      |
| Pages       | 8             | `q`, `withPhoto`, `sort`, `cursor`, `limit`   | `position` (default) or `edited` (newest first) |
| Submissions | 12            | `status`, `q`, `withPhoto`, `cursor`, `limit` | Newest first, ID as stable tie-breaker          |

All filtering and sorting happens **before** slicing the cursor window. A changed search, filter
or sort resets the cursor. Submissions return full-book status counts, independent of the window.
Clients append unique IDs, retain existing results on an append failure, and retry the same cursor.
`nextCursor: null` means the end; list UIs use Load more and an end message, never page numbers.
`limit` is bounded to 1–100. Mock cursors are last-item IDs; production cursors should be opaque
and encode the sort key plus `_id` so a newly arrived submission cannot shift offsets.
Page reordering stays disabled during search, With photo, or Recently edited sort. Position is the
canonical full-book position even when only some cards are loaded. `Page.editedAt` is an ISO date;
create and edit must set it server-side. Existing fixtures without a date sort after dated pages.

### Cropped photo uploads

The Page modal crops **before** calling the existing `POST /api/uploads/image` endpoint. No new
crop endpoint is needed. Reposition and zoom share a focal point across the two previews:

| Rendition | Ratio | Prototype output | Page field  |
| --------- | ----- | ---------------- | ----------- |
| Polaroid  | 1:1   | 800 × 800 JPEG   | `image`     |
| Page card | 4:3   | 1200 × 900 JPEG  | `cardImage` |

Apply renders both crops locally, uploads both files using the existing upload contract and
only replaces the selected page photo after both succeed. Cancel preserves the previous photo
and never uploads. Crop or upload errors retain the crop controls for Retry via Apply. Page Save
keeps both returned URLs and preserves `submissionId`. Uncropped existing fixtures continue to
use `image` as the card fallback. HEIC support depends on browser decoding; an unsupported image
shows a conversion hint and leaves the previous photo intact. The existing server upload
validation, EXIF stripping and rendition rules still apply.

### Public prototype documents and contextual errors

`#/terms` and `#/privacy` are static prototype drafts, with footer links and `?from=signup` return
links. The sign-up form is kept only in memory while visiting these pages. No legal API endpoint
is required. `#/missing?book=:slug` and `#/server-error?book=:slug` use that book's background and
cover accent; direct non-book errors use the default theme. Book-scoped reader and guest error
routes also retain known book context. Error UI text always uses DM Sans.

The prototype report inbox is read independently of the loaded feed window, so searching or
filtering the feed does not hide reports or disable their existing moderation actions. The mock
book list returns full store objects; a production summary response may omit embedded pages.

## Accepted backend amendments

These decisions supersede conflicting prototype comments. They supersede prototype behavior; see the implementation status above.

- Public reader: outsiders receive 404 for unpublished/private books. Approved submissions
  stay private until placed; a submission-backed page with an unknown source is not public.
- Live updates: retain SSE. Add Socket.io only if necessary, using one event bus and one
  authorization function for the same book ownership rule.
- Book persists guest hosts, prompt and collection status independently of reader publication.
  The guest DTO keeps its existing hosts, prompt and status names.
- Reports: bookId is resolved from the slug route; submissionId is optional and must belong to
  that book. Host report actions require ownership; public reports require rate limits.
- CAPTCHA/upload: the future CAPTCHA request must include bookSlug and draftId alongside
  the provider token so it can issue an upload authorization scoped to that book/draft.
  The existing captcha proof token remains separate from upload authorization. The response
  will retain token and add uploadToken and expiresAt. An upload token lasts at most 600 seconds;
  the upload request carries it as Authorization: Bearer <uploadToken>. Apply server-side quotas.
- Uploads: private R2 via the S3 SDK, file-type and Sharp. Quarantine input until validation,
  reject SVG, inspect bytes and decode, bound bytes/pixels, remove EXIF and generate the three
  documented renditions. Bind every asset to its authorized owner or guest draft. Do not expose
  raw/quarantine object URLs. Private delivery and endpoint adapter wiring belong to the upload stage.
- Ordering: PUT /api/books/:bookId/pages/order accepts pageId, expectedVersion and exactly
  one of beforeId or afterId. All IDs must belong to the owned book. Move and version increment
  occur in one transaction. Return { pageId, order, version }; stale versions return 409 CONFLICT.
  The previous all-page-ID request is superseded.
- Page create/edit writable fields are title, image, cardImage, caption (optional, up to 60 characters), header, body and author.
  IDs, timestamps and submission associations are server-controlled.
- Wire names remain in-book and withPhoto. Internal MongoDB names do not change this protocol.

The shared TypeScript request definitions record the anchored reorder and report target changes.
Mock adapters and local store mutations still need replacement in their respective stages.

Host report inbox: GET /api/books/:bookId/reports accepts an optional cursor and returns items and nextCursor. Each item includes id, reason, details, createdAt and an optional host-only submission. DELETE /api/books/:bookId/reports/:reportId acknowledges an open book-level report and returns 204. Entry reports use the existing entry moderation routes.
