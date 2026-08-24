import {
  aiResourceConfigFormats,
  aiResourceExportTargets,
  aiResourceKinds,
  aiResourceStatuses,
  aiResourceTargetTools,
  careerTracks,
  competitionFormats,
  competitionScopes,
  competitionStatuses,
  competitionTypes,
  courseStatuses,
  learningStatuses,
  thesisCompanySources,
  thesisCompanyStatuses
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

const potentialSecretPattern = /(sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9_]{16,}|github_pat_[A-Za-z0-9_]{16,}|xox[baprs]-[A-Za-z0-9-]{16,}|AKIA[0-9A-Z]{16})/;

const noPotentialSecret = (value: string) => !potentialSecretPattern.test(value);

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

export const trackSchema = z.object({
  label: z.string().min(1)
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

export const thesisCompanySchema = z.object({
  companyName: z.string().min(1, "Bedriftsnavn er obligatorisk."),
  topicArea: z.string().default(""),
  status: z.enum(thesisCompanyStatuses).default("known"),
  source: z.enum(thesisCompanySources).default("other"),
  location: z.string().default(""),
  contactPerson: z.string().default(""),
  websiteUrl: z
    .union([z.string().url(), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  targetSemester: z
    .union([z.literal(7), z.literal(8), z.literal(9), z.literal(10), z.null()])
    .optional()
    .transform((value) => value ?? null),
  trackTags: z.array(z.enum(careerTracks)).default([]),
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

export const aiResourceSchema = z.object({
  name: z.string().trim().min(1).max(200),
  kind: z.enum(aiResourceKinds),
  targetTools: z.array(z.enum(aiResourceTargetTools)).min(1).default(["cursor"]),
  status: z.enum(aiResourceStatuses).default("draft"),
  tags: z.array(z.string().trim().min(1).max(60)).default([]),
  installPath: z.string().trim().max(260).default(""),
  content: z.string().default("").refine(noPotentialSecret, {
    message: "Innholdet ser ut til å inneholde en hemmelig nøkkel. Bruk env-placeholder i stedet."
  }),
  frontmatter: z.record(z.unknown()).default({}),
  configFormat: z.enum(aiResourceConfigFormats).default("markdown"),
  notes: z.string().default(""),
  folderPath: z.string().trim().max(160).default("Inbox"),
  isStarred: z.boolean().default(false),
  usageCount: z.number().int().min(0).default(0),
  lastUsedAt: z.union([z.string().datetime(), z.null()]).optional(),
  sourcePath: z.string().trim().max(260).optional()
});

export const aiResourceImportSchema = z.object({
  files: z.array(z.object({
    fileName: z.string().trim().min(1).max(260),
    content: z.string().refine(noPotentialSecret, {
      message: "Innholdet ser ut til å inneholde en hemmelig nøkkel. Bruk env-placeholder i stedet."
    })
  })).min(1).max(25)
});

export const aiResourceSyncRequestSchema = z.object({
  target: z.enum(aiResourceExportTargets).default("all"),
  cwd: z.string().trim().min(1).max(500),
  force: z.boolean().optional().default(false)
});

export const aiResourceScanRequestSchema = z.object({
  cwd: z.string().trim().min(1).max(500)
});

export const bachelorKnowledgeSchema = z.object({
  folderId: z.union([z.string().min(1), z.null()]).optional(),
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
  description: z.string().default(""),
  kind: z.enum(["stage", "outcome"]).optional()
});

export const catalogReorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1)
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

export const internshipSchema = z.object({
  companyName: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(""),
  applicationUrl: applicationUrlField,
  notes: z.string().default(""),
  deadline: optionalDateField,
  statusId: z.string().min(1),
  stageIds: z.array(z.string().min(1)).min(1),
  locationIds: z.array(z.string()).default([]),
  trackTags: z.array(z.enum(careerTracks)).default([]),
  requirements: z.array(internshipRequirementItemSchema).default([])
});

export const graduateProgramSchema = z.object({
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
