# Excel Data Analysis Tools

Excel Master File Tool — a full-stack web app for Excel workbook processing (merge, deduplicate, match, convert) with Supabase authentication and metadata-only process history.

## Prerequisites

- **Node.js 20+** — [https://nodejs.org/](https://nodejs.org/)
- **pnpm** — enabled automatically via Corepack (`corepack enable`)
- **Supabase project** — for sign-in, profile storage, and process history

## Quick start (local)

### 1. Install Node.js

Download and install Node.js 20 LTS or newer from [nodejs.org](https://nodejs.org/). Restart your terminal after installation.

Verify:

```powershell
node --version
pnpm --version
```

If `pnpm` is not found, run:

```powershell
corepack enable
```

### 2. Run setup

From the project root:

```powershell
pnpm run setup:local
```

This will:

- Install dependencies (`pnpm install`)
- Create `.env` from `.env.example` with a generated `JWT_SECRET`

### 3. Configure environment variables

Edit `.env` and set your Supabase credentials:

| Variable | Where to find it |
| --- | --- |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API → anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role key (server only — never expose in the browser) |

The example file already includes the project URL (`https://lltzfiewqyhdbfvjqxon.supabase.co`).

### 4. Configure Supabase Auth redirects

In your Supabase project go to **Authentication → URL Configuration** and add:

| Setting | Value |
| --- | --- |
| Site URL | `http://localhost:3000` |
| Redirect URL | `http://localhost:3000/**` |

Keep existing production URLs if you also deploy to Vercel.

### 5. Start the dev server

```powershell
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The dev server runs Express + Vite on port 3000 (or the next free port if 3000 is busy). Excel processing runs on the same server — no external processing backend is required for local development.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm run setup:local` | First-time setup: install deps and create `.env` |
| `pnpm dev` | Start development server with hot reload |
| `pnpm build` | Build frontend and bundle server for production |
| `pnpm start` | Run production build |
| `pnpm test` | Run Vitest test suite |
| `pnpm check` | TypeScript type check |

## Optional: reCAPTCHA for login

For passwordless email sign-in with CAPTCHA protection, add to `.env`:

```
VITE_RECAPTCHA_SITE_KEY=your-site-key
RECAPTCHA_SECRET_KEY=your-secret-key
RECAPTCHA_ALLOWED_HOSTNAMES=localhost
```

Also enable CAPTCHA in Supabase Auth settings with the matching secret.

## Troubleshooting

**`node` or `pnpm` not recognized**  
Node.js is not installed or not on your PATH. Install Node.js 20+ and restart the terminal.

**Sign-in redirect fails**  
Confirm `http://localhost:3000/**` is in Supabase Auth redirect URLs.

**Excel upload fails with CORS or origin error**  
Ensure `.env` includes `ALLOWED_FRONTEND_ORIGINS=http://localhost:3000,http://127.0.0.1:3000`.

**Port 3000 already in use**  
The server automatically tries the next available port (3001, 3002, …). Update `VITE_PROCESSING_API_URL` in `.env` to match the port shown in the terminal.

## Production deployment

See [documentation/vercel-frontend-configuration.md](documentation/vercel-frontend-configuration.md) for Vercel and Supabase production settings.
