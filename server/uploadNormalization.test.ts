import { describe, expect, it } from "vitest";
import { normalizeUploadedFiles } from "./uploadNormalization";

describe("secure CSV upload normalization", () => {
  it("converts CSV input in memory to an XLSX payload for existing workflow workers", async () => {
    const normalized = await normalizeUploadedFiles([
      { name: "employees.csv", data: Buffer.from("Employee Full Name,NRC No\nAung A,12/ABC(N)123456\n").toString("base64") },
    ]);
    expect(normalized).toHaveLength(1);
    expect(normalized[0]?.name).toBe("employees.xlsx");
    expect(Buffer.from(normalized[0]?.data ?? "", "base64").subarray(0, 4).toString("hex")).toBe("504b0304");
  });
});
