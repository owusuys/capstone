import { useState } from "react";
import type { Course } from "../../types/course";
import CourseModal from "./CourseModal";

interface Props {
  courses: Course[];
  password: string;
  onRefresh: () => void;
}

export default function CourseTable({ courses, password, onRefresh }: Props) {
  const [modalCourse, setModalCourse] = useState<Course | null | "new">(null);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = courses.filter(
    (c) =>
      c.id.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (course: Course) => {
    if (!confirm(`Delete ${course.id} — ${course.name}? This will also remove all its prerequisites.`)) return;
    setDeleting(course.id);
    try {
      await fetch(`/api/courses/${encodeURIComponent(course.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${password}` },
      });
      onRefresh();
    } catch (err) {
      console.error(err);
      alert("Delete failed.");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      <div style={s.toolbar}>
        <input
          style={s.search}
          placeholder="Search courses…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button style={s.addBtn} onClick={() => setModalCourse("new")}>+ Add Course</button>
      </div>

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr style={s.thead}>
              <th style={s.th}>ID</th>
              <th style={s.th}>Name</th>
              <th style={s.th}>Credits</th>
              <th style={s.th}>CS Course</th>
              <th style={s.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} style={s.tr}>
                <td style={{ ...s.td, fontFamily: "monospace", fontWeight: 600 }}>{c.id}</td>
                <td style={s.td}>{c.name}</td>
                <td style={{ ...s.td, textAlign: "center" }}>{c.credits}</td>
                <td style={{ ...s.td, textAlign: "center" }}>{c.isCS ? "✓" : ""}</td>
                <td style={{ ...s.td, display: "flex", gap: 8 }}>
                  <button style={s.editBtn} onClick={() => setModalCourse(c)}>Edit</button>
                  <button
                    style={{ ...s.deleteBtn, opacity: deleting === c.id ? 0.5 : 1 }}
                    onClick={() => handleDelete(c)}
                    disabled={deleting === c.id}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} style={{ padding: "24px", textAlign: "center", color: "#9ca3af" }}>No courses found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modalCourse !== null && (
        <CourseModal
          course={modalCourse === "new" ? null : modalCourse}
          allCourses={courses}
          password={password}
          onClose={() => setModalCourse(null)}
          onSaved={() => { setModalCourse(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  search: { padding: "8px 12px", borderRadius: 8, border: "1.5px solid #d1d5db", fontSize: 14, width: 280, outline: "none" },
  addBtn: { padding: "8px 18px", borderRadius: 8, background: "#7b2d2d", color: "#fff", border: "none", fontWeight: 600, fontSize: 14, cursor: "pointer" },
  tableWrap: { background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse" },
  thead: { background: "#f9fafb" },
  th: { padding: "12px 16px", textAlign: "left" as const, fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: "0.05em", borderBottom: "1px solid #e5e7eb" },
  tr: { borderBottom: "1px solid #f3f4f6" },
  td: { padding: "12px 16px", fontSize: 14, color: "#111827" },
  editBtn: { padding: "4px 12px", borderRadius: 6, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", fontSize: 13, cursor: "pointer", fontWeight: 500 },
  deleteBtn: { padding: "4px 12px", borderRadius: 6, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", fontSize: 13, cursor: "pointer", fontWeight: 500 },
};
