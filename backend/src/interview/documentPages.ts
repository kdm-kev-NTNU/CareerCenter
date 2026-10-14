export const MAX_MODEL_CHARS = 12_000;
export const MIN_SPAN_CHARS = 200;

const PAGE_SPLIT = /===== PAGE (\d+) =====\n/g;
const FILE_SPLIT = /===== FILE (.+?) =====\n/g;
const SKIPPED_MARKER = "\n===== SKIPPED =====\n";

export interface DocumentPage {
  number: number;
  text: string;
}

export interface DocumentSection {
  fileName: string;
  pages: DocumentPage[];
}

export function formatPages(pages: string[]): string {
  return pages
    .map((text, index) => `===== PAGE ${index + 1} =====\n${text.trim()}`)
    .join("\n\n")
    .trim();
}

export function parsePages(content: string): DocumentPage[] {
  const matches = [...content.matchAll(PAGE_SPLIT)];
  if (matches.length === 0) {
    const text = content.trim();
    return text ? [{ number: 1, text }] : [];
  }

  return matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? content.length;
    return {
      number: Number(match[1]),
      text: content.slice(start, end).trim()
    };
  });
}

export function parseDocuments(content: string): DocumentSection[] {
  const body = content.split(SKIPPED_MARKER)[0] ?? "";
  const fileMatches = [...body.matchAll(FILE_SPLIT)];
  if (fileMatches.length === 0) {
    const pages = parsePages(body);
    return pages.length ? [{ fileName: "", pages }] : [];
  }

  return fileMatches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = fileMatches[index + 1]?.index ?? body.length;
    return {
      fileName: match[1]?.trim() ?? "",
      pages: parsePages(body.slice(start, end))
    };
  });
}

export function formatSkipped(entries: Array<{ name: string; reason: string }>): string {
  if (entries.length === 0) return "";
  const lines = entries.map((entry) => `- ${entry.name}: ${entry.reason}`);
  return `${SKIPPED_MARKER}${lines.join("\n")}`;
}

export function spanText(pages: DocumentPage[], pageStart: number, pageEnd: number): string {
  return pages
    .filter((page) => page.number >= pageStart && page.number <= pageEnd)
    .map((page) => page.text)
    .join("\n\n")
    .slice(0, MAX_MODEL_CHARS);
}
