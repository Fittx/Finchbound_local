# Finchbound server

For the hosted one-week educational demo, follow [deployment setup and shutdown](../docs/deployment.md).
The repository-root `render.yaml` builds React and Express into one Render Free
web service, uses Atlas and private R2, and sends hosted email through Brevo HTTPS.
Local SMTP remains the default; existing `server/.env` settings are not changed.

The Express API uses MongoDB transactions for accounts, books, moderation and guest submissions. Approved guest entries stay private until placed in a book. Authenticated hosts receive feed updates through SSE. See [the API contract](../docs/api-contract.md) for routes, request bodies, response fields and errors. React host authentication and Profile use the same-origin Express API. The Dashboard, creation wizard, Editor and public Reader use the books and pages API. Guest submissions and Hub moderation use Express, including the owner-only SSE feed and reports inbox. Host photo uploads require storage configuration. Local email flows need SMTP.

## Local setup on Windows

Use Node 22.12 or newer and pnpm 10.34.3. From the repository root:

```powershell
corepack pnpm install
if (!(Test-Path server/.env)) { Copy-Item server/.env.example server/.env }
```

Set a random JWT_SECRET in server/.env. Generate one locally with Node:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Use a MongoDB replica set. If your local rs0 is already running on port 27018, use it. For a fresh instance, start MongoDB in a separate terminal:

```powershell
New-Item -ItemType Directory -Force .local/mongo
mongod --dbpath .local/mongo --replSet rs0 --bind_ip localhost --ipv6 --port 27018
```

Connect Compass to localhost:27018 and run this once in its shell:

```javascript
rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "localhost:27018" }] });
```

Set MONGODB_URI to mongodb://localhost:27018/?replicaSet=rs0 and MONGODB_DB_NAME to the desired database. Set CLIENT_URL to the frontend's exact origin. Start the server with `npm run server:dev`. In a second terminal run `npm run dev -- --host 127.0.0.1 --port 5173`. Visit http://127.0.0.1:3001/api/health to check readiness.

## Services and credentials

[The environment template](.env.example) lists the server settings. SMTP delivers verification codes and reset links. Cloudflare Turnstile protects guest challenges. R2 stores private photos behind authenticated or publication-checked delivery routes. See [upload setup](../docs/phase-4.md) and [guest verification](../docs/phase-5.md). Keep credentials in server/.env or the deployment secret store. VITE-prefixed values are visible in the browser. Production requires HTTPS for the client, TLS for MongoDB and complete provider settings.

## Development fixtures

Create and verify a development host through the backend auth API first. Set SEED_OWNER_EMAIL to that host's email in server/.env, then run `npm run server:seed` from the root. The script reads the prototype book, page, guest and moderation fixtures and writes each book in one transaction. Repeated runs skip previously seeded books. A conflicting slug aborts the run. Seeded photos reference the prototype image URLs. The seed requires development mode and does not create account passwords.

## Account and cleanup

Account responses contain only id, name, email and plan. A new login email takes effect after the signed-in owner confirms its verification code. Changing a password requires the current password and signs out existing sessions. Deleting an account requires the exact stored email.

The server runs maintenance every MAINTENANCE_INTERVAL_MS (default 60000). Expired soft-deleted books lose their dependent records. Deleting an account removes its books and sessions in one transaction. Removed uploads become unavailable immediately. A worker retries private object deletion and removes the cleanup record after success. Unused uploads become eligible for collection after 24 hours.

## Verification and compiled startup

```powershell
$env:TEST_MONGODB_URI = "mongodb://localhost:27018/?replicaSet=rs0"
npm run server:typecheck
npm run server:build
npm run server:test
npm run server:db:check
```

Integration suites use isolated test databases. The database check writes and reads a separate probe database. To run the compiled server use `npm --prefix server start` from the project root.

For guest collection, set Guest submissions to Open in the event book settings. Reader publication is independent. Put the public widget key in VITE_TURNSTILE_SITE_KEY in the frontend environment before building. Use the matching TURNSTILE_SECRET on the server. If overriding TURNSTILE_ACTION, set the frontend VITE_TURNSTILE_ACTION to the same value (default guest-upload). The backend requires storage configuration before issuing guest grants. Email and Strict collection also need SMTP.
