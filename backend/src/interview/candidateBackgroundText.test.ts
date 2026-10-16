import { describe, expect, it } from "vitest";
import {
  formatCandidateBackgroundForPrompt,
  redactPersonalIds,
  sanitizeBackgroundDocumentText,
  trimTranscriptBoilerplate
} from "./candidateBackgroundText.js";

describe("redactPersonalIds", () => {
  it("removes spaced and unspaced 11-digit national IDs", () => {
    expect(redactPersonalIds("Navn: Mazali Fnr: 141004 78375")).toContain("[fjernet]");
    expect(redactPersonalIds("Navn: Mazali Fnr: 141004 78375")).not.toMatch(/141004/);
    expect(redactPersonalIds("id 14100478375 her")).toContain("[personnummer fjernet]");
    expect(redactPersonalIds("id 14100478375 her")).not.toMatch(/14100478375/);
  });

  it("keeps phone numbers and years", () => {
    const text = "Ring +47 96 96 01 93. Master 2026–2028.";
    expect(redactPersonalIds(text)).toBe(text);
  });
});

describe("trimTranscriptBoilerplate", () => {
  it("cuts from the grading-system heading", () => {
    const text = "Sum: 180,0\n\nStudiepoeng- og karaktersystem\nLang forklaring";
    expect(trimTranscriptBoilerplate(text)).toBe("Sum: 180,0");
  });
});

describe("sanitizeBackgroundDocumentText", () => {
  it("redacts IDs, trims transcript boilerplate, and caps length", () => {
    const raw = `Mazali Fnr: 141004 78375\nA på bachelor\n\nStudiepoeng- og karaktersystem\nMer`;
    const out = sanitizeBackgroundDocumentText(raw, { kind: "transcript" });
    expect(out).not.toMatch(/141004/);
    expect(out).not.toContain("Studiepoeng");
    expect(out).toContain("A på bachelor");
  });
});

describe("formatCandidateBackgroundForPrompt", () => {
  it("joins non-empty sections", () => {
    const text = formatCandidateBackgroundForPrompt({
      cvText: "CV her",
      transcriptText: "",
      notes: "Vil jobbe med KI"
    });
    expect(text).toContain("CV:\nCV her");
    expect(text).toContain("Tillegg fra kandidaten:\nVil jobbe med KI");
    expect(text).not.toContain("Karakterutskrift");
  });
});
