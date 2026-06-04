export const IMPORT_BATCH_SIZE = 25;

const SINGLE_FILE_PATHS = new Set([
  ".cursorrules",
  "agents.md",
  ".cursor/mcp.json",
  ".codex/config.toml"
]);

const SKILL_DIR_PREFIXES = [".cursor/skills/", ".codex/skills/", ".agents/skills/"];

export function normalizeDiscoveryPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

export function isDiscoverableAiResourcePath(relativePath: string): boolean {
  const fileName = normalizeDiscoveryPath(relativePath);
  const lower = fileName.toLowerCase();
  const base = fileName.split("/").filter(Boolean).pop() ?? fileName;

  if (SINGLE_FILE_PATHS.has(lower)) return true;

  if (lower.includes(".cursor/rules/") && lower.endsWith(".mdc")) return true;

  if (SKILL_DIR_PREFIXES.some((dir) => lower.startsWith(dir)) && base.toLowerCase() === "skill.md") {
    return true;
  }

  return false;
}

export function stripFolderRootFromWebkitPath(webkitRelativePath: string): string {
  const normalized = normalizeDiscoveryPath(webkitRelativePath);
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? normalized;
  return parts.slice(1).join("/");
}

export function folderRootFromWebkitPath(webkitRelativePath: string): string {
  const normalized = normalizeDiscoveryPath(webkitRelativePath);
  return normalized.split("/").filter(Boolean)[0] ?? "";
}

export function filesFromDirectoryInput(fileList: FileList): Array<{ fileName: string; file: File }> {
  const entries: Array<{ fileName: string; file: File }> = [];

  for (const file of fileList) {
    const webkitPath = file.webkitRelativePath;
    const relativePath = webkitPath
      ? stripFolderRootFromWebkitPath(webkitPath)
      : file.name;
    if (isDiscoverableAiResourcePath(relativePath)) {
      entries.push({ fileName: normalizeDiscoveryPath(relativePath), file });
    }
  }

  return entries;
}

export async function readDiscoveredFiles(
  entries: Array<{ fileName: string; file: File }>
): Promise<Array<{ fileName: string; content: string }>> {
  return Promise.all(
    entries.map(async ({ fileName, file }) => ({
      fileName,
      content: await file.text()
    }))
  );
}

export async function collectFilesFromDirectoryHandle(
  handle: FileSystemDirectoryHandle
): Promise<Array<{ fileName: string; content: string }>> {
  const found: Array<{ fileName: string; content: string }> = [];

  async function walk(dir: FileSystemDirectoryHandle, base: string) {
    for await (const entry of dir.values()) {
      const rel = base ? `${base}/${entry.name}` : entry.name;
      if (entry.kind === "file") {
        if (isDiscoverableAiResourcePath(rel)) {
          const file = await entry.getFile();
          found.push({
            fileName: normalizeDiscoveryPath(rel),
            content: await file.text()
          });
        }
      } else if (entry.kind === "directory") {
        await walk(entry, rel);
      }
    }
  }

  await walk(handle, "");
  return found;
}

export function chunkImportFiles<T>(files: T[], batchSize = IMPORT_BATCH_SIZE): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < files.length; index += batchSize) {
    batches.push(files.slice(index, index + batchSize));
  }
  return batches;
}
