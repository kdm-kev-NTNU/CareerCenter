import { describe, expect, it } from "vitest";
import {
  aonSourcePdfIds,
  aonSourcePdfs,
  getAonSourcePdf,
  isAonSourcePdfId
} from "./aonSourcePdfs.js";

describe("aonSourcePdfs", () => {
  it("exposes exactly three catalog entries with safe filenames", () => {
    expect(aonSourcePdfs).toHaveLength(3);
    expect(aonSourcePdfIds).toEqual([
      "switch_challenge",
      "scales_clx",
      "scales_numerical"
    ]);
    for (const pdf of aonSourcePdfs) {
      expect(pdf.filename).not.toMatch(/\.\.|[/\\]/);
      expect(pdf.filename.endsWith(".pdf")).toBe(true);
    }
  });

  it("resolves known ids and rejects unknown ones", () => {
    expect(getAonSourcePdf("scales_clx")?.filename).toBe(
      "practice-tasks---inductive-logical-reasoning-scales-clx.pdf"
    );
    expect(getAonSourcePdf("verbal")).toBeUndefined();
    expect(isAonSourcePdfId("switch_challenge")).toBe(true);
    expect(isAonSourcePdfId("../x")).toBe(false);
  });
});
