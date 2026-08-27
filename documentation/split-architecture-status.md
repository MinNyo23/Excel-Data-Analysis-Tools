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

The Vercel browser session is authenticated and the project **excel-master-file-tool** is available in the **Min Nyo's projects** team. It has the production domain `https://excel-master-file-tool.vercel.app` and is linked to the private GitHub repository `MinNyo23/Excel-Data-Analysis-Tools` on the `main` branch. The current reviewed application source was synchronized to that previously empty repository in commit `1d0c00b`, which should trigger the Vercel Git deployment workflow.

The Vercel deployment list showed a new production deployment named **Configure Supabase split architecture frontend** for commit `1d0c00b`. Its initial block was resolved by pushing follow-up commit `7c7c8f5` using the GitHub-recognized no-reply identity. The follow-up build then reached dependency installation and failed because `patches/wouter@3.7.1.patch`, referenced by `pnpm-lock.yaml`, was not included in the initial source synchronization. The source fix is to include the required `patches/` directory in the linked repository and trigger a new main-branch build.

Commit `c18dad5` added the required patch file. The corresponding Vercel production deployment is now building rather than blocked or rejected. Its final build status remains to be verified.

The Vercel deployment for commit `c18dad5` completed successfully with status **Ready**. The deployed preview address is `https://excel-master-file-tool-ichyr3myh-min-nyos-projects.vercel.app`; the project’s production alias is `https://excel-master-file-tool.vercel.app`.

The Vercel Environment Variables form is available and initially contains no project variables. Its default selection is Production, so the required browser-safe Supabase URL, publishable key, authentication flag, and processing API URL must be assigned to both Production and Preview before the external frontend can use the split architecture.

The Production configuration form now has `VITE_USE_SUPABASE_AUTH=true` entered and supports adding the remaining variables in the same save operation. The remaining browser-safe settings are the Supabase URL, Supabase publishable key, and managed processing API URL; the Supabase service-role key is intentionally excluded from Vercel.

The selected Supabase URL has now been entered as `VITE_SUPABASE_URL` in the same Vercel Production configuration form. No variables have yet been saved, and the remaining values will continue to use the browser-safe Config type.

The current active Supabase publishable key has also been entered as `VITE_SUPABASE_PUBLISHABLE_KEY`. This is a browser-facing key; it is distinct from the retained managed backend’s server-only Supabase credential.

The final staged Production variable is `VITE_PROCESSING_API_URL`, pointing to the managed in-memory processing API. All four required browser-safe variables are now entered in the Vercel form, but have not yet been saved. No server-only credential has been added to Vercel.

Vercel rejected the first save attempt because Vite-prefixed variables cannot use Secret visibility. The entries were switched to Config visibility, which is correct for the four browser-safe values and keeps the server-only Supabase service-role credential outside Vercel.

All four browser-safe variables were saved successfully in the Vercel Production environment. Vercel now requires a redeployment for them to take effect; its redeployment confirmation is set to use the already successful `c18dad5` build source and assign the production domain.

The Vercel production redeployment has been initiated for the successful `c18dad5` source and the saved current project settings. Its completion and active production URL remain to be checked.

The redeployment completed successfully with status **Ready** in 24 seconds. It uses commit `c18dad5`, includes the saved Production frontend configuration, and is assigned to `https://excel-master-file-tool.vercel.app`. Vercel also issued the deployment-specific address `https://excel-master-file-tool-jfzeduvdt-min-nyos-projects.vercel.app`.

The assigned Vercel production domain loads the deployed Excel Master File frontend successfully, including the workflow navigation, privacy disclosure, full-size processing diagram link, and sign-in entry points. The application is ready for browser-level Supabase sign-in testing once the Supabase Auth redirect configuration is confirmed.

The deployed JavaScript bundle was checked over HTTPS and contains both the selected Supabase project URL and the managed processing API URL. A preflight request from `https://excel-master-file-tool.vercel.app` to the managed API returned `204` with that exact origin, `Authorization` and `Content-Type` request headers, and `GET`, `POST`, and `OPTIONS` methods explicitly allowed.

An automated browser click on the Supabase sign-in entry point timed out and the browser session then became unavailable, so the final email-link sign-in interaction has not been completed in this workspace. The deployed code selects the Supabase sign-in path when `VITE_USE_SUPABASE_AUTH=true`; a user should complete one sign-in in the production site after the Supabase Auth URL configuration is confirmed.

The Supabase browser session is now authenticated: the organization dashboard is available after returning from the temporary password-reset view. The next task is to reopen the selected project’s Auth URL Configuration page and save the Vercel production and preview redirect allowlist.

The selected project’s authenticated Auth URL Configuration screen shows the existing Site URL as `http://localhost:3000` and no Redirect URLs. The Vercel production URL must replace that local default, and the Vercel production and preview patterns must be added to the redirect allowlist.

The Site URL field has been updated to `https://excel-master-file-tool.vercel.app`. The page remains in its editable state, so the saved value and the new redirect entries will be verified together after the URL configuration form is completed.

The Redirect URL form opened successfully, but its single-line input concatenated the two attempted entries. The invalid value has not been saved. The production and preview patterns will be added as separate URL rows instead.

The production redirect pattern `https://excel-master-file-tool.vercel.app/**` is now listed successfully in Supabase Auth. The remaining required entry is the Vercel preview pattern `https://*.vercel.app/**`.

The Vercel preview redirect pattern `https://*.vercel.app/**` is now staged in a separate Supabase redirect URL form entry. It has not yet been saved, which will persist both permitted redirect URLs together.

The Supabase Auth redirect list now contains both required entries: `https://excel-master-file-tool.vercel.app/**` and `https://*.vercel.app/**`. The Site URL field also displays the Vercel production domain. These values are ready for the final email-link authentication test.

The user completed the Vercel production email-link sign-in test successfully. This confirms the configured Vercel frontend, Supabase Auth redirect settings, bearer-token path to the managed processing API, and user-scoped Supabase metadata foundation are connected end to end.

Final Supabase security-advisor review found no schema, row-level-security, or trigger-function exposure remaining. It reported one optional Auth setting: leaked-password protection is disabled. The application currently uses passwordless email links; enabling that setting would be a project-wide Supabase Auth policy choice for any password-based accounts and should be considered before enabling passwords.

## Dedicated profile page deployment

The dedicated `/profile` page and sidebar navigation were added after the prior production deployment, so the deployed Vercel site initially returned a 404 for that route. The tested feature source was synchronized to the linked GitHub repository in commit `163e51a`. Vercel blocked that commit because its author identity did not match the authorized Git connection. A follow-up commit, `b045ea5`, uses the verified `MinNyo23` identity and has triggered the current Vercel production build; its Ready status must be confirmed before the external route is treated as live.

Vercel completed the authorized `b045ea5` build successfully in 16 seconds. The production deployment now contains the dedicated profile-and-history page source and is ready for a live route check.

Earlier API-based preview deployment calls returned a permission inconsistency, but this did not alter the active Vercel project. The browser dashboard is now the source of truth for the triggered Git deployment status.

## Important Architecture Constraint

The planned external frontend uses Supabase Auth and sends the resulting bearer token to the retained managed processing API. Workbook bytes continue to travel only from the browser to that processing API and are never written to Supabase Storage, Postgres, or any object-storage bucket.
