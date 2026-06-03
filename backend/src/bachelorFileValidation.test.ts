import { describe, expect, it, vi } from "vitest";
import { InvalidReferenceError } from "./repository.js";
import { BachelorFileUploadError, validateBachelorFileUpload } from "./bachelorFileValidation.js";

describe("validateBachelorFileUpload", () => {
  it("rejects missing file names", async () => {
    await expect(validateBachelorFileUpload({ folderId: null, originalName: "   " })).rejects.toThrow(
      new BachelorFileUploadError("Filnavn mangler.")
    );
  });

  it("accepts uploads to root without folder validation", async () => {
    await expect(
      validateBachelorFileUpload({ folderId: null, originalName: "notes.pdf" })
    ).resolves.toBeUndefined();
  });

  it("rejects uploads to missing folders", async () => {
    await expect(
      validateBachelorFileUpload(
        { folderId: "missing", originalName: "notes.pdf" },
        { folderExists: vi.fn().mockResolvedValue(false) }
      )
    ).rejects.toThrow(new InvalidReferenceError("Mappe finnes ikke."));
  });

  it("accepts uploads when folder exists", async () => {
    await expect(
      validateBachelorFileUpload(
        { folderId: "folder-1", originalName: "notes.pdf" },
        { folderExists: vi.fn().mockResolvedValue(true) }
      )
    ).resolves.toBeUndefined();
  });
});
