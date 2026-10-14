import type { CaseSourceKind } from "@careercenter/shared";
import {
  MAX_MODEL_CHARS,
  MIN_SPAN_CHARS,
  type DocumentPage,
  type DocumentSection,
  parseDocuments
} from "./documentPages.js";

export interface CaseChunk {
  fileName: string;
  title: string;
  pageStart: number;
  pageEnd: number;
  uncertain: boolean;
}

const HEADING = /^(?:case|cas)\s+\d+\b[:.\-\s].{0,120}$/i;
const TOC_LINE = /^(.{6,80}?)(?:\.{2,}|\s{2,})\s*(\d{1,4})\s*$/;

interface RawSpan {
  title: string;
  pageStart: number;
  pageEnd: number;
  uncertain: boolean;
}

export function proposeCaseSpans(content: string): CaseChunk[] {
  const sections = parseDocuments(content);
  return sections.flatMap((section) => spansForSection(section));
}

export function shouldChunkImport(input: { content: string; sourceKind: CaseSourceKind }): boolean {
  if (input.sourceKind === "exhibit_pack" || input.sourceKind === "topic_list") return false;
  if (input.sourceKind === "casebook") return true;
  const spans = proposeCaseSpans(input.content);
  if (spans.length > 1) return true;
  return input.content.length > MAX_MODEL_CHARS;
}

function spansForSection(section: DocumentSection): CaseChunk[] {
  if (section.pages.length === 0) return [];
  const raw = boundaries(section.pages);
  return raw.flatMap((span) => packSpan(section, span));
}

function boundaries(pages: DocumentPage[]): RawSpan[] {
  const toc = readToc(pages);
  const headings = toc ?? readHeadings(pages);
  if (!headings) {
    const last = pages[pages.length - 1]?.number ?? 1;
    return [{ title: "Dokument", pageStart: pages[0]?.number ?? 1, pageEnd: last, uncertain: true }];
  }

  const lastPage = pages[pages.length - 1]?.number ?? headings[headings.length - 1]?.page ?? 1;
  return headings.map((heading, index) => {
    const next = headings[index + 1]?.page;
    const pageEnd = next && next > heading.page ? next - 1 : lastPage;
    return {
      title: heading.title,
      pageStart: heading.page,
      pageEnd: Math.max(heading.page, pageEnd),
      uncertain: false
    };
  });
}

function readToc(pages: DocumentPage[]): Array<{ title: string; page: number }> | null {
  const hits: Array<{ title: string; page: number }> = [];
  for (const page of pages) {
    if (page.number > 8) break;
    for (const line of page.text.split(/\n/)) {
      const match = TOC_LINE.exec(line.trim());
      if (!match) continue;
      const pageNumber = Number(match[2]);
      if (!Number.isFinite(pageNumber) || pageNumber < 1) continue;
      hits.push({ title: match[1].trim(), page: pageNumber });
    }
  }
  if (hits.length < 2) return null;
  const increasing = hits.every((hit, index) => {
    const previous = hits[index - 1];
    return index === 0 || (previous !== undefined && hit.page >= previous.page);
  });
  return increasing ? hits : null;
}

function readHeadings(pages: DocumentPage[]): Array<{ title: string; page: number }> | null {
  const hits: Array<{ title: string; page: number }> = [];
  for (const page of pages) {
    for (const line of page.text.split(/\n/)) {
      const trimmed = line.trim();
      if (HEADING.test(trimmed)) hits.push({ title: trimmed, page: page.number });
    }
  }
  return hits.length >= 2 ? hits : null;
}

function packSpan(section: DocumentSection, span: RawSpan): CaseChunk[] {
  const selected = section.pages.filter((page) => page.number >= span.pageStart && page.number <= span.pageEnd);
  if (selected.length === 0) {
    return [
      {
        fileName: section.fileName,
        title: span.title,
        pageStart: span.pageStart,
        pageEnd: span.pageStart,
        uncertain: true
      }
    ];
  }

  const groups: DocumentPage[][] = [];
  let current: DocumentPage[] = [];
  let size = 0;
  for (const page of selected) {
    const length = page.text.length + 2;
    if (current.length > 0 && size + length > MAX_MODEL_CHARS) {
      groups.push(current);
      current = [];
      size = 0;
    }
    current.push(page);
    size += length;
  }
  if (current.length > 0) groups.push(current);

  const split = groups.length > 1;
  return groups.map((group) => {
    const text = group.map((page) => page.text).join("\n\n").trim();
    return {
      fileName: section.fileName,
      title: span.title,
      pageStart: group[0]?.number ?? span.pageStart,
      pageEnd: group[group.length - 1]?.number ?? span.pageEnd,
      uncertain: span.uncertain || split || text.length < MIN_SPAN_CHARS || text.length > MAX_MODEL_CHARS
    };
  });
}
