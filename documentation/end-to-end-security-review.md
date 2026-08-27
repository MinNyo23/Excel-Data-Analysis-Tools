# End-to-End Security Review

**Scope.** This review assesses the Excel Master File Tool's browser frontend, authenticated API, managed in-memory processing service, Supabase metadata layer, and Vercel deployment configuration as of 27 August 2026. It is an application security review and automated verification record, not a substitute for an independent penetration test or continuous infrastructure monitoring.

## Verified Security Controls

| Boundary | Control | Verification evidence |
| --- | --- | --- |
| Authentication | The managed API validates Supabase bearer tokens server-side. Legacy cookie sessions are HTTP-only, secure over HTTPS, same-site-lax, and limited to 24 hours. | Protected procedures reject unauthenticated calls; automated session and API tests pass. |
| Authorization | Profile, history, retention, export, deletion, and audit queries all use the signed-in user identifier. Supabase roles now come from the protected `app_user_accounts` record, not editable Auth user metadata. | The service-role adapter filters every affected operation by `user_id`; a new automated authorization contract checks the role source. |
| API errors | Browser-facing tRPC errors now return only a public message, stable error code, and HTTP status. Internal stacks, filesystem paths, procedure paths, and validation objects are removed. | A live malformed-route probe initially revealed a stack trace; after the fix, regression tests assert redaction and the live API response has no stack or host-path text. |
| Cross-origin API access | The managed processing API emits CORS headers only for configured Vercel origins, permits only required methods and headers, and rejects untrusted POST origins before parsing request bodies. | Trusted production preflight returned `204`; an untrusted POST returned `403`. |
| Abuse controls | API requests have a 30 MB transport limit, uploads have stricter per-file, batch, file-count, ZIP-entry, expansion-size, and compression-ratio limits, and protected operations are rate-limited. The IP-derived rate-limit key is hashed. | Upload-validation, origin, and rate-limit tests pass. The in-memory limiter now bounds its own key store to prevent unbounded key accumulation. |
| Workbook privacy | Workbook bytes, worksheets, preview rows, and output bytes are processed in memory and are excluded from the Supabase schema, history records, audit metadata, and profile exports. | Schema review, metadata-input validation, source-contract tests, and the existing privacy documentation confirm this boundary. |
| Download safety | Every generated XLSX now passes through an in-memory output guard before download. Formula-like cell text beginning with `=`, `+`, `-`, or `@` is written as literal text rather than executable spreadsheet formulas. | The regression test creates a formula-like workbook and verifies the guarded XLSX has no formula nodes. |
| Encrypted profile data | Editable profile fields are encrypted in the server layer before their Supabase record is written. | Existing profile-encryption tests and server-side encrypted-payload adapter remain in place. |
| Browser controls | Vercel is configured to send a restrictive Content Security Policy, deny framing, disable MIME sniffing, limit browser capabilities, restrict referrers, isolate browsing context, and block Adobe cross-domain policy files. The CSP permits only the selected Supabase project, managed processing API, and necessary Google font origins. | `vercel.json` is covered by an automated configuration contract and has been pushed in commit `4e158d6`; final live header verification follows the Vercel build. |
| Dependency hygiene | Production dependency audit reports no known vulnerabilities at the configured high-severity threshold. | `pnpm audit --prod --audit-level high` completed successfully in the release validation. |

## API Review Summary

The external browser uses only the Supabase publishable key, selected Supabase URL, and managed processing API URL. The Supabase service-role credential, profile-encryption key, session secret, and Forge server credentials do not appear in the browser source or built browser assets. API mutating operations require a signed-in identity, input schemas enforce expected field types and sizes, and destructive profile/history actions are routed through user-scoped procedures.

The API review also found and corrected two concrete issues. First, a malformed procedure URL exposed a development stack trace in the managed API response. The global tRPC error formatter now removes that diagnostic data and hides unknown procedure names. Second, the original Supabase authentication bridge trusted a user-editable role field from Auth metadata. The role is now read from the application account table created and protected by the database layer.

## Residual Operational Considerations

The request-rate limiter is intentionally in memory so it never stores raw IP addresses, but this also means its counters are per application instance. If traffic grows across many server instances or adversarial abuse becomes a concern, add a managed edge/WAF rate-limit rule or a privacy-reviewed shared counter service. The Vercel Content Security Policy retains `'unsafe-inline'` for scripts because the current generated browser runtime contains a required inline bootstrap script; replacing that runtime with a nonce- or hash-based build would allow a stricter policy. These are hardening opportunities rather than known data-exposure findings.

## Release Validation

The security release completed TypeScript validation, the full regression suite (**21 test files / 46 tests**), a production build, and the production dependency audit. Vercel completed the authorized `4e158d6` production deployment with status **Ready**. The canonical production site now serves the configured Content Security Policy, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, cross-origin isolation controls, and Vercel-managed HSTS.

The final production API check confirmed an exact-origin CORS preflight response for the Vercel site and a generic `404` response for an unknown tRPC operation. The response did not include a stack trace, filesystem location, package path, or unknown procedure name. No workbook or account data was sent during these verification requests.
