import { Router } from "express";
import pool from "../db";
import { requireAuth } from "../auth";

const router = Router();

// GET /api/pathways — list all pathways with course count
router.get("/", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.id, p.name, p.description, p.sort_order,
              COUNT(pc.course_id) AS courseCount
       FROM pathways p
       LEFT JOIN pathway_courses pc ON pc.pathway_id = p.id
       GROUP BY p.id
       ORDER BY p.sort_order, p.id`
    ) as [Array<{ id: number; name: string; description: string | null; sort_order: number; courseCount: number }>, unknown];

    res.json(rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      sortOrder: r.sort_order,
      courseCount: Number(r.courseCount),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// GET /api/pathways/:id — single pathway with full course details
router.get("/:id", async (req, res) => {
  try {
    const [pathwayRows] = await pool.query(
      `SELECT id, name, description, sort_order FROM pathways WHERE id = ?`,
      [req.params.id]
    ) as [Array<{ id: number; name: string; description: string | null; sort_order: number }>, unknown];

    if (pathwayRows.length === 0) { res.status(404).json({ error: "Not found" }); return; }

    const [courseRows] = await pool.query(
      `SELECT pc.course_id, pc.role, pc.sort_order, c.name, c.credits
       FROM pathway_courses pc
       JOIN courses c ON c.id = pc.course_id
       WHERE pc.pathway_id = ?
       ORDER BY FIELD(pc.role, 'essential', 'elective', 'capstone'), pc.sort_order`,
      [req.params.id]
    ) as [Array<{ course_id: string; role: string; sort_order: number; name: string; credits: number }>, unknown];

    const p = pathwayRows[0];
    res.json({
      id: p.id,
      name: p.name,
      description: p.description,
      sortOrder: p.sort_order,
      courses: courseRows.map((c) => ({
        courseId: c.course_id,
        role: c.role,
        sortOrder: c.sort_order,
        name: c.name,
        credits: c.credits,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// POST /api/pathways — create pathway
router.post("/", requireAuth, async (req, res) => {
  const { name, description, sortOrder } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  try {
    const [result] = await pool.query(
      `INSERT INTO pathways (name, description, sort_order) VALUES (?, ?, ?)`,
      [name, description ?? null, sortOrder ?? 0]
    ) as [{ insertId: number }, unknown];
    res.status(201).json({ id: (result as { insertId: number }).insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// PUT /api/pathways/:id — update pathway
router.put("/:id", requireAuth, async (req, res) => {
  const { name, description, sortOrder } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  try {
    await pool.query(
      `UPDATE pathways SET name = ?, description = ?, sort_order = ? WHERE id = ?`,
      [name, description ?? null, sortOrder ?? 0, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// DELETE /api/pathways/:id — delete pathway (CASCADE removes pathway_courses)
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await pool.query(`DELETE FROM pathways WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// POST /api/pathways/:id/courses — add or update a course in a pathway
router.post("/:id/courses", requireAuth, async (req, res) => {
  const { courseId, role, sortOrder } = req.body;
  if (!courseId || !role) { res.status(400).json({ error: "courseId and role are required" }); return; }
  if (!["essential", "elective", "capstone"].includes(role)) {
    res.status(400).json({ error: "role must be essential, elective, or capstone" }); return;
  }
  try {
    await pool.query(
      `INSERT INTO pathway_courses (pathway_id, course_id, role, sort_order)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE role = VALUES(role), sort_order = VALUES(sort_order)`,
      [req.params.id, courseId, role, sortOrder ?? 0]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// DELETE /api/pathways/:id/courses/:courseId — remove a course from a pathway
router.delete("/:id/courses/:courseId", requireAuth, async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM pathway_courses WHERE pathway_id = ? AND course_id = ?`,
      [req.params.id, req.params.courseId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

export default router;
