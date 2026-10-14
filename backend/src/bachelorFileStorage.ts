import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import { env } from "./config/env.js";

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export function getUploadRoot(): string {
  return path.resolve(env.UPLOAD_DIR);
}

export function sanitizeFileName(name: string): string {
  const base = path.basename(name).replace(/[^\w.\-() ]+/g, "_").trim();
  return base.length > 0 ? base.slice(0, 200) : "file";
}

export function bachelorUserDir(userId: string): string {
  return path.join(getUploadRoot(), "bachelor", userId);
}

export function bachelorFolderSegment(folderId: string | null | undefined): string {
  return folderId ?? "_root";
}

export function buildStoragePath(
  userId: string,
  folderId: string | null | undefined,
  fileId: string,
  originalName: string
): string {
  const safeName = sanitizeFileName(originalName);
  return path.join(
    bachelorUserDir(userId),
    bachelorFolderSegment(folderId),
    `${fileId}-${safeName}`
  );
}

export async function ensureDirForFile(storagePath: string): Promise<void> {
  await mkdir(path.dirname(storagePath), { recursive: true });
}

export async function writeUploadedFile(storagePath: string, stream: Readable): Promise<number> {
  await ensureDirForFile(storagePath);
  const absolute = resolveStoredPath(storagePath);
  const writeStream = createWriteStream(absolute);
  let bytes = 0;
  stream.on("data", (chunk: Buffer | string) => {
    const size = typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length;
    bytes += size;
    if (bytes > MAX_FILE_BYTES) {
      stream.destroy(new Error("Filen er for stor (maks 50 MB)."));
      writeStream.destroy();
    }
  });
  try {
    await pipeline(stream, writeStream);
    const fileStat = await stat(absolute);
    if (fileStat.size === 0) {
      throw new Error("Filen er tom.");
    }
    return fileStat.size;
  } catch (error) {
    await deleteStoredFile(storagePath);
    throw error;
  }
}

export async function storedFileExists(storagePath: string): Promise<boolean> {
  try {
    const fileStat = await stat(resolveStoredPath(storagePath));
    return fileStat.isFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export function readStoredFile(storagePath: string): Readable {
  return createReadStream(resolveStoredPath(storagePath));
}

export async function deleteStoredFile(storagePath: string): Promise<void> {
  try {
    await unlink(resolveStoredPath(storagePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export function resolveStoredPath(storagePath: string): string {
  const root = getUploadRoot();
  const resolved = path.resolve(storagePath);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error("Ugyldig filbane.");
  }
  return resolved;
}
