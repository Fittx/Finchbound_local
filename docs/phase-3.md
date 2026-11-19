# Phase 3: Books and Pages

Implemented Book/Page models, strict request schemas, thin controllers, services and all Books/Pages
routes in api-contract.md, including GET /api/public/books/:slug. Startup explicitly creates unique
slug and ordering/list indexes even with production autoIndex disabled.

## Verification

Verified in this workspace:

- Frontend and server typechecks passed.
- Frontend mock regression checks passed (including the earlier UI fixes).
- Full server suite passed: 104 tests across eight files, including all real MongoDB auth
  and Books/Pages integration cases; no integration tests skipped in that run.
- Production server build passed. Explicit Express return annotations also resolve the
  pnpm declaration portability errors exposed by that build.
- No dependencies were added and the application database was not used for tests.

Run the foundation suite and typechecks from the root:

```powershell
npm run server:typecheck
npm run server:test
npm run typecheck
npm run check:frontend
```

Run actual transaction/ownership/public-visibility tests against a replica set:

```powershell
$env:TEST_MONGODB_URI = "mongodb://localhost:27018/?replicaSet=rs0"
npm run server:test:books
```

These tests never load server/.env. Each run creates a fresh finchbound_books_test_* database,
checks its identity, and drops only that generated database. Auth uses real signed cookies and
persisted sessions with two independent hosts; no real emails or uploads are sent. The default
suite skips integration when TEST_MONGODB_URI is absent. To run auth and domain integration
alongside the foundation suite, set the variable above then run npm run server:test.

Coverage includes unauthorized and cross-owner requests; immutable kind/trusted fields; normalized
reserved/duplicate slugs and concurrent collisions; all page CRUD; filtered cursor pagination and
literal search; private/unpublished/published visibility; source submission eligibility; soft delete,
restore and expiry; concurrent appends; anchored moves, rollback, stale versions and foreign anchors.

## Boundaries

The frontend remains mock-backed, including auth. No demo data is inserted in the real database.
This phase can be exercised using the HTTP contract and integration suite. The shared Book type
adds optional metadata/version so existing prototype fixtures continue to compile.

Collection metadata defaults and zero-based reorder positions are documented in api-contract.md.
Source status uses the shared wire enum in-book. Submission services must preserve this when added.
Image URL validation does not yet prove ownership of an uploaded asset; Step 4 supplies R2 upload
binding and private delivery. Guest submission status enforcement, CAPTCHA, moderation, SSE,
account endpoints, purge and fixtures remain in their scheduled phases. No free-plan quota is
invented: a numeric book limit is not defined by the prototype contract.

Transactions use the MongoDB driver's withTransaction with fresh Mongoose documents on each
retry. This avoids Mongoose nested-document rollback bookkeeping while keeping page writes and
Book version changes in the same transaction. No side effects occur inside retry callbacks.
