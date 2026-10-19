import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { renderPracticeDocx, sanitizePracticeFilename } from "./practiceDocx.js";

function readDocumentXml(buffer: Buffer): string {
  const files = unzipSync(new Uint8Array(buffer));
  const entry = files["word/document.xml"];
  if (!entry) throw new Error("word/document.xml missing");
  return strFromU8(entry);
}

describe("renderPracticeDocx", () => {
  it("produces a docx with questions, example answers, tips and blank answer lines", async () => {
    const buffer = await renderPracticeDocx({
      companyName: "DNB",
      roleTitle: "Consultant",
      questions: [
        {
          text: "Fortell om en gang du ledet et prosjekt",
          category: "behavioral",
          audience: "candidate",
          sortOrder: 0,
          included: true,
          exampleAnswer: "Situation: … Task: … Action: … Result: …",
          tips: ["Bruk tall", "Hold under 90 sekunder"]
        },
        {
          text: "Utelatt spørsmål",
          category: "behavioral",
          audience: "candidate",
          sortOrder: 1,
          included: false,
          exampleAnswer: "Skal ikke med",
          tips: []
        },
        {
          text: "Hvordan er kulturen på teamet?",
          category: "company",
          audience: "ask_interviewer_company",
          sortOrder: 2,
          included: true,
          exampleAnswer: "",
          tips: ["Still etter at du har hørt om teamet"]
        }
      ]
    });

    expect(buffer.subarray(0, 2).toString("utf8")).toBe("PK");
    const xml = readDocumentXml(buffer);
    expect(xml).toContain("Øvingsdokument");
    expect(xml).toContain("DNB");
    expect(xml).toContain("Consultant");
    expect(xml).toContain("Fortell om en gang du ledet et prosjekt");
    expect(xml).toContain("Eksempelsvar");
    expect(xml).toContain("Situation:");
    expect(xml).toContain("Tips");
    expect(xml).toContain("Bruk tall");
    expect(xml).toContain("Ditt svar");
    expect(xml).toContain("Spørsmål du stiller dem");
    expect(xml).toContain("Hvordan er kulturen på teamet?");
    expect(xml).toContain("Still etter at du har hørt om teamet");
    expect(xml).not.toContain("Utelatt spørsmål");
    expect(xml).not.toContain("Skal ikke med");
  });

  it("sanitizes filenames", () => {
    expect(sanitizePracticeFilename("DNB ASA / Markets")).toMatch(/\.docx$/);
    expect(sanitizePracticeFilename("!!!")).toBe("ovingsdokument-oving.docx");
  });
});
