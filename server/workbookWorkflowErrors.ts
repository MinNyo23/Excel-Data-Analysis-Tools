import { TRPCError } from "@trpc/server";
import { isSafeWorkbookWorkflowMessage } from "../shared/uploadLimits.js";

export function toWorkbookWorkflowError(error: unknown): never {
  if (error instanceof TRPCError) throw error;

  const message = error instanceof Error ? error.message.trim() : "";
  if (/safe download limit|Generated workbook exceeds/i.test(message)) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: "The comparison output is too large to download. Try smaller files, fewer columns, or a more selective comparison operation.",
    });
  }
  if (message && isSafeWorkbookWorkflowMessage(message)) {
    throw new TRPCError({ code: "BAD_REQUEST", message });
  }
  if (/does not contain|workbook is empty|could not be read/i.test(message)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: message || "The uploaded workbook could not be read. Check the file and try again.",
    });
  }

  console.error("[Workbook workflow]", message || error);
  throw error instanceof Error ? error : new Error("Request could not be completed.");
}
