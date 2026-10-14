import type { CaseSourceKind, KnowledgeDocKind } from "./interviewPrep.js";

export interface InferKnowledgeKindInput {
  filename?: string;
  title?: string;
  content?: string;
}

export interface ClassifyCaseSourceInput {
  filename?: string;
  title?: string;
  content?: string;
  entryCount?: number;
}

const kindPatterns: Array<{ kind: KnowledgeDocKind; pattern: RegExp }> = [
  { kind: "star", pattern: /\bstar\b|situation.*task|atferd/i },
  { kind: "firm_profile", pattern: /firm\s*profile|bedriftsprofil|selskapsprofil/i },
  { kind: "company", pattern: /\bcompany\b|selskap|employer|arbeidsgiver/i },
  { kind: "case", pattern: /\bcase\b|casebook|case\s*interview|mckinsey|bcg|bain/i },
  { kind: "tech_topics", pattern: /tech(nical)?\s*topic|fagstoff|teknisk/i },
  { kind: "finance", pattern: /finance|finans|valuation|verdsettelse|dcf|wacc/i },
  { kind: "brainteasers", pattern: /brain\s*teaser|gåter|ferdighetsoppgave/i },
  { kind: "partner", pattern: /partner\s*interview|partnerrunde/i },
  { kind: "practice", pattern: /practice|øving|mock/i },
  { kind: "strengths_weaknesses", pattern: /strength|weakness|styrke|svakhet/i },
  { kind: "ki", pattern: /\bki\b|kunstig intelligens|artificial intelligence|\bai\b/i },
  { kind: "core", pattern: /\bcore\b|grunnleggende|fundamentals/i }
];

export function inferKnowledgeKind(input: InferKnowledgeKindInput): KnowledgeDocKind {
  const haystack = [input.filename, input.title, input.content?.slice(0, 4000)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const { kind, pattern } of kindPatterns) {
    if (pattern.test(haystack)) return kind;
  }
  return "other";
}

export function classifyCaseSource(input: ClassifyCaseSourceInput): CaseSourceKind {
  const haystack = [input.filename, input.title, input.content?.slice(0, 2000)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const entryCount = input.entryCount ?? 1;

  if (/exhibit|vedlegg|appendix|bilag/.test(haystack)) return "exhibit_pack";
  if (/topic\s*list|temaliste|question\s*bank/.test(haystack)) return "topic_list";
  if (entryCount >= 8 || /casebook|case\s*book/.test(haystack)) return "casebook";
  if (entryCount >= 2) return "mini_cases";
  return "single_case";
}
