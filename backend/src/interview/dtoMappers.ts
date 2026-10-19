import {
  emptyCompanyProfile,
  findRepeatedStories,
  resolveEssentialsSheet,
  type CandidateBackgroundDto,
  type CompanyProfile,
  type InterviewBankQuestionDto,
  type InterviewImportJobDto,
  type InterviewKnowledgeDocDto,
  type InterviewMessageDto,
  type InterviewPrepPlanDto,
  type InterviewSessionDto,
  type InterviewSimulatorSettingsDto
} from "@careercenter/shared";
import type {
  CandidateBackgroundRecord,
  InterviewBankQuestionRecord,
  InterviewImportJobRecord,
  InterviewKnowledgeDoc,
  InterviewMessageRecord,
  InterviewPrepPlanRecord,
  InterviewSessionRecord,
  InterviewSimulatorSettingsRecord
} from "../interviewPrepRepository.js";
import { companyProfileSchema } from "./knowledgeSchemas.js";

export function toKnowledgeDocDto(doc: InterviewKnowledgeDoc): InterviewKnowledgeDocDto {
  return {
    id: doc.id,
    kind: doc.kind,
    title: doc.title,
    content: doc.content,
    sourceFilename: doc.sourceFilename,
    contentHash: doc.contentHash,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  };
}

export function toBankQuestionDto(row: InterviewBankQuestionRecord): InterviewBankQuestionDto {
  return {
    id: row.id,
    knowledgeDocId: row.knowledgeDocId,
    text: row.text,
    category: row.category,
    audience: row.audience,
    status: row.status,
    discardReason: row.discardReason,
    origin: row.origin,
    sourceText: row.sourceText,
    tags: row.tags,
    contentHash: row.contentHash,
    cleanedAt: row.cleanedAt,
    createdAt: row.createdAt
  };
}

export function toCandidateBackgroundDto(
  row: CandidateBackgroundRecord | null
): CandidateBackgroundDto {
  if (!row) {
    return {
      cvText: "",
      cvFileName: "",
      cvUpdatedAt: null,
      transcriptText: "",
      transcriptFileName: "",
      transcriptUpdatedAt: null,
      notes: "",
      updatedAt: null
    };
  }
  return {
    cvText: row.cvText,
    cvFileName: row.cvFileName,
    cvUpdatedAt: row.cvUpdatedAt,
    transcriptText: row.transcriptText,
    transcriptFileName: row.transcriptFileName,
    transcriptUpdatedAt: row.transcriptUpdatedAt,
    notes: row.notes,
    updatedAt: row.updatedAt
  };
}

export function toPrepPlanDto(plan: InterviewPrepPlanRecord): InterviewPrepPlanDto {
  return {
    id: plan.id,
    companyName: plan.companyName,
    roleTitle: plan.roleTitle,
    format: plan.format,
    researchModel: plan.researchModel,
    status: plan.status,
    pipelineStep: plan.pipelineStep,
    jobAdText: plan.jobAdText,
    researchNotes: plan.researchNotes,
    companyProfile: parseCompanyProfile(plan.companyProfileJson),
    clarificationRound: plan.clarificationRound,
    curationFilledCount: plan.curationFilledCount,
    failureReason: plan.failureReason,
    clarifications: plan.clarifications,
    questions: plan.questions.map((q) => ({
      id: q.id,
      text: q.text,
      category: q.category,
      audience: q.audience,
      target: q.target,
      sortOrder: q.sortOrder,
      source: q.source,
      bankQuestionId: q.bankQuestionId,
      storyId: q.storyId,
      gapReason: q.gapReason,
      included: q.included,
      notes: q.notes,
      exampleAnswer: q.exampleAnswer,
      tips: q.tips
    })),
    repeatedStoryIds: findRepeatedStories(plan.questions),
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt
  };
}

export function toImportJobDto(job: InterviewImportJobRecord): InterviewImportJobDto {
  return {
    id: job.id,
    knowledgeDocId: job.knowledgeDocId,
    kind: job.kind,
    status: job.status,
    progress: job.progress,
    message: job.message,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  };
}

export function toSimulatorSettingsDto(settings: InterviewSimulatorSettingsRecord): InterviewSimulatorSettingsDto {
  const essentials = resolveEssentialsSheet(settings.mode, settings.essentialsSheet);
  return {
    mode: settings.mode,
    companyName: settings.companyName,
    tone: settings.tone,
    language: settings.language,
    essentialsSheet: essentials.text,
    essentialsIsDefault: essentials.isDefault
  };
}

export function toSessionDto(session: InterviewSessionRecord): InterviewSessionDto {
  return {
    id: session.id,
    mode: session.mode,
    title: session.title,
    prepPlanId: session.prepPlanId,
    planSection: session.planSection,
    finishedAt: session.finishedAt,
    feedback: session.feedback,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  };
}

export function toMessageDto(message: InterviewMessageRecord): InterviewMessageDto {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt
  };
}

function parseCompanyProfile(json: string): CompanyProfile {
  try {
    return companyProfileSchema.parse(JSON.parse(json || "{}"));
  } catch {
    return emptyCompanyProfile();
  }
}

