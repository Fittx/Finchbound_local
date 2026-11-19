# Phase 5: guest submissions and protection

## Implemented

- GET /api/public/books/:slug/guest returns the exact GuestEvent view for event books, including
  hosts, prompt, collection status and readerAvailable. Personal/deleted/missing books return 404.
  Closed/not-live events return their status. Reader publication remains independent of collection.
- Email request/confirmation endpoints keep their documented bodies. Both require the Phase 4
  captcha proof in Authorization: Bearer <token>. Upload tokens and host sessions cannot replace it.
  Challenges are hashed, book/email/draft/grant-bound, expire in ten minutes and have five attempts.
  The 30-second resend cooldown spans drafts for the same book/email. Failed attempts commit;
  correct codes are consumed once. SMTP delivery occurs outside retryable transactions.
- Confirmation returns only { ok: true } and an httpOnly, sameSite=Lax, production-secure,
  book-specific guest email cookie. Its persisted verification and expiry are checked again when
  submitting. It cannot authenticate a host, another book/draft/email, or be reused after submission.
- Guest emails use the existing generic email contract. The Gmail-only restriction remains on
  host accounts. No screen labels changed and no frontend endpoint adapter was replaced.
- POST submissions validates every field and the persisted current rules. Name/Strict requires
  a name; Email-only allows an empty name. Email/Strict requires matching verified email.
  photoRequired/messageRequired and open collection are enforced independently of reader live.
- Name/Email entries persist as approved and return { status: "added" }; Strict persists pending
  and returns { status: "pending" }. Neither creates a Page or becomes public before placement.
- Submission creation, exact-once CAPTCHA consumption, email-proof consumption, photo association
  and entriesCount increment commit in one transaction. Failures roll everything back. A unique
  book/draft key also prevents the same draft being saved through refreshed CAPTCHA grants.
- Photos must be ready guest uploads for that book/draft, not host assets, another draft, external
  URLs or quarantine objects. Upload tokens stop accepting new files once the proof is consumed;
  existing guest photo preview URLs remain usable until their grant expires.
- Public reports accept a book plus optional same-book submission target; foreign targets are 404.
  Reports are anonymous and rate-limited, and remain available on closed events without CAPTCHA.
  Submission reportedCount and report creation are transactional. Host report moderation is Phase 6.
- Host blocking requires a real owner session and a submission belonging to the owned book.
  It returns blockedSubmissionIds and is scoped to that book. Verified email and signed-device
  identities are blocked; volunteered unverified emails are never used to block their real owners.
- Guest email, reports and submission routes use MongoDB-backed IP and per-book quotas, in addition
  to the HTTP limiter. CAPTCHA/upload checks also reject known blocked device identities.

## Guest identity and concurrency

A signed httpOnly guest-device cookie supplies a pseudonymous HMAC identity; no client-supplied
fingerprint or raw IP is stored on submissions. It is captured in the CAPTCHA grant, so removing a
cookie cannot change the identity of an already issued proof. Device blocking is best effort:
clearing cookies/new browser profiles can create a new device identity; it is not a hardware ban.
Verified-email blocks still apply when that address is used from a different device.

Guest mutations write an internal Book guestVersion to serialize closing/deletion/blocking with
submissions. This does not change the owned page-order version or invalidate page pagination just
because a guest requested a code. Book/Page transactions reuse the same driver transaction helper;
every retry rebuilds documents and has no email/storage side effects.

There is no invented numeric plan/book entry cap; the prototype defines length, file and rate limits
but no free-plan entry quota. Strict moderation actions and promotion follow in Phase 6. SSE is
Phase 7. Live SMTP/R2/Turnstile setup remains deferred, as agreed.

## Files and verification

New models: Submission, Report, BlockedGuest, GuestOtp, GuestVerification; new guest routes,
controllers, validators, CAPTCHA-proof middleware, guest identity/security and business services.
Startup and the database checker explicitly create their unique, TTL, text and filter indexes.
No dependencies or environment variables were added.

Targeted verification passed: 30 new foundation/integration tests against an isolated local MongoDB
replica-set database. Tests cover email binding/OTP attempts/expiry/cooldown, single-use proofs and
concurrent submissions, strict-mode rules, asset ownership, public privacy, reports, owner-only
blocking, durable quotas and rollback. Real email/storage/Cloudflare services are injected test
implementations; no claim is made about live service delivery. A test-fixture literal type was
corrected after the targeted run; final full typecheck/build/regression confirmation is pending.

The final check commands were blocked by automatic approval review because execution attempted
unsolicited telemetry to an untrusted Visual Studio endpoint. They were not retried indirectly.
Run locally from the project root, with the replica set on port 27018 still running:

```powershell
npm run server:typecheck
npm run server:build
$env:TEST_MONGODB_URI = "mongodb://localhost:27018/?replicaSet=rs0"
npm run server:test:guests
npm run server:test
```

The dedicated command creates/drops only a new finchbound_guests_test_* database, never the
application database, and sends no real mail. Existing auth/books/uploads integration suites use
separate generated databases. The React prototype still uses mocks; production integration remains
an explicit later step. Do not change service credentials or seed production data to run these tests.
