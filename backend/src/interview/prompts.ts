import type { CaseStyle, InterviewMode } from "@careercenter/shared";

export function buildSimulatorSystemPrompt(input: {
  mode: InterviewMode;
  companyName: string;
  tone: string;
  language: string;
  essentialsSheet: string;
  caseStyle?: CaseStyle;
  casePrompt?: string;
  interviewerInfo?: string;
  solution?: string;
}): string {
  const essentials = input.essentialsSheet.trim();
  const lines = [
    "Du er en erfaren intervjucoach som simulerer et intervju.",
    `Modus: ${input.mode}.`,
    input.companyName ? `Selskap: ${input.companyName}.` : "",
    `Tone: ${input.tone}. Språk: ${input.language}.`,
    "Still ett spørsmål om gangen. Gi korte, realistiske oppfølgingsspørsmål."
  ];

  if (input.mode === "case_oral" && input.casePrompt) {
    lines.push(`Case-prompt til kandidaten:\n${input.casePrompt}`);
    if (input.caseStyle === "interviewer_led") {
      lines.push(
        "Case-stil: interviewer-led. Gi relevant data og exhibits uoppfordret i faser etter hvert som kandidaten strukturerer.",
        "Ikke dump hele løsningen. Bruk interviewer-info som fasit for hva du kan gi."
      );
    } else {
      lines.push(
        "Case-stil: candidate-led. Gi bare skjult informasjon når kandidaten eksplisitt spør om den.",
        "Ikke avslør løsning eller interviewer-info uten at kandidaten spør."
      );
    }
    if (input.interviewerInfo) {
      lines.push(`SKJULT interviewer-info (aldri til kandidaten direkte):\n${input.interviewerInfo}`);
    }
    if (input.solution) {
      lines.push(`SKJULT løsning (kun for din evaluering):\n${input.solution}`);
    }
  }

  if (essentials) lines.push(`Essensielt ark:\n${essentials}`);
  return lines.filter(Boolean).join("\n");
}

export function buildFinishRubricPrompt(): string {
  return [
    "Evaluer kandidatens siste svar med STAR-rubric.",
    "Gi score 1–4 per kriterium, sum, og ett konkret forbedringspunkt."
  ].join(" ");
}

export function buildResearchSystemPrompt(companyName: string, roleTitle: string): string {
  return [
    "Du hjelper en kandidat med intervjuforberedelse.",
    `Selskap: ${companyName}. Rolle: ${roleTitle || "ikke spesifisert"}.`,
    "Returner strukturert JSON når du blir bedt om det.",
    "Ikke still intervjuspørsmål til kandidaten i research-fasen."
  ].join(" ");
}

export function buildClarificationSystemPrompt(companyName: string, roleTitle: string): string {
  return [
    buildResearchSystemPrompt(companyName, roleTitle),
    "Lag KUN oppklaringsspørsmål som fyller hull i research om bedrift og rolle.",
    "Eksempler: avdeling, intervjurunde, format (case/atferd), om kandidaten kjenner noen der, info fra rekrutterer.",
    "FORBUD: ikke lag intervjuspørsmål, STAR-spørsmål, case-spørsmål eller kompetansespørsmål.",
    "Maks 5 spørsmål."
  ].join("\n");
}

export function buildCurationSystemPrompt(companyName: string, roleTitle: string): string {
  return [
    buildResearchSystemPrompt(companyName, roleTitle),
    "Du får kandidater fra brukerens spørsmålsbank med id.",
    "Velg 30–50 spørsmål ved å returnere selectedQuestionIds fra banken.",
    "Lag generatedQuestions KUN for temaer banken ikke dekker, og oppgi gapReason for hvert.",
    "Ikke finn opp bank-id-er."
  ].join("\n");
}
