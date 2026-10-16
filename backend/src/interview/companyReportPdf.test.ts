import { describe, expect, it } from "vitest";
import type { CompanyReport } from "@careercenter/shared";
import { renderCompanyReportPdf, sanitizeReportFilename } from "./companyReportPdf.js";

function fillWords(maxChars: number): string {
  const word = "ord ";
  return word.repeat(Math.ceil(maxChars / word.length)).slice(0, maxChars).trimEnd();
}

function sampleQuestionPrep(count: number): CompanyReport["questionPrep"] {
  return Array.from({ length: count }, (_, i) => ({
    question: fillWords(40) + ` ${i}`,
    whyTheyAsk: fillWords(80),
    suggestedAnswer: fillWords(200),
    backgroundUsed: [fillWords(40)],
    companyHooks: [fillWords(40)]
  }));
}

function maxReport(): CompanyReport {
  return {
    headline: fillWords(120),
    mustKnow: Array.from({ length: 4 }, () => fillWords(160)),
    questionPrep: sampleQuestionPrep(8),
    questionsToAsk: Array.from({ length: 6 }, () => ({
      question: fillWords(100),
      why: fillWords(100)
    })),
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
        headline: "DNB – spørsmål og svarforslag",
        mustKnow: ["Sterk posisjon i nordisk verdipapirhandel"],
        questionPrep: [
          {
            question: "Hvorfor DNB?",
            whyTheyAsk: "Tester om du har gjort research.",
            suggestedAnswer: "Jeg søker DNB fordi …",
            backgroundUsed: ["SpareBank 1-internship"],
            companyHooks: ["nordisk verdipapirhandel"]
          },
          {
            question: "Fortell om deg selv",
            whyTheyAsk: "Struktur og relevans.",
            suggestedAnswer: "Jeg heter Kevin …",
            backgroundUsed: ["NTNU datateknologi"],
            companyHooks: []
          },
          {
            question: "Hvorfor denne rollen?",
            whyTheyAsk: "Motivasjon.",
            suggestedAnswer: "Rollen passer fordi …",
            backgroundUsed: ["RAG-bachelor"],
            companyHooks: ["AI-satsing"]
          },
          {
            question: "Hvorfor er du egnet?",
            whyTheyAsk: "Fit.",
            suggestedAnswer: "Jeg tilfører …",
            backgroundUsed: ["Cogito"],
            companyHooks: []
          },
          {
            question: "Hva vet du om oss?",
            whyTheyAsk: "Research.",
            suggestedAnswer: "Dere er …",
            backgroundUsed: [],
            companyHooks: ["markets"]
          },
          {
            question: "Hvordan jobber du i team?",
            whyTheyAsk: "Samarbeid.",
            suggestedAnswer: "I SpareBank 1 …",
            backgroundUsed: ["tverrfaglig team"],
            companyHooks: []
          }
        ],
        questionsToAsk: [
          { question: "Hvordan måles suksess i rollen?", why: "Viser fokusasjon på forventninger." },
          { question: "Hvordan ser en typisk uke ut?", why: "Konkret arbeidsbilde." },
          { question: "Hvilke prosjekter er aktuelle nå?", why: "Kobler til din bakgrunn." },
          { question: "Hva liker du best med å jobbe her?", why: "Personlig spørsmål." }
        ],
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
        headline: "Equinor – forberedelse",
        mustKnow: ["Ny plattform i Nordsjøen"],
        questionPrep: sampleQuestionPrep(6).map((item, i) =>
          i === 0
            ? {
                ...item,
                question: "Hvorfor Equinor?",
                suggestedAnswer: "Jeg er interessert i energi og ærlige feil."
              }
            : item
        ),
        questionsToAsk: [
          { question: "Hvordan jobber teamet med ærlige feil?", why: "Kultur." },
          { question: "Hvilke KI-prosjekter kjører dere?", why: "Fit." },
          { question: "Hvordan ser onboarding ut?", why: "Praktisk." },
          { question: "Hva liker du best?", why: "Personlig." }
        ],
        sources: ["equinor.com"]
      },
      { companyName: "Equinor", roleTitle: "Intern", generatedAt: "2026-04-01T12:00:00.000Z" }
    );
    expect(pdf.subarray(0, 4).toString("utf8")).toBe("%PDF");
  });

  it("fits a max-size report on a few pages", async () => {
    const pdf = await renderCompanyReportPdf(maxReport(), {
      companyName: "Test AS",
      roleTitle: "Utvikler",
      generatedAt: "2026-04-01T12:00:00.000Z"
    });
    expect(countPdfPages(pdf)).toBeLessThanOrEqual(4);
  });
});

describe("sanitizeReportFilename", () => {
  it("slugifies company names", () => {
    expect(sanitizeReportFilename("DNB Markets")).toBe("dnb-markets-bedriftsrapport.pdf");
  });
});
