export const interviewModes = ["behavioral_mock", "case_oral", "concept_tutor"] as const;
export type InterviewMode = (typeof interviewModes)[number];

export const knowledgeDocKinds = [
  "core",
  "star",
  "case",
  "company",
  "firm_profile",
  "tech_topics",
  "practice",
  "strengths_weaknesses",
  "finance",
  "ki",
  "brainteasers",
  "partner",
  "other"
] as const;
export type KnowledgeDocKind = (typeof knowledgeDocKinds)[number];

export const starRubricCriteria = [
  "openingAndStructure",
  "situationAndTask",
  "action",
  "result",
  "learning",
  "ownership",
  "tempoAndLength",
  "relevance"
] as const;
export type StarRubricCriterion = (typeof starRubricCriteria)[number];

export const starRubricCriterionLabels: Record<StarRubricCriterion, string> = {
  openingAndStructure: "Innledning og struktur",
  situationAndTask: "Situasjon og oppgave",
  action: "Handling",
  result: "Resultat",
  learning: "Læring",
  ownership: "Eierskap",
  tempoAndLength: "Tempo og lengde",
  relevance: "Relevans"
};

export const caseFrameworkSteps = ["avklar", "avgrens", "hypoteser", "undersok", "los", "forebygg"] as const;
export type CaseFrameworkStep = (typeof caseFrameworkSteps)[number];

export const caseFrameworkStepLabels: Record<CaseFrameworkStep, string> = {
  avklar: "Avklar",
  avgrens: "Avgrens",
  hypoteser: "Hypoteser",
  undersok: "Undersøk",
  los: "Løs",
  forebygg: "Forebygg"
};

export const prepPlanStatuses = [
  "draft",
  "researching",
  "awaiting_answers",
  "curating",
  "ready",
  "failed"
] as const;
export type PrepPlanStatus = (typeof prepPlanStatuses)[number];

export const prepFormats = ["interview", "video_application", "case", "ability_test"] as const;
export type PrepFormat = (typeof prepFormats)[number];

export const questionTargets = ["interview", "video", "both"] as const;
export type QuestionTarget = (typeof questionTargets)[number];

export const questionCategories = ["behavioral", "technical", "motivation", "company", "case"] as const;
export type QuestionCategory = (typeof questionCategories)[number];

export const caseSourceKinds = ["casebook", "single_case", "exhibit_pack", "topic_list", "mini_cases"] as const;
export type CaseSourceKind = (typeof caseSourceKinds)[number];

export const caseStyles = ["interviewer_led", "candidate_led"] as const;
export type CaseStyle = (typeof caseStyles)[number];

export const prepQuestionSources = ["bank", "generated"] as const;
export type PrepQuestionSource = (typeof prepQuestionSources)[number];

export const caseApprovalStatuses = ["pending", "approved", "rejected"] as const;
export type CaseApprovalStatus = (typeof caseApprovalStatuses)[number];

export const importJobStatuses = ["queued", "running", "review", "done", "failed"] as const;
export type ImportJobStatus = (typeof importJobStatuses)[number];
