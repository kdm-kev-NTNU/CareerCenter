import { InvalidReferenceError } from "./repository.js";

export class BachelorFileUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BachelorFileUploadError";
  }
}

export type BachelorFileUploadValidationOptions = {
  folderExists?: (folderId: string) => Promise<boolean>;
};

export async function validateBachelorFileUpload(
  input: { folderId: string | null; originalName: string },
  options: BachelorFileUploadValidationOptions = {}
): Promise<void> {
  if (!input.originalName.trim()) {
    throw new BachelorFileUploadError("Filnavn mangler.");
  }

  if (input.folderId && options.folderExists) {
    const exists = await options.folderExists(input.folderId);
    if (!exists) {
      throw new InvalidReferenceError("Mappe finnes ikke.");
    }
  }
}
