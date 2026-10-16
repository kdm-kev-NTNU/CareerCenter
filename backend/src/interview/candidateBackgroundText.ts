/** Max characters kept per uploaded document after redaction. */
export const MAX_BACKGROUND_TEXT_CHARS = 40_000;

const TRANSCRIPT_BOILERPLATE_MARKER = "Studiepoeng- og karaktersystem";

/**
 * Norwegian national ID (fødselsnummer / D-nummer): 11 digits, optionally spaced.
 * Also strips "Fnr:" / "Fødselsnummer:" labelled lines.
 * Does not touch phone numbers (shorter) or years (4 digits).
 */
export function redactPersonalIds(text: string): string {
  let out = text;
  // Labelled fødselsnummer lines/phrases (keep the label word, drop the digits).
  out = out.replace(/\bFnr\s*:\s*[\d\s]{11,20}/gi, "Fnr: [fjernet]");
  out = out.replace(/\bFødselsnummer\s*:\s*[\d\s]{11,20}/gi, "Fødselsnummer: [fjernet]");
  // Standalone 11-digit IDs, including "DDMMYY XXXXX" with a single space in the middle.
  out = out.replace(/\b(\d{6})\s?(\d{5})\b/g, "[personnummer fjernet]");
  return out;
}

/**
 * Truncate character transcript boilerplate (grading system explanation on page 2).
 * Returns text up to (but not including) the marker when present.
 */
export function trimTranscriptBoilerplate(text: string): string {
  const index = text.indexOf(TRANSCRIPT_BOILERPLATE_MARKER);
  if (index < 0) return text.trim();
  return text.slice(0, index).trim();
}

/** Apply redaction, optional transcript trim, and length cap. Pure. */
export function sanitizeBackgroundDocumentText(
  text: string,
  options: { kind: "cv" | "transcript" }
): string {
  let out = redactPersonalIds(text);
  if (options.kind === "transcript") {
    out = trimTranscriptBoilerplate(out);
  }
  out = out.trim();
  if (out.length > MAX_BACKGROUND_TEXT_CHARS) {
    out = out.slice(0, MAX_BACKGROUND_TEXT_CHARS);
  }
  return out;
}

/**
 * Format background for LLM prompts / simulator candidate profile section.
 * Returns empty string when nothing useful is stored.
 */
export function formatCandidateBackgroundForPrompt(input: {
  cvText: string;
  transcriptText: string;
  notes: string;
}): string {
  const parts: string[] = [];
  const cv = input.cvText.trim();
  const transcript = input.transcriptText.trim();
  const notes = input.notes.trim();
  if (cv) parts.push(`CV:\n${cv}`);
  if (transcript) parts.push(`Karakterutskrift:\n${transcript}`);
  if (notes) parts.push(`Tillegg fra kandidaten:\n${notes}`);
  return parts.join("\n\n");
}
