import type { CaseStyle, InterviewMode, PlanSectionKey, QuestionAudience } from "@careercenter/shared";
import { questionInPlanSection } from "@careercenter/shared";
import {
  buildSessionEndRules,
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
  /** Questions the candidate asks the interviewer are left out of the script. */
  audience?: QuestionAudience;
  notes?: string;
  included?: boolean;
  sortOrder?: number;
}

export interface PlanPracticeInput {
  companyName: string;
  roleTitle?: string;
  companyProfileSummary?: string;
  questions: PlanPracticeQuestion[];
  /** Limit the script to one section of the plan. */
  section?: PlanSectionKey;
}

/**
 * Builds a numbered practice script from included plan questions the interviewer asks.
 * Pure: does not mutate plan; callers snapshot this into the session prompt.
 */
export function buildPlanPracticeScript(plan: PlanPracticeInput): string {
  const included = [...plan.questions]
    .filter((q) => q.included !== false && (q.audience ?? "candidate") === "candidate")
    .filter((q) => !plan.section || questionInPlanSection(q, plan.section))
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
  /** Formatted CV / transcript / notes for follow-up hooks. */
  candidateBackground?: string;
  caseStyle?: CaseStyle;
  casePrompt?: string;
  interviewerInfo?: string;
  solution?: string;
  planScript?: string;
  /** Practise only this section of the plan instead of the whole interview. */
  planSection?: { key: PlanSectionKey; title: string };
}): string {
  const essentials = input.essentialsSheet.trim();
  const isTutor = input.mode === "concept_tutor";
  const planSection = input.planSection;
  const sessionEnd = planSection ? [] : buildSessionEndRules(input.mode);
  const background = input.candidateBackground?.trim() ?? "";

  const lines: string[] = [
    "Du er intervjuer og øvingspartner i en muntlig intervjuøkt. Les hele instruksen før du svarer. Ikke oppsummer den.",
    `Modus: ${input.mode}.`,
    input.companyName ? `Selskap: ${input.companyName}.` : "",
    `Tone: ${input.tone}. Språk: ${input.language}.`,
    planSection ? buildSectionStartInstruction(planSection.title) : sessionStartInstruction,
    background
      ? `Kandidatprofil (kroker for oppfølging; ikke anta detaljer utover dette — spør i stedet):\n${background}`
      : "Kandidatprofil: ikke lastet opp. Ikke finn på fakta om kandidaten; spør når du trenger konkrete detaljer.",
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

  if (sessionEnd.length > 0) {
    lines.push(section("Avslutning", sessionEnd));
  }

  if (essentials) lines.push(`Kandidatens essentials-ark (bakgrunn, ikke les det opp):\n${essentials}`);
  return lines.filter(Boolean).join("\n\n");
}

function buildSectionStartInstruction(title: string): string {
  return [
    `Dette er en del-økt: kandidaten øver bare på seksjonen «${title}» fra planen.`,
    "Du er en ekte person i intervjuerrollen. Presentér deg med én setning (fornavn og rolle) og still det første spørsmålet i listen med en gang. Ikke be om en egen presentasjon og ikke still spørsmål utenfor listen, bortsett fra korte oppfølgingsspørsmål.",
    "Når alle spørsmålene i listen er stilt og fulgt opp: si kort at seksjonen er ferdig og at Avslutt-knappen gir vurdering.",
    "Ikke spør om modus, selskap eller lengde — det er allerede valgt i appen."
  ].join(" ");
}

export function buildFinishRubricPrompt(): string {
  return [
    "Evaluer kandidatens intervjusvar med STAR-rubric fra Intervjubibelen.",
    "Score hvert kriterium fra 1 til 4. Returner scores og ett konkret forbedringspunkt. Ikke returner sum — den beregnes server-side.",
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
    "Du lager en kort bedriftsrapport på norsk som kandidaten kan lese før intervju.",
    "HOVEDMÅL: lag bedriftsrelevante spørsmål kandidaten bør kunne svare på, med konkrete svarforslag basert på kandidatens bakgrunn (CV, karakterutskrift, tillegg) og research om selskapet.",
    "mustKnow: maks 4 korte fakta som svarene bygger på (produkter, satsinger, kultur-signaler, rollekontekst).",
    "questionPrep: 6–8 spørsmål. MÅ alltid inkludere: «Fortell om deg selv», «Hvorfor oss?», «Hvorfor denne rollen?», «Hvorfor er du egnet / hva tilfører du?», «Hva vet du om oss?». Legg til 2–3 spørsmål avledet av annonsekrav og bedriftens satsinger.",
    "For hvert questionPrep-element: whyTheyAsk (hva intervjueren tester), suggestedAnswer (utkast i jeg-form, 60–120 ord), backgroundUsed (CV-/karakterfakta brukt), companyHooks (bedriftsfakta brukt).",
    "REGLER FOR SVARFORSLAG: bruk KUN fakta fra kandidatbakgrunnen og research. Ikke finn på tall, historier eller motivasjon. Mangler personlig motivasjon i bakgrunnen, skriv en tydelig plassholder som [din personlige grunn for KI] i stedet for å dikte.",
    "questionsToAsk: 4–6 lure spørsmål kandidaten kan stille dem, med why (hvorfor spørsmålet er lurt). Ta gjerne utgangspunkt i bankforslagene når de finnes, og tilpass til selskapet.",
    "Ikke finn på tall, fakta eller sitater. Hvis noe er usikkert, utelat det.",
    "Hold tekstene korte: overhold feltgrensene i JSON-skjemaet.",
    "Oppgi kilder fra nettfunnene når du bruker dem."
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
    "Du får kandidater fra brukerens spørsmålsbank merket med korte alias Q1, Q2, …",
    "Velg 30–50 spørsmål ved å returnere selectedRefs med disse aliasene (f.eks. \"Q1\", \"Q7\"). Ikke bruk lange id-er.",
    "Prioriter bedriftsspesifikke (category company) spørsmål når banken har dem.",
    "Lag generatedQuestions KUN for temaer banken ikke dekker, og oppgi gapReason for hvert.",
    "Ikke finn opp aliaser som ikke finnes i listene.",
    "Returner KUN selectedRefs og generatedQuestions — ikke oppgaver, case eller spørsmål kandidaten stiller."
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
