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
  openingAndStructure: "Åpning og struktur",
  situationAndTask: "Situasjon og oppgave",
  action: "Handling",
  result: "Resultat",
  learning: "Lærdom",
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
  "failed",
  "cancelled"
] as const;
export type PrepPlanStatus = (typeof prepPlanStatuses)[number];

export const prepFormats = ["interview", "video_application", "case", "ability_test"] as const;
export type PrepFormat = (typeof prepFormats)[number];

/** Reasoning models that support Responses API web_search for prep-plan research. */
export const researchModels = [
  "gpt-6-astra",
  "gpt-6.1-sol",
  "gpt-6-luna",
  "gpt-5.5",
  "gpt-5.4"
] as const;
export type ResearchModel = (typeof researchModels)[number];

export const DEFAULT_RESEARCH_MODEL: ResearchModel = "gpt-6-astra";

export const researchModelLabels: Record<ResearchModel, string> = {
  "gpt-6-astra": "GPT-6 Astra — mest kapabel",
  "gpt-6.1-sol": "GPT-6.1 Sol — nær Astra, lavere kostnad",
  "gpt-6-luna": "GPT-6 Luna — rask og billig",
  "gpt-5.5": "GPT-5.5 — dypere nettsøk",
  "gpt-5.4": "GPT-5.4 — reasoning med web search"
};

export function isResearchModel(value: string): value is ResearchModel {
  return (researchModels as readonly string[]).includes(value);
}

export const questionTargets = ["interview", "video", "both"] as const;
export type QuestionTarget = (typeof questionTargets)[number];

export const questionCategories = ["behavioral", "technical", "motivation", "company", "case"] as const;
export type QuestionCategory = (typeof questionCategories)[number];

export const caseSourceKinds = ["casebook", "single_case", "exhibit_pack", "topic_list", "mini_cases"] as const;
export type CaseSourceKind = (typeof caseSourceKinds)[number];

export const caseStyles = ["interviewer_led", "candidate_led"] as const;
export type CaseStyle = (typeof caseStyles)[number];

export const prepQuestionSources = ["bank", "generated", "edited", "custom"] as const;
export type PrepQuestionSource = (typeof prepQuestionSources)[number];

export const caseApprovalStatuses = ["pending", "approved", "rejected"] as const;
export type CaseApprovalStatus = (typeof caseApprovalStatuses)[number];

export const importJobStatuses = ["queued", "running", "review", "done", "failed", "cancelled"] as const;
export type ImportJobStatus = (typeof importJobStatuses)[number];

/** Worker is finished. Queued and running jobs must be cancelled before they can be removed. */
export const deletableImportJobStatuses = ["review", "done", "failed", "cancelled"] as const satisfies readonly ImportJobStatus[];

const deletableImportJobStatusSet = new Set<ImportJobStatus>(deletableImportJobStatuses);

export function canDeleteImportJob(status: ImportJobStatus): boolean {
  return deletableImportJobStatusSet.has(status);
}

export const importJobKinds = ["cases", "questions"] as const;
export type ImportJobKind = (typeof importJobKinds)[number];
