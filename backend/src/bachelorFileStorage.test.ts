import { mkdtemp, readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_FILE_BYTES,
  buildStoragePath,
  deleteStoredFile,
  resolveStoredPath,
  sanitizeFileName,
  writeUploadedFile
} from "./bachelorFileStorage.js";

vi.mock("./config/env.js", () => ({
  env: { UPLOAD_DIR: "" }
}));

describe("bachelorFileStorage", () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "cc-upload-"));
    const { env } = await import("./config/env.js");
    Object.assign(env, { UPLOAD_DIR: tempRoot });
  });

  afterEach(async () => {
    vi.resetModules();
  });

  it("sanitizes unsafe file names", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("")).toBe("file");
    expect(sanitizeFileName("   ")).toBe("file");
    expect(sanitizeFileName("rapport (v2).pdf")).toBe("rapport (v2).pdf");
  });

  it("rejects storage paths outside upload root", () => {
    const storagePath = buildStoragePath("user-1", null, "file-1", "notes.txt");
    expect(() => resolveStoredPath(path.join(tempRoot, "..", "outside.txt"))).toThrow("Ugyldig filbane.");
    expect(resolveStoredPath(storagePath)).toContain(tempRoot);
  });

  it("rejects empty uploads and cleans up partial files", async () => {
    const storagePath = buildStoragePath("user-1", null, "file-1", "empty.txt");
    const emptyStream = Readable.from([Buffer.alloc(0)]);

    await expect(writeUploadedFile(storagePath, emptyStream)).rejects.toThrow("Filen er tom.");

    await expect(stat(resolveStoredPath(storagePath))).rejects.toThrow();
  });

  it("cleans up partial files when streaming fails", async () => {
    const storagePath = buildStoragePath("user-1", null, "file-1", "broken.txt");
    const failingStream = new Readable({
      read() {
        this.destroy(new Error("stream failed"));
      }
    });

    await expect(writeUploadedFile(storagePath, failingStream)).rejects.toThrow("stream failed");
    await expect(stat(resolveStoredPath(storagePath))).rejects.toThrow();
  });

  it(
    "rejects files larger than the configured limit",
    async () => {
      const storagePath = buildStoragePath("user-1", null, "file-1", "large.bin");
      const chunkSize = 256 * 1024;
      let sent = 0;
      const oversizedStream = new Readable({
        read() {
          if (sent > MAX_FILE_BYTES) {
            this.push(null);
            return;
          }
          const chunk = Buffer.alloc(chunkSize, 1);
          sent += chunk.length;
          this.push(chunk);
        }
      });

      await expect(writeUploadedFile(storagePath, oversizedStream)).rejects.toThrow(
        "Filen er for stor (maks 50 MB)."
      );
      await expect(stat(resolveStoredPath(storagePath))).rejects.toThrow();
    },
    30_000
  );

  it("deletes stored files idempotently", async () => {
    const storagePath = buildStoragePath("user-1", null, "file-1", "notes.txt");
    await writeUploadedFile(storagePath, Readable.from(["hello"]));
    await deleteStoredFile(storagePath);
    await deleteStoredFile(storagePath);
    const dir = path.dirname(resolveStoredPath(storagePath));
    const entries = await readdir(dir);
    expect(entries).toEqual([]);
  });

  it("reports whether a stored file exists on disk", async () => {
    const { storedFileExists } = await import("./bachelorFileStorage.js");
    const storagePath = buildStoragePath("user-1", null, "file-1", "notes.txt");
    expect(await storedFileExists(storagePath)).toBe(false);
    await writeUploadedFile(storagePath, Readable.from(["hello"]));
    expect(await storedFileExists(storagePath)).toBe(true);
  });
});
