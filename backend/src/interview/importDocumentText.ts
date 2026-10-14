import mammoth from "mammoth";
import { unzipSync } from "fflate";
import { extractText, getDocumentProxy } from "unpdf";

const TEXT_EXTENSIONS = new Set([".txt", ".md", ".csv", ".json"]);

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];
  return pages.join("\n\n").trim();
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

function extractZipTextEntries(buffer: Buffer): { texts: string[]; entryCount: number } {
  const archive = unzipSync(new Uint8Array(buffer));
  const texts: string[] = [];
  for (const [name, data] of Object.entries(archive)) {
    if (name.endsWith("/")) continue;
    const ext = extensionOf(name);
    if (!TEXT_EXTENSIONS.has(ext) && ext !== ".docx" && ext !== ".pdf") continue;
    if (TEXT_EXTENSIONS.has(ext)) {
      texts.push(decodeText(data));
      continue;
    }
    if (ext === ".docx") {
      texts.push(Buffer.from(data).toString("utf8"));
    }
  }
  return { texts: texts.filter(Boolean), entryCount: Object.keys(archive).length };
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
    return { text: await extractPdfText(buffer), entryCount: 1 };
  }
  if (ext === ".zip") {
    const { texts, entryCount } = extractZipTextEntries(buffer);
    return { text: texts.join("\n\n---\n\n").trim(), entryCount: Math.max(texts.length, entryCount) };
  }
  throw new Error(`Filtype støttes ikke: ${ext || "ukjent"}`);
}
