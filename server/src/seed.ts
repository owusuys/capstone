/**
 * Seed script: reads src/data/courses.json and populates the MySQL database.
 * Run with: npm run seed
 *
 * Idempotent — uses INSERT IGNORE so it's safe to re-run.
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import pool from "./db";
import courseData from "../../src/data/courses.json";

interface Course {
  id: string;
  name: string;
  credits: number;
  prerequisitesRaw: string | null;
  notes: string | null;
  corequisites: string[];
  isCS: boolean;
}

interface Edge {
  source: string;
  target: string;
  gradeReq: string | null;
}

const data = courseData as { courses: Course[]; edges: Edge[] };

/**
 * Parse a prerequisitesRaw string into AND-of-OR groups.
 *
 * Handles patterns like:
 *   "(CS 2114 or ECE 3514) and (CS 2505 or ECE 2564)"
 *   "CS 1114"  (single prereq, no parens)
 *   "(CS 2506 and CS 2114) or (ECE 2564 and ECE 3574)"  (DNF — approximated as CNF)
 *
 * Returns: string[][] where outer = AND groups, inner = OR members within each group.
 */
function parsePrereqRaw(raw: string): string[][] {
  const trimmed = raw.trim();

  // Remove surrounding parens if the whole string is wrapped
  // e.g. "((A or B) and (C))" → "(A or B) and (C)"
  const unwrap = (s: string): string => {
    while (s.startsWith("(") && s.endsWith(")")) {
      // Check if these outer parens are balanced and wrap the whole string
      let depth = 0;
      let i = 0;
      for (; i < s.length - 1; i++) {
        if (s[i] === "(") depth++;
        else if (s[i] === ")") depth--;
        if (depth === 0) break;
      }
      if (i === s.length - 1) s = s.slice(1, -1).trim();
      else break;
    }
    return s;
  };

  const str = unwrap(trimmed);

  // Split on top-level " and " (ignore " and " inside parentheses)
  const splitTopLevel = (s: string, delimiter: string): string[] => {
    const parts: string[] = [];
    let depth = 0;
    let start = 0;
    const dl = delimiter.toLowerCase();
    for (let i = 0; i < s.length; i++) {
      if (s[i] === "(") depth++;
      else if (s[i] === ")") depth--;
      if (depth === 0 && s.slice(i, i + dl.length).toLowerCase() === dl) {
        parts.push(s.slice(start, i).trim());
        start = i + dl.length;
        i += dl.length - 1;
      }
    }
    parts.push(s.slice(start).trim());
    return parts.filter(Boolean);
  };

  // First try splitting by " and "
  const andParts = splitTopLevel(str, " and ");

  // For each AND part, strip parens and split by " or "
  const groups: string[][] = andParts.map((part) => {
    const inner = unwrap(part);
    return splitTopLevel(inner, " or ").map((m) => unwrap(m).trim()).filter(Boolean);
  });

  return groups.filter((g) => g.length > 0);
}

async function createTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS courses (
      id                VARCHAR(20)       PRIMARY KEY,
      name              VARCHAR(255)      NOT NULL,
      credits           TINYINT UNSIGNED  NOT NULL DEFAULT 3,
      prerequisites_raw TEXT              NULL,
      notes             TEXT              NULL,
      is_cs             TINYINT(1)        NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS prerequisite_groups (
      id          INT           AUTO_INCREMENT PRIMARY KEY,
      course_id   VARCHAR(20)   NOT NULL,
      group_index INT           NOT NULL DEFAULT 0,
      notes       TEXT          NULL,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS prerequisite_group_members (
      group_id          INT         NOT NULL,
      prereq_course_id  VARCHAR(20) NOT NULL,
      grade_req         VARCHAR(5)  NULL,
      PRIMARY KEY (group_id, prereq_course_id),
      FOREIGN KEY (group_id)         REFERENCES prerequisite_groups(id) ON DELETE CASCADE,
      FOREIGN KEY (prereq_course_id) REFERENCES courses(id)             ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS corequisites (
      course_id VARCHAR(20) NOT NULL,
      coreq_id  VARCHAR(20) NOT NULL,
      PRIMARY KEY (course_id, coreq_id),
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (coreq_id)  REFERENCES courses(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pathways (
      id          INT           AUTO_INCREMENT PRIMARY KEY,
      name        VARCHAR(100)  NOT NULL,
      description TEXT          NULL,
      sort_order  INT           NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pathway_courses (
      pathway_id  INT           NOT NULL,
      course_id   VARCHAR(20)   NOT NULL,
      role        ENUM('essential','elective','capstone') NOT NULL DEFAULT 'essential',
      sort_order  INT           NOT NULL DEFAULT 0,
      PRIMARY KEY (pathway_id, course_id),
      FOREIGN KEY (pathway_id) REFERENCES pathways(id)  ON DELETE CASCADE,
      FOREIGN KEY (course_id)  REFERENCES courses(id)   ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  console.log("Tables ready.");
}

async function seedCourses(): Promise<void> {
  let inserted = 0;
  for (const c of data.courses) {
    await pool.query(
      `INSERT IGNORE INTO courses (id, name, credits, prerequisites_raw, notes, is_cs)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [c.id, c.name, c.credits, c.prerequisitesRaw, c.notes, c.isCS ? 1 : 0]
    );
    inserted++;
  }
  console.log(`Inserted/skipped ${inserted} courses.`);
}

async function seedPrerequisites(): Promise<void> {
  // Build a lookup for gradeReq from the flat edges array
  const gradeMap = new Map<string, string | null>();
  for (const e of data.edges) {
    gradeMap.set(`${e.source}||${e.target}`, e.gradeReq);
  }

  // Build a set of all valid course IDs so we can skip unknown courses
  const allIds = new Set(data.courses.map((c) => c.id));

  let groupCount = 0;
  let memberCount = 0;

  for (const course of data.courses) {
    if (!course.prerequisitesRaw) continue;

    const groups = parsePrereqRaw(course.prerequisitesRaw);

    for (let gi = 0; gi < groups.length; gi++) {
      const members = groups[gi].filter((m) => allIds.has(m));
      if (members.length === 0) continue;

      const [result] = await pool.query(
        `INSERT INTO prerequisite_groups (course_id, group_index, notes)
         VALUES (?, ?, NULL)`,
        [course.id, gi]
      ) as [{ insertId: number }, unknown];

      const groupId = (result as { insertId: number }).insertId;
      groupCount++;

      for (const prereqId of members) {
        const gradeReq = gradeMap.get(`${prereqId}||${course.id}`) ?? null;
        await pool.query(
          `INSERT IGNORE INTO prerequisite_group_members (group_id, prereq_course_id, grade_req)
           VALUES (?, ?, ?)`,
          [groupId, prereqId, gradeReq]
        );
        memberCount++;
      }
    }
  }

  console.log(`Inserted ${groupCount} prerequisite groups, ${memberCount} members.`);
}

async function seedCorequisites(): Promise<void> {
  let count = 0;
  for (const course of data.courses) {
    for (const coreqId of course.corequisites) {
      await pool.query(
        `INSERT IGNORE INTO corequisites (course_id, coreq_id) VALUES (?, ?)`,
        [course.id, coreqId]
      );
      count++;
    }
  }
  console.log(`Inserted/skipped ${count} corequisite pairs.`);
}

const PATHWAY_SEED = [
  {
    name: "AI/ML Engineer",
    description: "Artificial Intelligence and Machine Learning Engineers build the tech that makes computers smart — from apps that know what song you'll love next to cars that drive themselves.",
    sortOrder: 0,
    courses: [
      { id: "CS 3114", role: "essential", sortOrder: 0 },
      { id: "CS 3214", role: "essential", sortOrder: 1 },
      { id: "CS 3304", role: "essential", sortOrder: 2 },
      { id: "CS 3604", role: "essential", sortOrder: 3 },
      { id: "CS 4104", role: "elective",  sortOrder: 0 },
      { id: "CS 3654", role: "elective",  sortOrder: 1 },
      { id: "CS 4654", role: "elective",  sortOrder: 2 },
      { id: "CS 4804", role: "elective",  sortOrder: 3 },
      { id: "CS 4824", role: "elective",  sortOrder: 4 },
      { id: "CS 4094", role: "capstone",  sortOrder: 0 },
    ],
  },
  {
    name: "HCI/UX Engineer",
    description: "Human Computer Interaction and User Experience Engineers design the tech people actually want to use — from sleek apps to immersive VR. They blend coding and creativity to make technology intuitive, engaging, and fun.",
    sortOrder: 1,
    courses: [
      { id: "CS 2104", role: "essential", sortOrder: 0 },
      { id: "CS 2114", role: "essential", sortOrder: 1 },
      { id: "CS 3214", role: "essential", sortOrder: 2 },
      { id: "CS 3604", role: "essential", sortOrder: 3 },
      { id: "CS 4104", role: "elective",  sortOrder: 0 },
      { id: "CS 3724", role: "elective",  sortOrder: 1 },
      { id: "CS 3744", role: "elective",  sortOrder: 2 },
      { id: "CS 4634", role: "elective",  sortOrder: 3 },
      { id: "CS 4204", role: "elective",  sortOrder: 4 },
      { id: "CS 4094", role: "capstone",  sortOrder: 0 },
    ],
  },
  {
    name: "Cybersecurity Engineer",
    description: "Cybersecurity Engineers defend the digital world. They protect networks, applications, and data from hackers, malware, and insider threats.",
    sortOrder: 2,
    courses: [
      { id: "CS 2104", role: "essential", sortOrder: 0 },
      { id: "CS 3114", role: "essential", sortOrder: 1 },
      { id: "CS 3214", role: "essential", sortOrder: 2 },
      { id: "CS 3604", role: "essential", sortOrder: 3 },
      { id: "CS 4104", role: "elective",  sortOrder: 0 },
      { id: "CS 3274", role: "elective",  sortOrder: 1 },
      { id: "CS 4224", role: "elective",  sortOrder: 2 },
      { id: "CS 4254", role: "elective",  sortOrder: 3 },
      { id: "CS 4264", role: "elective",  sortOrder: 4 },
      { id: "CS 4094", role: "capstone",  sortOrder: 0 },
    ],
  },
  {
    name: "Full Stack Developer",
    description: "Full Stack Developers build the apps you actually use — from sleek interfaces to the behind-the-scenes logic that makes them work. They bridge front-end and back-end, making sure the whole system runs smoothly from click to database.",
    sortOrder: 3,
    courses: [
      { id: "CS 2104", role: "essential", sortOrder: 0 },
      { id: "CS 2114", role: "essential", sortOrder: 1 },
      { id: "CS 3214", role: "essential", sortOrder: 2 },
      { id: "CS 3604", role: "essential", sortOrder: 3 },
      { id: "CS 4104", role: "elective",  sortOrder: 0 },
      { id: "CS 3704", role: "elective",  sortOrder: 1 },
      { id: "CS 3714", role: "elective",  sortOrder: 2 },
      { id: "CS 3754", role: "elective",  sortOrder: 3 },
      { id: "CS 4604", role: "elective",  sortOrder: 4 },
      { id: "CS 4094", role: "capstone",  sortOrder: 0 },
    ],
  },
  {
    name: "Social Impact Engineer",
    description: "Social Impact Engineers put people first. They use code to tackle real problems — from making apps accessible to fighting misinformation to building tools that strengthen communities.",
    sortOrder: 4,
    courses: [
      { id: "CS 2104",   role: "essential", sortOrder: 0 },
      { id: "CS 3114",   role: "essential", sortOrder: 1 },
      { id: "STAT 4705", role: "essential", sortOrder: 2 },
      { id: "CS 3604",   role: "essential", sortOrder: 3 },
      { id: "CS 4104",   role: "elective",  sortOrder: 0 },
      { id: "CS 3654",   role: "elective",  sortOrder: 1 },
      { id: "CS 3724",   role: "elective",  sortOrder: 2 },
      { id: "CS 4014",   role: "elective",  sortOrder: 3 },
      { id: "BIT 4604",  role: "elective",  sortOrder: 4 },
      { id: "CS 4094",   role: "capstone",  sortOrder: 0 },
    ],
  },
  {
    name: "Freestyler",
    description: "Freestylers don't fit in one box — and that's the point. You mix and match electives to design a CS journey that's yours alone. Whether you dive deep into a niche or spread wide across domains, you'll graduate ready to tackle a variety of challenges.",
    sortOrder: 5,
    courses: [
      { id: "CS 2104", role: "essential", sortOrder: 0 },
      { id: "CS 2505", role: "essential", sortOrder: 1 },
      { id: "CS 3114", role: "essential", sortOrder: 2 },
      { id: "CS 3604", role: "essential", sortOrder: 3 },
      { id: "CS 4094", role: "capstone",  sortOrder: 0 },
    ],
  },
] as const;

// Placeholder course data for non-CS courses referenced in pathways
const PATHWAY_PLACEHOLDER_COURSES: Array<{ id: string; name: string }> = [
  { id: "STAT 4705", name: "Probability and Statistics" },
  { id: "BIT 4604",  name: "Data Governance, Privacy, & Ethics" },
];

async function seedPathways(): Promise<void> {
  // Ensure placeholder courses exist (non-CS courses referenced in pathways)
  for (const c of PATHWAY_PLACEHOLDER_COURSES) {
    await pool.query(
      `INSERT IGNORE INTO courses (id, name, credits, is_cs) VALUES (?, ?, 3, 0)`,
      [c.id, c.name]
    );
  }

  let pathwayCount = 0;
  let courseCount = 0;

  for (const p of PATHWAY_SEED) {
    const [result] = await pool.query(
      `INSERT IGNORE INTO pathways (name, description, sort_order) VALUES (?, ?, ?)`,
      [p.name, p.description, p.sortOrder]
    ) as [{ insertId: number; affectedRows: number }, unknown];

    // If affectedRows is 0, pathway already exists — look up its id
    let pathwayId: number;
    if ((result as { affectedRows: number }).affectedRows === 0) {
      const [rows] = await pool.query(
        `SELECT id FROM pathways WHERE name = ?`, [p.name]
      ) as [Array<{ id: number }>, unknown];
      pathwayId = rows[0].id;
    } else {
      pathwayId = (result as { insertId: number }).insertId;
      pathwayCount++;
    }

    for (const c of p.courses) {
      await pool.query(
        `INSERT IGNORE INTO pathway_courses (pathway_id, course_id, role, sort_order) VALUES (?, ?, ?, ?)`,
        [pathwayId, c.id, c.role, c.sortOrder]
      );
      courseCount++;
    }
  }

  console.log(`Inserted/skipped ${pathwayCount} pathways, ${courseCount} pathway course entries.`);
}

async function main(): Promise<void> {
  console.log("Starting seed...");
  try {
    await createTables();
    await seedCourses();
    await seedPrerequisites();
    await seedCorequisites();
    await seedPathways();
    console.log("Seed complete.");
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
