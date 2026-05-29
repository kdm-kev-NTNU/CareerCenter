import { careerMapApi } from "./careerMap.js";
import { companiesApi } from "./companies.js";
import { coursesApi } from "./courses.js";
import { competitionsApi } from "./competitions.js";
import { graduateProgramSettingsApi } from "./graduateProgramSettings.js";
import { graduateProgramsApi } from "./graduatePrograms.js";
import { internshipSettingsApi } from "./internshipSettings.js";
import { internshipsApi } from "./internships.js";
import { educationApi } from "./education.js";
import { boardsApi } from "./boards.js";

export const api = {
  ...careerMapApi,
  ...coursesApi,
  ...companiesApi,
  ...competitionsApi,
  ...internshipsApi,
  ...internshipSettingsApi,
  ...graduateProgramsApi,
  ...graduateProgramSettingsApi,
  ...educationApi,
  ...boardsApi
};

export { careerMapApi } from "./careerMap.js";
export { companiesApi } from "./companies.js";
export { coursesApi } from "./courses.js";
export { competitionsApi } from "./competitions.js";
export { graduateProgramSettingsApi } from "./graduateProgramSettings.js";
export { graduateProgramsApi } from "./graduatePrograms.js";
export { internshipSettingsApi } from "./internshipSettings.js";
export { internshipsApi } from "./internships.js";
export { boardsApi } from "./boards.js";
export { educationApi } from "./education.js";
export type { GraduateProgramQuery } from "./graduatePrograms.js";
export type { InternshipQuery } from "./internships.js";
export { request } from "./client.js";
export type {
  BachelorFileUpdatePayload,
  BachelorFolderPayload,
  BachelorKnowledgePayload,
  CatalogLabelPayload,
  CompanyPayload,
  CompetitionPayload,
  CoursePayload,
  EducationBookPayload,
  GraduateProgramPayload,
  GraduateProgramRequirementItemPayload,
  InternshipPayload,
  InternshipRequirementItemPayload,
  LearningPlatformPayload,
  MapNodePayload,
  SelfStudyCoursePayload,
  TrackPayload
} from "../types/index.js";
