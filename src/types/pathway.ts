export type PathwayCourseRole = "essential" | "elective" | "capstone";

export interface PathwayCourse {
  courseId: string;
  role: PathwayCourseRole;
  sortOrder: number;
  name: string;
  credits: number;
}

export interface Pathway {
  id: number;
  name: string;
  description: string | null;
  sortOrder: number;
  courses: PathwayCourse[];
}

export interface PathwaySummary {
  id: number;
  name: string;
  description: string | null;
  sortOrder: number;
  courseCount: number;
}
