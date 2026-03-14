# Veil

**Wildcard email aliasing on Cloudflare Workers. Forward, filter, and burn addresses — without exposing your inbox.**

Veil is a self-hosted, open-source email alias relay built entirely on Cloudflare's developer platform. It consists of two Cloudflare Workers deployed from a single GitHub monorepo via Workers Builds:

1. **Email Worker** — receives all inbound mail via Cloudflare Email Routing, enforces alias rules against a D1 database, and forwards allowed mail to your real inbox.
2. **Frontend Worker** — an Astro SSR application that serves the alias management dashboard and exposes a REST API for alias CRUD operations.

## Known Limitations

> Veil uses Cloudflare's `message.forward()` API, which reforwards mail with automatic SRS (Sender Rewriting Scheme) applied to the envelope sender. It is not a transparent SMTP proxy. SPF and bounce handling are managed automatically by Cloudflare. DMARC strict-alignment failures may occur with some senders, which is a known limitation shared by all forwarding-based alias services (SimpleLogin, AnonAddy, etc.).

## Prerequisites

- A Cloudflare account
- A domain added to Cloudflare
- Cloudflare Email Routing enabled on the domain
- Workers Paid plan (for D1 + Email Workers)
- `wrangler` CLI installed locally (`npm install -g wrangler`)

## Setup

### Step 1 — Fork this repository on GitHub

Click the Fork button in the top-right corner of this page.

### Step 2 — Create the D1 database

Run locally (once):

```bash
wrangler d1 create veil-db
```

Copy the `database_id` from the output. Open both:
- `workers/email-worker/wrangler.toml`
- `workers/frontend/wrangler.toml`

Replace `REPLACE_WITH_YOUR_D1_ID` with your actual ID, then commit and push the change to GitHub.

### Step 3 — Apply the schema

Run locally (once, from the repo root):

```bash
wrangler d1 execute veil-db --file=./schema.sql
```

### Step 4 — Connect Workers Builds in the Cloudflare dashboard

1. Go to **Workers & Pages → Create → Connect to Git**
2. Connect your fork for the **Email Worker**:
   - Root directory: `workers/email-worker`
   - Build command: *(leave empty)*
   - Deploy command: `wrangler deploy`
3. Connect your fork again for the **Frontend Worker**:
   - Root directory: `workers/frontend`
   - Build command: `npm run build`
   - Deploy command: `wrangler deploy`
4. Set the branch trigger to `main` for both.

### Step 5 — Set deploy variables

In the Cloudflare dashboard, go to **Worker → Settings → Variables** for each Worker and set:

**Email Worker Variables**

| Variable | Required | Description |
|---|---|---|
| `FORWARD_TO` | ✅ | Destination email address e.g. `you@proton.me` |
| `MODE` | ✅ | `catchall` or `specific` |
| `REJECT_MESSAGE` | ✅ | SMTP rejection text e.g. `This address is no longer active` |

**Frontend Worker Variables**

| Variable | Required | Description |
|---|---|---|
| `API_TOKEN` | ✅ | Static Bearer token for API auth |
| `DOMAIN` | ✅ | The relay domain e.g. `yourdomain.com` |
| `MODE` | ✅ | `catchall` or `specific` — mirrors Email Worker |
| `APP_NAME` | ❌ | Defaults to `Veil` |
| `APP_DESCRIPTION` | ❌ | Defaults to the tagline above |
| `ACCENT_COLOR` | ❌ | Hex color, defaults to `#6d83f2` |

### Step 6 — Bind D1 to both Workers

In the Cloudflare dashboard, go to **Worker → Settings → Bindings → D1 Database** for each Worker:

- Binding name: `DB`
- D1 Database: `veil-db`

### Step 7 — Configure Email Routing

1. Go to your domain → **Email → Email Routing**
2. Add a **Catch-All** rule
3. Action: Send to Worker
4. Select: `veil-email-worker`

### Step 8 — Generate your API token

Run locally:

```bash
openssl rand -hex 32
```

Set the output as `API_TOKEN` in the frontend Worker's variables.

### Step 9 — Deploy

Push any change to `main` to trigger your first Workers Builds deployment. Both Workers will build and deploy automatically on every subsequent push.

## Usage

- Visit your frontend Worker's URL to access the dashboard
- In **Specific mode**, add aliases manually before mail can flow through them
- In **Catch-All mode**, aliases appear automatically as mail arrives
- Click **Disable** to stop forwarding from a specific alias (mail is rejected at the Worker level)
- Click **Delete** to remove the record entirely
- Re-enable a disabled alias at any time with the **Enable** button

## Workers Builds Configuration Summary

| | Email Worker | Frontend Worker |
|---|---|---|
| **Root directory** | `workers/email-worker` | `workers/frontend` |
| **Build command** | *(none)* | `npm run build` |
| **Output directory** | *(none)* | `dist` |
| **Branch trigger** | `main` | `main` |
| **D1 binding** | `DB` → `veil-db` | `DB` → `veil-db` |

## License

MIT
