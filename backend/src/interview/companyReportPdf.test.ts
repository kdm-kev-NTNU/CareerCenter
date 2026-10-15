import { describe, expect, it } from "vitest";
import type { CompanyReport } from "@careercenter/shared";
import { renderCompanyReportPdf, sanitizeReportFilename } from "./companyReportPdf.js";

function fillWords(maxChars: number): string {
  const word = "ord ";
  return word.repeat(Math.ceil(maxChars / word.length)).slice(0, maxChars).trimEnd();
}

function maxReport(): CompanyReport {
  return {
    headline: fillWords(120),
    keyFacts: {
      industry: fillWords(80),
      headquarters: fillWords(80),
      size: fillWords(80),
      ownership: fillWords(80)
    },
    aboutCompany: fillWords(320),
    businessAreas: Array.from({ length: 4 }, () => fillWords(140)),
    strategyAndNews: Array.from({ length: 3 }, () => fillWords(160)),
    cultureAndValues: Array.from({ length: 3 }, () => fillWords(140)),
    roleInContext: fillWords(240),
    jobAdRequirements: Array.from({ length: 4 }, () => ({
      requirement: fillWords(120),
      howToShowFit: fillWords(140)
    })),
    nicheInsights: Array.from({ length: 4 }, () => fillWords(160)),
    companyQuestionPrep: Array.from({ length: 4 }, () => ({
      question: fillWords(140),
      answerAngle: fillWords(200),
      nicheHooks: [fillWords(90), fillWords(90)]
    })),
    interviewAngles: Array.from({ length: 3 }, () => fillWords(140)),
    questionsToAsk: Array.from({ length: 3 }, () => fillWords(140)),
    sources: Array.from({ length: 4 }, () => fillWords(140))
  };
}

function countPdfPages(buffer: Buffer): number {
  const text = buffer.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page(?![a-zA-Z])/g);
  return matches?.length ?? 0;
}

describe("renderCompanyReportPdf", () => {
  it("returns a PDF buffer", async () => {
    const pdf = await renderCompanyReportPdf(
      {
        headline: "DNB – kort oversikt",
        keyFacts: { industry: "Bank", headquarters: "Oslo" },
        aboutCompany: "DNB er Norges største bank.",
        businessAreas: ["Privatkundebank", "Markets"],
        strategyAndNews: ["Satser på AI"],
        cultureAndValues: ["Integritet"],
        roleInContext: "Associate i Markets.",
        jobAdRequirements: [
          { requirement: "Analytisk", howToShowFit: "Vis STAR-historie om modellering." }
        ],
        nicheInsights: ["Sterk posisjon i nordisk verdipapirhandel"],
        companyQuestionPrep: [
          {
            question: "Hvorfor DNB?",
            answerAngle: "Koble egen markets-erfaring til DNBs nordiske franchise.",
            nicheHooks: ["nordisk verdipapirhandel"]
          }
        ],
        interviewAngles: ["Kundeinnsikt"],
        questionsToAsk: ["Hvordan måles suksess i rollen?"],
        sources: ["dnb.no"]
      },
      { companyName: "DNB", roleTitle: "Associate", generatedAt: "2026-04-01T12:00:00.000Z" }
    );
    expect(pdf.subarray(0, 4).toString("utf8")).toBe("%PDF");
    expect(countPdfPages(pdf)).toBeGreaterThanOrEqual(1);
  });

  it("handles Norwegian characters without throwing", async () => {
    const pdf = await renderCompanyReportPdf(
      {
        headline: "ÆØÅ – bedriftsrapport",
        keyFacts: { industry: "Olje og gass", headquarters: "Bergen" },
        aboutCompany: "Selskapet vokser på vestlandet med bærekraft.",
        businessAreas: ["Produksjon", "Handel"],
        strategyAndNews: ["Ny plattform i Nordsjøen"],
        cultureAndValues: ["Sikkerhet først"],
        roleInContext: "Rådgiver for energihandel.",
        jobAdRequirements: [{ requirement: "Norsk muntlig", howToShowFit: "Øv på case på norsk." }],
        nicheInsights: ["Ny plattform i Nordsjøen"],
        companyQuestionPrep: [
          {
            question: "Hvorfor Equinor?",
            answerAngle: "Koble energiinteresse til konkret prosjekt.",
            nicheHooks: ["Nordsjøen"]
          }
        ],
        interviewAngles: ["Markedskunnskap"],
        questionsToAsk: ["Hvordan jobber teamet med ærlige feil?"],
        sources: ["equinor.no"]
      },
      { companyName: "Equinor", roleTitle: "Rådgiver", generatedAt: new Date().toISOString() }
    );
    expect(pdf.subarray(0, 4).toString("utf8")).toBe("%PDF");
  });

  it("fits a max-length report on at most 2 pages", async () => {
    const pdf = await renderCompanyReportPdf(maxReport(), {
      companyName: "MaxCorp",
      roleTitle: "Consultant",
      generatedAt: "2026-04-01T12:00:00.000Z"
    });
    expect(countPdfPages(pdf)).toBeLessThanOrEqual(2);
  });
});

describe("sanitizeReportFilename", () => {
  it("sanitizes company names for Content-Disposition", () => {
    expect(sanitizeReportFilename("DNB ASA")).toBe("dnb-asa-bedriftsrapport.pdf");
    expect(sanitizeReportFilename("A/B:C*")).toMatch(/bedriftsrapport\.pdf$/);
  });
});
