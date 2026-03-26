import { useState } from "react";
import type { Course } from "../../types/course";

interface Props {
  courses: Course[];
  password: string;
  onRefresh: () => void;
}

export default function CoreqEditor({ courses, password, onRefresh }: Props) {
  const [newCourse, setNewCourse] = useState("");
  const [newCoreq, setNewCoreq] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Collect all corequisite pairs from the loaded courses data
  const pairs: Array<{ courseId: string; coreqId: string }> = [];
  for (const c of courses) {
    for (const cid of c.corequisites) {
      pairs.push({ courseId: c.id, coreqId: cid });
    }
  }

  const handleAdd = async () => {
    if (!newCourse || !newCoreq) { setError("Select both courses."); return; }
    if (newCourse === newCoreq) { setError("A course cannot be its own corequisite."); return; }
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/corequisites", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${password}` },
        body: JSON.stringify({ courseId: newCourse, coreqId: newCoreq }),
      });
      if (!r.ok) {
        const d = await r.json();
        setError(d.error ?? "Failed to add corequisite.");
        return;
      }
      setNewCourse("");
      setNewCoreq("");
      onRefresh();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (courseId: string, coreqId: string) => {
    await fetch(`/api/corequisites/${encodeURIComponent(courseId)}/${encodeURIComponent(coreqId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${password}` },
    });
    onRefresh();
  };

  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 4 }}>Corequisites</div>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
        Corequisites must be taken in the same semester as the target course.
      </div>

      {/* Add pair */}
      <div style={s.addCard}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "#374151" }}>Add Corequisite Pair</div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={s.label}>Course</label>
            <select style={s.select} value={newCourse} onChange={(e) => setNewCourse(e.target.value)}>
              <option value="">— select —</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.id} — {c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={s.label}>Corequisite</label>
            <select style={s.select} value={newCoreq} onChange={(e) => setNewCoreq(e.target.value)}>
              <option value="">— select —</option>
              {courses.filter((c) => c.id !== newCourse).map((c) => <option key={c.id} value={c.id}>{c.id} — {c.name}</option>)}
            </select>
          </div>
          <button style={{ ...s.addBtn, opacity: saving ? 0.6 : 1 }} onClick={handleAdd} disabled={saving}>
            {saving ? "Saving…" : "Add"}
          </button>
        </div>
        {error && <div style={{ color: "#dc2626", fontSize: 13, marginTop: 8 }}>{error}</div>}
      </div>

      {/* Table */}
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr style={s.thead}>
              <th style={s.th}>Course</th>
              <th style={s.th}>Corequisite</th>
              <th style={s.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map(({ courseId, coreqId }) => (
              <tr key={`${courseId}||${coreqId}`} style={s.tr}>
                <td style={{ ...s.td, fontFamily: "monospace", fontWeight: 600 }}>{courseId}</td>
                <td style={{ ...s.td, fontFamily: "monospace" }}>{coreqId}</td>
                <td style={s.td}>
                  <button style={s.deleteBtn} onClick={() => handleDelete(courseId, coreqId)}>Remove</button>
                </td>
              </tr>
            ))}
            {pairs.length === 0 && (
              <tr><td colSpan={3} style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>No corequisite pairs defined</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  addCard: { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 20, marginBottom: 24 },
  label: { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 },
  select: { padding: "8px 12px", borderRadius: 8, border: "1.5px solid #d1d5db", fontSize: 13, outline: "none", minWidth: 240 },
  addBtn: { padding: "9px 20px", borderRadius: 8, background: "#7b2d2d", color: "#fff", border: "none", fontSize: 14, cursor: "pointer", fontWeight: 600 },
  tableWrap: { background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse" },
  thead: { background: "#f9fafb" },
  th: { padding: "12px 16px", textAlign: "left" as const, fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: "0.05em", borderBottom: "1px solid #e5e7eb" },
  tr: { borderBottom: "1px solid #f3f4f6" },
  td: { padding: "12px 16px", fontSize: 14, color: "#111827" },
  deleteBtn: { padding: "4px 12px", borderRadius: 6, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", fontSize: 13, cursor: "pointer", fontWeight: 500 },
};
