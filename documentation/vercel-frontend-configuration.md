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

> **Never set `SUPABASE_SERVICE_ROLE_KEY` in Vercel.** It is server-only and remains in the managed processing backend, where it is used to verify Supabase sessions and access user-owned metadata safely.

## Supabase Auth Dashboard Setting Required

In the selected Supabase project, add these entries to the Auth URL configuration before public use:

| Setting | Value |
| --- | --- |
| Site URL | `https://excel-master-file-tool.vercel.app` |
| Redirect URL | `https://excel-master-file-tool.vercel.app/**` |
| Preview redirect URL | `https://*.vercel.app/**` |

The Vercel project must deploy successfully once after the environment variables are saved. The deployment will build the static frontend with Supabase authentication enabled and preserve client-side routes such as `/tools/facility` and `/account`.
