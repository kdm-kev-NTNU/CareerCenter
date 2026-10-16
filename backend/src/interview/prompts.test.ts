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

describe("closing round", () => {
  it("asks for the candidate's questions in behavioral and case modes, not in tutor mode", () => {
    for (const mode of ["behavioral_mock", "case_oral"] as const) {
      const prompt = buildSimulatorSystemPrompt({ ...baseInput, mode });
      expect(prompt).toContain("Avslutning: spørsmålsrunde");
      expect(prompt).toContain("Har du noen spørsmål til oss?");
      expect(prompt).toContain("end_interview");
    }
    const tutor = buildSimulatorSystemPrompt({ ...baseInput, mode: "concept_tutor" });
    expect(tutor).not.toContain("Har du noen spørsmål til oss?");
  });

  it("lists prepared questions in a hidden section", () => {
    const prompt = buildSimulatorSystemPrompt({
      ...baseInput,
      mode: "behavioral_mock",
      questionsToAsk: [
        { text: "Hvordan jobber dere med KI?", audience: "ask_interviewer_company" },
        { text: "Hva overrasket deg mest?", audience: "ask_interviewer_personal" }
      ]
    });
    expect(prompt).toContain("SKJULT: Spørsmål kandidaten har forberedt");
    expect(prompt).toContain("Om selskapet:\n- Hvordan jobber dere med KI?");
    expect(prompt).toContain("Til deg personlig:\n- Hva overrasket deg mest?");
  });
});

describe("plan section sessions", () => {
  it("a question section starts on the first question and skips the closing round", () => {
    const prompt = buildSimulatorSystemPrompt({
      ...baseInput,
      mode: "behavioral_mock",
      planSection: { key: "behavioral", title: "Atferd (STAR)" }
    });
    expect(prompt).toContain("bare på seksjonen «Atferd (STAR)»");
    expect(prompt).not.toContain("be så kandidaten presentere seg");
    expect(prompt).not.toContain("Avslutning: spørsmålsrunde");
  });

  it("the closing-round section keeps the closing round rules", () => {
    const prompt = buildSimulatorSystemPrompt({
      ...baseInput,
      mode: "behavioral_mock",
      planSection: { key: "ask_interviewer", title: "Spørsmålsrunde (jeg spør)" },
      questionsToAsk: [{ text: "Hva overrasket deg mest?", audience: "ask_interviewer_personal" }]
    });
    expect(prompt).toContain("bare på spørsmålsrunden");
    expect(prompt).toContain("Avslutning: spørsmålsrunde");
    expect(prompt).toContain("Hva overrasket deg mest?");
  });
});

describe("essentials in the simulator prompt", () => {
  it("includes a custom sheet and leaves out an empty one", () => {
    const custom = buildSimulatorSystemPrompt({ ...baseInput, mode: "behavioral_mock", essentialsSheet: "Mine stikkord" });
    expect(custom).toContain("Kandidatens essentials-ark (bakgrunn, ikke les det opp):\nMine stikkord");
    const empty = buildSimulatorSystemPrompt({ ...baseInput, mode: "behavioral_mock", essentialsSheet: "  " });
    expect(empty).not.toContain("essentials-ark");
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

  it("leaves out questions the candidate asks the interviewer", () => {
    const script = buildPlanPracticeScript({
      companyName: "DNB",
      questions: [
        { text: "Why DNB?", category: "motivation", audience: "candidate", included: true, sortOrder: 0 },
        { text: "Hva er neste steg?", category: "company", audience: "ask_interviewer_company", included: true, sortOrder: 1 }
      ]
    });
    expect(script).toContain("1. [motivation] Why DNB?");
    expect(script).not.toContain("Hva er neste steg?");
    expect(
      buildPlanPracticeScript({
        companyName: "DNB",
        questions: [{ text: "Hva er neste steg?", category: "company", audience: "ask_interviewer_company" }]
      })
    ).toBe("");
  });

  it("keeps only the chosen section", () => {
    const script = buildPlanPracticeScript({
      companyName: "DNB",
      section: "behavioral",
      questions: [
        { text: "Why DNB?", category: "motivation", included: true, sortOrder: 0 },
        { text: "A conflict?", category: "behavioral", included: true, sortOrder: 1 }
      ]
    });
    expect(script).toContain("1. [behavioral] A conflict?");
    expect(script).not.toContain("Why DNB?");
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
    expect(prompt).toContain("Spørsmålsrunden til slutt");
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
