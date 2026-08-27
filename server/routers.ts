import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router, sensitiveProcedure, uploadProcedure } from "./_core/trpc";
import { z } from "zod";
import { processDeletionSummary } from "./deletionSummaryProcessor";
import { processDeletionDuplicates } from "./deletionDuplicatesProcessor";
import { processDeletionWithSummary } from "./deletionWithSummaryProcessor";
import { processAdditionExitMatch } from "./additionExitMatchProcessor";
import { processDeletionOnboardMatch } from "./deletionOnboardMatchProcessor";
import { processReadyUpload } from "./readyUploadProcessor";
import { processFacilityConversion } from "./facilityConversionProcessor";
import { processExcelFiles } from "./excelProcessor";
import { inspectWorkbookColumns } from "./workbookColumnInspector";
import { applyProcessHistoryRetention, clearProcessHistory, createProcessHistory, createSecurityAuditEvent, deleteUserProfile, getProcessHistoryRetention, getUserProfile, listProcessHistory, listProcessHistoryForExport, listSecurityAuditEventsForUser, RETENTION_DAYS_OPTIONS, saveProcessHistoryRetention, saveUserProfile, type ProcessHistoryDateRange, type RetentionDays } from "./db";
import { MAX_UPLOAD_FILES, validateUploadedWorkbook, validateUploadedWorkbookBatch } from "./security";
import { normalizeUploadedFiles } from "./uploadNormalization";
import { metadataStore, type MetadataUserId } from "./metadataStore";
import { sanitizeGeneratedWorkbookOutput } from "./workbookOutputSecurity";

export const uploadedFile = z.object({
  name: z.string().min(1).max(255),
  data: z.string().min(4),
}).superRefine((file, ctx) => {
  const error = validateUploadedWorkbook(file);
  if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
});

function uploadedFiles(min: number, max = MAX_UPLOAD_FILES) {
  return z.array(uploadedFile).min(min).max(max).superRefine((files, ctx) => {
    const error = validateUploadedWorkbookBatch(files);
    if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
  });
}
export const processHistoryInputSchema = z.object({
  toolKey: z.string().min(1).max(64),
  toolName: z.string().min(1).max(128),
  inputFileNames: z.array(z.string().min(1).max(255)).min(1).max(50),
  outputFilename: z.string().min(1).max(255),
  totalRecords: z.number().int().min(0).max(10_000_000),
}).strict();
export const editableUserProfileSchema = z.object({
  displayName: z.string().trim().max(120),
  phoneNumber: z.string().trim().max(40),
  organization: z.string().trim().max(160),
  jobTitle: z.string().trim().max(120),
}).strict();
function isCalendarDate(value: string) {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!matched) return false;
  const [year, month, day] = matched.slice(1).map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}
const dateInputSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isCalendarDate, { message: "Use a valid calendar date." });
export const accountExportInputSchema = z.object({
  startDate: dateInputSchema.optional(),
  endDate: dateInputSchema.optional(),
}).strict().refine(input => !input.startDate || !input.endDate || input.startDate <= input.endDate, { message: "Start date must be on or before end date." });
export const retentionDaysSchema = z.union([z.literal(7), z.literal(30), z.literal(90), z.literal(180), z.literal(365), z.null()]);
const optionalColumnName = z.string().trim().max(120).optional();
export const pairedColumnMappingSchema = z.object({
  originalPhone: optionalColumnName,
  originalNrc: optionalColumnName,
  originalCorporateName: optionalColumnName,
  secondPhone: optionalColumnName,
  secondNrc: optionalColumnName,
}).strict().optional();

export function exportDateRange(input: z.infer<typeof accountExportInputSchema>): ProcessHistoryDateRange {
  return {
    startDate: input.startDate ? new Date(`${input.startDate}T00:00:00.000Z`) : undefined,
    endDate: input.endDate ? new Date(`${input.endDate}T23:59:59.999Z`) : undefined,
  };
}

type ExportHistoryRecord = { toolKey: string; toolName: string; status: string; inputFileNames: string; outputFilename: string; totalRecords: number; completedAt: Date | string };

function exportedFileNames(value: string) {
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; }
}

export function createProfileExport(identity: { name: string; email: string }, profile: { displayName: string; phoneNumber: string; organization: string; jobTitle: string } | null, processHistory: ExportHistoryRecord[]) {
  return {
    exportedAt: new Date().toISOString(),
    identity,
    profile,
    processHistory: processHistory.map(record => ({
      toolKey: record.toolKey,
      toolName: record.toolName,
      status: record.status,
      inputFileNames: exportedFileNames(record.inputFileNames),
      outputFilename: record.outputFilename,
      totalRecords: record.totalRecords,
      completedAt: new Date(record.completedAt).toISOString(),
    })),
  };
}

type AuthenticatedExportDependencies = {
  loadProfile?: (userId: MetadataUserId) => Promise<{ displayName: string; phoneNumber: string; organization: string; jobTitle: string } | null>;
  loadProcessHistory?: (userId: MetadataUserId, range: ProcessHistoryDateRange) => Promise<ExportHistoryRecord[]>;
  applyRetention?: (userId: MetadataUserId) => Promise<unknown>;
};

export async function createAuthenticatedProfileExport(
  user: { id: MetadataUserId; name?: string | null; email?: string | null },
  range: ProcessHistoryDateRange = {},
  dependencies: AuthenticatedExportDependencies = {},
) {
  const loadProfile = dependencies.loadProfile ?? metadataStore.getProfile;
  const loadProcessHistory = dependencies.loadProcessHistory ?? metadataStore.listProcessHistoryForExport;
  const applyRetention = dependencies.applyRetention ?? metadataStore.applyRetention;
  await applyRetention(user.id);
  const [profile, processHistory] = await Promise.all([loadProfile(user.id), loadProcessHistory(user.id, range)]);
  return createProfileExport({ name: user.name ?? "", email: user.email ?? "" }, profile, processHistory);
}

async function auditSecurityEvent(userId: MetadataUserId, eventType: string, metadata?: Record<string, string | number | boolean | null | undefined>) {
  try { await metadataStore.createAuditEvent(userId, eventType, metadata); } catch { console.warn("[SecurityAudit] Event was not recorded."); }
}

export async function clearProcessingDataOnLogout(
  userId: MetadataUserId,
  dependencies: { clearHistory?: (id: MetadataUserId) => Promise<{ deletedCount: number }>; audit?: (id: MetadataUserId, eventType: string, metadata?: Record<string, string | number | boolean | null | undefined>) => Promise<void> } = {},
) {
  const clearHistory = dependencies.clearHistory ?? metadataStore.clearProcessHistory;
  const audit = dependencies.audit ?? auditSecurityEvent;
  const result = await clearHistory(userId);
  await audit(userId, "session_logout", { clearedProcessRecords: result.deletedCount });
  return { clearedProcessHistory: result.deletedCount } as const;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: protectedProcedure.mutation(async ({ ctx }) => {
      let cleanup: { clearedProcessHistory: number };
      try {
        cleanup = await clearProcessingDataOnLogout(ctx.user.id);
      } finally {
        // Session termination must not depend on the metadata cleanup outcome.
        if (ctx.user.authProvider !== "supabase") {
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
        }
      }
      return { success: true, ...cleanup } as const;
    }),
  }),
  excel: router({
    process: uploadProcedure
      .input(z.object({ files: uploadedFiles(1) }))
      .mutation(async ({ input }) => sanitizeGeneratedWorkbookOutput(await processExcelFiles(await normalizeUploadedFiles(input.files)))),
  }),
  workbookColumns: router({
    inspect: uploadProcedure.input(z.object({ file: uploadedFile }).strict()).mutation(async ({ input }) => inspectWorkbookColumns((await normalizeUploadedFiles([input.file]))[0]!)),
  }),
  deletionSummary: router({
    process: uploadProcedure
      .input(z.object({ file: uploadedFile }))
      .mutation(async ({ input }) => sanitizeGeneratedWorkbookOutput(await processDeletionSummary((await normalizeUploadedFiles([input.file]))[0]!))),
  }),
  deletionDuplicates: router({
    process: uploadProcedure
      .input(z.object({ file: uploadedFile }))
      .mutation(async ({ input }) => sanitizeGeneratedWorkbookOutput(await processDeletionDuplicates((await normalizeUploadedFiles([input.file]))[0]!))),
  }),
  deletionWithSummary: router({
    process: uploadProcedure
      .input(z.object({ file: uploadedFile }))
      .mutation(async ({ input }) => sanitizeGeneratedWorkbookOutput(await processDeletionWithSummary((await normalizeUploadedFiles([input.file]))[0]!))),
  }),
  additionExitMatch: router({
    process: uploadProcedure.input(z.object({ original: uploadedFile, exit: uploadedFile, mapping: pairedColumnMappingSchema }).superRefine((input, ctx) => { const error = validateUploadedWorkbookBatch([input.original, input.exit]); if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error }); })).mutation(async ({ input }) => { const [original, exit] = await normalizeUploadedFiles([input.original, input.exit]); return sanitizeGeneratedWorkbookOutput(await processAdditionExitMatch(original!, exit!, input.mapping)); }),
  }),
  deletionOnboardMatch: router({ process: uploadProcedure.input(z.object({ onboard: uploadedFile, deletion: uploadedFile, mapping: pairedColumnMappingSchema }).superRefine((input, ctx) => { const error = validateUploadedWorkbookBatch([input.onboard, input.deletion]); if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error }); })).mutation(async ({input}) => { const [onboard, deletion] = await normalizeUploadedFiles([input.onboard, input.deletion]); return sanitizeGeneratedWorkbookOutput(await processDeletionOnboardMatch(onboard!, deletion!, input.mapping)); }) }),
  readyUpload: router({ process: uploadProcedure.input(z.object({ file: uploadedFile })).mutation(async ({input}) => sanitizeGeneratedWorkbookOutput(await processReadyUpload((await normalizeUploadedFiles([input.file]))[0]!))) }),
  facilityConversion: router({ process: uploadProcedure.input(z.object({ file: uploadedFile })).mutation(async ({input}) => sanitizeGeneratedWorkbookOutput(await processFacilityConversion((await normalizeUploadedFiles([input.file]))[0]!))) }),
  processHistory: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      await metadataStore.applyRetention(ctx.user.id);
      return metadataStore.listProcessHistory(ctx.user.id);
    }),
    clear: sensitiveProcedure.mutation(async ({ ctx }) => {
      const result = await metadataStore.clearProcessHistory(ctx.user.id);
      await auditSecurityEvent(ctx.user.id, "history_cleared", { deletedCount: result.deletedCount });
      return result;
    }),
    record: sensitiveProcedure.input(processHistoryInputSchema).mutation(async ({ ctx, input }) => {
      await metadataStore.createProcessHistory({ userId: ctx.user.id, ...input, inputFileNames: JSON.stringify(input.inputFileNames) });
      await auditSecurityEvent(ctx.user.id, "workflow_completed", { workflow: input.toolKey, recordCount: input.totalRecords });
      return { success: true } as const;
    }),
    retention: router({
      get: protectedProcedure.query(async ({ ctx }) => ({ retentionDays: await metadataStore.getRetention(ctx.user.id), allowedDays: RETENTION_DAYS_OPTIONS })),
      update: sensitiveProcedure.input(z.object({ retentionDays: retentionDaysSchema }).strict()).mutation(async ({ ctx, input }) => {
        await metadataStore.saveRetention(ctx.user.id, input.retentionDays as RetentionDays);
        const cleanup = await metadataStore.applyRetention(ctx.user.id);
        await auditSecurityEvent(ctx.user.id, "retention_changed", { retentionDays: input.retentionDays ?? "unlimited", deletedCount: cleanup.deletedCount });
        return { ...cleanup, allowedDays: RETENTION_DAYS_OPTIONS };
      }),
    }),
  }),
  profile: router({
    me: protectedProcedure.query(async ({ ctx }) => ({
      identity: { name: ctx.user.name ?? "", email: ctx.user.email ?? "" },
      profile: await metadataStore.getProfile(ctx.user.id),
    })),
    update: sensitiveProcedure.input(editableUserProfileSchema).mutation(async ({ ctx, input }) => {
      await metadataStore.saveProfile(ctx.user.id, input);
      await auditSecurityEvent(ctx.user.id, "profile_updated");
      return { success: true } as const;
    }),
    export: protectedProcedure.input(accountExportInputSchema.optional()).query(async ({ ctx, input }) => {
      const result = await createAuthenticatedProfileExport(ctx.user, exportDateRange(input ?? {}));
      await auditSecurityEvent(ctx.user.id, "account_exported", { dateFiltered: Boolean(input?.startDate || input?.endDate), processRecordCount: result.processHistory.length });
      return result;
    }),
    delete: sensitiveProcedure.mutation(async ({ ctx }) => {
      const result = await metadataStore.deleteProfile(ctx.user.id);
      await auditSecurityEvent(ctx.user.id, "profile_deleted", { deletedCount: result.deletedCount });
      return result;
    }),
  }),
  securityAudit: router({
    list: protectedProcedure.query(async ({ ctx }) => metadataStore.listAuditEvents(ctx.user.id)),
  }),
});

export type AppRouter = typeof appRouter;
