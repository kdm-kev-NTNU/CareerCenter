import { interviewModes, starRubricCriteria, starRubricCriterionLabels } from "@careercenter/shared";
import { describe, expect, it } from "vitest";
import { rubricCriterionDescriptions } from "./interviewerPlaybook.js";
import {
  buildAnswerDraftSystemPrompt,
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
  it("uses uploaded background when provided and does not hardcode a CV", () => {
    const withBg = buildSimulatorSystemPrompt({
      ...baseInput,
      mode: "behavioral_mock",
      candidateBackground: "CV:\nKevin Dennis Mazali\nMaster i datateknologi"
    });
    expect(withBg).toContain("Kevin Dennis Mazali");
    expect(withBg).toContain("Klarhet slår dybde");
    expect(withBg).toContain("Avslutt-knappen");
    expect(withBg).toContain("Ikke åpne en egen runde der kandidaten stiller spørsmål tilbake");

    const withoutBg = buildSimulatorSystemPrompt({ ...baseInput, mode: "behavioral_mock" });
    expect(withoutBg).toContain("Kandidatprofil: ikke lastet opp");
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

  it("ends full sessions without a candidate Q&A round", () => {
    for (const mode of interviewModes) {
      const prompt = buildSimulatorSystemPrompt({ ...baseInput, mode });
      expect(prompt).not.toContain("Avslutning: spørsmålsrunde");
      expect(prompt).not.toContain("SKJULT: Spørsmål kandidaten har forberedt");
    }
    const behavioral = buildSimulatorSystemPrompt({ ...baseInput, mode: "behavioral_mock" });
    expect(behavioral).toContain("Avslutning");
    expect(behavioral).toContain("Ikke åpne en egen runde der kandidaten stiller spørsmål tilbake");
    expect(behavioral).toContain("Avslutt-knappen");
    const tutor = buildSimulatorSystemPrompt({ ...baseInput, mode: "concept_tutor" });
    expect(tutor).not.toContain("Ikke åpne en egen runde");
  });
});

describe("plan section sessions", () => {
  it("a question section starts on the first question and skips the session end block", () => {
    const prompt = buildSimulatorSystemPrompt({
      ...baseInput,
      mode: "behavioral_mock",
      planSection: { key: "behavioral", title: "Atferd (STAR)" }
    });
    expect(prompt).toContain("bare på seksjonen «Atferd (STAR)»");
    expect(prompt).not.toContain("be så kandidaten presentere seg");
    expect(prompt).not.toContain("\nAvslutning\n");
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

describe("buildAnswerDraftSystemPrompt", () => {
  it("instructs STAR method, placeholders for missing facts, and tips", () => {
    const prompt = buildAnswerDraftSystemPrompt("DNB", "Analyst");
    expect(prompt).toContain("eksempelsvar");
    expect(prompt).toContain("STAR");
    expect(prompt).toContain("tips");
    expect(prompt).toContain("plassholder");
    expect(prompt).toContain("questionAlias");
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
    expect(prompt).not.toContain("Spørsmålsrunden til slutt");
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
