import {
  caseSourceKinds,
  caseStyles,
  interviewModes,
  knowledgeDocKinds,
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
  )
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
  prepPlanId: z.string().optional()
});

export const sessionMessageSchema = z.object({
  content: z.string().min(1)
});

export const curatedQuestionSchema = z.object({
  text: z.string(),
  category: z.enum(questionCategories),
  target: z.enum(questionTargets)
});

export const curatedPlanSchema = z.object({
  questions: z.array(curatedQuestionSchema),
  tasks: z.array(
    z.object({
      title: z.string(),
      description: z.string().default("")
    })
  )
});

export const clarificationListSchema = z.object({
  clarifications: z.array(z.object({ question: z.string() }))
});
