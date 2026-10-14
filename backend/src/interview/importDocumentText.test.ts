import { describe, expect, it } from "vitest";
import { zipSync } from "fflate";
import { importDocumentText } from "./importDocumentText.js";

describe("importDocumentText", () => {
  it("imports plain text files", async () => {
    const result = await importDocumentText("notes.txt", Buffer.from("  hello world  "));
    expect(result).toEqual({ text: "hello world", entryCount: 1 });
  });

  it("imports markdown files", async () => {
    const result = await importDocumentText("doc.md", Buffer.from("# Title\n\nBody"));
    expect(result.text).toContain("# Title");
    expect(result.entryCount).toBe(1);
  });

  it("rejects unsupported extensions", async () => {
    await expect(importDocumentText("photo.png", Buffer.from("x"))).rejects.toThrow(/støttes ikke/i);
  });

  it("extracts text entries from zip archives", async () => {
    const zipped = zipSync({
      "readme.txt": new TextEncoder().encode("zip text"),
      "nested/notes.md": new TextEncoder().encode("md body"),
      "skip.bin": new TextEncoder().encode("binary")
    });
    const result = await importDocumentText("bundle.zip", Buffer.from(zipped));
    expect(result.text).toContain("zip text");
    expect(result.text).toContain("md body");
    expect(result.entryCount).toBeGreaterThanOrEqual(2);
  });
});
