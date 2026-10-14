import {
  emptyCompanyProfile,
  findRepeatedStories,
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
    tags: row.tags,
    contentHash: row.contentHash,
    createdAt: row.createdAt
  };
}

export function toPrepPlanDto(plan: InterviewPrepPlanRecord): InterviewPrepPlanDto {
  return {
    id: plan.id,
    companyName: plan.companyName,
    roleTitle: plan.roleTitle,
    format: plan.format,
    status: plan.status,
    pipelineStep: plan.pipelineStep,
    researchNotes: plan.researchNotes,
    companyProfile: parseCompanyProfile(plan.companyProfileJson),
    clarificationRound: plan.clarificationRound,
    failureReason: plan.failureReason,
    clarifications: plan.clarifications,
    questions: plan.questions.map((q) => ({
      id: q.id,
      text: q.text,
      category: q.category,
      target: q.target,
      sortOrder: q.sortOrder,
      source: q.source,
      bankQuestionId: q.bankQuestionId,
      storyId: q.storyId,
      gapReason: q.gapReason
    })),
    tasks: plan.tasks,
    recommendedCases: plan.recommendedCases,
    repeatedStoryIds: findRepeatedStories(plan.questions),
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt
  };
}

export function toImportJobDto(job: InterviewImportJobRecord): InterviewImportJobDto {
  return {
    id: job.id,
    knowledgeDocId: job.knowledgeDocId,
    status: job.status,
    progress: job.progress,
    message: job.message,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  };
}

export function toSimulatorSettingsDto(settings: InterviewSimulatorSettingsRecord): InterviewSimulatorSettingsDto {
  return {
    mode: settings.mode,
    companyName: settings.companyName,
    tone: settings.tone,
    language: settings.language,
    essentialsSheet: settings.essentialsSheet
  };
}

export function toSessionDto(session: InterviewSessionRecord): InterviewSessionDto {
  return {
    id: session.id,
    mode: session.mode,
    title: session.title,
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
