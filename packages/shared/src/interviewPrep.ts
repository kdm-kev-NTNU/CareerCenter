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

/** Categories for questions an interviewer asks the candidate. */
export const questionCategories = [
  "behavioral",
  "situational",
  "motivation",
  "personal",
  "technical",
  "case",
  "brainteaser",
  "company"
] as const;
export type QuestionCategory = (typeof questionCategories)[number];

export const questionCategoryLabels: Record<QuestionCategory, string> = {
  behavioral: "Atferd (STAR)",
  situational: "Situasjon",
  motivation: "Motivasjon",
  personal: "Personlig",
  technical: "Faglig/teknisk",
  case: "Case",
  brainteaser: "Brainteaser/estimering",
  company: "Selskapskunnskap"
};

/** Who asks the question: the interviewer asks the candidate, or the candidate asks the interviewer. */
export const questionAudiences = ["candidate", "ask_interviewer_personal", "ask_interviewer_company"] as const;
export type QuestionAudience = (typeof questionAudiences)[number];

export const questionAudienceLabels: Record<QuestionAudience, string> = {
  candidate: "Spørsmål til meg",
  ask_interviewer_personal: "Jeg spør: personlig",
  ask_interviewer_company: "Jeg spør: om bedriften"
};

export function isQuestionAudience(value: string): value is QuestionAudience {
  return (questionAudiences as readonly string[]).includes(value);
}

/** Questions the candidate asks the interviewer always use a fixed category. */
export function categoryForAudience(audience: QuestionAudience, category: QuestionCategory): QuestionCategory {
  if (audience === "ask_interviewer_company") return "company";
  if (audience === "ask_interviewer_personal") return "personal";
  return category;
}

export const bankQuestionStatuses = ["active", "discarded"] as const;
export type BankQuestionStatus = (typeof bankQuestionStatuses)[number];

export const bankQuestionOrigins = ["rule", "llm", "split", "manual"] as const;
export type BankQuestionOrigin = (typeof bankQuestionOrigins)[number];

export const questionDiscardReasons = [
  "instruks_til_intervjuer",
  "tips",
  "selvrefleksjon",
  "mal",
  "duplikat",
  "ikke_sporsmal",
  "manuelt"
] as const;
export type QuestionDiscardReason = (typeof questionDiscardReasons)[number];

export const questionDiscardReasonLabels: Record<QuestionDiscardReason, string> = {
  instruks_til_intervjuer: "Instruks til intervjuer",
  tips: "Tips/råd",
  selvrefleksjon: "Selvrefleksjon",
  mal: "Mal/standardsvar",
  duplikat: "Duplikat",
  ikke_sporsmal: "Ikke et spørsmål",
  manuelt: "Forkastet manuelt"
};

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

export const importJobKinds = ["cases", "questions", "questions_cleanup"] as const;
export type ImportJobKind = (typeof importJobKinds)[number];

export const importJobKindLabels: Record<ImportJobKind, string> = {
  cases: "Case-import",
  questions: "Spørsmålsuttrekk",
  questions_cleanup: "KI-opprydding"
};
