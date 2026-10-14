import type {
  InterviewKnowledgeDocDto,
  InterviewMessageDto,
  InterviewPrepPlanDto,
  InterviewSessionDto,
  InterviewSimulatorSettingsDto
} from "@careercenter/shared";
import type {
  InterviewKnowledgeDoc,
  InterviewMessageRecord,
  InterviewPrepPlanRecord,
  InterviewSessionRecord,
  InterviewSimulatorSettingsRecord
} from "../interviewPrepRepository.js";

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

export function toPrepPlanDto(plan: InterviewPrepPlanRecord): InterviewPrepPlanDto {
  return {
    id: plan.id,
    companyName: plan.companyName,
    roleTitle: plan.roleTitle,
    format: plan.format,
    status: plan.status,
    researchNotes: plan.researchNotes,
    failureReason: plan.failureReason,
    clarifications: plan.clarifications,
    questions: plan.questions,
    tasks: plan.tasks,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt
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
