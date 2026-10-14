import { describe, expect, it } from "vitest";
import { readArchive } from "./archiveEntries.js";

const encode = (value: string) => new TextEncoder().encode(value);

describe("readArchive", () => {
  it("reads nested pdf and docx with the shared readers and names skipped files", async () => {
    const result = await readArchive(
      [
        { name: "notes/readme.txt", data: encode("zip text") },
        { name: "book.pdf", data: encode("pdf-bytes") },
        { name: "memo.docx", data: encode("docx-bytes") },
        { name: "inner.zip", data: encode("zip") },
        { name: "skip.bin", data: encode("binary") },
        { name: "folder/", data: encode("") }
      ],
      {
        pdf: async () => "===== PAGE 1 =====\npdf side",
        docx: async () => "docx tekst"
      }
    );

    expect(result.parts.map((part) => part.name)).toEqual(["notes/readme.txt", "book.pdf", "memo.docx"]);
    expect(result.parts[1]?.text).toContain("pdf side");
    expect(result.parts[2]?.text).toBe("docx tekst");
    expect(result.skipped).toEqual([
      { name: "inner.zip", reason: "Nøstet zip støttes ikke" },
      { name: "skip.bin", reason: "Filtypen støttes ikke" }
    ]);
  });

  it("skips a broken pdf and continues with the rest of the archive", async () => {
    const result = await readArchive(
      [
        { name: "broken.pdf", data: encode("x") },
        { name: "ok.md", data: encode("behold meg") }
      ],
      {
        pdf: async () => {
          throw new Error("ufullstendig pdf");
        },
        docx: async () => ""
      }
    );

    expect(result.parts).toEqual([{ name: "ok.md", text: "behold meg" }]);
    expect(result.skipped).toEqual([{ name: "broken.pdf", reason: "ufullstendig pdf" }]);
  });
});
