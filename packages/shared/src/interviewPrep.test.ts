import { describe, expect, it } from "vitest";
import { abilityTestKinds } from "./abilityTests.js";
import {
  caseFrameworkSteps,
  DEFAULT_RESEARCH_MODEL,
  interviewModes,
  isResearchModel,
  knowledgeDocKinds,
  canDeleteImportJob,
  prepPlanStatuses,
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

describe("ability test constants", () => {
  it("defines ability test kinds", () => {
    expect(abilityTestKinds).toEqual(["switch_challenge", "scales_clx"]);
  });
});
