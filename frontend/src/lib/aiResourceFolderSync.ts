import type { AiResourceExportBundle, AiResourceSyncResult } from "@careercenter/shared";
import { normalizeDiscoveryPath } from "./aiResourceDiscovery.js";

type WriteOptions = {
  force?: boolean;
};

export async function writeBundleToDirectory(
  root: FileSystemDirectoryHandle,
  bundle: AiResourceExportBundle,
  options: WriteOptions = {}
): Promise<AiResourceSyncResult> {
  const force = options.force === true;
  const files: AiResourceSyncResult["files"] = [];
  const conflicts: AiResourceSyncResult["conflicts"] = [];
  const rejected: AiResourceSyncResult["rejected"] = [];

  for (const file of bundle.files) {
    try {
      const existing = await readExistingContent(root, file.path);
      if (existing === null) {
        await writeFileToDirectory(root, file.path, file.content);
        files.push({
          path: file.path,
          action: "create",
          writeStrategy: file.writeStrategy
        });
        continue;
      }

      if (existing === file.content) {
        files.push({
          path: file.path,
          action: "noop",
          writeStrategy: file.writeStrategy
        });
        continue;
      }

      if (!force) {
        conflicts.push({
          path: file.path,
          message: "Filen finnes og avviker. Bruk Force for å overskrive."
        });
        files.push({
          path: file.path,
          action: "conflict",
          writeStrategy: file.writeStrategy,
          message: "Konflikt."
        });
        continue;
      }

      await writeFileToDirectory(root, file.path, file.content);
      files.push({
        path: file.path,
        action: "update",
        writeStrategy: file.writeStrategy
      });
    } catch (error) {
      rejected.push({
        path: file.path,
        message: error instanceof Error ? error.message : "Kunne ikke skrive filen."
      });
    }
  }

  return {
    dryRun: false,
    target: bundle.target,
    cwd: root.name,
    files,
    conflicts,
    rejected
  };
}

async function getOrCreateDirectoryHandle(
  root: FileSystemDirectoryHandle,
  relativeDir: string
): Promise<FileSystemDirectoryHandle> {
  if (!relativeDir) return root;
  let current = root;
  for (const part of relativeDir.split("/").filter(Boolean)) {
    current = await current.getDirectoryHandle(part, { create: true });
  }
  return current;
}

async function getDirectoryHandleIfExists(
  root: FileSystemDirectoryHandle,
  relativeDir: string
): Promise<FileSystemDirectoryHandle | null> {
  if (!relativeDir) return root;
  let current = root;
  for (const part of relativeDir.split("/").filter(Boolean)) {
    try {
      current = await current.getDirectoryHandle(part);
    } catch {
      return null;
    }
  }
  return current;
}

async function readExistingContent(
  root: FileSystemDirectoryHandle,
  relativePath: string
): Promise<string | null> {
  const normalized = normalizeDiscoveryPath(relativePath);
  const parts = normalized.split("/").filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) return null;

  const dir = await getDirectoryHandleIfExists(root, parts.join("/"));
  if (!dir) return null;

  try {
    const handle = await dir.getFileHandle(fileName);
    const file = await handle.getFile();
    return await file.text();
  } catch {
    return null;
  }
}

async function writeFileToDirectory(
  root: FileSystemDirectoryHandle,
  relativePath: string,
  content: string
) {
  const normalized = normalizeDiscoveryPath(relativePath);
  const parts = normalized.split("/").filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) throw new Error("Ugyldig filsti.");

  const dir = await getOrCreateDirectoryHandle(root, parts.join("/"));
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}
