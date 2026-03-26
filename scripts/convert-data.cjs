const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const wb = XLSX.readFile(path.join(__dirname, "..", "Course Data.xlsx"));
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws);

// Extract all course codes from a prerequisite string
function extractCourseCodes(prereqStr) {
  if (!prereqStr) return [];
  const matches = prereqStr.match(/[A-Z]+\s+\d+[A-Z]?/g);
  return matches ? [...new Set(matches)] : [];
}

// Parse grade requirements from notes
function parseGradeReqs(notes) {
  if (!notes) return {};
  const gradeReqs = {};
  // Match patterns like "Grade of C or better required in CS prerequisite 3114"
  // or "Grade of C or better in CS 3114"
  const patterns = [
    /[Gg]rade of ([A-Z][+-]?) or better (?:required )?in (?:CS )?(?:pre-?requisites? )?(\d+(?:\s*and\s*\d+)*)/g,
    /[Gg]rade of ([A-Z][+-]?) or better in ([A-Z]+\s+\d+)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(notes)) !== null) {
      const grade = match[1];
      const courseRefs = match[2];
      // Handle "2506 and 2114" or "CS 3114"
      const nums = courseRefs.match(/\d+/g);
      if (nums) {
        for (const num of nums) {
          gradeReqs[`CS ${num}`] = grade;
        }
      }
    }
  }
  return gradeReqs;
}

// Build course list
const csCourseCodes = new Set(rows.map((r) => r.course_code));
const externalCourses = new Set();
const edges = [];

const courses = rows.map((row) => {
  const prereqCodes = extractCourseCodes(row.prerequisites);
  const gradeReqs = parseGradeReqs(row.notes);

  // Also extract corequisites from notes for display
  const coreqs = [];
  if (row.notes) {
    const coreqMatch = row.notes.match(/[Cc]orequisite:\s*(.+?)(?:\.|$)/);
    if (coreqMatch) {
      const coreqCodes = extractCourseCodes(coreqMatch[1]);
      coreqs.push(...coreqCodes);
    }
  }

  // Create edges and track external courses
  for (const prereq of prereqCodes) {
    if (!csCourseCodes.has(prereq)) {
      externalCourses.add(prereq);
    }
    edges.push({
      source: prereq,
      target: row.course_code,
      gradeReq: gradeReqs[prereq] || null,
    });
  }

  return {
    id: row.course_code,
    name: row.course_name,
    credits: row.credits,
    prerequisitesRaw: row.prerequisites || null,
    notes: row.notes || null,
    corequisites: coreqs,
    isCS: true,
  };
});

// Add external course nodes
for (const ext of externalCourses) {
  courses.push({
    id: ext,
    name: ext,
    credits: 0,
    prerequisitesRaw: null,
    notes: null,
    corequisites: [],
    isCS: false,
  });
}

const output = { courses, edges };
const outPath = path.join(__dirname, "..", "src", "data", "courses.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(
  `Wrote ${courses.length} courses (${csCourseCodes.size} CS + ${externalCourses.size} external) and ${edges.length} edges to ${outPath}`
);
