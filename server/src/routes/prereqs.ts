import { Router } from "express";
import pool from "../db";
import { requireAuth } from "../auth";

const router = Router();

// GET /api/edges — flat {source, target, gradeReq}[] for the graph
router.get("/edges", async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT pgm.prereq_course_id AS source,
             pg.course_id         AS target,
             pgm.grade_req        AS gradeReq
      FROM   prerequisite_group_members pgm
      JOIN   prerequisite_groups pg ON pg.id = pgm.group_id
    `) as [Array<{ source: string; target: string; gradeReq: string | null }>, unknown];
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// GET /api/prerequisite-groups?courseId=X — groups + members for a course
router.get("/prerequisite-groups", async (req, res) => {
  const { courseId } = req.query;
  if (!courseId) { res.status(400).json({ error: "courseId required" }); return; }
  try {
    const [groups] = await pool.query(
      "SELECT id, group_index, notes FROM prerequisite_groups WHERE course_id = ? ORDER BY group_index",
      [courseId]
    ) as [Array<{ id: number; group_index: number; notes: string | null }>, unknown];

    const [members] = await pool.query(
      `SELECT pgm.group_id, pgm.prereq_course_id, pgm.grade_req
       FROM prerequisite_group_members pgm
       JOIN prerequisite_groups pg ON pg.id = pgm.group_id
       WHERE pg.course_id = ?`,
      [courseId]
    ) as [Array<{ group_id: number; prereq_course_id: string; grade_req: string | null }>, unknown];

    const membersByGroup = new Map<number, Array<{ courseId: string; gradeReq: string | null }>>();
    for (const m of members) {
      if (!membersByGroup.has(m.group_id)) membersByGroup.set(m.group_id, []);
      membersByGroup.get(m.group_id)!.push({ courseId: m.prereq_course_id, gradeReq: m.grade_req });
    }

    res.json(groups.map((g) => ({
      id: g.id,
      groupIndex: g.group_index,
      notes: g.notes,
      members: membersByGroup.get(g.id) ?? [],
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// POST /api/prerequisite-groups — create a group for a course
router.post("/prerequisite-groups", requireAuth, async (req, res) => {
  const { courseId, notes } = req.body;
  if (!courseId) { res.status(400).json({ error: "courseId required" }); return; }
  try {
    const [countRows] = await pool.query(
      "SELECT COUNT(*) as cnt FROM prerequisite_groups WHERE course_id = ?",
      [courseId]
    ) as [Array<{ cnt: number }>, unknown];
    const groupIndex = countRows[0].cnt;
    const [result] = await pool.query(
      "INSERT INTO prerequisite_groups (course_id, group_index, notes) VALUES (?, ?, ?)",
      [courseId, groupIndex, notes ?? null]
    ) as [{ insertId: number }, unknown];
    res.status(201).json({ id: (result as { insertId: number }).insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// DELETE /api/prerequisite-groups/:id
router.delete("/prerequisite-groups/:id", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM prerequisite_groups WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// POST /api/prerequisite-group-members — add a member to a group
router.post("/prerequisite-group-members", requireAuth, async (req, res) => {
  const { groupId, prereqCourseId, gradeReq } = req.body;
  if (!groupId || !prereqCourseId) { res.status(400).json({ error: "groupId and prereqCourseId required" }); return; }
  try {
    await pool.query(
      "INSERT IGNORE INTO prerequisite_group_members (group_id, prereq_course_id, grade_req) VALUES (?, ?, ?)",
      [groupId, prereqCourseId, gradeReq ?? null]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// DELETE /api/prerequisite-group-members/:groupId/:prereqId
router.delete("/prerequisite-group-members/:groupId/:prereqId", requireAuth, async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM prerequisite_group_members WHERE group_id = ? AND prereq_course_id = ?",
      [req.params.groupId, req.params.prereqId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

export default router;
