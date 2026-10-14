import {
  caseSourceKinds,
  caseStyles,
  interviewModes,
  knowledgeDocKinds,
  MAX_CLARIFICATIONS_PER_ROUND,
  MAX_CURATED_QUESTIONS,
  MIN_CURATED_QUESTIONS,
  prepFormats,
  questionCategories,
  questionTargets
} from "@careercenter/shared";
import { z } from "zod";

export const knowledgeDocInputSchema = z.object({
  kind: z.enum(knowledgeDocKinds).optional(),
  title: z.string().min(1),
  content: z.string().default("")
});

export const caseEntryInputSchema = z.object({
  title: z.string().min(1),
  prompt: z.string().default(""),
  interviewerInfo: z.string().default(""),
  solution: z.string().default(""),
  sourceKind: z.enum(caseSourceKinds).optional(),
  caseStyle: z.enum(caseStyles).optional(),
  companyTags: z.array(z.string()).default([]),
  knowledgeDocId: z.string().optional()
});

export const prepPlanIntakeSchema = z.object({
  companyName: z.string().min(1),
  roleTitle: z.string().default(""),
  format: z.enum(prepFormats).default("interview")
});

export const clarificationAnswersSchema = z.object({
  answers: z.array(
    z.object({
      id: z.string(),
      answer: z.string()
    })
  ),
  skip: z.boolean().optional().default(false)
});

export const simulatorSettingsSchema = z.object({
  mode: z.enum(interviewModes),
  companyName: z.string().default(""),
  tone: z.string().default("profesjonell"),
  language: z.string().default("nb"),
  essentialsSheet: z.string().default("")
});

export const createSessionSchema = z.object({
  mode: z.enum(interviewModes),
  title: z.string().default(""),
  prepPlanId: z.string().optional(),
  caseEntryId: z.string().optional()
});

export const sessionMessageSchema = z.object({
  content: z.string().min(1)
});

export const companyProfileSchema = z.object({
  industries: z.array(z.string()).default([]),
  businessAreas: z.array(z.string()).default([]),
  interviewFormats: z.array(z.string()).default([]),
  caseTypes: z.array(z.string()).default([]),
  values: z.array(z.string()).default([]),
  themes: z.array(z.string()).default([]),
  summary: z.string().default("")
});

export const clarificationListSchema = z.object({
  clarifications: z
    .array(z.object({ question: z.string().min(1) }))
    .min(1)
    .max(MAX_CLARIFICATIONS_PER_ROUND)
});

export const curatedBankSelectionSchema = z.object({
  selectedQuestionIds: z.array(z.string()).min(MIN_CURATED_QUESTIONS).max(MAX_CURATED_QUESTIONS),
  generatedQuestions: z
    .array(
      z.object({
        text: z.string().min(1),
        category: z.enum(questionCategories),
        target: z.enum(questionTargets).default("interview"),
        gapReason: z.string().min(1)
      })
    )
    .default([]),
  tasks: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().default("")
      })
    )
    .default([])
});

export const caseSpanExtractSchema = z.object({
  title: z.string(),
  prompt: z.string(),
  interviewerInfo: z.string().default(""),
  solution: z.string().default("")
});

export const casebookSegmentSchema = z.object({
  cases: z.array(
    z.object({
      title: z.string(),
      prompt: z.string(),
      interviewerInfo: z.string().default(""),
      solution: z.string().default("")
    })
  )
});

export const exhibitPromptSchema = z.object({
  title: z.string(),
  prompt: z.string(),
  interviewerInfo: z.string().default(""),
  solution: z.string().default("")
});

export const replacePlanQuestionSchema = z.object({
  bankQuestionId: z.string().optional(),
  text: z.string().min(1).optional(),
  category: z.enum(questionCategories).optional(),
  target: z.enum(questionTargets).optional(),
  storyId: z.string().nullable().optional()
});
