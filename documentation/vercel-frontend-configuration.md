# Vercel Frontend Configuration

The Vercel project hosts only the React/Vite frontend. It does not accept workbook uploads or run Python Excel code. The browser sends its Supabase access token and the active workbook bytes directly to the existing managed processing API, which validates and processes the workbook in memory.

## Vercel Project Settings

Set the following variables in **Project Settings → Environment Variables** for both **Production** and **Preview** deployments.

| Variable | Value | Visibility |
| --- | --- | --- |
| `VITE_USE_SUPABASE_AUTH` | `true` | Browser-visible configuration. |
| `VITE_SUPABASE_URL` | `https://lltzfiewqyhdbfvjqxon.supabase.co` | Browser-visible project URL. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The active publishable key in the selected Supabase project. | Browser-visible key designed for client use. |
| `VITE_PROCESSING_API_URL` | `https://3000-il1ewvzwfbgv4rg9wy6pi-abbe9b7d.us4.manus.computer` | Browser-visible API base URL for the retained managed processing backend. |
| `VITE_RECAPTCHA_SITE_KEY` | Google reCAPTCHA site key registered for the application domains. | Browser-visible site key. |

> **Never set `SUPABASE_SERVICE_ROLE_KEY` or `RECAPTCHA_SECRET_KEY` in the browser-facing Vercel frontend.** `RECAPTCHA_SECRET_KEY` is server-only and must be configured on the server that runs `server/recaptcha.ts`. The frontend sends the reCAPTCHA token to `/api/auth/verify-recaptcha`, which calls Google’s `siteverify` endpoint before the token is passed to Supabase Auth.

## Server CAPTCHA Settings Required

Configure `RECAPTCHA_SECRET_KEY` in the server environment. Optionally set `RECAPTCHA_ALLOWED_HOSTNAMES` to a comma-separated list such as `excel-master-file-tool.vercel.app` to reject successful Google tokens issued for unexpected hostnames.

In the selected Supabase project, enable CAPTCHA protection with the matching Google reCAPTCHA secret as well. This keeps Supabase Auth’s own CAPTCHA validation enabled in addition to the application’s explicit server-side check.

## Supabase Auth Dashboard Setting Required

In the selected Supabase project, add these entries to the Auth URL configuration before public use:

| Setting | Value |
| --- | --- |
| Site URL | `https://excel-master-file-tool.vercel.app` |
| Redirect URL | `https://excel-master-file-tool.vercel.app/**` |
| Preview redirect URL | `https://*.vercel.app/**` |

The Vercel project must deploy successfully once after the environment variables are saved. The deployment will build the static frontend with Supabase authentication enabled and preserve client-side routes such as `/tools/facility` and `/account`.
