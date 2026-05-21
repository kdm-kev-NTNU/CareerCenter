import type { CareerMapNode, CareerPath, CareerPathStep, CareerTrack, CareerTrackSetting, Company, CoursePlan, CourseStatus, UserProfile } from "@careercenter/shared";

export const SINGLE_USER_EMAIL = "local@careercenter.app";

export interface CourseInput {
  semester: 7 | 8 | 9 | 10;
  courseCode: string;
  title: string;
  credits: number;
  status: CourseStatus;
  notes: string;
  trackTags: CareerTrack[];
  sortOrder: number;
}

export interface CompanyQuery {
  q?: string;
  track?: CareerTrack;
  tier?: number;
  geography?: string;
}

export interface PathInput {
  name: string;
  description: string;
  targetRole: string;
  horizon: string;
  steps: Array<Omit<CareerPathStep, "id" | "company">>;
}

export interface CareerMapNodeInput {
  title: string;
  items: string[];
}

export interface CareerTrackInput {
  label: string;
}

export interface Repository {
  getOrCreateSingleUser(): Promise<UserProfile>;
  getCareerMap(): Promise<{ nodes: CareerMapNode[]; tracks: CareerTrackSetting[] }>;
  updateCareerMapNode(id: string, input: CareerMapNodeInput): Promise<CareerMapNode | null>;
  resetCareerMapNode(id: string): Promise<CareerMapNode | null>;
  listCareerTracks(): Promise<CareerTrackSetting[]>;
  updateCareerTrack(id: CareerTrack, input: CareerTrackInput): Promise<CareerTrackSetting | null>;
  resetCareerTrack(id: CareerTrack): Promise<CareerTrackSetting | null>;
  listCourses(userId: string): Promise<CoursePlan[]>;
  createCourse(userId: string, input: CourseInput): Promise<CoursePlan>;
  updateCourse(userId: string, id: string, input: CourseInput): Promise<CoursePlan | null>;
  deleteCourse(userId: string, id: string): Promise<boolean>;
  listCompanies(query: CompanyQuery): Promise<Company[]>;
  listPaths(userId: string): Promise<CareerPath[]>;
  getPath(userId: string, id: string): Promise<CareerPath | null>;
  createPath(userId: string, input: PathInput): Promise<CareerPath>;
  updatePath(userId: string, id: string, input: PathInput): Promise<CareerPath | null>;
  deletePath(userId: string, id: string): Promise<boolean>;
}
