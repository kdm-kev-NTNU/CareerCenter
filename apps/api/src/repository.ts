import type { CareerPath, CareerPathStep, CareerTrack, Company, CoursePlan, CourseStatus, UserProfile } from "@careercenter/shared";

export interface RegisterUserInput {
  email: string;
  passwordHash: string;
}

export interface StoredUser extends UserProfile {
  passwordHash: string;
}

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

export interface Repository {
  findUserByEmail(email: string): Promise<StoredUser | null>;
  createUser(input: RegisterUserInput): Promise<UserProfile>;
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

