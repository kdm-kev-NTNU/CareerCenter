import { describe, expect, it } from "vitest";
import { abilityTestKinds } from "./abilityTests.js";
import {
  caseFrameworkSteps,
  interviewModes,
  knowledgeDocKinds,
  prepPlanStatuses,
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
  });

  it("defines case framework steps", () => {
    expect(caseFrameworkSteps).toEqual(["avklar", "avgrens", "hypoteser", "undersok", "los", "forebygg"]);
  });

  it("defines prep plan statuses", () => {
    expect(prepPlanStatuses).toContain("awaiting_answers");
    expect(prepPlanStatuses).toContain("ready");
  });
});

describe("ability test constants", () => {
  it("defines ability test kinds", () => {
    expect(abilityTestKinds).toEqual(["switch_challenge", "scales_clx"]);
  });
});
