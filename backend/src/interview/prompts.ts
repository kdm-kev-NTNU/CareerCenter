import type { CaseStyle, InterviewMode } from "@careercenter/shared";
import {
  candidateProfile,
  deliveryRules,
  formatRubricCriteriaForPrompt,
  hardRules,
  interviewerRoleRules,
  modeSections,
  pressurePoints,
  scoreInterpretation,
  sessionStartInstruction
} from "./interviewerPlaybook.js";

function section(title: string, lines: string[]): string {
  return `${title}\n${lines.map((line) => `- ${line}`).join("\n")}`;
}

export interface PlanPracticeQuestion {
  text: string;
  category: string;
  notes?: string;
  included?: boolean;
  sortOrder?: number;
}

export interface PlanPracticeInput {
  companyName: string;
  roleTitle?: string;
  companyProfileSummary?: string;
  questions: PlanPracticeQuestion[];
}

/**
 * Builds a numbered practice script from included plan questions.
 * Pure: does not mutate plan; callers snapshot this into the session prompt.
 */
export function buildPlanPracticeScript(plan: PlanPracticeInput): string {
  const included = [...plan.questions]
    .filter((q) => q.included !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  if (included.length === 0) {
    return "";
  }

  const lines = [
    `Øvingsplan for ${plan.companyName}${plan.roleTitle ? ` — ${plan.roleTitle}` : ""}.`,
    plan.companyProfileSummary ? `Bedriftsprofil: ${plan.companyProfileSummary}` : "",
    "Still spørsmålene i denne rekkefølgen, ett om gangen. Gi korte, realistiske oppfølgingsspørsmål før du går videre.",
    "Spørsmålsliste:"
  ];

  included.forEach((question, index) => {
    const notes = question.notes?.trim()
      ? ` (notater til intervjuer: ${question.notes.trim()})`
      : "";
    lines.push(`${index + 1}. [${question.category}] ${question.text}${notes}`);
  });

  return lines.filter(Boolean).join("\n");
}

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
  planScript?: string;
}): string {
  const essentials = input.essentialsSheet.trim();
  const isTutor = input.mode === "concept_tutor";

  const lines: string[] = [
    "Du er intervjuer og øvingspartner i en muntlig intervjuøkt. Les hele instruksen før du svarer. Ikke oppsummer den.",
    `Modus: ${input.mode}.`,
    input.companyName ? `Selskap: ${input.companyName}.` : "",
    `Tone: ${input.tone}. Språk: ${input.language}.`,
    sessionStartInstruction,
    section("Kandidatprofil", candidateProfile),
    section("Leveringsregler (noter, coach ikke underveis)", deliveryRules)
  ];

  if (!isTutor) {
    lines.push(section("Rolle", interviewerRoleRules));
    lines.push(section("Presspunkter", pressurePoints));
    lines.push(section("Regler du ikke bryter", hardRules));
  }

  lines.push(section("Modusspesifikke regler", modeSections[input.mode]));

  if (input.planScript?.trim()) {
    lines.push(
      "Du følger en redigerbar øvingsplan. Bruk listen under som primær spørsmålskilde.",
      input.planScript.trim()
    );
  }

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
  return lines.filter(Boolean).join("\n\n");
}

export function buildFinishRubricPrompt(): string {
  return [
    "Evaluer kandidatens intervjusvar med STAR-rubric fra Intervjubibelen.",
    "Score hvert kriterium fra 1 til 4. Returner scores, sum (totalt av 32), og ett konkret forbedringspunkt.",
    "Bruk hele transkriptet. Relevans betyr at historien svarer på spørsmålet som ble stilt.",
    "Kriterier:",
    formatRubricCriteriaForPrompt(),
    "Slik tolker du scoren:",
    ...scoreInterpretation.map((line) => `- ${line}`)
  ].join("\n");
}

export function buildResearchSystemPrompt(companyName: string, roleTitle: string): string {
  return [
    "Du hjelper en kandidat med intervjuforberedelse.",
    `Selskap: ${companyName}. Rolle: ${roleTitle || "ikke spesifisert"}.`,
    "Returner strukturert JSON når du blir bedt om det.",
    "Ikke still intervjuspørsmål til kandidaten i research-fasen."
  ].join(" ");
}

export function buildCompanyReportSystemPrompt(companyName: string, roleTitle: string): string {
  return [
    buildResearchSystemPrompt(companyName, roleTitle),
    "Du lager en kort bedriftsrapport på norsk (1–2 sider) som kandidaten kan lese før intervju.",
    "HOVEDMÅL: finn nisje-info om bedriften som kandidaten kan bruke til å svare på bedriftsspesifikke spørsmål (category company), ikke generisk bedriftsblabla.",
    "nicheInsights: konkrete, differensierende fakta (produkter, deals, strategiskift, kultur-signaler, konkurranseposisjon) som gjør «Hvorfor oss?»-svar unike.",
    "companyQuestionPrep: 3–4 typiske bedriftsspesifikke spørsmål med answerAngle (hvordan svare) og nicheHooks (hvilke nisje-fakta som skal inn i svaret).",
    "Alt innhold skal være relevant for stillingsannonsen og rollen.",
    "Ikke finn på tall, fakta eller sitater. Hvis noe er usikkert, utelat det.",
    "Hold tekstene korte: overhold feltgrensene i JSON-skjemaet.",
    "Oppgi kilder fra nettfunnene når du bruker dem.",
    "jobAdRequirements skal koble annonsekrav til hvordan kandidaten kan vise fit i intervju."
  ].join("\n");
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
    "Prioriter bedriftsspesifikke (category company) spørsmål når banken har dem.",
    "Lag generatedQuestions KUN for temaer banken ikke dekker, og oppgi gapReason for hvert.",
    "tasks: lag konkrete øvingsoppgaver som bruker nisje-info fra bedriftsrapporten til å øve svar på bedriftsspesifikke spørsmål (f.eks. skriv 60-sekunders «Hvorfor oss?» med 2 nicheHooks).",
    "Ikke finn opp bank-id-er."
  ].join("\n");
}

/** Build a role-labeled transcript for rubric evaluation. */
export function formatSessionTranscriptForRubric(
  messages: Array<{ role: string; content: string }>
): string {
  if (messages.length === 0) return "Ingen meldinger i sesjonen.";
  return messages
    .map((message) => {
      const label = message.role === "assistant" ? "Intervjuer" : message.role === "user" ? "Kandidat" : message.role;
      return `${label}: ${message.content}`;
    })
    .join("\n\n");
}
