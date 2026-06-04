export const IMPORT_BATCH_SIZE = 25;

type IterableDirectoryHandle = FileSystemDirectoryHandle & {
  values(): AsyncIterable<FileSystemHandle>;
};

const SINGLE_FILE_PATHS = new Set([
  ".cursorrules",
  "agents.md",
  ".cursor/mcp.json",
  ".codex/config.toml"
]);

const SKILL_DIR_PREFIXES = [
  ".cursor/skills/",
  ".codex/skills/",
  ".agents/skills/",
  ".agent-inventory/skills/"
];

const INVENTORY_SKILL_CATEGORIES = new Set([
  "agents",
  "codex",
  "cursor-builtin",
  "plugins",
  "user"
]);

export function normalizeDiscoveryPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

export function canonicalizeDiscoveredAiResourcePath(relativePath: string, rootName = ""): string {
  const normalized = normalizeDiscoveryPath(relativePath);
  const lower = normalized.toLowerCase();
  const root = normalizeDiscoveryPath(rootName).toLowerCase();
  const parts = lower.split("/").filter(Boolean);
  const firstPart = parts[0] ?? "";

  if (!normalized) return normalized;

  if (
    lower.startsWith(".agent-inventory/") ||
    lower.startsWith(".agents/") ||
    lower.startsWith(".codex/") ||
    lower.startsWith(".cursor/")
  ) {
    return normalized;
  }

  if (root === ".agent-inventory" && lower.startsWith("skills/")) {
    return `.agent-inventory/${normalized}`;
  }

  if (root === ".agents" && lower.startsWith("skills/")) {
    return `.agents/${normalized}`;
  }

  if (root === ".agent-inventory/skills") {
    return `.agent-inventory/skills/${normalized}`;
  }

  if (root === ".agents/skills") {
    return `.agents/skills/${normalized}`;
  }

  if (root === "skills" && lower.endsWith("/skill.md")) {
    const sourceRoot = INVENTORY_SKILL_CATEGORIES.has(firstPart)
      ? ".agent-inventory/skills"
      : ".agents/skills";
    return `${sourceRoot}/${normalized}`;
  }

  return normalized;
}

export function isDiscoverableAiResourcePath(relativePath: string, rootName = ""): boolean {
  const fileName = canonicalizeDiscoveredAiResourcePath(relativePath, rootName);
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
    const rootName = webkitPath ? folderRootFromWebkitPath(webkitPath) : "";
    const relativePath = webkitPath
      ? stripFolderRootFromWebkitPath(webkitPath)
      : file.name;
    const fileName = canonicalizeDiscoveredAiResourcePath(relativePath, rootName);
    if (isDiscoverableAiResourcePath(fileName)) {
      entries.push({ fileName, file });
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
    for await (const entry of (dir as IterableDirectoryHandle).values()) {
      const rel = base ? `${base}/${entry.name}` : entry.name;
      if (entry.kind === "file") {
        const fileName = canonicalizeDiscoveredAiResourcePath(rel, handle.name);
        if (isDiscoverableAiResourcePath(fileName)) {
          const file = await (entry as FileSystemFileHandle).getFile();
          found.push({
            fileName,
            content: await file.text()
          });
        }
      } else if (entry.kind === "directory") {
        await walk(entry as FileSystemDirectoryHandle, rel);
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
