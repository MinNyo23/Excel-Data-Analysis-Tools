# Excel Data Analysis Tools
## System Specification for Security, Development, and Project Management

**Document status:** Development baseline and security review specification  
**Version:** 1.0  
**Prepared by:** Manus AI  
**Repository:** `MinNyo23/Excel-Data-Analysis-Tools`  
**Primary production URL:** `https://excel-master-file-tool.vercel.app`  
**Hosting model:** Vercel-hosted web application with Supabase-backed authentication and administrative services

> This document describes the system that is currently implemented in the repository, separates confirmed implementation from recommended controls, and defines the target standards that must be maintained as development continues. It is intended to be shared with the security team, developer team, and project manager.

## 1. Executive Summary

Excel Data Analysis Tools is a browser-based internal operations toolkit for processing Excel workbooks. Users authenticate with a passwordless Supabase email OTP flow, choose a workflow, upload workbook data, receive a generated result, and optionally retain limited process metadata in their account history. Workbook bytes, worksheet cell values, preview rows, and generated workbook contents are designed to remain temporary and are not stored as application history.

The application uses a React and TypeScript frontend built with Vite, a Node.js and TypeScript backend exposed through tRPC, Supabase for authentication and selected administrative/database functions, and Vercel for hosting and serverless execution. The repository also contains a Drizzle ORM and MySQL-compatible legacy metadata path. This dual-path design is an important architectural fact: the team must either formally support both persistence paths or complete a controlled consolidation so production behavior is predictable.

The highest-priority security boundary is the server. The browser may send a publishable Supabase key and authenticated requests, but it must never receive a Supabase secret/service-role key, database password, encryption key, or other privileged credential. Supabase documents that secret and service-role keys bypass Row Level Security and must be used only on a backend [1].

## 2. System Goals and Non-Goals

### 2.1 Goals

The system shall provide a reliable and privacy-conscious way to process Excel workbooks through specialized workflows. It shall support passwordless user access, account and process-history management, administrative user moderation, configurable allowed email domains, security-event recording, and deployment through a controlled GitHub pull-request workflow.

The system shall validate input files before processing, constrain request sizes, sanitize generated workbook output, isolate user data by authenticated identity, and give administrators clear confirmation before destructive account actions. The system shall remain usable when optional administrative history storage is unavailable by using a controlled fallback rather than returning an avoidable page-level failure.

### 2.2 Non-goals

The current system is not a general-purpose document-management platform, permanent Excel-file repository, multi-tenant enterprise data warehouse, or collaborative spreadsheet editor. It does not promise that uploaded workbooks are retained after a request. It should not be used as the sole system of record for regulated documents unless the security and compliance teams approve retention, classification, backup, and audit requirements.

## 3. Stakeholders and Responsibilities

| Stakeholder | Primary responsibility | Required decisions and deliverables |
|---|---|---|
| Project manager | Scope, priority, release coordination, acceptance criteria, risk tracking | Approve roadmap, maintain release checklist, confirm migration and rollback owners, coordinate security sign-off |
| Development team | Frontend, backend, database integration, tests, code review, defect correction | Implement features through branches and PRs, maintain type safety, add regression tests, document migrations |
| Security team | Threat modeling, secret management, authorization review, logging, incident readiness | Approve admin controls, RLS policies, service-role isolation, CSP, rate limits, audit retention, incident playbooks |
| Infrastructure/DevOps owner | Vercel project, environment variables, deployment protection, monitoring, backups | Configure Preview/Production environments, protect deployments, review logs, maintain recovery procedures |
| Database/Supabase owner | Auth configuration, SQL migrations, RLS, database health, Auth Admin API | Apply and verify migrations, configure redirect URLs and OTP templates, review privileged access |
| Master Account administrator | Operational user management and sign-in policy | Manage ban/unban/delete actions, review action history, maintain the allowed email domain |
| End user | Upload valid workbooks, review results, manage account metadata | Use approved files, report incorrect processing or access issues, avoid uploading secrets or prohibited data |

The project manager owns whether a requirement is accepted. The security team owns whether a security control is sufficient. The development team owns implementation quality. No single role should both author and unilaterally approve a security-sensitive production change.

## 4. Current Architecture

### 4.1 Logical architecture

```text
User browser
   |
   | HTTPS, React SPA, Vite-built assets
   v
Vercel
   |-- Static frontend assets from dist/public
   |-- Vercel Functions / Node server bundle
   |-- /api/trpc/* request handling
   |
   +--> Supabase Auth
   |      |-- Email OTP issuance and verification
   |      |-- User sessions and Auth Admin operations
   |
   +--> Supabase database/API
   |      |-- app_user_accounts
   |      |-- process_history
   |      |-- admin_auth_settings
   |      |-- admin_user_action_history
   |      |-- security_audit_events
   |
   +--> Optional Drizzle/MySQL-compatible metadata path
          |-- users
          |-- process_history
          |-- user_profiles
          |-- user_process_settings
          |-- security_audit_events
```

Vercel builds the Vite frontend and bundles the Node backend. The repository defines `pnpm install --frozen-lockfile`, `pnpm build`, and `dist/public` as the Vercel output. Vercel’s Vite documentation confirms support for Vite builds, environment variables, serverless functions, and SPA rewrites [2]. The repository’s `vercel.json` also defines API function time limits, SPA rewrites, and security response headers.

### 4.2 Technology inventory

| Layer | Technology currently used | Purpose |
|---|---|---|
| Language | TypeScript, JavaScript, SQL | Application code, type contracts, migrations, configuration |
| Frontend | React 19, Vite 7, React DOM | Single-page user interface and route rendering |
| Routing | Wouter | Client-side route selection and navigation |
| Styling | Tailwind CSS 4, CSS, `tw-animate-css` | Responsive layout, design tokens, component styling |
| UI primitives | Radix UI, shadcn-style wrappers, Lucide icons | Accessible dialogs, buttons, forms, menus, alerts, icons |
| Data fetching | tRPC client, TanStack React Query, SuperJSON | Typed API calls, caching, mutation state, serialization |
| Backend | Node.js, Express, tRPC server | HTTP handling, authentication context, API procedures, workflow orchestration |
| Validation | Zod | Strict input schemas and request validation |
| Authentication | `@supabase/supabase-js`, Supabase Auth | Email OTP login, session management, user administration |
| Database integration | Supabase Data API/Admin API; Drizzle ORM; MySQL2 | Supabase-backed services and legacy/optional metadata persistence |
| Excel processing | Workbook processors and ExcelJS-related processing utilities in the codebase | Validate, inspect, transform, and generate workbook outputs |
| File handling | Base64 request normalization, temporary in-memory processing | Transfer and process workbook data without application file retention |
| Security libraries | `jose`, cookie handling, reCAPTCHA integration | Token/session support, cookie operations, bot-resistance capability |
| Testing | Vitest, TypeScript compiler | Unit, contract, security, processor, and build validation |
| Build tooling | pnpm, Vite, esbuild, TypeScript, Prettier | Reproducible installation, frontend build, server bundle, formatting |
| Hosting | Vercel | Static delivery, previews, serverless API execution |
| Backend service | Supabase | Auth, managed Postgres/Data API, Auth Admin API, SQL migrations |

The project is MIT licensed in `package.json`. Dependency versions must be reviewed through the existing `pnpm audit --prod --audit-level high` command and updated through pull requests.

## 5. Services and Responsibility Boundaries

### 5.1 Vercel

Vercel is the public hosting and execution layer. It is responsible for serving the Vite-built SPA, routing non-API paths to `index.html`, executing the server bundle through serverless functions, exposing Preview deployments, and storing environment variables for each deployment environment. Vercel is not the application database and must not be treated as durable file storage.

The Vercel project shall maintain separate **Development**, **Preview**, and **Production** variables. Production credentials must not be copied into local files or Preview environments unless explicitly required and approved. The deployment pipeline shall remain pull-request based: code is developed on a feature branch, validated, reviewed, merged by an authorized repository owner, and then deployed by the configured integration.

### 5.2 Supabase

Supabase is the authoritative backend service for authentication and the current administrative integration. Supabase Auth issues and verifies email OTP credentials. The application uses the Supabase Auth Admin API on the server for user listing, ban/unban, and deletion. The application uses Supabase tables and SQL migrations for account roles, allowed email-domain policy, process metadata, admin action history, and audit records.

Supabase’s passwordless email documentation states that OTP login sends a one-time code and that verification creates the authenticated session [3]. The team must configure the production Site URL, permitted redirect URLs, email template, OTP expiration, sender configuration, and abuse controls in the Supabase dashboard. Redirect URLs must contain only approved application origins.

### 5.3 Database persistence

The current repository includes two persistence approaches. The Supabase path uses tables such as `app_user_accounts`, `process_history`, `admin_auth_settings`, `admin_user_action_history`, and `security_audit_events`. The Drizzle/MySQL-compatible path defines `users`, `process_history`, `user_profiles`, `user_process_settings`, and `security_audit_events`.

This must be treated as an explicit architecture decision, not an accidental implementation detail. The project manager and technical lead shall decide whether Supabase is the sole production persistence layer. If yes, legacy MySQL/Drizzle paths should be retired or isolated behind a documented compatibility boundary. If both remain, the system specification must define which tables are authoritative, how writes are synchronized, and how recovery handles divergence.

## 6. Functional Specification

### 6.1 Authentication and session flow

1. A user enters an email address on the login screen.
2. The frontend validates the format and the configured allowed-domain rule.
3. The backend and Supabase policy enforce the allowed domain; the frontend check is not considered sufficient authorization.
4. Supabase sends a one-time OTP email.
5. The user enters the OTP on the callback/login-success flow.
6. Supabase verifies the OTP and establishes the session.
7. The application obtains the authenticated identity and maps the user to an application role.
8. Protected routes require an authenticated context. The Master Account route additionally requires administrator authorization.
9. Logout clears session state and attempts process-history cleanup without allowing cleanup failure to prevent logout.

Supabase documents a default OTP request interval and expiration behavior and recommends configuring the production email template and expiration deliberately [3]. The security team shall approve the final OTP lifetime and request rate before production sign-off.

### 6.2 Excel workflow functions

The current router exposes the following processing capabilities:

| Function | Input pattern | Expected output |
|---|---|---|
| Excel processing | One or more validated workbooks | Sanitized generated workbook result |
| Workbook column inspection | One workbook | Column/structure inspection result |
| Deletion summary | One workbook | Deletion summary workbook |
| Deletion duplicates | One workbook | Duplicate-separation result workbook |
| Deletion with summary | One workbook | Deletion result with summary |
| Addition and exit match | Original and exit workbooks plus optional column mapping | Matched output workbook |
| Deletion and onboard match | Onboard and deletion workbooks plus optional column mapping | Matched output workbook |
| Ready upload | One workbook | Upload-ready transformed workbook |
| Facility conversion | One workbook | Facility-converted workbook |

All workflow procedures use upload-specific middleware and Zod schemas. File names, file counts, base64 payload shape, workbook signatures, column mappings, and record-count limits are validated before processing. Generated output passes through sanitization before it is returned to the client.

### 6.3 Account and privacy functions

Authenticated users can view and clear process-history metadata, configure retention, view security events, edit an encrypted profile payload, export their account metadata within an optional date range, and delete their profile metadata. Process-history records contain tool name, tool key, file-name metadata, output filename, record count, status, and completion time. They must not contain worksheet values, workbook bytes, preview rows, passwords, tokens, or sensitive profile content.

Retention options currently include 7, 30, 90, 180, and 365 days, plus no automatic limit. The project manager shall decide whether “unlimited” is permitted for the organization’s privacy policy. The security team shall define a maximum retention period if policy or regulation requires one.

### 6.4 Master Account functions

The Master Account interface supports user listing, email search, account status display, activity statistics, ban, unban, delete, administrative action history, and allowed email-domain configuration. Ban, unban, and delete are privileged actions and must be protected by server-side role checks; hiding a button in the frontend is not authorization.

Destructive operations must display a centered confirmation dialog that identifies the target email and the action. A delete confirmation must clearly state that deletion is permanent or identify the exact recovery policy. Each attempt must produce a persistent action-history record containing actor identity, target identity, action, final status, and timestamp. The target-user foreign key must not prevent deleted-user history from remaining available.

The default allowed email domain is `gmail.com` in the current policy implementation. The Master Account can change the configured domain, but the setting must never exclude the Master Account itself. Domain policy changes should be audited and should require a security-sensitive mutation path.

## 7. API and Authorization Model

The API is organized as typed tRPC procedures. The current high-level procedure groups are `auth`, `admin`, `excel`, `workbookColumns`, each workbook workflow, `processHistory`, `profile`, and `securityAudit`.

| Procedure category | Access level | Examples |
|---|---|---|
| Public | No authenticated session required | `auth.emailPolicy`, `auth.me` |
| Protected | Authenticated user required | `processHistory.list`, `profile.me`, `securityAudit.list` |
| Sensitive | Authenticated user plus sensitive-mutation safeguards | Profile update/delete, history clear, retention update |
| Administrative | Authenticated Master Account/admin role required | `admin.users`, `admin.actionHistory`, `admin.updateEmailPolicy`, `admin.moderate` |
| Upload | Validated upload request and request-size controls | All workbook processing and inspection procedures |

The team shall standardize authorization around an application role stored in a protected account record, rather than relying only on a hard-coded email comparison. The existing Master Account email check is useful as an emergency bootstrap control but should not be the long-term role model. Authorization must be evaluated server-side on every administrative request and again before every destructive mutation.

All input schemas shall remain strict. Unknown fields must be rejected where practical. Server errors returned to clients must use safe public messages and must not expose SQL statements, service credentials, filesystem paths, stack traces, or internal request payloads.

## 8. Security Specification

### 8.1 Identity and access management

| Control | Current direction | Required standard |
|---|---|---|
| Passwordless login | Supabase email OTP | Production Site URL, approved redirects, controlled OTP expiry, request throttling, verified sender |
| Domain restriction | Configurable policy, default `gmail.com` | Enforce on server and client; audit every change; prevent accidental lockout of the Master Account |
| Admin authorization | Protected procedure and application role lookup | Server-side role check for every admin query/mutation; no frontend-only trust |
| Privileged credentials | Server Supabase Admin API | Secret/service-role key only in Vercel server environment; never in `VITE_*`, browser bundles, logs, or client responses |
| Session handling | Supabase session plus application context | Secure HTTPS-only cookies where applicable, appropriate SameSite setting, logout invalidation, bounded session lifetime |
| Strong admin protection | Recommended | Add MFA or an approved identity-provider control for the Master Account; document break-glass recovery |

Supabase explicitly states that publishable/anon keys may be exposed to frontend code only when RLS and least-privilege policies protect the data, while secret/service-role keys bypass RLS and are never safe in the browser [1].

### 8.2 Database security and Row Level Security

All Supabase application tables containing user data, profile data, process metadata, policy data, or audit records shall have RLS enabled. Policies shall implement least privilege. A normal user may access only their own profile, process-history, retention settings, and security events. An administrator may access administrative records only through an approved server-side path or narrowly scoped policy.

The security team shall review every policy with the following questions:

1. What role or JWT claim is being evaluated?
2. Is the row owner derived from the authenticated subject rather than a client-provided user ID?
3. Can an authenticated user select, update, insert, or delete another user’s record?
4. Does a service-role path bypass RLS intentionally, and is that path server-only?
5. Can an admin history record be modified or deleted by an ordinary user?
6. Are audit records append-only or otherwise protected from tampering?

Supabase recommends enabling RLS and configuring least-privilege policies for exposed data [1]. RLS is not a substitute for server-side authorization; both layers must be maintained.

### 8.3 Input, file, and output security

The server shall validate file MIME/signature, extension, size, number of files, decoded payload size, workbook structure, worksheet dimensions, and maximum record counts. Validation shall occur before parsing with a resource-intensive library. The system shall reject malformed, encrypted, macro-enabled, or unsupported workbooks unless the security team explicitly approves a safe handling model.

Uploaded content shall be processed in memory or in a controlled temporary location with a guaranteed cleanup path. Temporary files must not be publicly reachable. Generated workbooks shall be sanitized to reduce formula-injection and unsafe-output risks. User-controlled strings placed into spreadsheet cells must be treated as data; the output layer must prevent spreadsheet formula execution where the application’s use case does not require formulas.

The system shall never place workbook bytes or worksheet rows into process history, security logs, analytics events, error messages, or support tickets. File names may themselves contain sensitive information and therefore should be minimized, normalized, and retained only when required.

### 8.4 API and web security

The current Vercel response headers include a Content Security Policy, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, Referrer Policy, Permissions Policy, Cross-Origin Opener Policy, Cross-Origin Resource Policy, and related hardening headers. These controls shall be tested in Production after every CSP or third-party integration change.

The CSP should remain as restrictive as possible. The team should remove legacy or unnecessary external origins, avoid `unsafe-inline` and `unsafe-eval` where the build permits, and document every allowed Google reCAPTCHA, font, analytics, or asset origin. CORS must allow only the production application origin and explicitly approved Preview origins; wildcard origins are prohibited for authenticated API responses.

The API shall apply rate limits to OTP requests, OTP verification attempts, login errors, account exports, upload processing, and administrative mutations. Rate-limit responses must not reveal whether a target email exists. The system should use request correlation IDs, structured safe logs, and anomaly alerts without logging secrets or workbook content.

### 8.5 Secret and configuration management

| Secret or configuration | Where it belongs | Prohibited location |
|---|---|---|
| Supabase URL | Client build configuration may expose project URL | Not sensitive, but must not be confused with a secret key |
| Supabase publishable/anon key | Frontend only with RLS | Never treated as authorization by itself |
| Supabase service-role/secret key | Vercel server environment only | Browser bundle, `VITE_*`, Git, issue comments, logs |
| Database URL/password | Server environment only | Client bundle, migrations committed with credentials, logs |
| Profile encryption key | Server environment or managed secret store | Database plaintext, browser, Git |
| reCAPTCHA secret | Server environment only | Frontend source or public environment variable |
| OAuth/API provider secrets | Server environment only | Client source, test fixtures, Preview unless approved |

Environment variables shall be reviewed per Vercel environment. Secret rotation must have an owner, a documented procedure, and a test plan. Production secrets must be rotated after accidental exposure, staff departure, or suspected compromise.

### 8.6 Audit and monitoring

Security events currently include privacy-preserving metadata such as workflow completion, history clearing, retention changes, profile updates/deletion, account export, session logout, and administrative actions. Event metadata shall remain allow-listed and typed. It must not contain access tokens, OTP values, full spreadsheet contents, raw profile payloads, IP addresses, or unnecessary personal data.

Administrative audit records shall include the actor ID/email, target ID/email captured before deletion, action, final status, timestamp, and a stable event identifier. Audit records should be append-only to ordinary application roles. The security team should define retention, export, alert thresholds, and tamper-evidence requirements.

Operational alerts should cover repeated OTP failures, abnormal upload rejection rates, repeated admin moderation attempts, service-role errors, database policy failures, Vercel function failures, unexpected 5xx increases, and CSP violations. Logs must be retained according to the organization’s policy and deleted on schedule.

## 9. Reliability and Performance Requirements

The system shall return a clear error state rather than an unhandled blank page when an optional table, migration, or downstream service is unavailable. The Master Account history fallback is an example of this principle. Optional audit persistence must not make a completed Auth deletion appear to fail; the Auth result and the audit-write result must be tracked separately.

Each workbook request must have a bounded execution time and memory budget compatible with Vercel’s serverless function limits. Large files should be rejected with a clear user message or moved to an asynchronous worker architecture if business requirements exceed serverless limits. The product team shall define maximum workbook size, maximum sheets, maximum rows, maximum concurrent jobs per user, and maximum total processing time.

Performance targets should be agreed before release. A recommended baseline is: login page interactive within 3 seconds on a normal broadband connection; ordinary metadata API responses within 1 second at the 95th percentile; clear validation errors within 2 seconds; and an explicit progress/error state for any workbook operation exceeding 5 seconds.

## 10. Data Classification and Retention

| Data type | Classification | Storage rule | Retention rule |
|---|---|---|---|
| OTP code, access token, refresh token | Secret | Supabase/provider-managed only; never log | Provider/session policy |
| Workbook bytes and cell values | Confidential user data | Temporary processing only unless separately approved | Delete after request completion or controlled failure cleanup |
| Generated workbook bytes | Confidential user data | Return to authorized requester; do not store by default | Temporary/download lifecycle only |
| File names and record counts | Potentially sensitive metadata | Process history only when necessary | User-selected or policy-defined retention |
| Encrypted profile payload | Personal data | Server-side encrypted storage | User deletion plus policy-defined backups |
| Security audit metadata | Restricted operational data | Append-only protected table/log | Security-team retention policy |
| Admin action history | Restricted operational data | Protected persistent history | Policy-defined, with deleted-user identity preserved as required |
| Email address and role | Personal/account data | Supabase Auth and protected account table | Account lifecycle policy |

The team shall document whether backups contain profile data, metadata, or audit records and how user deletion interacts with backup retention. “Deleted from the live database” does not necessarily mean immediately removed from encrypted backups; that distinction must be communicated in the privacy policy.

## 11. Development and Release Process

All changes shall follow this workflow:

1. Create a feature or fix branch from the intended base branch.
2. Implement the smallest complete change with tests and migration notes.
3. Run `pnpm install --frozen-lockfile` where dependencies are being reproduced.
4. Run `pnpm run check`, `pnpm run build`, focused Vitest tests, the full test suite, and `pnpm audit --prod --audit-level high` as appropriate.
5. Review the diff for secrets, accidental generated files, schema drift, and unrelated changes.
6. Push the branch and open a pull request.
7. Obtain developer review and security review for security-sensitive changes.
8. Merge only by an authorized repository owner after checks pass.
9. Allow the configured Vercel integration to deploy the merged commit; do not deploy unreviewed local changes.
10. Verify the Production deployment, Supabase migrations, headers, authentication, primary workflows, admin actions, and rollback readiness.

Pull requests changing authentication, authorization, migrations, CSP, file processing, encryption, logging, admin actions, or dependency versions require explicit security-team review. Database migrations must be idempotent where practical, tested against a disposable environment, and accompanied by rollback or forward-fix instructions.

## 12. Testing Strategy

| Test layer | Required coverage |
|---|---|
| Unit tests | Domain validation, file validation, processors, output sanitization, encryption helpers, retention calculations |
| Contract tests | Router procedure access levels, Admin page dialog behavior, layout and footer behavior, audit payload allow-list |
| Integration tests | Supabase Auth flow, protected procedure context, RLS policies, admin moderation, migration application |
| Security tests | Cross-user access denial, ordinary-user admin denial, service-role isolation, formula injection, oversized/malformed files, CSP and CORS checks |
| End-to-end tests | Login/OTP, workflow upload and download, profile management, logout, Master Account ban/delete confirmation and history |
| Reliability tests | Missing optional table, Supabase timeout, Auth Admin error, audit-write error after successful moderation, Vercel function timeout |
| Release smoke tests | Production URL, redirect URL, OTP email, one representative workflow, history, logout, admin access, security headers |

Tests must use mocked or disposable services for local execution. No test should send OTP emails, delete production users, or write production audit records. Destructive integration tests must use dedicated test identities and an isolated Supabase project.

## 13. Recommended Enhancements

The following recommendations should be added to the project backlog and prioritized by risk rather than convenience.

### Priority 0: Required before broad production use

1. **Formalize the single source of truth.** Decide whether Supabase fully replaces the Drizzle/MySQL-compatible path. Document the decision and remove unneeded credentials and code paths.
2. **Replace email-only admin identification.** Use a protected role/claim model with an emergency bootstrap procedure and MFA for the Master Account.
3. **Complete and verify RLS.** Add policy tests for every user-owned and admin-owned Supabase table. Confirm that service-role access exists only in server code.
4. **Add rate limiting.** Protect OTP issuance, verification, uploads, exports, and admin mutations with per-IP, per-account, and global limits.
5. **Define file limits and cleanup guarantees.** Enforce maximum bytes, decoded bytes, workbook dimensions, and processing time; test cleanup on every exception path.
6. **Configure monitoring and incident response.** Establish alerts for 5xx errors, Auth abuse, service-role failures, and suspicious admin activity.

### Priority 1: Important operational improvements

1. Add a durable job model for workbooks that exceed serverless execution limits.
2. Add explicit idempotency keys for admin mutations and long-running processing requests.
3. Add a security dashboard for audit events, failed admin operations, and policy changes.
4. Add automated dependency scanning, secret scanning, CodeQL or equivalent static analysis, and lockfile review in CI.
5. Add preview-environment data isolation so Preview cannot access Production users or metadata.
6. Add formal backup/restore tests for Supabase data and document recovery time and recovery point objectives.
7. Add a changelog and migration registry that records which SQL migrations are applied in each environment.

### Priority 2: Product and usability improvements

1. Add a visible processing progress indicator and cancellation behavior for large workbooks.
2. Add an admin confirmation dialog that requires typing the user email for permanent deletion.
3. Add pagination and server-side search for large user lists rather than loading up to 1,000 users at once.
4. Add an exportable, access-controlled admin audit report with redaction rules.
5. Add accessibility testing with keyboard-only navigation, screen-reader labels, focus trapping, and color-contrast verification.
6. Add localization support if the tool will be used by teams with different primary languages.

## 14. Open Decisions for the Project Manager

| Decision | Owner | Required outcome |
|---|---|---|
| Is Supabase the sole production database? | Project manager + technical lead | One authoritative data-path decision |
| What email domains are permitted in production? | Project manager + security | Approved domain list and change process |
| Is MFA required for the Master Account? | Security team | Authentication assurance level and recovery plan |
| What is the maximum workbook size and processing duration? | Product + development | Published limits and technical enforcement |
| How long is process metadata retained? | Project manager + privacy/security | Default, maximum, and deletion behavior |
| Are workbook contents prohibited from backups and logs? | Security + privacy | Data-classification and backup statement |
| What are the RTO/RPO targets? | Project manager + infrastructure | Recovery plan and test schedule |
| Who may merge and who may deploy? | Project manager + repository owner | Branch protection and approval matrix |

## 15. Production Readiness Checklist

### Application

- [ ] Production build succeeds from the lockfile.
- [ ] TypeScript check and full test suite pass, or exceptions are documented and approved.
- [ ] All workbook processors enforce size, structure, and record limits.
- [ ] Generated output is sanitized and formula-injection behavior is tested.
- [ ] No workbook bytes or cell values appear in metadata, logs, telemetry, or errors.
- [ ] Logout works even when metadata cleanup fails.
- [ ] Master Account ban, unban, and delete actions require centered confirmation and write final-status history.

### Supabase

- [ ] Production Site URL and redirect URLs are restricted to approved origins.
- [ ] OTP template, expiration, sender, and rate limits are configured.
- [ ] RLS is enabled on all exposed application tables.
- [ ] RLS policy tests cover cross-user and ordinary-user admin access.
- [ ] Service-role/secret credentials exist only in server-side environment variables.
- [ ] All required migrations are applied and recorded.
- [ ] Admin history survives target-user deletion as designed.
- [ ] Backup, restore, and deletion-retention behavior is documented.

### Vercel and repository

- [ ] Preview and Production environments use separate variables and data.
- [ ] Branch protection requires review and passing checks.
- [ ] Direct production deployment is restricted to authorized operators or the approved merge integration.
- [ ] CSP, CORS, security headers, and third-party origins are verified on the production URL.
- [ ] Vercel function duration and memory limits match the workbook workload.
- [ ] Logs and alerts are configured without secrets or user workbook content.
- [ ] Rollback procedure has been tested.

### Governance

- [ ] Security review is signed off for authentication, authorization, RLS, file processing, and secrets.
- [ ] Project manager has approved scope, limits, retention, and release acceptance criteria.
- [ ] Support and incident contacts are documented.
- [ ] Privacy notice and user-facing data-retention statements match actual behavior.
- [ ] A post-release review is scheduled after the first production release.

## 16. References

[1]: https://supabase.com/docs/guides/database/secure-data "Supabase: Securing your data"

[2]: https://vercel.com/docs/frameworks/frontend/vite "Vercel: Vite on Vercel"

[3]: https://supabase.com/docs/guides/auth/auth-email-passwordless "Supabase: Passwordless email logins"

## 17. Repository Evidence Used

This specification was derived from the repository’s current `package.json`, `vercel.json`, `client/src/App.tsx`, `client/src/pages/Admin.tsx`, `client/src/components/DashboardLayout.tsx`, `server/routers.ts`, `server/supabaseIntegration.ts`, `server/db.ts`, `drizzle/schema.ts`, and `supabase/migrations/`. Statements labeled as recommendations or requirements are target controls proposed for team approval rather than claims that every control is already complete.
