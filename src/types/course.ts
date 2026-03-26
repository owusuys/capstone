export interface Course {
  id: string;
  name: string;
  credits: number;
  prerequisitesRaw: string | null;
  notes: string | null;
  corequisites: string[];
  isCS: boolean;
}

export interface PrereqEdge {
  source: string;
  target: string;
  gradeReq: string | null;
}

export type HighlightMode = "fail" | "plan";

export interface CourseData {
  courses: Course[];
  edges: PrereqEdge[];
}
