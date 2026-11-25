# Finchbound

Digital guestbooks. A host creates a **personal book** (their own pages) or an **event book**
(guests scan a QR code and add a photo and a message). Hosts moderate guest entries live,
place them into the book, and share a flipbook-style reader by link.

## Roles

| Role   | How                                           | Can                                                                  |
| ------ | --------------------------------------------- | -------------------------------------------------------------------- |
| Host   | Signs up with a Gmail address and verifies it | Create and edit books, moderate guests, read feedback                |
| Guest  | Opens `/<book>/join` (QR code)                | Add one page per draft to an open event book, report content         |
| Reader | Opens `/reader/<book>`                        | Read live, link-shared books, message the host, report the book      |
| Admin  | Host whose email is in `ADMIN_EMAILS`         | Review platform reports at `/admin`, unpublish books, remove entries |

## Stack

React 19 + Vite + Tailwind 4 (`src/`), Express 5 + Mongoose on a MongoDB replica set
(`server/`), shared types and limits (`shared/`). Photos are re-encoded with sharp and stored
privately (local disk in development, Cloudflare R2 in production). Email is SMTP locally,
Brevo on Render. Cloudflare Turnstile protects guest submissions in production.

## Run it locally (Windows, PowerShell)

Requirements: Node 22.12+, MongoDB 8 (installed in Program Files or `mongod` on your PATH;
otherwise set `MONGOD_PATH`).

### The easy way: one command

After `corepack pnpm install` once, run:

```powershell
npm run local
```

It creates or completes
`server/.env`, starts MongoDB on port 27018 as replica set `rs0` (data in `.local/mongo`,
created on first run), then the API and the website. Open http://127.0.0.1:5173. Press Ctrl+C
(or close the window) to stop everything it started.

Fill the SMTP values in `server/.env` once (for Gmail use an App Password) and optionally your
email in `ADMIN_EMAILS`, then check the settings and the email connection:

```powershell
npm run check:env
```

### Test on phones over your Wi-Fi

Run `npm run local:lan` (or the manual commands below). It prints an address such as
`http://192.168.1.7:5173`. Open it on phones connected to the same Wi-Fi; on the PC both that
address and http://127.0.0.1:5173 work. Book links and QR codes use the address you opened the
Hub from, so open the Hub from the Wi-Fi address when guests will scan them.

- If phones can't load the page, allow **Node.js** on **Private networks** when Windows Firewall
  asks (or in Windows Security > Firewall > Allow an app).
- Public or guest Wi-Fi often blocks devices from reaching each other; use a home network or
  a phone hotspot.
- To pick a different network address, set `LAN_IP` first: `$env:LAN_IP="192.168.1.7"; npm run local:lan`.
- Only the website listens on the network. The API and database stay private to this PC.

### Manually, in three windows

```powershell
& "C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe" --dbpath .local/mongo --replSet rs0 --bind_ip localhost --port 27018
```

```powershell
npm run server:dev
```

```powershell
npm run dev
```

Open http://127.0.0.1:5173. API health: http://127.0.0.1:3001/api/health.

For phones on the same Wi-Fi, start windows 2 and 3 like this instead (replace the address
with your PC's Wi-Fi IPv4 address from `ipconfig`), then open `http://<that address>:5173`:

```powershell
$env:CLIENT_URL="http://192.168.1.7:5173"; $env:EXTRA_CLIENT_ORIGINS="http://127.0.0.1:5173"; npm run server:dev
```

```powershell
npm run dev -- --host 0.0.0.0
```

Locally, guests see a **Skip check (dev only)** button instead of Turnstile, and photos are
saved in `server/.local/uploads`. Neither exists in a production build.

## Tests and checks

```powershell
npm run typecheck; npm run server:typecheck
npm run server:test:all     # all server tests incl. MongoDB integration (needs mongod on 27018)
npm run check:frontend      # frontend logic checks
npm run check:toolchain     # build tooling tests
npm run build               # production build + generated-JS syntax check
```

Integration tests create and drop their own `finchbound_*_test_*` databases.

## Configuration

`server/.env.example` lists every server setting with comments. Production (`NODE_ENV=production`)
refuses to start without HTTPS `CLIENT_URL`, R2 storage, Turnstile and a mail provider.
`VITE_TURNSTILE_SITE_KEY` in the root `.env` is the public Turnstile key for production builds.

## Docs

- [API contract](docs/api-contract.md): routes, bodies, errors.
- [Deployment](docs/deployment.md): Render, Atlas, R2, Brevo, Turnstile.
- [Audit report](audit/report.md): findings and fixes.
