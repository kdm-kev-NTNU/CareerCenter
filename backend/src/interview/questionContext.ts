/**
 * Locates an extracted question in its source document and returns the nearest headings and
 * surrounding text. Whether a question is asked *to* or *by* the candidate is often decided by
 * the section heading ("3. Spørsmål du stiller dem"), not by the question text itself.
 */

export interface DocHeading {
  offset: number;
  text: string;
  kind: "numbered" | "sub";
}

export interface DocContextIndex {
  text: string;
  /** Lowercased text with whitespace runs collapsed to one space. */
  flat: string;
  /** Offset in `text` for each character in `flat`. */
  map: number[];
  headings: DocHeading[];
}

export interface QuestionContext {
  heading: string;
  subheading: string;
  excerpt: string;
  /** Offset in the document, or Infinity when the text was not found. */
  position: number;
}

const BEFORE_CHARS = 280;
const AFTER_CHARS = 220;
const MARKER_LINE = /^=+\s*(FILE|PAGE)\b.*=+$/i;
const NUMBERED_HEADING = /^(\d+(?:\.\d+)*\.?)\s+(\S.*)$/;

export function buildDocContextIndex(content: string): DocContextIndex {
  const text = content.replace(/\r/g, "");
  let flat = "";
  const map: number[] = [];
  let previousSpace = true;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (/\s/.test(ch)) {
      if (!previousSpace) {
        flat += " ";
        map.push(i);
        previousSpace = true;
      }
      continue;
    }
    const lower = ch.toLowerCase();
    flat += lower.length === 1 ? lower : ch;
    map.push(i);
    previousSpace = false;
  }

  const headings: DocHeading[] = [];
  let offset = 0;
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    const kind = headingKind(line);
    if (kind) headings.push({ offset: offset + rawLine.indexOf(line), text: line, kind });
    offset += rawLine.length + 1;
  }

  return { text, flat, map, headings };
}

function headingKind(line: string): DocHeading["kind"] | null {
  if (!line || MARKER_LINE.test(line)) return null;
  const numbered = NUMBERED_HEADING.exec(line);
  if (numbered || /^Vedlegg\b/.test(line)) {
    const rest = numbered ? numbered[2]! : line;
    if (line.length > 80 || rest.includes(". ") || /[.?!]$/.test(line)) return null;
    return "numbered";
  }
  if (line.length < 3 || line.length > 60) return null;
  if (!/^[A-ZÆØÅ]/.test(line)) return null;
  if (/[.?!:;,»"”]$/.test(line) || line.includes("?")) return null;
  return "sub";
}

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function stripMarkers(value: string): string {
  return value.replace(/^\s*([-*•]|\d+[.)])\s+/, "").replace(/[«»"“”]/g, "");
}

function findInFlat(index: DocContextIndex, sourceText: string): { pos: number; length: number } | null {
  const needle = collapse(sourceText);
  if (!needle) return null;
  const candidates = [needle, needle.slice(0, 60), collapse(stripMarkers(sourceText)).slice(0, 60)];
  for (const candidate of candidates) {
    if (candidate.length < 8) continue;
    const pos = index.flat.indexOf(candidate);
    if (pos >= 0) return { pos, length: candidate.length };
  }
  return null;
}

function trimToWords(value: string, fromStart: boolean, fromEnd: boolean): string {
  let out = value.replace(/=====[^=\n]*=====/g, " ").replace(/\s+/g, " ").trim();
  if (fromStart) out = out.replace(/^\S*\s/, "");
  if (fromEnd) out = out.replace(/\s\S*$/, "");
  return `${fromStart ? "…" : ""}${out}${fromEnd ? "…" : ""}`;
}

export function questionContext(index: DocContextIndex, sourceText: string): QuestionContext {
  const found = findInFlat(index, sourceText);
  if (!found) return { heading: "", subheading: "", excerpt: "", position: Number.POSITIVE_INFINITY };

  const start = index.map[found.pos]!;
  const end = index.map[Math.min(found.pos + found.length - 1, index.map.length - 1)]! + 1;

  let heading: DocHeading | undefined;
  for (const item of index.headings) {
    if (item.offset >= start) break;
    if (item.kind === "numbered") heading = item;
  }
  let subheading: DocHeading | undefined;
  for (const item of index.headings) {
    if (item.offset >= start) break;
    if (item.kind === "sub" && (!heading || item.offset > heading.offset)) subheading = item;
  }

  const from = Math.max(0, start - BEFORE_CHARS);
  const to = Math.min(index.text.length, end + AFTER_CHARS);
  return {
    heading: heading?.text ?? "",
    subheading: subheading?.text ?? "",
    excerpt: trimToWords(index.text.slice(from, to), from > 0, to < index.text.length),
    position: start
  };
}
