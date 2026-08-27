# Hosting and Backend Service Comparison

## Short Answer

For the **current Excel Master File Tool**, keeping the existing managed hosting is the better option. The application already combines a React frontend, a TypeScript/Express backend, a MySQL/TiDB database, secure sign-in, and Python-based Excel analysis in one managed deployment. Most importantly, it can process the currently supported **10 MB per file** and **20 MB per batch** uploads without first placing the user’s workbook in object storage.

Vercel and Supabase can be a good future stack, but they are **not a direct replacement** for this exact application. Moving there would require a backend redesign because a Vercel Function limits request and response bodies to **4.5 MB**, while this tool’s supported Excel uploads and output workbooks can be larger.[1]

> **Recommendation:** Keep the current managed deployment for the application as it is today. Use a custom domain with the existing hosting if you want a branded public address. Consider Vercel + Supabase only if you are willing to redesign the upload/processing architecture and accept either a separate Python worker service or temporary object storage.

## 1. What the Application Uses Now

| Layer | Current technology | Where it runs | What it does |
| --- | --- | --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS | Managed web application hosting | Shows the dashboard, tool pages, upload controls, previews, downloads, profile settings, and account management. |
| API and backend | Node.js, TypeScript, Express 4, tRPC 11 | Same managed web deployment | Receives authenticated processing requests, validates files, applies rate limits, calls the selected processing worker, and returns previews and output bytes. |
| Excel analysis | Python 3, pandas, openpyxl | A short-lived worker started by the backend for each request | Reads the active CSV/XLSX data in memory, applies the selected Excel workflow, creates a new XLSX result in memory, and exits. |
| Database | Managed MySQL/TiDB with Drizzle ORM | Managed database service | Stores user identity, encrypted editable profile information, metadata-only process history, retention preferences, and safe audit events. |
| Authentication | Managed OAuth and hardened signed sessions | Backend and identity service | Signs users in and protects upload, account, history, profile, and audit operations. |
| Workbook storage | None | Not applicable | Source files, sheet values, preview rows, and output workbooks are not written to the database or file storage. |

The current hosting mode is **Autoscale**, which is a managed, stateless Cloud Run-style deployment. It can start and scale request-serving instances as needed. It is suitable for this application because each workbook run is request-scoped: the Python worker starts, processes the active bytes, returns the result, and ends. The managed platform also provides HTTPS, secrets handling, access control, checkpoints, rollback, and custom-domain support without separate infrastructure administration.[3]

## 2. Current Data and Processing Path

```text
User browser
   → Managed React frontend
   → Express + tRPC backend
   → Temporary Python pandas/openpyxl worker
   → Result returned to browser for preview and local download

Only safe account and process metadata
   → Managed MySQL/TiDB database

Workbook files and spreadsheet values
   → Never written to the database or object storage
```

This design is well aligned with your privacy requirement because there is no object-storage bucket holding user workbooks after the request completes.

## 3. What Vercel Would Provide

Vercel is very good for hosting React and Next.js frontends. It can also run Node.js and Python functions. Its Python runtime supports ASGI and WSGI applications, including FastAPI and Flask.[2]

However, your current backend is a long-running Express server that starts Python scripts for each Excel workflow. It cannot simply be uploaded to Vercel unchanged. You would need to choose one of the following migration designs.

| Vercel design | How it would work | Fit for this tool |
| --- | --- | --- |
| Vercel frontend + Vercel Functions | Convert Express/tRPC routes into Vercel Functions and move or rewrite Python processing. | **Not suitable without major changes.** The 4.5 MB request/response limit conflicts with the current 10 MB single-file and 20 MB batch limits.[1] |
| Vercel frontend + Vercel Python Function | Rewrite the worker as a FastAPI/Flask endpoint. | **Technically possible but still blocked by the 4.5 MB request/response limit** for typical workbook payloads.[1] [2] |
| Vercel frontend + separate Python service | Vercel hosts the user interface; a separate Cloud Run, Render, Railway, Fly.io, or similar service runs the current Python workflow API. | **Possible**, but you would operate two services and need secure cross-service authentication, CORS rules, monitoring, deployment, and scaling. |
| Vercel frontend + temporary object storage + worker | Browser uploads workbook directly to protected object storage; a worker reads it, processes it, then deletes it. | **Technically common, but it conflicts with your current strict no-file-storage preference** unless you formally approve short-lived encrypted storage and deletion rules. |

Vercel Functions can run up to five minutes on the Hobby plan and up to 800 seconds on Pro/Enterprise, with a longer 30-minute option in beta for supported runtimes. They have 2 GB memory on Hobby and up to 4 GB on Pro/Enterprise.[1] These limits are reasonable for small workbook tasks, but the **4.5 MB HTTP request and response body limit is the practical blocker** for your current upload rules and for returning generated XLSX files directly.[1]

## 4. What Supabase Would Provide

Supabase is a managed backend platform centered on **PostgreSQL**. It includes a hosted Postgres database, authentication, REST APIs, realtime capabilities, and object storage.[4] [5] [6]

| Supabase service | Possible use in this app | Important migration impact |
| --- | --- | --- |
| Postgres database | Replace the current MySQL/TiDB database. | All Drizzle schema definitions, migrations, SQL details, connection setup, and database tests must be converted from MySQL to PostgreSQL. |
| Supabase Auth | Replace the current managed OAuth/session flow. | The login flow, session handling, user identity mapping, server procedures, and security tests must be rewritten. Supabase Auth uses JWTs and is normally paired with Row Level Security (RLS).[5] |
| Supabase Storage | Store uploaded or generated workbook files. | **Do not use it for this application under the current privacy rule.** Storage is designed for files, but this tool intentionally avoids retaining workbook files.[6] |
| Edge Functions | Run small API logic near the database. | Not a replacement for your present pandas/openpyxl worker; complex Python workbook processing needs its own tested runtime and resource plan. |

Supabase can be a strong choice if you want PostgreSQL, its dashboard, built-in user authentication, and SQL-level Row Level Security. Each Supabase project receives a full Postgres database, and paid plans include point-in-time recovery for database data.[4] But it will not remove the need for a reliable processing runtime for the Excel work itself.

## 5. Side-by-Side Comparison

| Decision factor | Current managed deployment | Vercel + Supabase |
| --- | --- | --- |
| Keep the application working now | **Best fit.** No platform migration. | Requires significant backend, database, and authentication migration. |
| Existing Python/pandas/openpyxl workflows | **Supported in the current request worker design.** | Requires a separate worker service or a full rewrite into Vercel-compatible Python functions. |
| Current upload policy: 10 MB per file / 20 MB batch | **Fits the current server-body design.** | Direct Vercel Function requests exceed the 4.5 MB function payload cap.[1] |
| Generated output download | **Returned directly to the browser from the backend.** | Could exceed Vercel’s 4.5 MB response cap; requires a different download design.[1] |
| No workbook storage | **Matches the current in-memory-only model.** | Possible only with a separate worker that accepts streaming/direct processing; object-storage-based patterns need a policy change. |
| Database | Managed MySQL/TiDB, already implemented and hardened. | Supabase Postgres is powerful, but migration is required. |
| Authentication | Managed OAuth and hardened 24-hour sessions are already implemented. | Supabase Auth is capable, but requires migration and RLS policy design.[5] |
| Operational work | **Low.** Managed hosting, secrets, database, checkpoints, rollback, and custom domain. | Higher. At least Vercel + Supabase, and likely a third Python worker service. |
| Best use case | Current private, security-conscious Excel processing tool. | New product built around Next.js/Postgres, with small HTTP payloads or approved storage-based uploads. |

## 6. Clear Recommendation

### Use the Current Managed Hosting Now

The current model is better for you **today**. It supports the application’s existing Python workbook processors, the larger protected upload limits, direct browser result downloads, and the rule that user workbooks are never stored in the database or object storage. It also avoids a high-risk migration of the database, authentication, server routes, and tests.

If the goal is simply to use your own business address, connect a **custom domain** to the current managed application instead of migrating infrastructure. This preserves the working privacy and processing model.

### Use Vercel + Supabase Only for a Planned Redesign

Choose Vercel + Supabase if you specifically want a Next.js/Vercel development workflow and Supabase’s Postgres/Auth ecosystem, and you accept the added engineering work. For this Excel tool, the recommended version would be:

```text
Vercel: React/Next.js frontend
Supabase: Postgres, Auth, metadata-only account data
Separate Python worker service: pandas/openpyxl processing
No Supabase Storage for workbooks: preserve in-memory-only processing
```

That architecture still needs the separate Python service because direct Vercel Functions cannot safely carry this application’s current workbook sizes through their HTTP request/response body limit.[1]

## 7. Migration Checklist If You Decide to Move Later

1. **Decide the file privacy policy first.** Keep strict in-memory-only processing, or explicitly approve short-lived encrypted object storage with deletion, access control, and audit rules.
2. **Move the frontend separately.** Vercel can host the React/Next.js user interface.
3. **Choose a Python worker host.** Keep the pandas/openpyxl logic in a dedicated service that has tested memory, timeout, and payload capacity.
4. **Migrate the database from MySQL/TiDB to Supabase Postgres.** Convert Drizzle schema, migrations, indexes, queries, and tests.
5. **Migrate authentication deliberately.** Replace the current OAuth/session logic with Supabase Auth, define RLS policies, and retest every protected operation.
6. **Redesign request paths.** Ensure file uploads and output downloads never cross a 4.5 MB Vercel Function body limit.
7. **Repeat the security review.** Revalidate session security, RLS, secrets, rate limits, database TLS, audit-event privacy, and the no-workbook-storage boundary before launch.

## References

[1] [Vercel Functions Limits](https://vercel.com/docs/functions/limitations)

[2] [Vercel Python Runtime](https://vercel.com/docs/functions/runtimes/python)

[3] [Manus Persistent Computing and WebDev Hosting Guidance](file:///home/ubuntu/skills/persistent-computing/SKILL.md)

[4] [Supabase Database Overview](https://supabase.com/docs/guides/database/overview)

[5] [Supabase Auth Overview](https://supabase.com/docs/guides/auth)

[6] [Supabase Storage Overview](https://supabase.com/docs/guides/storage)
