import { Router } from "express";
import pool from "../db";
import { requireAuth } from "../auth";

const router = Router();

// POST /api/corequisites — add a corequisite pair
router.post("/", requireAuth, async (req, res) => {
  const { courseId, coreqId } = req.body;
  if (!courseId || !coreqId) { res.status(400).json({ error: "courseId and coreqId required" }); return; }
  try {
    await pool.query(
      "INSERT IGNORE INTO corequisites (course_id, coreq_id) VALUES (?, ?)",
      [courseId, coreqId]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// DELETE /api/corequisites/:courseId/:coreqId
router.delete("/:courseId/:coreqId", requireAuth, async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM corequisites WHERE course_id = ? AND coreq_id = ?",
      [req.params.courseId, req.params.coreqId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

export default router;
