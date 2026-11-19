# Phase 4: private image uploads

## Implemented

- POST /api/uploads/image: one multipart file, 10 MB maximum, allowlisted image MIME and real
  magic bytes, full Sharp decoding, pixel/animation limits, EXIF orientation then metadata stripping,
  JPEG thumbnail (400), page (800) and lightbox (1800) renditions, without enlargement.
- Owner uploads require the persisted host session. Guest uploads require a purpose-specific,
  book/draft-bound signed token, issued after Turnstile and valid for at most 600 seconds.
- POST /api/public/captcha accepts token, bookSlug and UUID draftId; returns separate captcha proof
  and upload tokens plus expiry. Checks collection status independently of reader publication.
- Cloudflare Siteverify checks success, CLIENT_URL hostname, configured action and cData binding
  bookSlug_draftId. Provider token hashes have a unique index to prevent concurrent/replayed grants.
- MongoDB persists upload grants, atomic token-use/draft/IP/book quotas and asset metadata. Six
  upload attempts per draft/token by default supports two crop files plus limited replacement.
  Refreshing CAPTCHA does not reset the draft-window quota. Failed attempts count against quotas.
- Raw input goes to private R2 quarantine; no raw URL is exposed. Only all-three-rendition success
  transitions to ready. Failure removes every planned key; cleanup failures remain recorded.
- GET /api/uploads/:uploadId/:size proxies validated JPEG only, after permission checks. Owners
  can preview their own assets; guests use asset-specific expiring preview tokens; outsiders only
  see assets referenced by eligible public pages. No R2 keys, signed object URLs or secrets leak.
- Page create/edit binds ready uploads to the owner and book in the page transaction. Arbitrary
  external URLs and foreign/cross-book uploads are rejected; query preview tokens are stripped.
  Empty image/cardImage clears a field. Existing legacy database URLs are readable but new writes
  must use assets from the upload API. Submission promotion will use guest asset bindings in Step 6.
- Processing admission occurs before multipart buffering, bounded per process. A disconnected
  client does not release an active processing slot until that work actually finishes.

## Database verification

```powershell
npm run server:db:check
```

Loads server/.env without printing credentials, uses configured DB/TLS/replica-set requirements,
creates application indexes, writes a majority+journaled marker in a randomly named isolated
finchbound_persistence_check_* database, disconnects/reconnects, verifies the marker and drops only
that generated probe database. Reports counts (never contents) for users/books/pages/uploads.
Does not seed or delete application records. A default direct script invocation without --probe
only checks connectivity and counts.

The check passed against the configured server during implementation. Application collection
counts were zero: the React prototype still uses mocks, so website actions do not yet write to
MongoDB. Real API integration tests use isolated databases and do prove server-side persistence.
The ESM startup check also found and fixed Mongoose mutable-property named imports: connection
and models now use the default export, as required by the installed runtime package.

## Configure Cloudflare locally

Do not paste secrets into chat or commit server/.env. Current local storage and Turnstile settings
were blank at implementation time, so live Cloudflare operations are not verified.

1. Create/select an R2 bucket with public r2.dev access and public custom domains disabled.
2. Create bucket-scoped Object Read & Write S3 credentials. Set STORAGE_ENDPOINT (HTTPS account
   endpoint), STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY in server/.env;
   keep STORAGE_REGION=auto. The app never sets public ACLs. Actual bucket privacy must also be
   configured in Cloudflare; application code cannot disable an already public bucket.
3. Set a bucket lifecycle rule deleting quarantine/ objects after one day. The app removes raw
   objects immediately, but this catches crashes. Keep failed upload metadata for the future purge
   job to reconcile orphaned validated/ objects; no public delivery is permitted for failed assets.
4. Configure Turnstile for the actual CLIENT_URL hostname. Set TURNSTILE_SECRET and keep
   TURNSTILE_ACTION=guest-upload. The future browser widget must use that action and cData
   `${bookSlug}_${draftId}`. No dummy token or development bypass exists in the runtime server.
5. Restart the backend. Frontend CAPTCHA/upload adapters remain mocks until endpoint integration;
   this phase provides the real HTTP contracts and tested backend implementation.

New config: UPLOAD_MAX_PER_DRAFT=6, UPLOAD_CONCURRENCY=2, UPLOAD_PROCESS_TIMEOUT_SECONDS=15,
TURNSTILE_ACTION=guest-upload. Existing maximums remain ten minutes, 10 MB and 40 million pixels.
Image processing uses CPU and bounded memory, not GPU. File bytes belong to R2; MongoDB stores
ownership/status/object references/dimensions/byte counts, not image buffers.

## Checks and limitations

The targeted upload and Books/Pages run passed 34 tests against local MongoDB with real image
processing. The configured database persistence probe passed; it cleaned up its temporary DB.
Subsequent full-suite/typecheck attempts were blocked by automatic approval review for unsolicited
Visual Studio telemetry, so the complete release check is not claimed as passed. Final disconnect
guards were code-reviewed after that run and still require the blocked regression run.

```powershell
npm run server:typecheck
npm run server:build
$env:TEST_MONGODB_URI = "mongodb://localhost:27018/?replicaSet=rs0"
npm run server:test
```

Image tests execute real Sharp/file-type with JPG, PNG, WebP, metadata, invalid input and bounds.
Upload integration tests use actual MongoDB and signed host/guest tokens, with injected storage
and CAPTCHA services. SDK/provider tests mock transport; no claim is made about live R2/Turnstile.
HEIC/HEIF decoding depends on the installed native decoder; unsupported inputs return a safe 422.

Node 22.12+ is now explicit (the existing mise toolchain already selects Node 22); installed
file-type 22 requires Node 22. Package declarations include S3 SDK, Sharp, file-type and Multer.
Dependency installation/lockfile verification encountered automatic approval rejection for
unsolicited Visual Studio telemetry. Runtime dependency imports were independently confirmed;
pnpm-lock.yaml must be regenerated before frozen-lockfile CI. The offline lockfile attempt failed
because dependency metadata was not cached. Do not treat the old lockfile as matching Phase 4.

Runtime Multer is locally typed to the small surface this app uses, avoiding an extra typings
package that could not be installed offline. No install scripts are required for the prebuilt
Sharp package used in this workspace; a deployment still needs a supported native binary.

References:
- https://developers.cloudflare.com/r2/api/s3/tokens/
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://sharp.pixelplumbing.com/api-constructor/
