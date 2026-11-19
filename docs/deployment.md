# One-week Finchbound demo

Run the built React site and Express API together on **one Render Free web service**.
Render supplies an HTTPS `onrender.com` address, so no domain purchase or running
home computer is needed. Keep MongoDB in Atlas M0 and photos in private R2.
Turnstile protects guest contributions. Local development continues using Vite
and your existing SMTP configuration.

This is a small educational demo configuration, not a load-tested production
service. Free Render services sleep after 15 idle minutes and can take about a
minute to wake. SSE reconnects after a restart. Uploaded files must stay in R2,
because Render's local filesystem is ephemeral. The rate limiters assume one
instance. The deployment lowers image processing concurrency to one and accepts
at most 16 million pixels to reduce memory pressure on Free compute.

## 1. Accounts and credentials

Complete these in your own dashboards. Do not put credentials into chat or Git.

### MongoDB Atlas

1. Create an **M0 / Free** cluster, preferably Singapore if offered. Do not choose Flex.
2. Create a dedicated database user with `readWrite` on `finchbound_demo` only.
3. Obtain the Node driver connection URI (`mongodb+srv://...`). URL-encode any
   special characters in the password before putting it in the URI.
4. In Atlas Network Access, allow Render's outbound IP ranges shown on the
   service's Connect / Outbound page after service creation. Do not open your
   home MongoDB port to the internet. If the initial deploy cannot connect,
   add those ranges and deploy again.
5. Compass can connect to Atlas using its connection URI. The existing local
   database stays separate; this demo starts empty and needs a new account.

The app explicitly creates its indexes at startup and checks transaction support.
Production MongoDB connections enforce TLS. No local `replicaSet=rs0` option
belongs in the Atlas URI.

### Cloudflare R2

1. Use your existing private **Standard** bucket (for example, `finchbound`).
2. Create R2 S3 credentials with **Object Read & Write**, restricted to that bucket.
3. Save the S3 endpoint, bucket name, Access Key ID and Secret Access Key into
   Render's environment settings. The S3 endpoint is an HTTPS origin without a
   bucket path. Leave public bucket access disabled.

R2's Standard free allowance is 10 GB-month of storage, 1 million Class A and
10 million Class B operations monthly. It is usage-billed beyond those amounts;
one week online does not guarantee a zero bill. Keep demo photos small and
monitor usage. Suspending the website does not delete stored photos or end R2 billing.

### Brevo HTTPS email

Render Free blocks outbound SMTP on 465 and 587, so the hosted app uses Brevo's
HTTPS API. Your Gmail app password continues to work locally and is not needed
on Render.

1. Create a Brevo **Free** account (currently 300 emails/day) and activate
   transactional sending if requested.
2. Add and verify a sender in Brevo. Set `EMAIL_FROM` to that approved sender.
   Brevo may rewrite a free Gmail sender to a provider-managed domain. Confirm
   the sender is accepted and test delivery to your Gmail inbox in its dashboard;
   do not assume that simply entering an address verifies it.
3. Create an **API key**, not an SMTP key, and put it in `BREVO_API_KEY` on Render.

Requests use the existing OTP/reset rules. Responses and logs never include the
API key, provider payloads or verification code. Failed API calls are not retried
automatically. Resend/reset email delivery remains an in-process job, so request
a new message if the service restarts while sending one.

### Cloudflare Turnstile

Create a Managed widget and save its **site key** and **secret key**. When Render
assigns the public URL, add that exact hostname to the widget (no `https://`, port
or path). Use the real widget keys; dummy keys lack the hostname/action/draft
fields this server validates. Set both actions to `guest-upload`.

The site key is public and is embedded during the frontend build. Rebuild after
changing it. The secret stays only on the server.

## 2. Upload source to a private Git repository

Use a private GitHub repository containing the project source, lockfile and
`render.yaml`. Keep `.env`, `.env.local`, `server/.env`, `.local`, `node_modules`,
and build outputs out of Git. They are covered by `.gitignore`.
Never upload a ZIP containing credentials. If a credential was committed earlier,
rotate it even after removing the file.

Optional local checks (from the project root):

```powershell
npm run deploy:build
npm run check:frontend
npm run server:test
```

Integration tests need `TEST_MONGODB_URI` pointing to your development replica
set; the suites use their own disposable databases. They do not test real Brevo,
R2 or Turnstile credentials.

## 3. Create the Render service

1. Choose **New > Blueprint** and connect the private repository.
2. Review the `render.yaml` service. Confirm **Free**, one instance, no disk,
   no paid database and no paid add-ons. Keep automatic deploys off.
3. Render prompts for these values:

| Variable                    | Value                       |
| --------------------------- | --------------------------- |
| `MONGODB_URI`               | Atlas connection URI        |
| `BREVO_API_KEY`             | Brevo API key               |
| `EMAIL_FROM`                | Approved Brevo sender email |
| `STORAGE_ENDPOINT`          | R2 S3 HTTPS endpoint        |
| `STORAGE_BUCKET`            | Actual bucket name          |
| `STORAGE_ACCESS_KEY_ID`     | Bucket-scoped S3 key ID     |
| `STORAGE_SECRET_ACCESS_KEY` | S3 secret                   |
| `TURNSTILE_SECRET`          | Private widget secret       |
| `VITE_TURNSTILE_SITE_KEY`   | Public widget site key      |

Other deployment settings are declared in the Blueprint, including a generated
JWT secret. Do not copy your local environment wholesale. `CLIENT_URL` is
automatically derived from Render's `RENDER_EXTERNAL_URL` unless you explicitly
set it. If overriding it, use the exact assigned HTTPS origin.

The repository root is the service root. The commands are:

```text
Build: corepack pnpm install --frozen-lockfile --prod=false && corepack pnpm deploy:build
Start: npm start
Health: /api/health
```

`SERVE_CLIENT=true` serves root `dist/` from Express; no Vite dev server is exposed.
The server binds `0.0.0.0` and Render's `PORT`. `/api` remains JSON, with its
authentication, origin checks and rate limits. The hash router uses `/#/...`.
Production cookies are Secure, httpOnly, sameSite=Lax. Static files and the API
share the same origin; no cross-site-cookie workarounds are needed.

`TRUST_PROXY=1` assumes a single trusted ingress hop and is intended only for this
Render setup. Do not reuse it on a directly exposed server. Before sharing,
verify the service topology and that two different client networks do not
incorrectly share a rate-limit quota. Do not add another proxy in front without
reviewing this setting.

After the URL exists, complete Atlas's IP allowlist and Turnstile's hostname list.
Use **Manual Deploy > Deploy latest commit** if the initial deploy failed while
these were being configured. Changing a VITE variable requires a rebuild.

Render Free does not need a payment method to get started. Leave paid upgrades
off. Free services have usage quotas and may suspend when those are exhausted.
R2's separate usage billing still applies.

## 4. Check the actual hosted app before sharing

1. Open `https://YOUR-SERVICE.onrender.com/api/health`: expect `{"ok":true}`.
2. Register, receive a real email, verify, refresh, log out and log back in.
3. Create a book, upload/crop a photo, save a page and refresh. Confirm records in
   Atlas through Compass and private rendition objects in R2.
4. Export the book PDF. Check photos and fonts after the page has fully loaded.
5. Publish a link-visible book and open its reader in a signed-out browser.
   Unpublished/private books must remain unavailable to outsiders.
6. Submit as a guest through Turnstile. Approved entries must stay private until
   placed. Check the host's SSE feed and moderation actions.
7. Test reset-password email delivery and the single-use reset link.

Local tests do not establish that provider credentials or Render's proxy work.
Any failed hosted check must be resolved before sharing the demo link.

## 5. Take it offline after one week

1. Export any diary PDFs and back up any database records you want to keep.
2. In Render, open the service's **Settings** and select **Suspend Web Service**.
   Confirm from a private browser that both `/` and `/api/health` are unavailable.
   Leave automatic deploys disabled. Delete the service if you are finished with it.
3. Atlas and R2 remain independent. To stop R2 storage usage, delete the demo
   objects/bucket only after backing up what you need. Revoke the demo R2 token.
   Review Cloudflare billing/subscriptions; stopping Render does not cancel R2.
4. Remove the demo Atlas user's access and Render IP allowlist entries. If you
   no longer need the demo data, delete the Atlas demo cluster after backup.
5. Revoke the Brevo API key and Turnstile widget used solely for this demo.

This is a manual shutdown checklist, not an automatic scheduled shutdown.

## Official references

- https://render.com/docs/free
- https://render.com/docs/blueprint-spec
- https://render.com/docs/environment-variables
- https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/r2/get-started/s3/
- https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/
- https://developers.brevo.com/reference/send-transac-email
- https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan
