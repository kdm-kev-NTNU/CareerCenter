import { interviewModes, starRubricCriteria, starRubricCriterionLabels } from "@careercenter/shared";
import { describe, expect, it } from "vitest";
import { rubricCriterionDescriptions } from "./interviewerPlaybook.js";
import {
  buildFinishRubricPrompt,
  buildPlanPracticeScript,
  buildSimulatorSystemPrompt,
  formatSessionTranscriptForRubric
} from "./prompts.js";

const baseInput = {
  companyName: "BearingPoint",
  tone: "profesjonell",
  language: "nb",
  essentialsSheet: ""
};

describe("buildSimulatorSystemPrompt", () => {
  it("includes profile and delivery rules for every mode", () => {
    for (const mode of interviewModes) {
      const prompt = buildSimulatorSystemPrompt({ ...baseInput, mode });
      expect(prompt).toContain("Kevin Dennis Mazali");
      expect(prompt).toContain("Klarhet slår dybde");
      expect(prompt).toContain("Avslutt-knappen");
    }
  });

  it("includes weakness pressure rules for behavioral_mock", () => {
    const prompt = buildSimulatorSystemPrompt({ ...baseInput, mode: "behavioral_mock" });
    expect(prompt).toContain("kan du nevne en til");
    expect(prompt).toContain("ikke coach");
    expect(prompt).toContain("Ikke skriv svarene hans");
  });

  it("does not include no-hint interviewer rules for concept_tutor", () => {
    const prompt = buildSimulatorSystemPrompt({ ...baseInput, mode: "concept_tutor" });
    expect(prompt).toContain("konsepttutor");
    expect(prompt).toContain("Her er du coach");
    expect(prompt).not.toContain("ikke coach");
    expect(prompt).not.toContain("Ikke skriv svarene hans for ham underveis");
    expect(prompt).not.toContain("kan du nevne en til");
  });

  it("marks interviewer info and solution as SKJULT in case_oral", () => {
    const prompt = buildSimulatorSystemPrompt({
      ...baseInput,
      mode: "case_oral",
      casePrompt: "En kunde vil ha chatbot.",
      caseStyle: "candidate_led",
      interviewerInfo: "Omsetning 10M",
      solution: "Bygg RAG"
    });
    expect(prompt).toContain("Case-prompt til kandidaten");
    expect(prompt).toContain("SKJULT interviewer-info");
    expect(prompt).toContain("Omsetning 10M");
    expect(prompt).toContain("SKJULT løsning");
    expect(prompt).toContain("Bygg RAG");
    expect(prompt).toContain("Hold alltid tilbake informasjon");
  });
});

describe("buildPlanPracticeScript", () => {
  it("includes only included questions in sort order with notes", () => {
    const script = buildPlanPracticeScript({
      companyName: "DNB",
      roleTitle: "Analyst",
      companyProfileSummary: "Bank",
      questions: [
        { text: "Second?", category: "behavioral", included: true, sortOrder: 2, notes: "STAR" },
        { text: "Skipped?", category: "case", included: false, sortOrder: 0 },
        { text: "First?", category: "motivation", included: true, sortOrder: 1 }
      ]
    });
    expect(script).toContain("Øvingsplan for DNB — Analyst");
    expect(script).toContain("Bedriftsprofil: Bank");
    expect(script).toContain("1. [motivation] First?");
    expect(script).toContain("2. [behavioral] Second? (notater til intervjuer: STAR)");
    expect(script).not.toContain("Skipped?");
  });

  it("is embedded in simulator prompt when planScript is set", () => {
    const script = buildPlanPracticeScript({
      companyName: "DNB",
      questions: [{ text: "Why DNB?", category: "motivation", included: true, sortOrder: 0 }]
    });
    const prompt = buildSimulatorSystemPrompt({
      ...baseInput,
      mode: "behavioral_mock",
      planScript: script
    });
    expect(prompt).toContain("redigerbar øvingsplan");
    expect(prompt).toContain("Why DNB?");
  });
});

describe("buildFinishRubricPrompt", () => {
  it("contains every criterion description and label", () => {
    const prompt = buildFinishRubricPrompt();
    for (const criterion of starRubricCriteria) {
      expect(prompt).toContain(criterion);
      expect(prompt).toContain(starRubricCriterionLabels[criterion]);
      expect(prompt).toContain(rubricCriterionDescriptions[criterion]);
    }
    expect(prompt).toContain("Ett forbedringspunkt");
    expect(prompt).toContain("Under 24 av 32");
  });
});

describe("formatSessionTranscriptForRubric", () => {
  it("labels interviewer and candidate turns", () => {
    const transcript = formatSessionTranscriptForRubric([
      { role: "assistant", content: "Fortell om en feil du gjorde." },
      { role: "user", content: "Jeg glemte en deadline." }
    ]);
    expect(transcript).toContain("Intervjuer: Fortell om en feil du gjorde.");
    expect(transcript).toContain("Kandidat: Jeg glemte en deadline.");
  });
});
