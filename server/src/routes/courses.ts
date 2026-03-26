import { Router } from "express";
import pool from "../db";
import { requireAuth } from "../auth";

const router = Router();

// GET /api/courses — all courses with their corequisite arrays
router.get("/", async (_req, res) => {
  try {
    const [courses] = await pool.query(
      "SELECT id, name, credits, prerequisites_raw, notes, is_cs FROM courses ORDER BY id"
    );

    const [coreqRows] = await pool.query(
      "SELECT course_id, coreq_id FROM corequisites"
    ) as [Array<{ course_id: string; coreq_id: string }>, unknown];

    const coreqMap = new Map<string, string[]>();
    for (const row of coreqRows) {
      if (!coreqMap.has(row.course_id)) coreqMap.set(row.course_id, []);
      coreqMap.get(row.course_id)!.push(row.coreq_id);
    }

    const result = (courses as Array<{
      id: string; name: string; credits: number;
      prerequisites_raw: string | null; notes: string | null; is_cs: number;
    }>).map((c) => ({
      id: c.id,
      name: c.name,
      credits: c.credits,
      prerequisitesRaw: c.prerequisites_raw,
      notes: c.notes,
      isCS: c.is_cs === 1,
      corequisites: coreqMap.get(c.id) ?? [],
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// GET /api/courses/:id
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, credits, prerequisites_raw, notes, is_cs FROM courses WHERE id = ?",
      [req.params.id]
    ) as [Array<{ id: string; name: string; credits: number; prerequisites_raw: string | null; notes: string | null; is_cs: number }>, unknown];

    if (rows.length === 0) { res.status(404).json({ error: "Not found" }); return; }

    const [coreqRows] = await pool.query(
      "SELECT coreq_id FROM corequisites WHERE course_id = ?",
      [req.params.id]
    ) as [Array<{ coreq_id: string }>, unknown];

    const c = rows[0];
    res.json({
      id: c.id, name: c.name, credits: c.credits,
      prerequisitesRaw: c.prerequisites_raw, notes: c.notes, isCS: c.is_cs === 1,
      corequisites: coreqRows.map((r) => r.coreq_id),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// POST /api/courses — create
router.post("/", requireAuth, async (req, res) => {
  const { id, name, credits, prerequisitesRaw, notes, isCS } = req.body;
  if (!id || !name) { res.status(400).json({ error: "id and name are required" }); return; }
  try {
    await pool.query(
      "INSERT INTO courses (id, name, credits, prerequisites_raw, notes, is_cs) VALUES (?, ?, ?, ?, ?, ?)",
      [id, name, credits ?? 3, prerequisitesRaw ?? null, notes ?? null, isCS ? 1 : 0]
    );
    res.status(201).json({ id });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "ER_DUP_ENTRY") { res.status(409).json({ error: "Course ID already exists" }); return; }
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// PUT /api/courses/:id — update
router.put("/:id", requireAuth, async (req, res) => {
  const { name, credits, prerequisitesRaw, notes, isCS } = req.body;
  try {
    await pool.query(
      "UPDATE courses SET name=?, credits=?, prerequisites_raw=?, notes=?, is_cs=? WHERE id=?",
      [name, credits ?? 3, prerequisitesRaw ?? null, notes ?? null, isCS ? 1 : 0, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// DELETE /api/courses/:id
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM courses WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

export default router;
