# Local Development Environment Handoff

This guide is for a developer who needs to run the Excel Data Analysis Tools project locally. The companion `.env.example` file is a **sanitized template**. It contains no usable production credentials. Copy it to `.env` and obtain real development values through the project owner’s approved secret-sharing method.

## Current development stack

| Layer | Local implementation | Purpose |
|---|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS | Browser application and workflow screens |
| API | Node.js, Express, tRPC 11 | Typed server procedures under `/api/trpc` |
| Authentication | Supabase Auth with email OTP | Login, session, access-token validation, and user identity |
| Database | Supabase tables plus the repository’s Drizzle/MySQL-compatible path | User metadata, process history, policies, and audit records |
| Excel processing | Python 3 with pandas/openpyxl workers | In-memory workbook parsing and output generation |
| Local server | `tsx watch server/_core/index.ts` | Runs the frontend/API development server |
| Production hosting | Vercel | Vite build and serverless API deployment |

## Setup

Use Node.js 22 or a compatible current LTS release, pnpm 10, and Python 3.11 or newer. From the repository root, install dependencies with:

```bash
pnpm install
```

Copy the environment template and edit the placeholders:

```bash
cp .env.example .env
```

The minimum Supabase values for the current email-OTP application are `VITE_USE_SUPABASE_AUTH=true`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and a server-only `SUPABASE_SERVICE_ROLE_KEY`. The service-role key is required for server-side Auth Admin operations and must never be shared through chat, committed to Git, placed in a `VITE_*` variable, or exposed in browser JavaScript.

Start the local development server with:

```bash
pnpm dev
```

The default local address is normally `http://localhost:3000`. If `PORT` is set to another value, use that value instead. The Supabase project owner must add the local callback URL and local site URL to the approved Supabase Auth configuration before OTP login can work locally.

## Variable ownership

| Variable category | Examples | Browser-visible? | Owner |
|---|---|---:|---|
| Supabase publishable configuration | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Developer may use a development project value |
| Server secrets | `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `PROFILE_ENCRYPTION_KEY`, `DATABASE_URL` | No | Project owner or security team |
| CAPTCHA | `VITE_RECAPTCHA_SITE_KEY` | Site key only | Developer/security team |
| CAPTCHA secret | `RECAPTCHA_SECRET_KEY` | No | Security team |
| Optional Manus services | `BUILT_IN_FORGE_API_KEY`, `VITE_FRONTEND_FORGE_API_KEY` | Server key: no; frontend key: yes | Project owner |
| Local routing | `VITE_USE_EXTERNAL_PROCESSING_API`, `VITE_PROCESSING_API_URL`, `ALLOWED_FRONTEND_ORIGINS` | Some values are bundled | Developer; verify before production |

## Secret-handling requirements

The `.env.example` file may be committed. Real `.env` and `.env.local` files must remain untracked; the repository already ignores these filenames. Use separate development credentials and encryption keys rather than copying Production values. If a production secret is accidentally placed in a local file that will be shared, rotate it immediately.

The browser-safe Supabase publishable key does not grant service-role privileges. The service-role key bypasses database Row Level Security and must exist only in the server environment. Before a production release, inspect the built JavaScript bundle and Vercel environment-variable scopes to confirm that no server secret is exposed through a `VITE_*` variable.

## Local checks

Run the following checks before opening a pull request:

```bash
pnpm check
pnpm test
pnpm build
```

For a focused test file, use:

```bash
pnpm vitest run server/<test-file>.test.ts
```

Do not run `pnpm db:push` against the Production database from a local machine. Database migrations must be reviewed, applied through the approved Supabase workflow, and verified in the project migration history.

## Local authentication notes

The local app uses Supabase email OTP when the Supabase feature flag and client values are present. The Supabase project must permit the local site URL and callback URL. A developer should use a dedicated test email account or an approved test mailbox; do not use the Master Account for routine development testing.

If Supabase variables are intentionally unavailable, public UI/build work can still be performed, but authenticated API workflows will not be reliable. Do not disable server authorization merely to make local tests pass.

## Handoff checklist

Before another developer receives access, the project manager should provide the repository URL, the intended branch and PR workflow, the Supabase development project reference, and the approved secret-sharing method. The security team should separately approve service-role access, database access, OTP redirect settings, and test-account usage. The developer should confirm that the `.env` file is local-only, run the type check and tests, and report any missing environment variable without pasting its secret value into an issue or chat.
