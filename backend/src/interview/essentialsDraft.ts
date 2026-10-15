import { defaultEssentialsSheets, type InterviewMode, type KnowledgeDocKind } from "@careercenter/shared";
import type { InterviewKnowledgeDoc } from "../interviewPrepRepository.js";

const MAX_CHARS_PER_DOC = 12_000;
const MAX_TOTAL_CHARS = 48_000;

/** Document kinds whose advice belongs on the essentials sheet for each mode. */
export const ESSENTIALS_SOURCE_KINDS: Record<InterviewMode, KnowledgeDocKind[]> = {
  behavioral_mock: ["star", "core", "practice", "company", "strengths_weaknesses"],
  case_oral: ["case", "practice", "brainteasers", "core"],
  concept_tutor: ["core", "tech_topics", "ki", "finance"]
};

const TIPS_TITLE = /tips|råd|essentials|jukselapp/i;
/** Instructions to the AI interviewer are not advice for the candidate. */
const INSTRUCTION_TITLE = /instruks/i;

const MODE_LABELS: Record<InterviewMode, string> = {
  behavioral_mock: "et atferdsintervju (STAR)",
  case_oral: "et muntlig caseintervju",
  concept_tutor: "en faglig samtale"
};

export function selectEssentialsSourceDocs(
  mode: InterviewMode,
  docs: InterviewKnowledgeDoc[]
): Array<{ title: string; content: string }> {
  const kinds = new Set(ESSENTIALS_SOURCE_KINDS[mode]);
  const picked = docs.filter(
    (doc) =>
      doc.content.trim() &&
      !INSTRUCTION_TITLE.test(doc.title) &&
      (kinds.has(doc.kind) || TIPS_TITLE.test(doc.title))
  );
  // Tips documents first, then by the mode's kind order, so the budget favours the most relevant ones.
  const kindOrder = ESSENTIALS_SOURCE_KINDS[mode];
  picked.sort((a, b) => {
    const tipsA = TIPS_TITLE.test(a.title) ? 0 : 1;
    const tipsB = TIPS_TITLE.test(b.title) ? 0 : 1;
    if (tipsA !== tipsB) return tipsA - tipsB;
    const orderA = kindOrder.indexOf(a.kind);
    const orderB = kindOrder.indexOf(b.kind);
    return (orderA < 0 ? 99 : orderA) - (orderB < 0 ? 99 : orderB);
  });

  const out: Array<{ title: string; content: string }> = [];
  let budget = MAX_TOTAL_CHARS;
  for (const doc of picked) {
    if (budget <= 0) break;
    const content = doc.content.slice(0, Math.min(MAX_CHARS_PER_DOC, budget));
    budget -= content.length;
    out.push({ title: doc.title, content });
  }
  return out;
}

export function buildEssentialsDraftSystemPrompt(mode: InterviewMode): string {
  return [
    `Du lager et essentials-ark for ${MODE_LABELS[mode]}: jukselappen kandidaten har liggende like utenfor kamerabildet under intervjuet. Kandidaten skal finne punktet på to sekunder.`,
    "Bygg arket fra kandidatens egne dokumenter nedenfor, med standardarket som utgangspunkt. Behold strukturen hvis den fungerer, og bytt generelle punkter med kandidatens egne regler og formuleringer.",
    "- Maks 30 linjer. Stikkord og korte setninger, aldri avsnitt.",
    "- 3–6 korte overskrifter med store bokstaver. Punkter med «- ».",
    "- Bare det som hjelper i øyeblikket: levering, struktur, nødsvar, påminnelser. Ikke rutiner for dagen før.",
    "- Behold plassholdere i hakeparentes, for eksempel [historie] og [om selskapet]. Fyll dem bare ut hvis dokumentene sier nøyaktig hva som skal stå der.",
    "- Ikke finn på historier, tall, navn eller fakta om kandidaten. Norsk bokmål.",
    "Returner arket som ren tekst i feltet sheet.",
    "",
    "Standardark:",
    defaultEssentialsSheets[mode]
  ].join("\n");
}

export function buildEssentialsDraftUserMessage(sources: Array<{ title: string; content: string }>): string {
  return sources.map((source) => `===== ${source.title} =====\n${source.content}`).join("\n\n");
}
