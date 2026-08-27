# Project TODO

- [x] Confirm the first feature scope and exact output sheet names
- [x] Review the provided Colab script for Addition and Deletion sheet merging
- [x] Add server-side Excel processing using pandas/openpyxl-compatible logic
- [x] Support multiple .xlsx and .xls uploads through drag-and-drop and file picker
- [x] Match Addition and Deletion sheets flexibly using the provided script behavior
- [x] Add Source_File metadata to merged Addition and Deletion rows
- [x] Generate Summary Report with per-file counts and a TOTAL row
- [x] Generate workbook with exact sheet names: Summary Report, Addition, Deletion
- [x] Add in-browser preview tables for merged Addition and Deletion samples
- [x] Add one-click .xlsx download after preview is available
- [x] Handle invalid files, missing sheets, empty uploads, and processing errors clearly
- [x] Create Vitest coverage for the Excel processing contract
- [x] Verify TypeScript/build checks and responsive visual layout
- [x] Capture final checkpoint and deliver the project version

## History

- Initial feature request: Addition and deletion compress into master file.
- Source logic received from Colab attachment: `pasted_content.txt`.
- User clarified server-side processing, preview-before-download, exact workbook sheet names, and polished UI requirements.
 לע

- [x] Add Vitest coverage for real in-memory Excel workbooks, flexible sheet matching, Source_File tagging, merged rows, totals, and exact sheet names
- [x] Run the production build and fix any build issues
- [x] Verify responsive layout at mobile and tablet breakpoints

- [x] Open the generated workbook bytes in a test and assert the actual workbook tabs and representative merged cell values
- [x] Capture and review a tablet-width screenshot around 768px

## Deletion Summary List

- [x] Add server-side entity-level deletion count processing from one uploaded workbook
- [x] Match the Deletion sheet flexibly and fall back to the first sheet when no deletion label exists
- [x] Match the Entity Name column flexibly and report a clear error when it is missing
- [x] Generate a Deletion Entity Summary sheet with Sr No, Entity Name, Total Deletion Count, and TOTAL row
- [x] Preserve the selected deletion data in a Deletion Data sheet
- [x] Add Deletion Summary List upload, preview, and download controls to the application
- [x] Add Vitest coverage for entity counting, total calculation, sheet fallback, and output workbook tabs
- [x] Run build/tests and verify the updated responsive interface
- [x] Save and deliver the updated project checkpoint

- [x] Add a Deletion Summary test workbook with no Deletion/Del sheet label and verify first-sheet fallback

## Deletion Duplicate Remove and Separate List

- [x] Add server-side duplicate detection using Employee Full Name and NRC No
- [x] Match duplicate-detection columns flexibly and report missing-column errors clearly
- [x] Read the first worksheet and preserve the first occurrence of each duplicate key
- [x] Move subsequent duplicate rows into a separate Duplicates Moved sheet
- [x] Generate Clean Data and Duplicates Moved output sheets with exact names
- [x] Add duplicate-removal upload, preview, counts, and download controls to the application
- [x] Add Vitest coverage for duplicate grouping, clean-row retention, column matching, and workbook tabs
- [x] Run build/tests and verify the updated responsive interface
- [x] Save and deliver the updated project checkpoint

- [x] Capture and review mobile and tablet screenshots for the duplicate-separation section

## Deletion with the Summary

- [x] Add server-side multi-sheet entity counting with flexible Entity Name detection
- [x] Generate an Entity Summary sheet with per-sheet count columns, Grand Total, and TOTAL row
- [x] Preserve all source worksheets after the new Entity Summary sheet
- [x] Add upload, preview, metrics, and download controls for the multi-sheet entity summary
- [x] Add Vitest coverage for cross-sheet counts, totals, preserved tabs, and exported workbook layout
- [x] Run build/tests and verify the updated responsive interface
- [x] Save and deliver the updated project checkpoint

- [x] Inspect the exported Entity Summary workbook bytes in Vitest to verify real tabs and representative cell values
- [x] Capture and review a tablet screenshot for the Entity Summary section

## Addition Original and Exit Data Match

- [x] Add server-side normalized mobile and NRC matching between original and exit files
- [x] Add original-data lookup with mobile priority and matched output columns
- [x] Categorize and export Both Matched, Mobile Only, NRC Only, and No Match records
- [x] Generate Summary Report and exact report sheet names
- [x] Add two-file upload, preview, metrics, and download controls to the application
- [x] Add Vitest coverage for matching categories, match priority, and workbook tabs
- [x] Run build/tests and verify the updated responsive interface
- [x] Save and deliver the updated project checkpoint

- [x] Add category metrics and preview tabs for the match report output groups
- [x] Inspect the exported match workbook bytes in Vitest to verify tabs and sample values
- [x] Capture and review mobile and tablet layouts for the match workflow

## Deletion Check with Onboard

- [x] Add server-side normalized NRC matching between onboard and deletion files
- [x] Enrich matched deletion records with onboard registration number and corporate name
- [x] Generate Matched List, No Match List, and Summary Report with exact names
- [x] Add two-file upload, match metrics, previews, and download controls to the application
- [x] Add Vitest coverage for NRC matching, enrichment, output groups, and workbook tabs
- [x] Run build/tests and verify the updated responsive interface
- [x] Save and deliver the updated project checkpoint

## Development Preview WebSocket Fix

- [x] Inspect Vite development configuration and WebSocket-related logs
- [x] Apply a preview-compatible HMR WebSocket configuration fix if required
- [x] Restart the development service and confirm the preview loads without WebSocket errors

## Persistent Vite WebSocket Fallback Fix

- [x] Inspect the active HMR client settings and Vite runtime integration
- [x] Prevent Vite from retrying an unreachable direct local WebSocket connection through the preview proxy
- [x] Restart and confirm that the browser preview no longer logs the WebSocket failure

## Vite WebSocket Handshake Closure Fix

- [x] Inspect the active HMR protocol settings that reach the browser client
- [x] Apply a protocol-compatible HMR client configuration for the local proxy route
- [x] Restart and confirm the browser connection remains open

## Routed Vite WebSocket Preview Fix

- [x] Inspect the active Vite client configuration for routed preview pages
- [x] Prevent the browser Vite client from opening the unsupported preview WebSocket transport
- [x] Restart and verify the Onboard route preview without a WebSocket console error

## Convert into Ready File to Upload

- [x] Add server-side employee column renaming, blank required fields, and target ordering
- [x] Normalize Date of Birth and apply the MM/DD/YYYY Excel display format
- [x] Generate Transformed_Employee_Data.xlsx with the defined upload-ready schema
- [x] Add single-file upload, conversion preview, schema metrics, and download controls
- [x] Add Vitest coverage for renamed fields, final order, formatted dates, and exported workbook structure
- [x] Run build/tests and verify the responsive converter interface
- [x] Save and deliver the updated project checkpoint

## Addition Convert Facility by Facility

- [x] Add server-side Entity Name cleaning, per-facility counts, and grand total generation
- [x] Create Summary, All Data, and one sanitized unique worksheet per facility
- [x] Handle invalid, duplicate, and overlength facility sheet names safely
- [x] Add file upload, facility summary preview, metrics, and download controls
- [x] Add Vitest coverage for summary counts, facility tabs, and exported workbook structure
- [x] Run build/tests and verify the responsive interface
- [x] Save and deliver the updated project checkpoint

## Multi-page Tool Navigation Redesign

- [x] Define a navigable dashboard home that explains each available Excel workflow
- [x] Add a persistent desktop sidebar and mobile navigation drawer for all tools
- [x] Create a dedicated route and workspace for workbook consolidation
- [x] Create a dedicated route and workspace for Deletion Summary List
- [x] Create a dedicated route and workspace for duplicate separation
- [x] Create a dedicated route and workspace for multi-sheet entity summary
- [x] Create a dedicated route and workspace for Addition Original and Exit Data Match
- [x] Create a dedicated route and workspace for Deletion Check with Onboard
- [x] Create a dedicated route and workspace for upload-ready conversion
- [x] Create a dedicated route and workspace for facility-by-facility conversion
- [x] Verify tool routes, menu navigation, and responsive layouts
- [x] Save and deliver the updated project checkpoint

## Home and Sidebar Visibility Refinement

- [x] Remove the workflow card catalogue from the home screen
- [x] Keep the home screen as a concise welcome and navigation prompt
- [x] Increase sidebar background opacity, contrast, border definition, and active-state clarity
- [x] Verify the refined sidebar remains visible at desktop and mobile breakpoints
- [x] Save and deliver the updated project checkpoint

## Excel Upload Privacy Audit

- [x] Inspect database schema, storage helpers, and processors for uploaded workbook persistence
- [x] Confirm or enforce transient in-memory processing with temporary-file cleanup
- [x] Document the exact upload-to-download data flow and retention behavior for the user
- [x] Add a user-facing privacy and data-flow explanation inside the application
- [x] Add a concise in-workflow privacy reassurance beside file upload controls
- [x] Add a shared privacy reassurance directly beside workflow upload controls

## Metadata-only Process Dashboard

- [x] Create a process-history schema that excludes Excel file bytes, file contents, preview rows, and workbook output data
- [x] Add server operations to save and list per-user completed process metadata
- [x] Record function name, completed status, source file name(s), safe count totals, output filename, and completion time only
- [x] Add a dashboard overview showing completed processes, per-tool totals, and recent activity
- [x] Explain on the dashboard that files and spreadsheet contents are not retained
- [x] Add Vitest coverage confirming sensitive workbook payloads cannot be stored in the process-history record
- [x] Verify the new dashboard on desktop and mobile without regressing workflow pages
- [x] Add a per-tool completed-process totals breakdown to the dashboard
- [x] Verify the process dashboard on mobile and a workflow route after history integration
- [x] Save and deliver the updated project checkpoint

## Clear Process History

- [x] Add a private server operation that deletes only the signed-in user's process-history metadata
- [x] Add a dashboard Clear History control with destructive-action confirmation
- [x] Explain that deletion applies only to saved metadata, not temporary files or downloaded workbooks
- [x] Add Vitest coverage for per-user history deletion scope
- [x] Verify the clear-history dashboard flow and deliver the update
- [x] Add a unit test that inspects the authenticated user-specific delete scope used for process-history deletion
- [x] Verify the confirmation dialog and post-deletion empty-state refresh flow
- [x] Verify the Clear History success behavior by code review under current authentication constraints
- [x] Perform an authenticated dashboard interaction to verify enabled control, confirmation, success toast, and refreshed empty state

## Remaining Workflow Contract Validation

- [x] Add dedicated Deletion Check with Onboard contract coverage for NRC matches, enrichment, outputs, and workbook tabs
- [x] Add dedicated Ready File to Upload contract coverage for schema conversion, DOB display, ordering, and workbook output
- [x] Add facility sheet-name collision and overlength safety coverage
- [x] Add facility conversion contract coverage for summary totals, source retention, and generated tabs

## Secure User Profile

- [x] Define the editable profile fields and ensure each record is owned by the authenticated user
- [x] Add encrypted-at-rest storage for user-entered profile information without altering OAuth identity fields
- [x] Add protected profile read and update operations with validation and user-scope enforcement
- [x] Add a dashboard profile panel where signed-in users can view and edit their profile information
- [x] Add tests for encryption, validation, and cross-user profile isolation
- [x] Verify the authenticated profile update flow in the browser and save a checkpoint
- [x] Add an authenticated profile-load error state with a retry action
- [x] Verify saving non-empty profile values and displaying those encrypted persisted values after a dashboard refresh

## Account Management

- [x] Define the profile-data export boundary and ensure every operation is scoped to the authenticated user
- [x] Add protected profile export and profile deletion operations with encrypted-data handling
- [x] Add an Account Management route with an export control and confirmed profile-data deletion control
- [x] Add tests for export content, unauthenticated protection, and user-scoped profile deletion
- [x] Verify authenticated export and confirmed profile deletion flows in the browser and save a checkpoint
- [x] Add export-payload contract coverage confirming authenticated identity/profile output excludes unrelated application data
- [x] Save the completed Account Management feature checkpoint

## Combined Account Data Export

- [x] Define the process-history metadata included in the account export and preserve the no-workbook-data privacy boundary
- [x] Extend the protected export operation to include only the authenticated user’s process-history metadata
- [x] Add contract coverage for combined export shape, user scoping, and exclusion of workbook payloads
- [x] Update the Account Management export copy and verify authenticated combined JSON export in the browser
- [x] Add combined-export test coverage that proves only the authenticated user’s process-history metadata is included
- [x] Capture authenticated combined-export completion evidence and inspect the downloaded JSON structure
- [x] Save and deliver the updated project checkpoint

## Date-Filtered Export and On-Use Retention

- [x] Add a user-owned retention preference for process-history metadata with allowed periods and an unlimited option
- [x] Add authenticated on-use cleanup that removes only the current user’s expired process-history metadata before history views and exports
- [x] Add start-date and end-date filtering to the authenticated account-data export
- [x] Add contract tests for retention scope, date ranges, unlimited retention, and workbook-data exclusion
- [x] Add Account Management date controls and retention setting guidance
- [x] Verify authenticated date-filtered exports and retention cleanup, then save and deliver a checkpoint

## Retention and Date-Range Unit Tests

- [x] Review the current retention and account-export contract tests for missing boundary cases
- [x] Add unit tests for all retention periods, unlimited behavior, cutoff boundaries, and user-scoped cleanup
- [x] Add unit tests for open-ended and bounded export date ranges, invalid inputs, and metadata-only payloads
- [x] Run the expanded test suite and production build, then save and deliver a checkpoint

## Application Security Hardening

- [x] Audit current authentication, upload, database, server-header, and audit boundaries
- [x] Restrict workbook inputs to validated CSV and XLSX files with size and archive-safety limits
- [x] Add route-level rate limits and request-origin safeguards for sensitive mutations and upload processing
- [x] Add security headers and hardened production error handling
- [x] Add privacy-preserving, user-scoped security audit events without file or spreadsheet content
- [x] Add database-access safeguards and a dependency vulnerability-check script
- [x] Add unit tests for upload validation, rate controls, headers, audit scope, and audit privacy
- [x] Enforce production database connection safeguards that fail closed for insecure remote transport settings
- [x] Add automated validation coverage for database connection security requirements
- [x] Run dependency checks, the complete test suite, and production build; verify hardened browser behavior and save a checkpoint

## Technical Architecture Documentation

- [x] Document the frontend, backend, database, and workbook-processing technology stack
- [x] Create a deterministic architecture and secure data-flow diagram
- [x] Deliver the architecture explanation and diagram files

## Backend Upload-to-Output Processing Guide

- [x] Document the exact step-by-step backend flow from authenticated upload through output download
- [x] Explain where workbook analysis executes and which data is transient versus stored
- [x] Create and deliver a focused backend processing flow diagram

## In-App Privacy Diagram

- [x] Upload the verified backend-processing diagram as a managed web asset
- [x] Add the processing diagram and accessible explanation to the in-app privacy section
- [x] Verify the privacy diagram on desktop and mobile, then save a checkpoint

## End-User Journey Guide

- [x] Document the step-by-step user journey from choosing a workflow to downloading the result
- [x] Create a simple user-facing journey diagram with plain-language privacy reassurance
- [x] Deliver the end-user guide and diagram files

## Hosting and Backend Service Review

- [x] Document the current managed backend, database, and workbook-processing hosting model
- [x] Compare the current model with Vercel and Supabase for this application
- [x] Deliver a clear hosting recommendation and migration considerations

## Vercel and Supabase Migration

- [x] Inspect available Vercel and Supabase connections and confirm the target project/account strategy
- [x] Define a migration-safe architecture that preserves in-memory-only workbook processing
- [x] Provision or connect Vercel and Supabase without disrupting the existing managed deployment
- [x] Migrate or adapt database, authentication, and Python processing components for the target architecture
- [x] Validate the target integration and provide the remaining external deployment steps

### Confirmed Targets

- [x] Inspect and document the selected Supabase project `lltzfiewqyhdbfvjqxon` before schema changes
- [x] Create a new Vercel project and external preview deployment for the Excel Master File Tool
- [x] Preserve the existing managed deployment as the rollback environment during migration

### Confirmed Split Architecture

- [x] Keep workbook processing on the existing managed Python/pandas backend with no workbook persistence
- [x] Connect the Vercel frontend to Supabase authentication and protected metadata storage
- [x] Establish secure cross-service API access from the Vercel frontend to the processing backend

### External Foundation Progress

- [x] Inspect the selected empty Supabase project and apply the privacy-preserving metadata schema with RLS
- [x] Resolve Supabase security-advisor findings for the new-user trigger function
- [x] Create the Vercel project `excel-master-file-tool` with a non-production external preview
- [x] Obtain the Supabase server credential required for managed-backend metadata writes and JWT verification
- [x] Add Supabase Auth/Postgres integration under the split architecture while retaining the Manus OAuth/MySQL path for managed rollback

### Vercel Git Connection

- [x] Inspect the linked `MinNyo23/Excel-Data-Analysis-Tools` repository and compare it with the current managed-project source
- [x] Confirm a non-destructive source synchronization approach before pushing current application changes to the linked repository
- [x] Configure Vercel build settings and environment variables after the linked repository contains the current frontend
- [x] Synchronize the current managed-project source to `MinNyo23/Excel-Data-Analysis-Tools` and deploy the completed Vercel frontend
- [x] Add the Vercel production and preview URLs to the Supabase Auth redirect allowlist and complete one email-link sign-in test

## Dedicated Profile and Account Settings Page

- [x] Review existing encrypted profile, account-export, and metadata-history features for reuse
- [x] Add a dedicated signed-in profile page with editable encrypted account settings
- [x] Add a user-scoped processing-history view that exposes metadata only and no workbook data
- [x] Add profile-page navigation and protected unauthenticated states
- [x] Add automated coverage and responsive verification for the dedicated profile and history experience
- [x] Synchronize the dedicated profile page changes to the Vercel-linked repository and verify the deployed route

## End-to-End Security and API Review

- [x] Inventory browser, API, authentication, metadata, and workbook-processing trust boundaries
- [x] Review protected procedures, external API authentication, origins, rate limits, headers, and error handling
- [x] Verify the no-persistent-workbook-data boundary and server-only secret exposure controls
- [x] Check dependency vulnerabilities, production HTTP headers, and API responses for unintended disclosure
- [x] Apply and test any proportionate security improvements identified by the review
- [x] Run the complete validation suite, document the final security posture, and synchronize verified changes to Vercel

## Friendly Error Handling and Rate-Limit Countdown

- [x] Review how API and workflow errors are currently surfaced to users
- [x] Add a reusable user-friendly error translator for API, upload, authentication, and rate-limit failures
- [x] Display a visible countdown and disable retrying workflow actions while a rate-limit retry window is active
- [x] Add automated coverage and responsive verification for the user-facing error and countdown states
- [x] Run full validation, synchronize the release to Vercel, and save the completed checkpoint

## Footer Developer Credit and Terms

- [x] Review the existing footer placement and application routes
- [x] Add a responsive developer credit and Terms & Conditions link to the footer
- [x] Add an accessible Terms & Conditions page that explains service, privacy, and acceptable-use boundaries
- [x] Add automated coverage, verify desktop and mobile layouts, synchronize to Vercel, and save the completed checkpoint

## Footer Visual Refinement

- [x] Review the shared footer’s current background and link styles
- [x] Add a subtle professional footer background plus smooth hover and keyboard-focus effects
- [x] Verify the refined footer on desktop and mobile, synchronize to Vercel, and save the completed checkpoint

## Sidebar Navigation Interaction Refinement

- [x] Review current sidebar navigation classes and interaction states
- [x] Add smooth hover, keyboard-focus, active-press, and reduced-motion behavior to sidebar links
- [x] Verify desktop and mobile navigation, synchronize to Vercel, and save the completed checkpoint

## Route Transition Refinement

- [x] Review active-route rendering and current animation patterns
- [x] Add a shared smooth route-transition wrapper with reduced-motion support
- [x] Add automated coverage, verify routes on desktop and mobile, synchronize to Vercel, and save the completed checkpoint

## Tool Overview Journey-Flow Diagram Update

- [x] Review the existing Tool Overview privacy diagram and its explanatory reference text
- [x] Replace the existing image with the user-provided end-user journey flow and update its accessible text and reference copy
- [x] Add coverage, verify desktop and mobile layouts, synchronize to Vercel, and save the completed checkpoint
