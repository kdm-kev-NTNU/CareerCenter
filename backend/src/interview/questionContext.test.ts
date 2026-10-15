import { describe, expect, it } from "vitest";
import { bibleUserDocs } from "./bibleUserDocs.js";
import { buildDocContextIndex, questionContext } from "./questionContext.js";

function docContent(slug: string): string {
  const doc = bibleUserDocs.find((item) => item.slug === slug);
  if (!doc) throw new Error(`Mangler dokument ${slug}`);
  return doc.content;
}

describe("questionContext", () => {
  it("finds the section heading that decides a question is asked to the interviewer", () => {
    const index = buildDocContextIndex(docContent("bedrift"));
    const context = questionContext(index, "Hva overrasket deg mest det første året ditt her?");
    expect(context.heading).toBe("3. Spørsmål du stiller dem");
    expect(context.excerpt).toContain("Hva overrasket deg mest");
    expect(Number.isFinite(context.position)).toBe(true);
  });

  it("finds the partner question heading", () => {
    const index = buildDocContextIndex(docContent("partner"));
    const context = questionContext(index, "Hvordan velger dere hvilke oppdrag dere takker nei til?");
    expect(context.heading).toBe("4. Spørsmål du stiller en partner");
  });

  it("does not treat numbered sentences as headings", () => {
    const index = buildDocContextIndex(docContent("ovingspartner"));
    expect(index.headings.some((h) => h.text.startsWith("1. STAR-drill"))).toBe(false);
    expect(index.headings.some((h) => h.text === "5. Spørsmålsbank")).toBe(true);
    const context = questionContext(index, "Kan du introdusere deg selv?");
    expect(context.heading).toBe("5. Spørsmålsbank");
    expect(context.subheading).toBe("Introduksjon og personlighet");
  });

  it("finds sub headings for self-reflection prompts", () => {
    const index = buildDocContextIndex(docContent("svakheter"));
    const context = questionContext(index, "Er det en tilbakemelding du husker fordi den irriterte deg?");
    expect(context.heading).toBe("5. Tøffe tilbakemeldinger");
    expect(context.subheading).toBe("Spørsmål å lete i");
  });

  it("finds text that was soft-wrapped across lines", () => {
    const index = buildDocContextIndex("1. Tema\nHvordan har du\nløst en konflikt i et team?\n");
    const context = questionContext(index, "Hvordan har du løst en konflikt i et team?");
    expect(context.heading).toBe("1. Tema");
    expect(context.position).toBe(8);
  });

  it("returns an empty context when the text is missing", () => {
    const index = buildDocContextIndex("1. Tema\nNoe helt annet.");
    expect(questionContext(index, "Hvorfor vil du jobbe her?")).toEqual({
      heading: "",
      subheading: "",
      excerpt: "",
      position: Number.POSITIVE_INFINITY
    });
  });

  it("keeps the excerpt bounded", () => {
    const filler = "Lang tekst uten spørsmål. ".repeat(200);
    const index = buildDocContextIndex(`${filler}\nHvorfor vil du jobbe her?\n${filler}`);
    const context = questionContext(index, "Hvorfor vil du jobbe her?");
    expect(context.excerpt.length).toBeLessThan(600);
    expect(context.excerpt.startsWith("…")).toBe(true);
    expect(context.excerpt.endsWith("…")).toBe(true);
  });
});
