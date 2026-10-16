import { describe, expect, it } from "vitest";
import { buildPlanSections, isPlanSectionKey, questionInPlanSection } from "./planSections.js";

describe("buildPlanSections", () => {
  it("groups included questions by category in plan order, closing round last", () => {
    const sections = buildPlanSections([
      { category: "company", audience: "ask_interviewer_company", sortOrder: 0 },
      { category: "motivation", audience: "candidate", sortOrder: 3 },
      { category: "behavioral", audience: "candidate", sortOrder: 1 },
      { category: "behavioral", audience: "candidate", sortOrder: 2 },
      { category: "personal", audience: "ask_interviewer_personal", sortOrder: 4 }
    ]);

    expect(sections).toEqual([
      { key: "behavioral", title: "Atferd (STAR)", questionCount: 2 },
      { key: "motivation", title: "Motivasjon", questionCount: 1 },
      { key: "ask_interviewer", title: "Spørsmålsrunde (jeg spør)", questionCount: 2 }
    ]);
  });

  it("leaves out excluded questions and sections that end up empty", () => {
    const sections = buildPlanSections([
      { category: "technical", audience: "candidate", included: false },
      { category: "behavioral", audience: "candidate", included: true }
    ]);

    expect(sections.map((s) => s.key)).toEqual(["behavioral"]);
  });
});

describe("questionInPlanSection", () => {
  it("matches interviewer questions by category and candidate questions to the closing round", () => {
    expect(questionInPlanSection({ category: "behavioral", audience: "candidate" }, "behavioral")).toBe(true);
    expect(questionInPlanSection({ category: "company", audience: "ask_interviewer_company" }, "company")).toBe(false);
    expect(questionInPlanSection({ category: "company", audience: "ask_interviewer_company" }, "ask_interviewer")).toBe(
      true
    );
  });
});

describe("isPlanSectionKey", () => {
  it("accepts categories and the closing round only", () => {
    expect(isPlanSectionKey("behavioral")).toBe(true);
    expect(isPlanSectionKey("ask_interviewer")).toBe(true);
    expect(isPlanSectionKey("candidate")).toBe(false);
  });
});
