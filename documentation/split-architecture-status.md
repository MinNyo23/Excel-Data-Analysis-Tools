# Split Architecture Integration Status

## Confirmed Services

| Service | Selected target | Status |
| --- | --- | --- |
| Supabase | `supabase-violet-chair` (`lltzfiewqyhdbfvjqxon`) at `https://lltzfiewqyhdbfvjqxon.supabase.co` | Active and healthy. |
| Vercel team | `Min Nyo's projects` (`team_qtpMKBqVgXQPTCVgUtbb1fz6`) | Connected through the available Vercel integration. |
| Managed processing backend | Existing Excel Master File Tool backend | Retained as the Python/pandas/openpyxl in-memory worker and rollback environment. |

## Supabase Foundation Completed

The selected Supabase project was empty before setup. The integration applied metadata-only tables for user accounts, encrypted user profiles, process history, retention settings, and security audit events. These tables deliberately exclude workbook bytes, sheet contents, preview rows, output files, storage paths, and cell data.

Row Level Security was enabled on every new application table. The first Supabase security-advisor review identified that the internal auth-user trigger function could be called through public RPC. Execution was revoked from `public`, `anon`, and `authenticated`; the follow-up security-advisor review returned no findings.

## External Frontend Status

An initial Vercel preview response returned a preview URL, but the Vercel integration subsequently could not list or retrieve the corresponding project/deployment and rejected a full frontend redeployment with a permission error. No production Vercel deployment has been created or switched live. The integration must resolve Vercel project permission/ownership before publishing the built frontend.

## Important Architecture Constraint

The planned external frontend uses Supabase Auth and sends the resulting bearer token to the retained managed processing API. Workbook bytes continue to travel only from the browser to that processing API and are never written to Supabase Storage, Postgres, or any object-storage bucket.
