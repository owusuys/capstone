import { useState, useEffect } from "react";
import type { Course } from "../../types/course";

interface Member {
  courseId: string;
  gradeReq: string | null;
}

interface Group {
  id: number;
  groupIndex: number;
  notes: string | null;
  members: Member[];
}

interface Props {
  courses: Course[];
  password: string;
}

export default function PrereqEditor({ courses, password }: Props) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [addMember, setAddMember] = useState<Record<number, string>>({});
  const [addGrade, setAddGrade] = useState<Record<number, string>>({});

  const loadGroups = (courseId: string) => {
    if (!courseId) return;
    setLoading(true);
    fetch(`/api/prerequisite-groups?courseId=${encodeURIComponent(courseId)}`)
      .then((r) => r.json())
      .then(setGroups)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadGroups(selectedId); }, [selectedId]);

  const addGroup = async () => {
    await fetch("/api/prerequisite-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${password}` },
      body: JSON.stringify({ courseId: selectedId }),
    });
    loadGroups(selectedId);
  };

  const deleteGroup = async (groupId: number) => {
    if (!confirm("Delete this entire prerequisite group?")) return;
    await fetch(`/api/prerequisite-groups/${groupId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${password}` },
    });
    loadGroups(selectedId);
  };

  const addMemberToGroup = async (groupId: number) => {
    const prereqId = addMember[groupId];
    if (!prereqId) return;
    await fetch("/api/prerequisite-group-members", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${password}` },
      body: JSON.stringify({ groupId, prereqCourseId: prereqId, gradeReq: addGrade[groupId] || null }),
    });
    setAddMember((prev) => ({ ...prev, [groupId]: "" }));
    setAddGrade((prev) => ({ ...prev, [groupId]: "" }));
    loadGroups(selectedId);
  };

  const removeMember = async (groupId: number, prereqId: string) => {
    await fetch(`/api/prerequisite-group-members/${groupId}/${encodeURIComponent(prereqId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${password}` },
    });
    loadGroups(selectedId);
  };

  return (
    <div>
      <div style={s.topBar}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>Prerequisite Groups</div>
        <div style={s.description}>
          Each group is an <strong>OR-group</strong>: any one course in it satisfies the requirement.
          All groups must be satisfied (<strong>AND</strong> between groups).
        </div>
      </div>

      <div style={s.selector}>
        <label style={s.label}>Select course to edit prerequisites:</label>
        <select
          style={s.select}
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="">— choose a course —</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.id} — {c.name}</option>
          ))}
        </select>
      </div>

      {selectedId && (
        <div style={{ marginTop: 24 }}>
          {loading && <div style={{ color: "#6b7280", fontSize: 14 }}>Loading…</div>}

          {!loading && groups.length === 0 && (
            <div style={s.empty}>No prerequisite groups defined for {selectedId}.</div>
          )}

          {groups.map((g, i) => (
            <div key={g.id} style={s.groupCard}>
              <div style={s.groupHeader}>
                <span style={s.groupTitle}>Group {i + 1} <span style={{ fontWeight: 400, color: "#6b7280" }}>(satisfy any one)</span></span>
                <button style={s.deleteGroupBtn} onClick={() => deleteGroup(g.id)}>Delete group</button>
              </div>

              {/* Members */}
              <div style={s.members}>
                {g.members.length === 0 && (
                  <span style={{ fontSize: 13, color: "#9ca3af" }}>No members yet</span>
                )}
                {g.members.map((m) => (
                  <span key={m.courseId} style={s.chip}>
                    {m.courseId}{m.gradeReq ? ` (≥${m.gradeReq})` : ""}
                    <button style={s.chipX} onClick={() => removeMember(g.id, m.courseId)}>×</button>
                  </span>
                ))}
              </div>

              {/* Add member */}
              <div style={s.addRow}>
                <select
                  style={s.selectSm}
                  value={addMember[g.id] ?? ""}
                  onChange={(e) => setAddMember((p) => ({ ...p, [g.id]: e.target.value }))}
                >
                  <option value="">Add course…</option>
                  {courses
                    .filter((c) => c.id !== selectedId && !g.members.some((m) => m.courseId === c.id))
                    .map((c) => <option key={c.id} value={c.id}>{c.id}</option>)}
                </select>
                <input
                  style={s.gradeInput}
                  placeholder="Min grade (opt)"
                  value={addGrade[g.id] ?? ""}
                  onChange={(e) => setAddGrade((p) => ({ ...p, [g.id]: e.target.value }))}
                  maxLength={2}
                />
                <button style={s.addMemberBtn} onClick={() => addMemberToGroup(g.id)}>Add</button>
              </div>
            </div>
          ))}

          <button style={s.newGroupBtn} onClick={addGroup}>+ New OR-group</button>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  topBar: { marginBottom: 20 },
  description: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  selector: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: "#374151" },
  select: { padding: "9px 12px", borderRadius: 8, border: "1.5px solid #d1d5db", fontSize: 14, outline: "none", maxWidth: 480 },
  empty: { color: "#9ca3af", fontSize: 14, padding: "16px 0" },
  groupCard: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 20, marginBottom: 14 },
  groupHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  groupTitle: { fontSize: 14, fontWeight: 600, color: "#111827" },
  deleteGroupBtn: { padding: "4px 12px", borderRadius: 6, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", fontSize: 12, cursor: "pointer" },
  members: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: { display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: "#f0fdf4", border: "1px solid #86efac", fontSize: 13, color: "#166534" },
  chipX: { background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 16, lineHeight: 1, padding: 0 },
  addRow: { display: "flex", gap: 8, alignItems: "center" },
  selectSm: { padding: "6px 10px", borderRadius: 6, border: "1.5px solid #d1d5db", fontSize: 13, outline: "none" },
  gradeInput: { padding: "6px 10px", borderRadius: 6, border: "1.5px solid #d1d5db", fontSize: 13, width: 120, outline: "none" },
  addMemberBtn: { padding: "6px 14px", borderRadius: 6, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", fontSize: 13, cursor: "pointer", fontWeight: 500 },
  newGroupBtn: { marginTop: 8, padding: "9px 20px", borderRadius: 8, background: "#f0fdf4", color: "#166534", border: "1px solid #86efac", fontSize: 14, cursor: "pointer", fontWeight: 600 },
};
