import mammoth from "mammoth";
import { unzipSync } from "fflate";
import { getDocumentProxy } from "unpdf";
import { readArchive } from "./archiveEntries.js";
import { formatPages, formatSkipped } from "./documentPages.js";

const TEXT_EXTENSIONS = new Set([".txt", ".md", ".csv", ".json"]);

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

async function extractPdfText(data: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(data);
  const pages: string[] = [];
  for (let number = 1; number <= pdf.numPages; number += 1) {
    pages.push(await readPdfPage(pdf, number));
  }
  return formatPages(pages);
}

async function readPdfPage(pdf: Awaited<ReturnType<typeof getDocumentProxy>>, number: number): Promise<string> {
  try {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    return content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "ukjent feil";
    return `[Side ${number} kunne ikke leses: ${reason}]`;
  }
}

function sectionFor(part: { name: string; text: string }): string {
  const body = part.text.includes("===== PAGE ") ? part.text : formatPages([part.text]);
  return `===== FILE ${part.name} =====\n${body}`;
}

export interface ImportedDocument {
  text: string;
  entryCount: number;
}

export async function importDocumentText(filename: string, buffer: Buffer): Promise<ImportedDocument> {
  const ext = extensionOf(filename);
  if (TEXT_EXTENSIONS.has(ext)) {
    return { text: buffer.toString("utf8").trim(), entryCount: 1 };
  }
  if (ext === ".docx") {
    return { text: await extractDocxText(buffer), entryCount: 1 };
  }
  if (ext === ".pdf") {
    return { text: await extractPdfText(new Uint8Array(buffer)), entryCount: 1 };
  }
  if (ext === ".zip") {
    const archive = unzipSync(new Uint8Array(buffer));
    const entries = Object.entries(archive).map(([name, data]) => ({ name, data }));
    const { parts, skipped } = await readArchive(entries, {
      pdf: extractPdfText,
      docx: async (data) => extractDocxText(Buffer.from(data))
    });
    const text = `${parts.map(sectionFor).join("\n\n")}${formatSkipped(skipped)}`.trim();
    return { text, entryCount: Math.max(parts.length, 1) };
  }
  throw new Error(`Filtype støttes ikke: ${ext || "ukjent"}`);
}
