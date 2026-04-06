# Veil

**Wildcard email aliasing on Cloudflare Workers. Forward, filter, and burn addresses without exposing your inbox.**

Veil is a self-hosted, open-source email alias relay built entirely on Cloudflare's developer platform. It consists of two Cloudflare Workers deployed from a single GitHub monorepo via Workers Builds:

1. **Email Worker**: receives all inbound mail via Cloudflare Email Routing, enforces alias rules against a D1 database, and forwards allowed mail to your real inbox.
2. **Frontend Worker**: an Astro SSR application that serves the alias management dashboard and exposes a REST API for alias CRUD operations.

## Features

- **Session-based authentication** - Secure login with HttpOnly cookies (no tokens in browser)
- **Two modes**: Catch-All (auto-create aliases) or Specific (whitelist only)
- **Expiring aliases** - Set optional expiration dates for temporary addresses
- **Rate limiting** - 100 emails/minute per sender to prevent abuse
- **CSV export** - Download your alias list for backup
- **Copy-to-clipboard** - Quick copy buttons for each alias
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

### Step 5: Set environment variables

In the Cloudflare dashboard, go to **Worker → Settings → Variables and Secrets** for each Worker:

**Email Worker Variables**

| Variable | Required | Description |
|---|---|---|
| `FORWARD_TO` | ✅ | Destination email address e.g. `you@proton.me` |
| `MODE` | ✅ | `catchall` or `specific` |
| `REJECT_MESSAGE` | ✅ | SMTP rejection text e.g. `This address is no longer active` |

**Frontend Worker Variables**

| Variable | Required | Description |
|---|---|---|
| `API_TOKEN` | ✅ | Password for dashboard login (generate with `openssl rand -hex 32`) |
| `DOMAIN` | ✅ | The relay domain e.g. `yourdomain.com` |
| `MODE` | ✅ | `catchall` or `specific` (mirrors Email Worker) |
| `APP_NAME` | ❌ | Defaults to `Veil` |
| `APP_DESCRIPTION` | ❌ | Defaults to the tagline above |
| `ACCENT_COLOR` | ❌ | Hex color, defaults to `#6d83f2` |

### Step 6: Bind D1 database to both Workers

In the Cloudflare dashboard, go to **Worker → Settings → Bindings → D1 Database** for each Worker:

- Binding name: `DB`
- D1 Database: `veil-db`

### Step 7: Configure Email Routing

1. Go to your domain → **Email → Email Routing**
2. Add a **Catch-All** rule
3. Action: Send to Worker
4. Select: `veil-email-worker`

### Step 8: Deploy

After completing Steps 4-7, trigger your first deployment:

1. Go to each Worker in the dashboard
2. Click **Deployments** → you should see a pending/running build
3. Wait for both workers to deploy successfully
4. Visit your frontend Worker's URL (found in the dashboard under **Preview** or **Triggers**)

Both Workers will automatically rebuild and redeploy on every push to `main` — but only if files within their respective watch paths changed.

### Step 9: Verify deployment

1. Visit your frontend Worker URL — you should see the Veil login page
2. Log in with your `API_TOKEN`
3. Send a test email to `test@yourdomain.com`
4. Check the dashboard to see the alias appear (in catchall mode)
5. Verify the email was forwarded to your `FORWARD_TO` address

## Usage

- Visit your frontend Worker's URL to access the dashboard
- Log in using your `API_TOKEN` as the password
- In **Specific mode**, add aliases manually before mail can flow through them
- In **Catch-All mode**, aliases appear automatically as mail arrives
- Set an **expiration date** when creating aliases for temporary addresses
- Click the **copy button** to copy an alias to clipboard
- Click **Disable** to stop forwarding from a specific alias (mail is rejected at the Worker level)
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
