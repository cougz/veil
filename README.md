# Veil

**Wildcard email aliasing on Cloudflare Workers. Forward, filter, and burn addresses without exposing your inbox.**

Veil is a self-hosted, open-source email alias relay built entirely on Cloudflare's developer platform. It consists of two Cloudflare Workers deployed from a single GitHub monorepo via Workers Builds:

1. **Email Worker**: receives all inbound mail via Cloudflare Email Routing, enforces alias rules against a D1 database, and forwards allowed mail to your real inbox.
2. **Frontend Worker**: an Astro SSR application that serves the alias management dashboard and exposes a REST API for alias CRUD operations.

## Features

- **Cloudflare Access authentication** - Secure login via CF Access with JWT verification
- **Configurable settings** - Set forwarding address and rejection message via dashboard
- **Expiring aliases** - Set optional expiration dates for temporary addresses
- **Rate limiting** - 100 emails/minute per sender to prevent abuse
- **CSV export** - Download your alias list for backup
- **Pagination** - Handles large alias lists efficiently

## Known Limitations

> Veil uses Cloudflare's `message.forward()` API, which reforwards mail with automatic SRS (Sender Rewriting Scheme) applied to the envelope sender. It is not a transparent SMTP proxy. SPF and bounce handling are managed automatically by Cloudflare. DMARC strict-alignment failures may occur with some senders, which is a known limitation shared by all forwarding-based alias services (SimpleLogin, AnonAddy, etc.).

## Prerequisites

- A Cloudflare account
- A domain added to Cloudflare
- Cloudflare Email Routing enabled on the domain
- Workers Paid plan (for D1 + Email Workers)
- `wrangler` CLI installed locally (`npm install -g wrangler`)

## Local Development

To run the frontend locally:

```bash
cd workers/frontend
npm install
npm run dev
```

To test the email worker locally, you'll need to use `wrangler dev` with email routing simulation. However, email workers are best tested in production since Cloudflare Email Routing cannot be fully simulated locally.

## Production Deployment

### Step 1: Fork this repository on GitHub

Click the Fork button in the top-right corner of this page.

### Step 2: Create the D1 database

Run locally (once):

```bash
wrangler d1 create veil-db
```

Copy the `database_id` from the output. Open both:
- `workers/email-worker/wrangler.toml`
- `workers/frontend/wrangler.toml`

Replace `REPLACE_WITH_YOUR_D1_ID` with your actual ID, then commit and push the change to GitHub.

### Step 3: Apply the schema

Run locally (once, from the repo root):

```bash
wrangler d1 execute veil-db --file=./schema.sql
```

If you are upgrading from a previous version without the `logs` table, run:

```bash
wrangler d1 execute veil-db --command="CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp INTEGER NOT NULL, level TEXT NOT NULL DEFAULT 'info', event TEXT NOT NULL, alias TEXT, from_addr TEXT, to_addr TEXT, message TEXT, details TEXT);"
wrangler d1 execute veil-db --command="CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);"
wrangler d1 execute veil-db --command="CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);"
wrangler d1 execute veil-db --command="CREATE INDEX IF NOT EXISTS idx_logs_event ON logs(event);"
```

### Step 4: Configure Workers Builds in the Cloudflare dashboard

Workers Builds automatically deploys your workers when you push to GitHub. Configure each worker:

**Email Worker** (`workers/email-worker`)

1. Go to **Workers & Pages → Create → Connect to Git**
2. Select your fork and configure:
   - **Root directory**: `workers/email-worker`
   - **Install command**: `npm install`
   - **Build command**: *(leave empty)*
   - **Deploy command**: `wrangler deploy`
   - **Branch trigger**: `main`
3. Under **Settings → Build configurations**, add a build watch path:
   - **Include**: `workers/email-worker/**`

This ensures the email worker only rebuilds when files in `workers/email-worker/` change.

**Frontend Worker** (`workers/frontend`)

1. Create another Workers Builds project for the same repo
2. Configure:
   - **Root directory**: `workers/frontend`
   - **Install command**: `npm install`
   - **Build command**: `npm run build`
   - **Deploy command**: `wrangler deploy`
   - **Branch trigger**: `main`
3. Add a build watch path:
   - **Include**: `workers/frontend/**`

The frontend's `wrangler.toml` includes an `assets` directive that ensures static files (CSS, JS, fonts) are uploaded alongside the worker. This is critical — without it, the dashboard will load as a blank page.

Both workers have **Observability** enabled via `wrangler.toml`, which automatically collects logs, errors, and invocation data. You can view logs in the dashboard under **Worker → Observability**.

### Step 5: Set environment variables

In the Cloudflare dashboard, go to **Worker → Settings → Variables and Secrets** for each Worker.

> **Critical**: Set ALL variables as **Secret** type. Variables set as "Text" or "JSON" will be overwritten on each deployment from GitHub. Only **Secret** type values persist across deployments since they are encrypted and not included in `wrangler.toml`.

**Email Worker Variables**

| Variable | Type | Required | Description |
|---|---|---|---|
| `FORWARD_TO` | **Secret** | ❌ | Destination email address (required - must Settings page, Otherwise forwarding will fail)) |
| `REJECT_MESSAGE` | **Secret** | ❌ | SMTP rejection text (optional - defaults via Settings page) |

**Frontend Worker Variables**

| Variable | Type | Required | Description |
|---|---|---|---|
| `CF_ACCESS_TEAM_DOMAIN` | **Secret** | ✅ | Your CF Access team URL (e.g., `https://yourteam.cloudflareaccess.com`) |
| `CF_ACCESS_AUD` | **Secret** | ✅ | Your CF Access application audience tag |
| `DOMAIN` | **Secret** | ✅ | The relay domain e.g. `yourdomain.com` |
| `APP_NAME` | **Secret** | ❌ | Defaults to `Veil` |
| `APP_DESCRIPTION` | **Secret** | ❌ | Defaults to the tagline above |
| `ACCENT_COLOR` | **Secret** | ❌ | Hex color, defaults to `#6d83f2` |

> **Note**: `FORWARD_TO` and `REJECT_MESSAGE` can be configured via the Settings page in the dashboard. Settings stored in the database take precedence over environment variables.

### Step 6: Configure Cloudflare Access

Protect your frontend Worker with Cloudflare Access:

1. Go to **Zero Trust → Access → Applications**
2. Add an application for your frontend Worker URL
3. Create an access policy (e.g., email domain, specific emails, or GitHub groups)
4. Note the **Application Audience (AUD) tag** from the application settings
5. Set the `CF_ACCESS_AUD` variable in your frontend Worker to this value
6. Set `CF_ACCESS_TEAM_DOMAIN` to your team URL (e.g., `https://yourteam.cloudflareaccess.com`)

### Step 7: Bind D1 database to both Workers

In the Cloudflare dashboard, go to **Worker → Settings → Bindings → D1 Database** for each Worker:

- Binding name: `DB`
- D1 Database: `veil-db`

### Step 8: Configure Email Routing

1. Go to your domain → **Email → Email Routing**
2. Add a **Destination address** - enter your `FORWARD_TO` address and click Verify
3. Click the verification link sent to that address
4. Add a **Catch-All** rule
5. Action: Send to Worker
6. Select: `veil-email-worker`

> **Note**: The destination address must be verified before email forwarding will work. You'll get a "destination address not verified" error if you skip this step.

### Step 9: Deploy

After completing Steps 4-7, trigger your first deployment:

1. Go to each Worker in the dashboard
2. Click **Deployments** → you should see a pending/running build
3. Wait for both workers to deploy successfully
4. Visit your frontend Worker's URL (found in the dashboard under **Preview** or **Triggers**)

Both Workers will automatically rebuild and redeploy on every push to `main` — but only if files within their respective watch paths changed.

### Step 10: Verify deployment

1. Visit your frontend Worker URL — you should be prompted to authenticate via Cloudflare Access
2. After authenticating, you should see the Veil dashboard
3. Go to **Settings** and configure your forwarding address
4. Send a test email to `test@yourdomain.com`
5. Check the dashboard to see the alias appear
6. Verify the email was forwarded to your configured address

## Usage

- Visit your frontend Worker's URL to access the dashboard (requires CF Access authentication)
- Configure **Forward To** and **Reject Message** in the Settings page
- Aliases are created automatically when emails arrive (controlled by Cloudflare Email Routing rules)
- Click **Disable** to block a specific alias (mail is rejected at the Worker level)
- Click **Delete** to remove the record entirely
- Use **Export CSV** to backup your alias list
- Re-enable a disabled alias at any time with the **Enable** button

## Workers Builds Configuration Summary

| | Email Worker | Frontend Worker |
|---|---|---|
| **Root directory** | `workers/email-worker` | `workers/frontend` |
| **Install command** | `npm install` | `npm install` |
| **Build command** | *(none)* | `npm run build` |
| **Deploy command** | `wrangler deploy` | `wrangler deploy` |
| **Output directory** | *(none)* | `dist` |
| **Branch trigger** | `main` | `main` |
| **Build watch paths** | `workers/email-worker/**` | `workers/frontend/**` |
| **D1 binding** | `DB` → `veil-db` | `DB` → `veil-db` |

## License

MIT
