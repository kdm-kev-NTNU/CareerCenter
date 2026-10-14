import { createWriteStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import { getUploadRoot, sanitizeFileName } from "../bachelorFileStorage.js";

export function interviewUserDir(userId: string): string {
  return path.join(getUploadRoot(), "interview", userId);
}

export function buildInterviewStoragePath(userId: string, fileId: string, originalName: string): string {
  return path.join(interviewUserDir(userId), `${fileId}-${sanitizeFileName(originalName)}`);
}

export async function writeInterviewFile(storagePath: string, buffer: Buffer): Promise<void> {
  await mkdir(path.dirname(storagePath), { recursive: true });
  await writeFile(storagePath, buffer);
}

export async function writeInterviewStream(storagePath: string, stream: Readable): Promise<void> {
  await mkdir(path.dirname(storagePath), { recursive: true });
  await pipeline(stream, createWriteStream(storagePath));
}

export async function deleteInterviewFile(storagePath: string): Promise<void> {
  try {
    await unlink(storagePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
