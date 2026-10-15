import type { InterviewMode } from "./interviewPrep.js";
import type { InterviewSimulatorSettingsDto } from "./interviewPrepDtos.js";

export const DEFAULT_SIMULATOR_TONE = "profesjonell";
export const DEFAULT_SIMULATOR_LANGUAGE = "nb";

/**
 * Default essentials sheets: the cheat sheet next to the camera during an interview.
 * Distilled from the Intervjubibel STAR, core, practice and company documents.
 * Placeholders in [brackets] are filled in by the candidate.
 */
export const defaultEssentialsSheets: Record<InterviewMode, string> = {
  behavioral_mock: [
    "ATFERDSINTERVJU – ESSENTIALS",
    "",
    "FØR DU SVARER",
    "- Ta pausen: 2–5 sekunder er lov.",
    "- Si strukturen først: «Det er to ting her, A og B. Jeg begynner med A.»",
    "- To eller tre deler. Aldri fire.",
    "",
    "STAR",
    "- Situasjon + oppgave: 20–30 sek. Hvor, når, hvem, hva sto på spill.",
    "- Handling: mest tid. «Jeg» om din innsats, «vi» om teamet.",
    "- Resultat: tallfest, koble tilbake til det som sto på spill.",
    "- Lærdom: én setning. Avslutt tydelig.",
    "- Klarhet slår dybde. Ett helt eksempel slår tre halve.",
    "- Samme historie aldri to ganger i samme intervju.",
    "",
    "INTRO (under 2 min)",
    "- Nå → hva du har gjort → hvorfor du sitter her. Slutt med broen til rollen.",
    "",
    "STÅR DU FAST",
    "«Det har jeg ikke jobbet direkte med. Slik jeg forstår det handler det om X, og jeg ville begynt med Y. Stemmer den forståelsen?»",
    "",
    "MINE HISTORIER (stikkord)",
    "1. [historie] – dekker: [spørsmål]",
    "2. [historie] – dekker: [spørsmål]",
    "3. [historie] – dekker: [spørsmål]",
    "",
    "KONTAKT",
    "- Tre personlige innslag: i introen, midt i, mot slutten.",
    "- Minst ett personlig spørsmål til dem. Følg opp på svaret.",
    "",
    "SPØRSMÅL JEG STILLER (minst ett personlig)",
    "1. [om rollen eller teamet]",
    "2. [om selskapet]",
    "3. [personlig, f.eks. «Hva gjorde at du ble værende?»]"
  ].join("\n"),
  case_oral: [
    "CASE – ESSENTIALS",
    "",
    "START",
    "- Si at du tar noen sekunder. Ikke tenk i stillhet uten å si fra.",
    "- Oppklaring de første 30 sek: mål, kunde, tidshorisont, hva er suksess?",
    "- Si antagelsene høyt.",
    "",
    "STRUKTUR",
    "- Si den høyt: «Jeg vil se på A, B og C, og jeg begynner med A.»",
    "- To eller tre deler som passer problemet, ikke en mal.",
    "- Avbrutt? Svar der, og finn tilbake til strukturen.",
    "- Tenk høyt mens du jobber.",
    "",
    "TALL OG ESTIMERING",
    "- Bryt ned i faktorer før du regner.",
    "- Runde tall. Sjekk mot noe du vet.",
    "- Svar med et intervall og hva som endrer svaret mest.",
    "",
    "STÅR DU FAST",
    "- Nødstruktur: problemet → 2–3 mulige forklaringer → hvordan skiller jeg dem → hva anbefaler jeg i mellomtiden.",
    "",
    "AVSLUTNING",
    "- Alltid en anbefaling, forbeholdene, og hva du ville undersøkt videre.",
    "",
    "SPØRSMÅL JEG STILLER (minst ett personlig)",
    "1. [om selskapet]",
    "2. [personlig]"
  ].join("\n"),
  concept_tutor: [
    "FAGLIG SAMTALE – ESSENTIALS",
    "",
    "FORKLAR",
    "- Hele kjeden først, så dybde der det avgjør noe.",
    "- Kort versjon først (under ett minutt), spør om de vil ha mer.",
    "- Ett konkret eksempel, helst fra egne prosjekter.",
    "- Kan du forklare det uten tavle?",
    "",
    "AVVEININGER",
    "- Oversett til konsekvens for brukeren eller for kostnaden.",
    "- To alternativer med hver sin pris, og en anbefaling.",
    "",
    "NÅR DU IKKE VET",
    "- Aldri selvsikker i noe du ikke kan.",
    "- «Det er jeg ikke sikker på, men slik ville jeg funnet ut av det.»",
    "- «Slik jeg forstår det handler det om X. Stemmer den forståelsen?»",
    "",
    "BEGREPER JEG ØVER PÅ",
    "1. [begrep]",
    "2. [begrep]",
    "3. [begrep]"
  ].join("\n")
};

function normalizeSheet(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

/**
 * Effective essentials text for a mode. `null` means the user never customised it,
 * so the current default applies. An empty string is a deliberate empty sheet.
 */
export function resolveEssentialsSheet(
  mode: InterviewMode,
  stored: string | null
): { text: string; isDefault: boolean } {
  if (stored === null) return { text: defaultEssentialsSheets[mode], isDefault: true };
  return { text: stored, isDefault: false };
}

/** Value to store: `null` when the input equals the default, so later default changes reach the user. */
export function normalizeEssentialsInput(mode: InterviewMode, value: string | null): string | null {
  if (value === null) return null;
  if (normalizeSheet(value) === normalizeSheet(defaultEssentialsSheets[mode])) return null;
  return value;
}

export function defaultSimulatorSettings(mode: InterviewMode): InterviewSimulatorSettingsDto {
  return {
    mode,
    companyName: "",
    tone: DEFAULT_SIMULATOR_TONE,
    language: DEFAULT_SIMULATOR_LANGUAGE,
    essentialsSheet: defaultEssentialsSheets[mode],
    essentialsIsDefault: true
  };
}
