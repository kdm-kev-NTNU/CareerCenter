import type {
  BankQuestionStatus,
  KnowledgeDocKind,
  QuestionAudience,
  QuestionCategory
} from "./interviewPrep.js";

export interface ExtractableKnowledgeDoc {
  kind: KnowledgeDocKind;
  title: string;
  content: string;
}

export interface ExtractedBankQuestion {
  text: string;
  category: QuestionCategory;
  tags: string[];
  contentHashInput: string;
}

export interface RankableBankQuestion {
  id: string;
  text: string;
  category: QuestionCategory;
  tags: string[];
  audience?: QuestionAudience;
  status?: BankQuestionStatus;
}

export interface BankQuestionRankProfile {
  industries: string[];
  themes: string[];
  caseTypes: string[];
  interviewFormats: string[];
  values: string[];
}

const KIND_TO_CATEGORY: Partial<Record<KnowledgeDocKind, QuestionCategory>> = {
  star: "behavioral",
  case: "case",
  company: "company",
  firm_profile: "company",
  tech_topics: "technical",
  practice: "behavioral",
  strengths_weaknesses: "personal",
  finance: "technical",
  ki: "technical",
  brainteasers: "brainteaser",
  partner: "motivation",
  core: "behavioral"
};

/** Default category for questions extracted from a document of this kind. */
export function categoryForDocKind(kind: KnowledgeDocKind): QuestionCategory {
  return KIND_TO_CATEGORY[kind] ?? "behavioral";
}

/**
 * Identity key for a question text: case, quotes, list markers and whitespace do not matter.
 * Used to recognise the same question across reindex runs, documents and cleanup rewrites.
 */
export function normalizeQuestionKey(text: string): string {
  return stripListPrefix(text.trim())
    .replace(/[«»"“”„]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Characters per extracted question below which a large doc should get LLM extraction. */
export const QUESTION_DENSITY_CHARS = 3000;

/**
 * Extract individual interview questions from a knowledge document blob.
 * Joins soft-wrapped lines (PDF-style) into paragraphs, then picks sentences ending with `?`.
 */
export function extractBankQuestions(doc: ExtractableKnowledgeDoc): ExtractedBankQuestion[] {
  const category = categoryForDocKind(doc.kind);
  const tags = [doc.kind, ...tokenize(doc.title)];
  const paragraphs = joinSoftWrappedLines(doc.content);
  const seen = new Set<string>();
  const out: ExtractedBankQuestion[] = [];

  for (const paragraph of paragraphs) {
    for (const raw of splitQuestionSentences(paragraph)) {
      const text = normalizeQuestionLine(raw);
      if (!text) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        text,
        category,
        tags: [...new Set(tags)],
        contentHashInput: key
      });
    }
  }

  return out;
}

/**
 * Join soft line breaks inside paragraphs so PDF-wrapped questions become one sentence.
 * Blank lines start a new paragraph. Bullet/numbered lines stay as their own units.
 */
export function joinSoftWrappedLines(content: string): string[] {
  const lines = content.split(/\r?\n/);
  const paragraphs: string[] = [];
  let current = "";

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (current) {
        paragraphs.push(current);
        current = "";
      }
      continue;
    }

    if (isListLine(line)) {
      if (current) {
        paragraphs.push(current);
        current = "";
      }
      paragraphs.push(stripListPrefix(line));
      continue;
    }

    if (!current) {
      current = line;
      continue;
    }

    // Soft wrap: only join when the previous line looks unfinished and the next
    // continues mid-sentence (typically lowercase after a PDF line break).
    if (!endsSentence(current) && startsContinuation(line)) {
      current = `${current} ${line}`;
    } else {
      paragraphs.push(current);
      current = line;
    }
  }

  if (current) paragraphs.push(current);
  return paragraphs;
}

function isListLine(line: string): boolean {
  return /^([-*\u2022]|\d+[.)]|[a-zA-Z][.)])\s+/.test(line);
}

function stripListPrefix(line: string): string {
  return line
    .replace(/^[-*\u2022]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/^[a-zA-Z][.)]\s+/, "")
    .trim();
}

function endsSentence(text: string): boolean {
  return /[.?!…:]$/.test(text.trim());
}

function startsContinuation(line: string): boolean {
  const first = line.trim().charAt(0);
  if (!first) return false;
  // Lowercase letter (incl. Norwegian) → likely wrapped continuation
  return /[a-zæøå]/.test(first);
}

/** Split a paragraph into candidate question strings (each ending with ?). */
export function splitQuestionSentences(paragraph: string): string[] {
  const trimmed = paragraph.trim();
  if (!trimmed) return [];
  if (!trimmed.includes("?")) return [];

  const parts: string[] = [];
  let start = 0;
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] !== "?") continue;
    const slice = trimmed.slice(start, i + 1).trim();
    if (slice) parts.push(slice);
    start = i + 1;
  }
  return parts;
}

function normalizeQuestionLine(raw: string): string | null {
  let line = raw.trim();
  if (!line) return null;
  line = stripListPrefix(line);
  line = line.replace(/\s+/g, " ").trim();
  if (line.length < 8) return null;
  if (!line.endsWith("?")) return null;
  return line;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9æøå]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

/**
 * Resolves short model aliases (Q1…Qn) to bank ids, drops unknowns, caps at max,
 * and fills up to min from the ranked candidate list.
 * Invariant: when enough candidates exist, result length is in [min, max] and
 * every id is unique and present in rankedCandidates.
 */
export function resolveCuratedSelection(
  refs: string[],
  rankedCandidates: Array<{ id: string }>,
  options: { min?: number; max?: number } = {}
): { ids: string[]; filledCount: number; droppedRefs: string[] } {
  const min = options.min ?? 30;
  const max = options.max ?? 50;
  const aliasToId = new Map<string, string>();
  rankedCandidates.forEach((q, index) => {
    aliasToId.set(`Q${index + 1}`, q.id);
  });

  const seen = new Set<string>();
  const ids: string[] = [];
  const droppedRefs: string[] = [];

  for (const raw of refs) {
    const ref = raw.trim().toUpperCase();
    if (!ref) continue;
    const id = aliasToId.get(ref);
    if (!id) {
      droppedRefs.push(raw);
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= max) break;
  }

  let filledCount = 0;
  for (const candidate of rankedCandidates) {
    if (ids.length >= min) break;
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    ids.push(candidate.id);
    filledCount += 1;
  }

  return { ids: ids.slice(0, max), filledCount, droppedRefs };
}

/**
 * Deterministic pre-ranking of bank questions for a company profile.
 * Only active questions the interviewer asks the candidate are ranked.
 * Returns up to `limit` candidates (default 120), stable by score then id.
 */
export function rankBankQuestions(
  profile: BankQuestionRankProfile,
  questions: RankableBankQuestion[],
  limit = 120
): RankableBankQuestion[] {
  const scored = questions
    .filter((q) => (q.audience ?? "candidate") === "candidate" && (q.status ?? "active") === "active")
    .map((q) => ({ q, score: scoreBankQuestion(profile, q) }));
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.q.id.localeCompare(b.q.id);
  });
  return scored.slice(0, limit).map((s) => s.q);
}

function scoreBankQuestion(profile: BankQuestionRankProfile, q: RankableBankQuestion): number {
  let score = 0;
  const haystack = `${q.text} ${q.tags.join(" ")} ${q.category}`.toLowerCase();
  for (const theme of profile.themes) {
    if (theme && haystack.includes(theme.toLowerCase())) score += 20;
  }
  for (const industry of profile.industries) {
    if (industry && haystack.includes(industry.toLowerCase())) score += 15;
  }
  for (const value of profile.values) {
    if (value && haystack.includes(value.toLowerCase())) score += 10;
  }
  for (const fmt of profile.interviewFormats) {
    if (fmt && haystack.includes(fmt.toLowerCase())) score += 8;
  }
  for (const ct of profile.caseTypes) {
    if (ct && (q.category === "case" || haystack.includes(ct.toLowerCase()))) score += 12;
  }
  if (q.category === "company" && profile.industries.length) score += 5;
  if (q.category === "motivation" || q.category === "personal") score += 2;
  return score;
}

export function findRepeatedStories(
  questions: Array<{ id: string; storyId?: string | null }>
): string[] {
  const counts = new Map<string, number>();
  for (const q of questions) {
    if (!q.storyId) continue;
    counts.set(q.storyId, (counts.get(q.storyId) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id);
}

/** True when deterministic extraction is too sparse for the document size. */
export function needsLlmQuestionExtraction(
  contentLength: number,
  extractedCount: number,
  maxModelChars: number
): boolean {
  if (contentLength > maxModelChars) return true;
  if (contentLength < 400) return false;
  return extractedCount * QUESTION_DENSITY_CHARS < contentLength;
}
