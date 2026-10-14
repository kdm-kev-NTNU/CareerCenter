import type { InterviewCaseEntryDto, InterviewCasePublicDto } from "@careercenter/shared";
import type { InterviewCaseEntryRecord } from "../interviewPrepRepository.js";

export function toPublicCaseDto(entry: InterviewCaseEntryRecord): InterviewCasePublicDto {
  return {
    id: entry.id,
    title: entry.title,
    prompt: entry.prompt,
    sourceKind: entry.sourceKind,
    caseStyle: entry.caseStyle,
    companyTags: entry.companyTags,
    knowledgeDocId: entry.knowledgeDocId,
    approvalStatus: entry.approvalStatus,
    originalFileKey: entry.originalFileKey,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
}

export function toFullCaseDto(entry: InterviewCaseEntryRecord): InterviewCaseEntryDto {
  return {
    ...toPublicCaseDto(entry),
    interviewerInfo: entry.interviewerInfo,
    solution: entry.solution
  };
}
