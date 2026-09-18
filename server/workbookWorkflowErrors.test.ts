import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { toWorkbookWorkflowError } from "./workbookWorkflowErrors";

describe("workbook workflow errors", () => {
  it("maps missing column failures to BAD_REQUEST", () => {
    try {
      toWorkbookWorkflowError(new Error('The selected File 1 column 1 column was not found: "NRC". Re-upload the file or choose a different column.'));
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("BAD_REQUEST");
      expect((error as TRPCError).message).toMatch(/column was not found/i);
      return;
    }
    throw new Error("Expected toWorkbookWorkflowError to throw");
  });

  it("maps oversized generated workbooks to PAYLOAD_TOO_LARGE", () => {
    try {
      toWorkbookWorkflowError(new Error("Generated workbook exceeds the safe download limit."));
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("PAYLOAD_TOO_LARGE");
      expect((error as TRPCError).message).toMatch(/comparison output is too large/i);
      return;
    }
    throw new Error("Expected toWorkbookWorkflowError to throw");
  });
});
