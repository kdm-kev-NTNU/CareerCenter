export const careerTracks = [
  "ENERGY_QUANT",
  "AI_CONSULTING",
  "VENTURE_PE_AI_OPS",
  "INVESTMENT_TECH",
  "INDUSTRIAL_AI"
] as const;

export type CareerTrack = (typeof careerTracks)[number];

export const trackLabels: Record<CareerTrack, string> = {
  ENERGY_QUANT: "Energy, Power Trading & Quant",
  AI_CONSULTING: "Tech Consulting / AI Strategy",
  VENTURE_PE_AI_OPS: "Tech Venture, PE, Growth Equity, AI Ops",
  INVESTMENT_TECH: "Investment Technology",
  INDUSTRIAL_AI: "Industrial AI"
};

export interface CareerTrackSetting {
  id: CareerTrack;
  label: string;
  sortOrder: number;
}

export const careerTrackDefaults: CareerTrackSetting[] = careerTracks.map((track, index) => ({
  id: track,
  label: trackLabels[track],
  sortOrder: index
}));

export const courseStatuses = ["planned", "considering", "confirmed", "completed"] as const;
export type CourseStatus = (typeof courseStatuses)[number];

export const learningStatuses = ["planned", "in_progress", "completed"] as const;
export type LearningStatus = (typeof learningStatuses)[number];

export const aiResourceKinds = [
  "cursor_rule",
  "cursor_skill",
  "codex_instruction",
  "codex_skill",
  "mcp_server",
  "prompt_snippet",
  "workflow_checklist"
] as const;
export type AiResourceKind = (typeof aiResourceKinds)[number];

export const aiResourceTargetTools = ["cursor", "codex"] as const;
export type AiResourceTargetTool = (typeof aiResourceTargetTools)[number];

export const aiResourceStatuses = ["draft", "active", "needs_review", "archived"] as const;
export type AiResourceStatus = (typeof aiResourceStatuses)[number];

export const aiResourceConfigFormats = ["markdown", "mdc", "json", "toml", "plain"] as const;
export type AiResourceConfigFormat = (typeof aiResourceConfigFormats)[number];

export const aiResourceExportTargets = ["cursor", "codex", "all"] as const;
export type AiResourceExportTarget = (typeof aiResourceExportTargets)[number];

export const aiResourceWriteStrategies = [
  "replace",
  "managed_markdown_block",
  "json_mcp_merge",
  "toml_managed_block"
] as const;
export type AiResourceWriteStrategy = (typeof aiResourceWriteStrategies)[number];

export interface AiResource {
  id: string;
  name: string;
  kind: AiResourceKind;
  targetTools: AiResourceTargetTool[];
  status: AiResourceStatus;
  tags: string[];
  installPath: string;
  content: string;
  frontmatter: Record<string, unknown>;
  configFormat: AiResourceConfigFormat;
  notes: string;
  folderPath: string;
  isStarred: boolean;
  usageCount: number;
  lastUsedAt?: string | null;
  sourcePath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiResourceImportFile {
  fileName: string;
  content: string;
}

export interface AiResourceImportRejectedFile {
  fileName: string;
  message: string;
}

export interface AiResourceImportResult {
  created: AiResource[];
  updated: AiResource[];
  rejected: AiResourceImportRejectedFile[];
}

export interface AiResourceExportFile {
  path: string;
  content: string;
  resourceIds: string[];
  resourceNames: string[];
  writeStrategy: AiResourceWriteStrategy;
}

export interface AiResourceExportBundle {
  target: AiResourceExportTarget;
  files: AiResourceExportFile[];
}

export const aiResourceSyncActions = ["create", "update", "noop", "conflict"] as const;
export type AiResourceSyncAction = (typeof aiResourceSyncActions)[number];

export interface AiResourceSyncFileResult {
  path: string;
  action: AiResourceSyncAction;
  writeStrategy: AiResourceWriteStrategy;
  message?: string;
}

export interface AiResourceSyncResult {
  dryRun: boolean;
  target: AiResourceExportTarget;
  cwd: string;
  files: AiResourceSyncFileResult[];
  conflicts: Array<{ path: string; message: string }>;
  rejected: Array<{ path: string; message: string }>;
}

export interface AiResourceScanResult {
  created: AiResource[];
  updated: AiResource[];
  rejected: Array<{ fileName: string; message: string }>;
  scanned: number;
}

export interface SelfStudyCourse {
  id: string;
  title: string;
  provider: string;
  status: LearningStatus;
  url?: string;
  notes: string;
  completedAt?: string;
  sortOrder: number;
}

export interface EducationBook {
  id: string;
  title: string;
  author?: string;
  status: LearningStatus;
  url?: string;
  notes: string;
  sortOrder: number;
}

export interface LearningPlatform {
  id: string;
  name: string;
  url?: string;
  notes: string;
  isActive: boolean;
  sortOrder: number;
}

export interface BachelorKnowledge {
  id: string;
  folderId: string | null;
  courseName: string;
  topic: string;
  notes: string;
  sortOrder: number;
}

export interface BachelorFolder {
  id: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export interface BachelorFolderTreeNode extends BachelorFolder {
  children: BachelorFolderTreeNode[];
}

export interface BachelorFile {
  id: string;
  folderId: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  notes: string;
  sortOrder: number;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
}

export interface CoursePlan {
  id: string;
  semester: 7 | 8 | 9 | 10;
  courseCode: string;
  title: string;
  credits: number;
  status: CourseStatus;
  notes: string;
  trackTags: CareerTrack[];
  sortOrder: number;
}

export function assertSemester(value: number): 7 | 8 | 9 | 10 {
  if ([7, 8, 9, 10].includes(value)) {
    return value as 7 | 8 | 9 | 10;
  }
  throw new Error("Semester må være 7, 8, 9 eller 10.");
}

export const competitionTypes = ["hackathon", "competition", "case_competition", "datathon", "other"] as const;
export type CompetitionType = (typeof competitionTypes)[number];

export const competitionScopes = ["NORWAY", "NORDICS", "EUROPE", "GLOBAL"] as const;
export type CompetitionScope = (typeof competitionScopes)[number];

export const competitionFormats = ["online", "onsite", "hybrid"] as const;
export type CompetitionFormat = (typeof competitionFormats)[number];

export const competitionStatuses = [
  "watching",
  "considering",
  "registered",
  "participating",
  "completed",
  "won",
  "dropped"
] as const;
export type CompetitionStatus = (typeof competitionStatuses)[number];

export const competitionTypeLabels: Record<CompetitionType, string> = {
  hackathon: "Hackathon",
  competition: "Konkurranse",
  case_competition: "Case-konkurranse",
  datathon: "Datathon",
  other: "Annet"
};

export const competitionScopeLabels: Record<CompetitionScope, string> = {
  NORWAY: "Norge",
  NORDICS: "Norden",
  EUROPE: "Europa",
  GLOBAL: "Globalt"
};

export const competitionFormatLabels: Record<CompetitionFormat, string> = {
  online: "Online",
  onsite: "Fysisk",
  hybrid: "Hybrid"
};

export const competitionStatusLabels: Record<CompetitionStatus, string> = {
  watching: "Følger med",
  considering: "Vurderer",
  registered: "Påmeldt",
  participating: "Deltar",
  completed: "Fullført",
  won: "Vant / plassering",
  dropped: "Avsluttet"
};

export interface CompetitionEntry {
  id: string;
  title: string;
  type: CompetitionType;
  scope: CompetitionScope;
  format: CompetitionFormat;
  startDate?: string;
  endDate?: string;
  registrationDeadline?: string;
  location: string;
  organizer: string;
  url?: string;
  status: CompetitionStatus;
  notes: string;
  sortOrder: number;
}

export const thesisCompanyStatuses = [
  "known",
  "interested",
  "contacted",
  "confirmed",
  "not_relevant"
] as const;
export type ThesisCompanyStatus = (typeof thesisCompanyStatuses)[number];

export const thesisCompanySources = ["network", "internship", "university", "website", "other"] as const;
export type ThesisCompanySource = (typeof thesisCompanySources)[number];

export const thesisCompanyStatusLabels: Record<ThesisCompanyStatus, string> = {
  known: "Kjent mulighet",
  interested: "Interessert",
  contacted: "Kontaktet",
  confirmed: "Avtale på plass",
  not_relevant: "Ikke aktuelt"
};

export const thesisCompanySourceLabels: Record<ThesisCompanySource, string> = {
  network: "Nettverk",
  internship: "Internship / erfaring",
  university: "NTNU / fakultet",
  website: "Bedriftens nettside",
  other: "Annet"
};

export interface ThesisCompany {
  id: string;
  companyName: string;
  topicArea: string;
  status: ThesisCompanyStatus;
  source: ThesisCompanySource;
  location: string;
  contactPerson: string;
  websiteUrl?: string;
  targetSemester?: 7 | 8 | 9 | 10;
  trackTags: CareerTrack[];
  notes: string;
  sortOrder: number;
}

export {
  internshipStatusKinds,
  isInternshipStage,
  internshipTemplateStageIds
} from "./internshipStatus.js";
export type { InternshipStatusKind, InternshipStatusOption } from "./internshipStatus.js";

export {
  interviewModes,
  knowledgeDocKinds,
  starRubricCriteria,
  starRubricCriterionLabels,
  caseFrameworkSteps,
  caseFrameworkStepLabels,
  prepPlanStatuses,
  prepFormats,
  questionTargets,
  questionCategories,
  caseSourceKinds,
  caseStyles,
  prepQuestionSources,
  caseApprovalStatuses,
  importJobStatuses
} from "./interviewPrep.js";
export type {
  InterviewMode,
  KnowledgeDocKind,
  StarRubricCriterion,
  CaseFrameworkStep,
  PrepPlanStatus,
  PrepFormat,
  QuestionTarget,
  QuestionCategory,
  CaseSourceKind,
  CaseStyle,
  PrepQuestionSource,
  CaseApprovalStatus,
  ImportJobStatus
} from "./interviewPrep.js";

export { inferKnowledgeKind, classifyCaseSource } from "./interviewKnowledge.js";
export type { InferKnowledgeKindInput, ClassifyCaseSourceInput } from "./interviewKnowledge.js";

export type {
  InterviewKnowledgeDocDto,
  InterviewCasePublicDto,
  InterviewCaseEntryDto,
  InterviewBankQuestionDto,
  InterviewPrepClarificationDto,
  InterviewPrepQuestionDto,
  InterviewPrepPlanCaseDto,
  InterviewPrepTaskDto,
  InterviewPrepPlanDto,
  InterviewImportJobDto,
  InterviewSimulatorSettingsDto,
  InterviewSessionDto,
  InterviewMessageDto,
  InterviewSessionFeedbackDto
} from "./interviewPrepDtos.js";

export {
  extractBankQuestions,
  rankBankQuestions,
  findRepeatedStories
} from "./questionBank.js";
export type {
  ExtractableKnowledgeDoc,
  ExtractedBankQuestion,
  RankableBankQuestion,
  BankQuestionRankProfile
} from "./questionBank.js";
export { answerStats } from "./answerStats.js";
export type { AnswerStats } from "./answerStats.js";
export { emptyCompanyProfile } from "./companyProfile.js";
export type { CompanyProfile } from "./companyProfile.js";

export { abilityTestKinds } from "./abilityTests.js";
export type { AbilityTestKind } from "./abilityTests.js";
export {
  createSeededRng,
  generateSwitchChallenge,
  isCorrectSwitchAnswer,
  SWITCH_SYMBOLS
} from "./switchChallenge.js";
export type { SwitchChallengePuzzle, SwitchOperator, SwitchSymbol } from "./switchChallenge.js";
export { generateScalesClx, isCorrectClxSelection } from "./scalesClx.js";
export type { ClxCell, ClxColor, ClxGrid, ClxShape, ScalesClxPuzzle } from "./scalesClx.js";
export { CLX_SHAPE_COLOR } from "./scalesClx.js";
export {
  transitionPrepPlan,
  canStartSimulators,
  prepPlanPipelineSteps,
  parsePrepPlanPipelineStep,
  prepPlanStepVisual,
  isPrepPlanPipelineActive,
  MAX_CLARIFICATION_ROUNDS,
  MAX_CLARIFICATIONS_PER_ROUND,
  MIN_CURATED_QUESTIONS,
  MAX_CURATED_QUESTIONS
} from "./prepPlanState.js";
export type { PrepPlanEvent, PrepPlanPipelineStep, PrepPlanStepVisual } from "./prepPlanState.js";
export {
  transitionVideoSim,
  canStartRecording,
  phaseNeedsCamera,
  phaseRevealsPrompt,
  videoSimStates
} from "./videoSimState.js";
export type { VideoSimState, VideoSimEvent } from "./videoSimState.js";
export {
  videoSimulatorSettingsSchema,
  defaultVideoSimulatorSettings
} from "./videoSimulatorSettings.js";
export type { VideoSimulatorSettings } from "./videoSimulatorSettings.js";
export {
  weakestStoryQueue,
  averageStarSum,
  storyToAnkiRow,
  storiesToAnkiCsv,
  emptyStarScores
} from "./storyBank.js";
export type { StoryScoreSnapshot, StoryWithScores, AnkiStoryRow } from "./storyBank.js";
export type {
  InterviewStoryBankEntryDto,
  InterviewStoryScoreDto,
  InterviewCaseRepertoireLogDto,
  InterviewAbilityTestAttemptDto,
  InterviewVideoSettingsDto,
  InterviewVideoRunDto,
  VoiceSessionDto
} from "./interviewMeccaDtos.js";
export { rankCasesForCompany } from "./rankCases.js";
export type { CaseRankProfile, RankableCase } from "./rankCases.js";
import type { InternshipStatusOption } from "./internshipStatus.js";

export interface InternshipLocationOption {
  id: string;
  label: string;
  sortOrder: number;
}

export interface InternshipRequirementType {
  id: string;
  label: string;
  description: string;
  sortOrder: number;
}

export interface InternshipRequirementItem {
  id: string;
  requirementTypeId: string;
  label?: string;
  description?: string;
  isRequired: boolean;
  isDone: boolean;
  notes: string;
}

export interface Internship {
  id: string;
  companyName: string;
  title: string;
  description: string;
  applicationUrl: string;
  notes: string;
  deadline?: string;
  statusId: string;
  status?: InternshipStatusOption;
  stageIds: string[];
  locationIds: string[];
  locations?: InternshipLocationOption[];
  trackTags: CareerTrack[];
  requirements: InternshipRequirementItem[];
  createdAt: string;
  updatedAt: string;
}

export interface InternshipSettings {
  statuses: InternshipStatusOption[];
  locations: InternshipLocationOption[];
  requirementTypes: InternshipRequirementType[];
}

export interface GraduateProgramStatusOption {
  id: string;
  label: string;
  sortOrder: number;
}

export interface GraduateProgramLocationOption {
  id: string;
  label: string;
  sortOrder: number;
}

export interface GraduateProgramRequirementType {
  id: string;
  label: string;
  description: string;
  sortOrder: number;
}

export interface GraduateProgramRequirementItem {
  id: string;
  requirementTypeId: string;
  label?: string;
  description?: string;
  isRequired: boolean;
  isDone: boolean;
  notes: string;
}

export interface GraduateProgram {
  id: string;
  companyName: string;
  title: string;
  description: string;
  applicationUrl: string;
  notes: string;
  deadline?: string;
  statusId: string;
  status?: GraduateProgramStatusOption;
  locationIds: string[];
  locations?: GraduateProgramLocationOption[];
  trackTags: CareerTrack[];
  requirements: GraduateProgramRequirementItem[];
  createdAt: string;
  updatedAt: string;
}

export interface GraduateProgramSettings {
  statuses: GraduateProgramStatusOption[];
  locations: GraduateProgramLocationOption[];
  requirementTypes: GraduateProgramRequirementType[];
}
