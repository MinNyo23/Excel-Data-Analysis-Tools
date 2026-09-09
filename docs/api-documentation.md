# Excel Data Analysis Tools API Documentation

**Document status:** Current implementation reference  
**API style:** tRPC 11 over HTTP  
**Production base URL:** `https://excel-master-file-tool.vercel.app`  
**API base path:** `/api/trpc`  
**Primary backend:** Node.js, Express, tRPC, Supabase Auth, Supabase database integration  
**Author:** Manus AI

## 1. Overview

The application exposes a typed RPC API rather than a conventional REST resource API. Procedures are defined in `server/routers.ts`, mounted by the Express adapter in `api/index.ts`, and served under `/api/trpc`. The frontend consumes the same contract through the generated `AppRouter` type and the React tRPC client.

The production server applies security headers, no-store caching, API CORS rules, request guards, and JSON/form body limits before the tRPC middleware. JSON request bodies are limited to 4 MB at the Express layer. Workbook payloads are additionally validated by application-level upload security before processing.

> **Important:** The public API hostname and route are stable, but the exact procedure set is defined by the deployed Git commit. Keep this document synchronized with `server/routers.ts` whenever a procedure or schema changes.

## 2. Transport and Request Format

### 2.1 Base URL

Use the following base URL for Production:

```text
https://excel-master-file-tool.vercel.app/api/trpc
```

For a single query procedure, the canonical tRPC URL is conceptually:

```text
GET /api/trpc/{procedure}?input={encoded-input}
```

The application also supports tRPC batching. A browser request may therefore look like:

```text
GET /api/trpc/auth.me?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D
```

A mutation should be sent as a JSON `POST` request to the procedure path. The exact tRPC client serialization is preferred over hand-constructing requests.

### 2.2 Required headers

Authenticated callers must send the Supabase access token as a bearer token:

```http
Authorization: Bearer <supabase-access-token>
Content-Type: application/json
```

The browser client should use the project’s tRPC client and Supabase session integration rather than manually managing cookies or duplicating authentication logic. The API sets `Cache-Control: no-store, no-cache, max-age=0, must-revalidate` and `Pragma: no-cache` for API responses.

### 2.3 CORS

The Vercel adapter allows the production origin and Vercel subdomains according to the current server implementation. The Supabase dashboard redirect allow-list must remain narrower than the server’s technical CORS capability. CORS is not an authorization mechanism; every protected procedure still authenticates and authorizes the caller.

## 3. Authentication and Authorization

The request context first attempts to authenticate a Supabase bearer token. If a Supabase user is not found, the broader application context can fall back to the legacy Manus session mechanism for supported routes. Supabase-authenticated users are represented with an `authProvider` value of `supabase`.

The Supabase Vercel adapter validates the bearer token with Supabase Auth, loads the configured allowed email domain, and rejects users whose email does not satisfy that policy. The domain policy is currently managed through the Master Account feature and defaults to the project policy value rather than being hard-coded in every endpoint.

| Procedure class | Authentication | Additional authorization | Rate limit |
|---|---|---|---|
| `publicProcedure` | No session required | None, except endpoint-specific policy behavior | No tRPC user rate limit |
| `protectedProcedure` | Valid authenticated user required | User-scoped data access | No generic limit unless composed with another middleware |
| `sensitiveProcedure` | Valid authenticated user required | User-scoped mutation or sensitive operation | 30 requests per minute per user and procedure path |
| `uploadProcedure` | Valid authenticated user required | Valid workbook payload required | 12 requests per minute per user and procedure path |
| `admin.*` in the current router | Valid authenticated user required | Master Account email check in `server/admin.ts` | Depends on underlying protected procedure; moderation also depends on Supabase Admin API |

Unauthenticated requests normally return `UNAUTHORIZED` with HTTP status 401. A caller who is authenticated but is not the Master Account receives `FORBIDDEN` for Master Account procedures. The current Master Account check is email-based and compares the normalized caller email with the configured Master Account email constant; this must be treated as a high-risk authorization boundary.

## 4. Common Response and Error Shapes

Successful tRPC results are wrapped by the tRPC protocol. A conceptual success response is:

```json
{
  "result": {
    "data": {
      "json": {
        "success": true
      }
    }
  }
}
```

A conceptual error response is:

```json
{
  "error": {
    "json": {
      "message": "Request could not be completed.",
      "code": -32603,
      "data": {
        "code": "INTERNAL_SERVER_ERROR",
        "httpStatus": 500
      }
    }
  }
}
```

The server deliberately redacts internal stack traces, filesystem paths, procedure names, and implementation-specific validation details from browser-facing errors. Common public error codes are shown below.

| tRPC code | HTTP status | Typical meaning |
|---|---:|---|
| `UNAUTHORIZED` | 401 | No valid Supabase bearer token or supported session was supplied. |
| `FORBIDDEN` | 403 | The caller is authenticated but lacks Master Account authorization. |
| `BAD_REQUEST` | 400 | The input failed schema or workbook validation. |
| `NOT_FOUND` | 404 | The requested procedure or resource is unavailable. |
| `TOO_MANY_REQUESTS` | 429 | The per-user procedure limit was exceeded; the response may include `retryAfterSeconds`. |
| `PRECONDITION_FAILED` | 412 | The requested operation requires a provider or deployment capability that is not available. |
| `INTERNAL_SERVER_ERROR` | 500 | An unexpected backend failure occurred. Internal details are logged server-side, not returned to the browser. |

## 5. Procedure Catalog

The tables below document the current `AppRouter` procedures. Inputs marked `null` or omitted use the tRPC equivalent of no input. Zod schemas reject unknown properties where the schema is marked strict.

### 5.1 Public authentication procedures

| Procedure | Method | Input | Response |
|---|---|---|---|
| `auth.emailPolicy` | Query | None | The currently allowed email-domain policy used by the login flow. |
| `auth.me` | Query | None | The authenticated application user or `null` for an unauthenticated request. |

Example:

```bash
curl -sS \
  'https://excel-master-file-tool.vercel.app/api/trpc/auth.me?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D'
```

### 5.2 Authenticated session procedure

| Procedure | Method | Input | Response | Notes |
|---|---|---|---|---|
| `auth.logout` | Mutation | None | `{ "success": true, "clearedProcessHistory": number }` | Attempts to clear process history and records a logout audit event. Session termination remains successful if cleanup is unavailable. |

Example with the Supabase access token:

```bash
curl -sS -X POST \
  'https://excel-master-file-tool.vercel.app/api/trpc/auth.logout?batch=1' \
  -H 'Authorization: Bearer <supabase-access-token>' \
  -H 'Content-Type: application/json' \
  --data '{"0":{"json":null}}'
```

### 5.3 Excel and workbook processing procedures

All procedures in this section use `uploadProcedure`. They require authentication, accept workbook data encoded by the application’s upload format, and are limited to 12 requests per minute per user and procedure path.

The shared `uploadedFile` object is:

```json
{
  "name": "input.xlsx",
  "data": "<base64-or-supported-encoded-workbook-data>"
}
```

The file name must be 1–255 characters and the data string must contain at least 4 characters. The security layer validates workbook type, file structure, file count, and batch constraints before the processor runs. The maximum batch file count is controlled by `MAX_UPLOAD_FILES` in `server/security.ts`.

| Procedure | Input shape | Purpose |
|---|---|---|
| `excel.process` | `{ "files": uploadedFile[] }` with at least one file | Runs the general Excel processing workflow. |
| `workbookColumns.inspect` | `{ "file": uploadedFile }` | Inspects workbook columns for mapping and workflow preparation. |
| `deletionSummary.process` | `{ "file": uploadedFile }` | Processes deletion-summary data. |
| `deletionDuplicates.process` | `{ "file": uploadedFile }` | Processes deletion-duplicate data. |
| `deletionWithSummary.process` | `{ "file": uploadedFile }` | Processes deletion data with summary output. |
| `additionExitMatch.process` | `{ "original": uploadedFile, "exit": uploadedFile, "mapping": pairedColumnMapping? }` | Matches original and exit workbooks. |
| `deletionOnboardMatch.process` | `{ "onboard": uploadedFile, "deletion": uploadedFile, "mapping": pairedColumnMapping? }` | Matches onboard and deletion workbooks. |
| `readyUpload.process` | `{ "file": uploadedFile }` | Runs the ready-upload preparation workflow. |
| `facilityConversion.process` | `{ "file": uploadedFile }` | Converts facility-related workbook data. |

The optional `pairedColumnMapping` object can contain these trimmed column-name fields, each with a maximum length of 120 characters:

```json
{
  "originalPhone": "Phone",
  "originalNrc": "NRC",
  "originalCorporateName": "Corporate Name",
  "secondPhone": "Phone",
  "secondNrc": "NRC"
}
```

Processed workbook results are passed through output sanitization before being returned. Clients must treat generated files as untrusted output until they are downloaded and verified by the user.

### 5.4 Process history procedures

| Procedure | Method | Input | Response |
|---|---|---|---|
| `processHistory.list` | Query | None | The authenticated user’s process-history records after retention cleanup. |
| `processHistory.record` | Mutation | `processHistoryInputSchema` | `{ "success": true }` after recording a completed workflow and security audit event. |
| `processHistory.clear` | Mutation | None | `{ "deletedCount": number }` and a `history_cleared` audit event. |

`processHistory.record` accepts:

```json
{
  "toolKey": "deletion-summary",
  "toolName": "Deletion Summary",
  "inputFileNames": ["source.xlsx"],
  "outputFilename": "processed.xlsx",
  "totalRecords": 1250
}
```

Validation limits are a 1–64 character `toolKey`, a 1–128 character `toolName`, 1–50 input file names with each name limited to 255 characters, a 1–255 character output filename, and an integer `totalRecords` from 0 through 10,000,000.

### 5.5 Retention procedures

| Procedure | Method | Input | Response |
|---|---|---|---|
| `processHistory.retention.get` | Query | None | `{ "retentionDays": 7\|30\|90\|180\|365\|null, "allowedDays": [...] }` |
| `processHistory.retention.update` | Mutation | `{ "retentionDays": 7\|30\|90\|180\|365\|null }` | Cleanup result plus `allowedDays`; records a `retention_changed` audit event. |

`null` represents unlimited retention in the application’s current policy model. Retention cleanup runs when history is listed, updated, and when an account export is created.

### 5.6 Profile procedures

| Procedure | Method | Input | Response |
|---|---|---|---|
| `profile.me` | Query | None | `{ "identity": { "name": string, "email": string }, "profile": profile\|null }` |
| `profile.update` | Mutation | `editableUserProfileSchema` | `{ "success": true }` and a `profile_updated` audit event. |
| `profile.export` | Query | Optional `{ "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" }` | Identity, profile, exported timestamp, and filtered process history. |
| `profile.delete` | Mutation | None | Metadata-profile deletion result and a `profile_deleted` audit event. |

The editable profile schema is:

```json
{
  "displayName": "string, trimmed, maximum 120 characters",
  "phoneNumber": "string, trimmed, maximum 40 characters",
  "organization": "string, trimmed, maximum 160 characters",
  "jobTitle": "string, trimmed, maximum 120 characters"
}
```

The export date fields must be valid calendar dates. If both dates are supplied, `startDate` must be on or before `endDate`. The export returns input file names as arrays instead of the database’s serialized representation.

### 5.7 Security-audit procedures

| Procedure | Method | Input | Response |
|---|---|---|---|
| `securityAudit.list` | Query | None | Security audit events belonging to the authenticated user. |

The API uses audit event types such as `session_logout`, `workflow_completed`, `history_cleared`, `retention_changed`, `profile_updated`, `account_exported`, and `profile_deleted`. Audit write failures are logged server-side and should not expose secrets or stop a non-critical user workflow unless the procedure explicitly requires durable history.

### 5.8 Master Account procedures

Master Account procedures require authentication and then perform an additional Master Account email authorization check. The current implementation integrates with Supabase Admin API operations for Supabase-authenticated administrators.

| Procedure | Method | Input | Response |
|---|---|---|---|
| `admin.users` | Query | None | Managed users enriched with workflow, file, record, and last-activity usage data. |
| `admin.actionHistory` | Query | None | Persistent user-management action history. The application includes a fallback path for a deployed security-audit table when the optional structured history table is absent. |
| `admin.emailPolicy` | Query | None | Current allowed email-domain policy. |
| `admin.updateEmailPolicy` | Mutation | `{ "domain": string }` | Updated policy. Domain input is trimmed and limited to 253 characters. |
| `admin.moderate` | Mutation | `{ "userId": string, "action": "ban"\|"unban"\|"delete" }` | Final moderation result after Supabase Auth action and history logging. |

Example moderation input:

```json
{
  "userId": "supabase-user-uuid",
  "action": "ban"
}
```

Ban and delete operations are destructive administrative actions. They must be initiated only from the confirmed Master Account UI, require explicit user confirmation, and be tested with a disposable user before a production rollout.

## 6. Supabase Integration Boundary

Supabase is the authentication and privileged user-management provider for Supabase-authenticated accounts. The server validates Supabase access tokens, reads the configured domain policy, lists Supabase users, lists Supabase-backed process history, and uses the Supabase Admin API for ban, unban, and delete operations.

The browser may use the Supabase publishable key. The Supabase service-role key must remain in server-side Vercel environment variables and must never appear in `VITE_*` variables, frontend source, browser responses, or client bundles. Service-role operations must not be exposed as a direct browser-callable Supabase operation.

The database layer currently uses owner-scoped RLS policies for core application tables. The API additionally filters data by the authenticated user ID. Both controls are required: application filtering must not be treated as a replacement for database RLS.

## 7. Security Requirements for API Consumers

API consumers must use HTTPS and must not log bearer tokens, OTP values, workbook contents, generated files, SMTP credentials, or service-role credentials. Tokens should be kept in the Supabase client session mechanism and attached by the approved client integration.

Clients must display generic user-facing error messages and use the server’s `retryAfterSeconds` value when a 429 response is returned. Clients must not retry destructive moderation mutations automatically. Uploads must be validated before transmission, and users should be warned that workbook formulas, macros, hidden sheets, and external links may contain unsafe content.

The Master Account should use TOTP MFA, a narrowly restricted Supabase redirect allow-list, a verified transactional email provider, and a documented break-glass procedure. Ordinary users must never be granted access to `admin.*` procedures, even if they can access other protected procedures.

## 8. Operational and Testing Guidance

Every API change should update `server/routers.ts`, add or update a focused Vitest test, run the TypeScript check and production build, and be delivered through a pull request before deployment. Database changes must include an ordered Supabase migration and a verification step in the Production migration history.

Before a release, test successful and failed authentication, an expired OTP, an unapproved email domain, cross-user data access, ordinary-user calls to every Master Account procedure, upload size/type limits, rate limiting, profile export date validation, retention cleanup, logout when cleanup fails, and deletion-history persistence after a target user is removed.

## 9. Recommended OpenAPI-Like Mapping

Because tRPC is the authoritative contract, an OpenAPI document should be generated or maintained only as a secondary integration artifact. If a REST integration is required, expose a versioned adapter such as `/api/v1` rather than asking external consumers to depend on internal tRPC batching and serialization details. The adapter should preserve the same Zod schemas, authorization rules, error redaction, rate limits, and audit behavior.

## 10. References

[1]: https://trpc.io/docs "tRPC documentation"

[2]: https://supabase.com/docs/guides/auth "Supabase Auth documentation"

[3]: https://supabase.com/docs/guides/database/postgres/row-level-security "Supabase Row Level Security documentation"

[4]: https://vercel.com/docs/functions "Vercel Functions documentation"
