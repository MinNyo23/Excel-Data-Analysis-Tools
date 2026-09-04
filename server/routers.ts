import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies.js";
import { systemRouter } from "./_core/systemRouter.js";
import { protectedProcedure, publicProcedure, router, sensitiveProcedure, uploadProcedure } from "./_core/trpc.js";
import { z } from "zod";
import { processDeletionSummary } from "./deletionSummaryProcessor.js";
import { processDeletionDuplicates } from "./deletionDuplicatesProcessor.js";
import { processDeletionWithSummary } from "./deletionWithSummaryProcessor.js";
import { processAdditionExitMatch } from "./additionExitMatchProcessor.js";
import { processDeletionOnboardMatch } from "./deletionOnboardMatchProcessor.js";
import { processReadyUpload } from "./readyUploadProcessor.js";
import { processFacilityConversion } from "./facilityConversionProcessor.js";
import { processFileComparison } from "./fileComparisonProcessor.js";
import { processExcelFiles } from "./excelProcessor.js";
import { inspectWorkbookColumns } from "./workbookColumnInspector.js";
import { applyProcessHistoryRetention, clearProcessHistory, createProcessHistory, createSecurityAuditEvent, deleteUserProfile, getProcessHistoryRetention, getUserProfile, listProcessHistory, listProcessHistoryForExport, listSecurityAuditEventsForUser, RETENTION_DAYS_OPTIONS, saveProcessHistoryRetention, saveUserProfile, type ProcessHistoryDateRange, type RetentionDays } from "./db.js";
import { MAX_UPLOAD_FILES, validateUploadedWorkbook, validateUploadedWorkbookBatch } from "./security.js";
import { normalizeUploadedFiles } from "./uploadNormalization.js";
import { metadataStore, type MetadataUserId } from "./metadataStore.js";
import { sanitizeGeneratedWorkbookOutput } from "./workbookOutputSecurity.js";
import { getAllowedEmailDomain, listManagedUsers, listUserActionHistory, moderateUser, updateAllowedEmailDomain } from "./admin.js";
import { supabaseGetAllowedEmailDomain } from "./supabaseIntegration.js";


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
export const retentionDaysSchema = z.union([z.literal(0.5), z.literal(1), z.literal(5), z.literal(7), z.literal(30), z.literal(90), z.literal(180), z.literal(365), z.null()]);
const optionalColumnName = z.string().trim().max(120).optional();
export const pairedColumnMappingSchema = z.object({
  originalPhone: optionalColumnName,
  originalNrc: optionalColumnName,
  originalCorporateName: optionalColumnName,
  secondPhone: optionalColumnName,
  secondNrc: optionalColumnName,
}).strict().optional();
export const fileComparisonConfigSchema = z.object({
  file1Column1: z.string().trim().min(1).max(120),
  file2Column1: z.string().trim().min(1).max(120),
  enableSecondCondition: z.boolean(),
  file1Column2: optionalColumnName,
  file2Column2: optionalColumnName,
  operation: z.enum(["exists_in_file2", "find_duplicates", "missing_in_file2"]),
}).strict().superRefine((input, ctx) => {
  if (input.enableSecondCondition && (!input.file1Column2 || !input.file2Column2)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Both second-condition columns must be selected." });
  }
});

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
  admin: router({
    users: protectedProcedure.query(({ ctx }) => listManagedUsers(ctx.user)),
    actionHistory: protectedProcedure.query(({ ctx }) => listUserActionHistory(ctx.user)),
    emailPolicy: protectedProcedure.query(({ ctx }) => getAllowedEmailDomain(ctx.user)),
    updateEmailPolicy: protectedProcedure.input(z.object({ domain: z.string().trim().min(1).max(253) })).mutation(({ ctx, input }) => updateAllowedEmailDomain(ctx.user, input.domain)),
    moderate: protectedProcedure.input(z.object({ userId: z.string().min(1).max(64), action: z.enum(["ban", "unban", "delete"]) })).mutation(({ ctx, input }) => moderateUser(ctx.user, input.userId, input.action)),
  }),
  auth: router({
    emailPolicy: publicProcedure.query(() => supabaseGetAllowedEmailDomain()),
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: protectedProcedure.mutation(async ({ ctx }) => {
      let cleanup = { clearedProcessHistory: 0 };
      try {
        cleanup = await clearProcessingDataOnLogout(ctx.user.id);
      } catch (error) {
        // Logout must remain successful even if history cleanup is unavailable.
        // The session cookie is cleared below so the user can always leave the workspace.
        console.warn("[Auth] Logout cleanup was not completed.", error instanceof Error ? error.message : "unknown error");
      } finally {
        // Session termination must not depend on the metadata cleanup outcome.
        if (ctx.user.authProvider !== "supabase") {
          const cookieOptions = getSessionCookieOptions(ctx.req);
          (ctx.res as typeof ctx.res & { clearCookie: (name: string, options?: Record<string, unknown>) => void }).clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
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
  fileComparison: router({
    process: uploadProcedure.input(z.object({
      file1: uploadedFile,
      file2: uploadedFile,
      config: fileComparisonConfigSchema,
    }).superRefine((input, ctx) => {
      const error = validateUploadedWorkbookBatch([input.file1, input.file2]);
      if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
    })).mutation(async ({ input }) => {
      const [file1, file2] = await normalizeUploadedFiles([input.file1, input.file2]);
      return sanitizeGeneratedWorkbookOutput(await processFileComparison(file1!, file2!, input.config));
    }),
  }),
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
