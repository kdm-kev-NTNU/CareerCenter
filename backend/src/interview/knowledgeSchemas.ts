import {
  caseSourceKinds,
  caseStyles,
  DEFAULT_RESEARCH_MODEL,
  interviewModes,
  knowledgeDocKinds,
  MAX_CLARIFICATIONS_PER_ROUND,
  MAX_CURATED_QUESTIONS,
  MIN_CURATED_QUESTIONS,
  prepFormats,
  researchModels,
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
  format: z.enum(prepFormats).default("interview"),
  researchModel: z.enum(researchModels).default(DEFAULT_RESEARCH_MODEL),
  jobAdText: z.string().max(20_000).default("")
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

const reportText = (max: number) => z.string().max(max);
const reportBullet = (max = 200) => z.string().min(1).max(max);

export const companyReportSchema = z.object({
  headline: reportText(120).default(""),
  keyFacts: z
    .object({
      industry: reportText(80).optional(),
      headquarters: reportText(80).optional(),
      size: reportText(80).optional(),
      ownership: reportText(80).optional()
    })
    .default({}),
  aboutCompany: reportText(450).default(""),
  businessAreas: z.array(reportBullet()).max(4).default([]),
  strategyAndNews: z.array(reportBullet(200)).max(4).default([]),
  cultureAndValues: z.array(reportBullet()).max(4).default([]),
  roleInContext: reportText(350).default(""),
  jobAdRequirements: z
    .array(
      z.object({
        requirement: reportBullet(140),
        howToShowFit: reportBullet(160)
      })
    )
    .max(5)
    .default([]),
  nicheInsights: z.array(reportBullet(180)).max(5).default([]),
  companyQuestionPrep: z
    .array(
      z.object({
        question: reportBullet(160),
        answerAngle: reportBullet(220),
        nicheHooks: z.array(reportBullet(100)).max(3).default([])
      })
    )
    .max(5)
    .default([]),
  interviewAngles: z.array(reportBullet(180)).max(4).default([]),
  questionsToAsk: z.array(reportBullet(160)).max(4).default([]),
  sources: z.array(reportBullet(160)).max(5).default([])
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

export const bankQuestionExtractSchema = z.object({
  questions: z
    .array(
      z.object({
        text: z.string().min(1),
        category: z.enum(questionCategories).optional()
      })
    )
    .default([])
});

export const patchPlanQuestionSchema = z.object({
  text: z.string().min(1).optional(),
  category: z.enum(questionCategories).optional(),
  notes: z.string().optional(),
  included: z.boolean().optional()
});

export const addPlanQuestionSchema = z.object({
  text: z.string().min(1),
  category: z.enum(questionCategories),
  target: z.enum(questionTargets).optional(),
  notes: z.string().optional(),
  included: z.boolean().optional()
});

export const reorderPlanQuestionsSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1)
});

export const voiceSessionBodySchema = z.object({
  sessionId: z.string().min(1)
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
