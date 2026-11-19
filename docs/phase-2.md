# Phase 2: authentication

## Implemented backend

All nine /api/auth routes in api-contract.md now have real server handlers:
register, verify-email, resend-code, login, forgot-password, reset-password token
check, reset-password mutation, logout and me.

The UI is not switched to these endpoints in this stage. Frontend auth, account,
book and guest API adapters still use mock behavior. Testing the sign-up screen
does not yet test the new server. No host route guards are added to prototype screens.

## Files

- server/src/models/: User.ts, Otp.ts, AuthSession.ts, auth.ts (index initialization).
- server/src/services/: auth.ts, password.ts, tokens.ts, mail.ts.
- server/src/validators/auth.ts: strict body/param/query validation.
- server/src/controllers/auth.ts and routes/auth.ts: HTTP mapping.
- server/src/middleware/requireAuth.ts and requireOwner.ts: reusable authorization.
- server/src/utils/cookies.ts: cookie parsing, creation and deletion.
- shared/password.ts: shared password policy, also consumed by src/lib/validation.ts.
- server/tests/auth.foundation.test.ts and auth.integration.test.ts.
- server/scripts/test-auth.mjs: explicit integration test launcher.
- Updated server app, startup, configuration, package dependencies and API documentation.
- Restored server/.env.example; the existing server/.env is not modified.

## Security behavior

Account email addresses are restricted to exactly @gmail.com, with case-insensitive
domain checking and normalized storage. The shared rule is used by account forms,
auth validators and the User model. Verification is still required; this does not
implement Google OAuth. Guest contribution email addresses remain a separate policy.

- User email is normalized and protected by a unique MongoDB index. Requests cannot
  set emailVerified, passwordHash, plan, failedLogins, authVersion or trusted IDs.
- bcrypt uses 12 rounds by default. Passwords use the existing minimum-length,
  letter-and-number rule and are limited to 72 UTF-8 bytes to prevent silent truncation.
- Unverified accounts cannot sign in. The fifth failed password attempt locks the
  persisted account for 15 minutes. Expiration and counter updates are transactional.
- Verification codes are random six-digit values with an email/purpose-bound keyed hash,
  ten-minute expiry, five attempts and a 30-second resend cooldown. Successful use
  and verification/session creation commit together. Expiry is checked explicitly,
  independently of MongoDB TTL cleanup.
- Reset tokens use 32 random bytes, are hashed in MongoDB, expire in one hour, and
  are consumed once in a transaction. Reset changes the hash, clears locks, increments
  the auth version and revokes all sessions.
- Forgot-password responses are { ok: true } for known/unknown emails. Cooldowns are
  reserved for both so rate-limit responses do not reveal membership. SMTP delivery
  is outside the response path for reset and resend requests.
- JWTs accept only HS256 and validate issuer, audience, expiry, subject, purpose and
  random JWT ID. A valid signature alone is insufficient: requireAuth checks a
  persisted AuthSession and current verified User/authVersion on every request.
- Logout revokes that specific session and clears the cookie. Other sessions remain
  valid. Old cookies cannot be replayed after logout or password reset.
- Session cookies are httpOnly, sameSite=lax, path=/, and secure in production.
  Secure is disabled only for local HTTP development. Remember-me adds a 30-day
  cookie lifetime; otherwise the cookie is browser-session-only with a 30-minute JWT.
- Unsafe HTTP methods require the trusted frontend Origin. CORS remains exact-origin.
  Auth throttling supplements the baseline limiter; me/logout do not consume the
  credential-attempt quota. These limiters are process-local; shared-store deployment
  limits remain necessary before scaling to multiple instances.
- requireOwner uses a server-side owner resolver and the same authorizeOwner function
  reserved for future HTTP/SSE handlers. Real book ownership tests belong to Phase 3.
- No HTTP response or application log includes passwords, OTPs, reset URLs or JWTs.
  The JWT is delivered only through Set-Cookie, never in JSON.

## Installation and configuration

This environment cannot download new packages (registry DNS ENOTFOUND). New bcrypt,
jsonwebtoken and Nodemailer dependencies and their type packages are declared, but
must be installed and pnpm-lock.yaml regenerated before this stage can run.
Do not bypass missing-module errors or the startup dependency checks.

From the project root:

```powershell
corepack pnpm install
npm run server:typecheck
npm run server:test
npm run server:build
```

Keep your current server/.env and MongoDB connection. Do not overwrite it with the
example file. New settings have validated defaults: BCRYPT_ROUNDS=12,
OTP_MAX_ATTEMPTS=5, OTP_TTL_MINUTES=10, PASSWORD_RESET_TTL_MINUTES=60, and
AUTH_RATE_LIMIT_MAX_REQUESTS=30 per IP per 15 minutes.

For real email delivery, configure SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER,
SMTP_PASSWORD and SMTP_FROM. Port 587 requires STARTTLS; port 465 uses secure=true.
TLS certificate verification stays enabled. Do not paste credentials into chat.
Without SMTP configuration, registration/resend/reset requests fail closed with a
SERVER error before creating an account or challenge. Login and me do not use SMTP.

Registration awaits provider acceptance. Failed delivery leaves an unverified account
that can recover through resend once SMTP is corrected; it never grants a session.
Resend/reset delivery runs in-process, logs only a generic failure event, and is not a
durable outbox. A restart may lose an in-flight delivery; request another message.
Add a durable mail job/outbox before requiring guaranteed delivery in production.

## Real integration tests

The normal suite explicitly skips the twelve integration cases unless TEST_MONGODB_URI
is set. The dedicated command refuses to run without that variable:

```powershell
$env:TEST_MONGODB_URI = "mongodb://localhost:27018/?replicaSet=rs0"
npm run server:test:auth
```

Keep mongod running. The test process overrides the database name with a new random
finchbound_auth_test_* name, checks it, and only clears/drops that isolated database.
It never reads server/.env. An interrupted run may leave its disposable test database.
Tests inject an in-memory email recipient to examine codes; production exposes no
test-mail capture endpoint. No real email is sent by these tests.

Coverage includes registration persistence, duplicate email races, verification and
single use, wrong/expired codes, cooldowns, lockout expiry, real bcrypt hashes, JWT
claims, cross-instance sessions, logout replay, reset expiry/replay and concurrent reset,
session revocation, and unconfigured mail.

## Verification limits

Local non-network tests cover schemas, byte limits, hash/code shape, cookie parsing
and environment validation. Supertest connections are denied with EACCES in this
execution environment, including unchanged Phase 1 HTTP tests. Those failures do
not establish an application regression, but they are not counted as passes.
Full server semantic type checking remains blocked by missing new packages.
Real SMTP, real bcrypt/JWT integration and MongoDB auth transactions remain unverified
here until installation and the integration suite succeed. Do not advance this
stage as production-ready on the basis of static checks alone.
