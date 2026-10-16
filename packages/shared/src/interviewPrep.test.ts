import { describe, expect, it } from "vitest";
import { abilityTestKinds } from "./abilityTests.js";
import {
  bankQuestionOrigins,
  bankQuestionStatuses,
  categoryForAudience,
  caseFrameworkSteps,
  DEFAULT_RESEARCH_MODEL,
  interviewModes,
  isResearchModel,
  knowledgeDocKinds,
  canDeleteImportJob,
  importJobKindLabels,
  importJobKinds,
  isQuestionAudience,
  prepPlanStatuses,
  questionAudienceLabels,
  questionAudiences,
  questionCategories,
  questionCategoryLabels,
  questionDiscardReasonLabels,
  questionDiscardReasons,
  researchModelLabels,
  researchModels,
  starRubricCriteria,
  starRubricCriterionLabels
} from "./interviewPrep.js";

describe("interview prep constants", () => {
  it("defines interview modes", () => {
    expect(interviewModes).toEqual(["behavioral_mock", "case_oral", "concept_tutor"]);
  });

  it("defines knowledge doc kinds", () => {
    expect(knowledgeDocKinds).toContain("firm_profile");
    expect(knowledgeDocKinds).toContain("brainteasers");
  });

  it("defines STAR rubric with Norwegian labels for all criteria", () => {
    expect(starRubricCriteria).toHaveLength(8);
    for (const criterion of starRubricCriteria) {
      expect(starRubricCriterionLabels[criterion].length).toBeGreaterThan(0);
    }
    expect(starRubricCriterionLabels.openingAndStructure).toBe("Åpning og struktur");
    expect(starRubricCriterionLabels.learning).toBe("Lærdom");
  });

  it("defines case framework steps", () => {
    expect(caseFrameworkSteps).toEqual(["avklar", "avgrens", "hypoteser", "undersok", "los", "forebygg"]);
  });

  it("defines prep plan statuses", () => {
    expect(prepPlanStatuses).toContain("awaiting_answers");
    expect(prepPlanStatuses).toContain("ready");
  });

  it("defines research models with web search support", () => {
    expect(researchModels).toEqual([
      "gpt-6-astra",
      "gpt-6.1-sol",
      "gpt-6-luna",
      "gpt-5.5",
      "gpt-5.4"
    ]);
    expect(DEFAULT_RESEARCH_MODEL).toBe("gpt-6-astra");
    for (const model of researchModels) {
      expect(researchModelLabels[model].length).toBeGreaterThan(0);
      expect(isResearchModel(model)).toBe(true);
    }
    expect(isResearchModel("o3")).toBe(false);
    expect(isResearchModel("gpt-4o")).toBe(false);
  });

  it("allows deleting import jobs only after they have stopped or finished", () => {
    expect(canDeleteImportJob("cancelled")).toBe(true);
    expect(canDeleteImportJob("failed")).toBe(true);
    expect(canDeleteImportJob("done")).toBe(true);
    expect(canDeleteImportJob("review")).toBe(true);
    expect(canDeleteImportJob("queued")).toBe(false);
    expect(canDeleteImportJob("running")).toBe(false);
  });
});

describe("question taxonomy", () => {
  it("separates situational, personal and brainteaser questions from behavioral", () => {
    expect(questionCategories).toEqual([
      "behavioral",
      "situational",
      "motivation",
      "personal",
      "technical",
      "case",
      "brainteaser",
      "company"
    ]);
  });

  it("labels every category, audience, discard reason and job kind", () => {
    expect(Object.keys(questionCategoryLabels).sort()).toEqual([...questionCategories].sort());
    expect(Object.keys(questionAudienceLabels).sort()).toEqual([...questionAudiences].sort());
    expect(Object.keys(questionDiscardReasonLabels).sort()).toEqual([...questionDiscardReasons].sort());
    expect(Object.keys(importJobKindLabels).sort()).toEqual([...importJobKinds].sort());
    expect(importJobKinds).toContain("questions_cleanup");
    expect(questionAudienceLabels.ask_interviewer_personal).toBe("Jeg spør: personlig");
  });

  it("defines bank question statuses and origins", () => {
    expect(bankQuestionStatuses).toEqual(["active", "discarded"]);
    expect(bankQuestionOrigins).toEqual(["rule", "llm", "split", "manual"]);
  });

  it("forces the category of questions the candidate asks the interviewer", () => {
    expect(categoryForAudience("candidate", "situational")).toBe("situational");
    expect(categoryForAudience("ask_interviewer_company", "behavioral")).toBe("company");
    expect(categoryForAudience("ask_interviewer_personal", "technical")).toBe("personal");
  });

  it("recognises audiences", () => {
    expect(isQuestionAudience("candidate")).toBe(true);
    expect(isQuestionAudience("interviewer")).toBe(false);
  });
});

describe("ability test constants", () => {
  it("defines ability test kinds", () => {
    expect(abilityTestKinds).toEqual([
      "switch_challenge",
      "scales_clx",
      "scales_numerical",
      "scales_verbal",
      "scales_mta"
    ]);
  });
});
