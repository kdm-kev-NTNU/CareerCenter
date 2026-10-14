const TEXT_EXTENSIONS = new Set([".txt", ".md", ".csv", ".json"]);

export interface ArchiveEntry {
  name: string;
  data: Uint8Array;
}

export interface SkippedArchiveEntry {
  name: string;
  reason: string;
}

export interface ArchiveReaders {
  pdf: (data: Uint8Array) => Promise<string>;
  docx: (data: Uint8Array) => Promise<string>;
}

export interface ArchiveReadResult {
  parts: Array<{ name: string; text: string }>;
  skipped: SkippedArchiveEntry[];
}

function extensionOf(filename: string): string {
  const slash = Math.max(filename.lastIndexOf("/"), filename.lastIndexOf("\\"));
  const base = slash >= 0 ? filename.slice(slash + 1) : filename;
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot).toLowerCase() : "";
}

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export async function readArchive(entries: ArchiveEntry[], readers: ArchiveReaders): Promise<ArchiveReadResult> {
  const parts: Array<{ name: string; text: string }> = [];
  const skipped: SkippedArchiveEntry[] = [];

  for (const entry of entries) {
    if (!entry.name || entry.name.endsWith("/")) continue;
    const ext = extensionOf(entry.name);
    try {
      if (TEXT_EXTENSIONS.has(ext)) {
        const text = decodeText(entry.data).trim();
        if (text) parts.push({ name: entry.name, text });
        continue;
      }
      if (ext === ".pdf") {
        const text = (await readers.pdf(entry.data)).trim();
        if (text) parts.push({ name: entry.name, text });
        continue;
      }
      if (ext === ".docx") {
        const text = (await readers.docx(entry.data)).trim();
        if (text) parts.push({ name: entry.name, text });
        continue;
      }
      const reason = ext === ".zip" ? "Nøstet zip støttes ikke" : "Filtypen støttes ikke";
      skipped.push({ name: entry.name, reason });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Kunne ikke lese filen";
      skipped.push({ name: entry.name, reason });
    }
  }

  return { parts, skipped };
}
