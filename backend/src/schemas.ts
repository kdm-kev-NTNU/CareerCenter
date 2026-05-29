import {
  careerTracks,
  competitionFormats,
  competitionScopes,
  competitionStatuses,
  competitionTypes,
  courseStatuses,
  learningStatuses
} from "@careercenter/shared";
import { z } from "zod";

const optionalDateField = z
  .union([z.string(), z.null()])
  .optional()
  .refine(
    (value) => {
      if (value === undefined || value === null || value === "") return true;
      const parsed = new Date(value);
      return !Number.isNaN(parsed.getTime());
    },
    { message: "Ugyldig dato." }
  )
  .transform((value) => {
    if (!value || value === "") return null;
    return new Date(value);
  });

const applicationUrlField = z
  .union([z.string().url({ message: "Ugyldig søknads-URL." }), z.literal("")])
  .default("");

const optionalUrlField = z
  .union([z.string().url(), z.literal(""), z.null()])
  .optional()
  .transform((value) => (value ? value || undefined : undefined));

export const courseSchema = z.object({
  semester: z.union([z.literal(7), z.literal(8), z.literal(9), z.literal(10)]),
  courseCode: z.string().min(1),
  title: z.string().min(1),
  credits: z.number().min(0).max(60),
  status: z.enum(courseStatuses),
  notes: z.string().default(""),
  trackTags: z.array(z.enum(careerTracks)).default([]),
  sortOrder: z.number().int().default(0)
});

export const mapNodeSchema = z.object({
  title: z.string().min(1),
  items: z.array(z.string().min(1))
});

export const trackSchema = z.object({
  label: z.string().min(1)
});

const companyDifficulties = ["Medium", "Medium/high", "High", "Very high"] as const;
const companyUpsides = ["High", "Very high"] as const;

export const companySchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  tracks: z.array(z.enum(careerTracks)).min(1),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  geography: z.string().min(1),
  roleTypes: z.array(z.string().min(1)).min(1),
  difficulty: z.enum(companyDifficulties),
  upside: z.enum(companyUpsides),
  relevanceScore: z.number().int().min(0).max(100),
  websiteUrl: optionalUrlField
});

export const competitionSchema = z.object({
  title: z.string().min(1),
  type: z.enum(competitionTypes),
  scope: z.enum(competitionScopes),
  format: z.enum(competitionFormats).default("hybrid"),
  startDate: optionalDateField,
  endDate: optionalDateField,
  registrationDeadline: optionalDateField,
  location: z.string().default(""),
  organizer: z.string().default(""),
  url: z
    .union([z.string().url(), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  status: z.enum(competitionStatuses),
  notes: z.string().default(""),
  sortOrder: z.number().int().default(0)
});

export const selfStudyCourseSchema = z.object({
  title: z.string().min(1),
  provider: z.string().min(1),
  status: z.enum(learningStatuses),
  url: optionalUrlField,
  notes: z.string().default(""),
  completedAt: optionalDateField,
  sortOrder: z.number().int().default(0)
});

export const educationBookSchema = z.object({
  title: z.string().min(1),
  author: z.union([z.string().min(1), z.literal(""), z.null()]).optional().transform((value) => (value ? value || undefined : undefined)),
  status: z.enum(learningStatuses),
  url: optionalUrlField,
  notes: z.string().default(""),
  sortOrder: z.number().int().default(0)
});

export const learningPlatformSchema = z.object({
  name: z.string().min(1),
  url: optionalUrlField,
  notes: z.string().default(""),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0)
});

export const bachelorKnowledgeSchema = z.object({
  courseName: z.string().min(1),
  topic: z.string().min(1),
  notes: z.string().default(""),
  sortOrder: z.number().int().default(0)
});

export const bachelorFolderSchema = z.object({
  name: z.string().min(1).max(200),
  parentId: z.union([z.string().min(1), z.null()]).optional(),
  sortOrder: z.number().int().default(0)
});

export const bachelorFileUpdateSchema = z.object({
  originalName: z.string().min(1).max(200).optional(),
  folderId: z.union([z.string().min(1), z.null()]).optional(),
  notes: z.string().optional(),
  sortOrder: z.number().int().optional()
});

export const catalogLabelSchema = z.object({
  label: z.string().min(1),
  sortOrder: z.number().int().optional(),
  description: z.string().default("")
});

export const internshipRequirementItemSchema = z.object({
  requirementTypeId: z.string().min(1),
  isRequired: z.boolean().default(true),
  isDone: z.boolean().default(false),
  notes: z.string().default("")
});

export const graduateProgramRequirementItemSchema = z.object({
  requirementTypeId: z.string().min(1),
  isRequired: z.boolean().default(true),
  isDone: z.boolean().default(false),
  notes: z.string().default("")
});

const boardPositionSchema = z.object({
  x: z.number(),
  y: z.number()
});

const boardViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number()
});

const boardTrackField = z.enum(careerTracks).optional();

const boardCompanyDataSchema = z.object({
  companyId: z.string().min(1),
  note: z.string().optional(),
  track: boardTrackField
});

const boardMilestoneDataSchema = z.object({
  label: z.string().min(1),
  track: boardTrackField
});

const boardNoteDataSchema = z.object({
  text: z.string().min(1)
});

const boardNodeSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1),
    type: z.literal("company"),
    position: boardPositionSchema,
    data: boardCompanyDataSchema
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("milestone"),
    position: boardPositionSchema,
    data: boardMilestoneDataSchema
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("note"),
    position: boardPositionSchema,
    data: boardNoteDataSchema
  })
]);

const boardEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string().optional()
});

export const boardGraphSchema = z.object({
  nodes: z.array(boardNodeSchema),
  edges: z.array(boardEdgeSchema)
});

export const boardCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  graph: boardGraphSchema.optional(),
  isDefault: z.boolean().optional()
});

export const boardUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  viewport: boardViewportSchema.nullable().optional(),
  graph: boardGraphSchema.optional(),
  isDefault: z.boolean().optional()
});

export const internshipSchema = z.object({
  companyId: z.union([z.string().min(1), z.null()]).optional(),
  companyName: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(""),
  applicationUrl: applicationUrlField,
  notes: z.string().default(""),
  deadline: optionalDateField,
  statusId: z.string().min(1),
  locationIds: z.array(z.string()).default([]),
  trackTags: z.array(z.enum(careerTracks)).default([]),
  requirements: z.array(internshipRequirementItemSchema).default([])
});

export const graduateProgramSchema = z.object({
  companyId: z.union([z.string().min(1), z.null()]).optional(),
  companyName: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(""),
  applicationUrl: applicationUrlField,
  notes: z.string().default(""),
  deadline: optionalDateField,
  statusId: z.string().min(1),
  locationIds: z.array(z.string()).default([]),
  trackTags: z.array(z.enum(careerTracks)).default([]),
  requirements: z.array(graduateProgramRequirementItemSchema).default([])
});

export const authCredentialsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Navn må være minst 2 tegn.")
    .max(32, "Navn kan ikke være lengre enn 32 tegn.")
    .regex(/^[a-zA-ZæøåÆØÅ0-9 _.-]+$/, "Navn inneholder ugyldige tegn."),
  pin: z
    .string()
    .regex(/^\d{4,6}$/, "Pinkoden må være 4–6 siffer.")
});
