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
  course: Course | null; // null = new course
  allCourses: Course[];
  password: string;
  onClose: () => void;
  onSaved: () => void;
}

/** Build a human-readable prerequisite string from groups, e.g.
 *  "(CS 1114 or CS 2064) and CS 1044" */
function buildPrereqRaw(groups: Group[]): string {
  const nonEmpty = groups.filter((g) => g.members.length > 0);
  if (nonEmpty.length === 0) return "";
  return nonEmpty
    .map((g) => {
      const names = g.members.map((m) => (m.gradeReq ? `${m.courseId} (≥${m.gradeReq})` : m.courseId));
      return names.length === 1 ? names[0] : `(${names.join(" or ")})`;
    })
    .join(" and ");
}

export default function CourseModal({ course, allCourses, password, onClose, onSaved }: Props) {
  const isNew = course === null;

  // Basic fields
  const [id, setId] = useState(course?.id ?? "");
  const [name, setName] = useState(course?.name ?? "");
  const [credits, setCredits] = useState(String(course?.credits ?? 3));
  const [isCS, setIsCS] = useState(course?.isCS ?? true);
  const [notes, setNotes] = useState(course?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prerequisite groups (only for existing courses)
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(!isNew);
  const [addMember, setAddMember] = useState<Record<number, string>>({});
  const [addGrade, setAddGrade] = useState<Record<number, string>>({});

  useEffect(() => {
    if (isNew || !course?.id) return;
    setGroupsLoading(true);
    fetch(`/api/prerequisite-groups?courseId=${encodeURIComponent(course.id)}`)
      .then((r) => r.json())
      .then((data: Group[]) => setGroups(data))
      .catch(console.error)
      .finally(() => setGroupsLoading(false));
  }, [course?.id, isNew]);

  const refreshGroups = () => {
    if (!course?.id) return;
    fetch(`/api/prerequisite-groups?courseId=${encodeURIComponent(course.id)}`)
      .then((r) => r.json())
      .then((data: Group[]) => setGroups(data))
      .catch(console.error);
  };

  const addGroup = async () => {
    await fetch("/api/prerequisite-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${password}` },
      body: JSON.stringify({ courseId: course!.id }),
    });
    refreshGroups();
  };

  const deleteGroup = async (groupId: number) => {
    await fetch(`/api/prerequisite-groups/${groupId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${password}` },
    });
    refreshGroups();
  };

  const addMemberToGroup = async (groupId: number) => {
    const prereqId = addMember[groupId];
    if (!prereqId) return;
    await fetch("/api/prerequisite-group-members", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${password}` },
      body: JSON.stringify({ groupId, prereqCourseId: prereqId, gradeReq: addGrade[groupId] || null }),
    });
    setAddMember((p) => ({ ...p, [groupId]: "" }));
    setAddGrade((p) => ({ ...p, [groupId]: "" }));
    refreshGroups();
  };

  const removeMember = async (groupId: number, prereqId: string) => {
    await fetch(`/api/prerequisite-group-members/${groupId}/${encodeURIComponent(prereqId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${password}` },
    });
    refreshGroups();
  };

  const handleSave = async () => {
    if (!id.trim() || !name.trim()) { setError("ID and name are required."); return; }
    setSaving(true);
    setError(null);
    const prereqRaw = isNew ? null : (buildPrereqRaw(groups) || null);
    const body = {
      id: id.trim(),
      name: name.trim(),
      credits: Number(credits),
      isCS,
      notes: notes.trim() || null,
      prerequisitesRaw: prereqRaw,
    };
    try {
      const url = isNew ? "/api/courses" : `/api/courses/${encodeURIComponent(course!.id)}`;
      const r = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${password}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const data = await r.json();
        setError(data.error ?? "Save failed.");
        return;
      }
      onSaved();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  };

  const existingMemberIds = new Set(groups.flatMap((g) => g.members.map((m) => m.courseId)));

  return (
    <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.title}>{isNew ? "Add Course" : `Edit ${course!.id}`}</div>

        {/* ── Basic fields ─────────────────────────────── */}
        <label style={s.label}>Course ID</label>
        <input style={{ ...s.input, background: !isNew ? "#f9fafb" : undefined }} value={id} onChange={(e) => setId(e.target.value)} placeholder="e.g. CS 3114" disabled={!isNew} />

        <label style={s.label}>Course Name</label>
        <input style={s.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Data Structures and Algorithms" />

        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={s.label}>Credits</label>
            <input style={s.input} type="number" value={credits} onChange={(e) => setCredits(e.target.value)} min={1} max={12} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingBottom: 4 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
              <input type="checkbox" checked={isCS} onChange={(e) => setIsCS(e.target.checked)} />
              CS Course
            </label>
          </div>
        </div>

        <label style={s.label}>Notes</label>
        <textarea style={{ ...s.input, height: 60, resize: "vertical" }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes…" />

        {/* ── Prerequisite groups (existing courses only) ─ */}
        {!isNew && (
          <div style={s.prereqSection}>
            <div style={s.prereqHeader}>
              <span style={s.prereqTitle}>Prerequisites</span>
              <span style={s.prereqHint}>AND between groups · OR within a group</span>
            </div>

            {groupsLoading && <div style={s.loadingText}>Loading…</div>}

            {!groupsLoading && groups.length === 0 && (
              <div style={s.emptyText}>No prerequisites. Add a group below.</div>
            )}

            {groups.map((g, i) => (
              <div key={g.id} style={s.groupCard}>
                <div style={s.groupHeader}>
                  <span style={s.groupLabel}>Group {i + 1} <span style={{ fontWeight: 400, color: "#6b7280" }}>— satisfy any one</span></span>
                  <button style={s.deleteGroupBtn} onClick={() => deleteGroup(g.id)}>✕ Remove group</button>
                </div>

                {/* Members */}
                <div style={s.chipRow}>
                  {g.members.length === 0 && <span style={s.emptyChip}>Empty — add a course below</span>}
                  {g.members.map((m) => (
                    <span key={m.courseId} style={s.chip}>
                      {m.courseId}{m.gradeReq ? ` ≥${m.gradeReq}` : ""}
                      <button style={s.chipX} onClick={() => removeMember(g.id, m.courseId)}>×</button>
                    </span>
                  ))}
                </div>

                {/* Add member row */}
                <div style={s.addRow}>
                  <select
                    style={s.selectSm}
                    value={addMember[g.id] ?? ""}
                    onChange={(e) => setAddMember((p) => ({ ...p, [g.id]: e.target.value }))}
                  >
                    <option value="">Add course…</option>
                    {allCourses
                      .filter((c) => c.id !== course!.id && !g.members.some((m) => m.courseId === c.id))
                      .map((c) => <option key={c.id} value={c.id}>{c.id} — {c.name}</option>)}
                  </select>
                  <input
                    style={s.gradeInput}
                    placeholder="Min grade"
                    value={addGrade[g.id] ?? ""}
                    onChange={(e) => setAddGrade((p) => ({ ...p, [g.id]: e.target.value }))}
                    maxLength={2}
                  />
                  <button style={s.addMemberBtn} onClick={() => addMemberToGroup(g.id)}>Add</button>
                </div>
              </div>
            ))}

            <button style={s.newGroupBtn} onClick={addGroup}>+ New group</button>

            {groups.some((g) => g.members.length > 0) && (
              <div style={s.previewRaw}>
                <span style={{ fontWeight: 600, color: "#374151" }}>Preview: </span>
                <span style={{ color: "#6b7280" }}>{buildPrereqRaw(groups)}</span>
              </div>
            )}
          </div>
        )}

        {isNew && (
          <div style={s.newCourseHint}>
            Prerequisites can be added after the course is created.
          </div>
        )}

        {error && <div style={{ color: "#dc2626", fontSize: 13 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, marginTop: 4, justifyContent: "flex-end" }}>
          <button style={s.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={{ ...s.saveBtn, opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, overflowY: "auto", padding: "24px 0" },
  modal: { background: "#fff", borderRadius: 12, padding: "28px 32px", width: 540, maxWidth: "95vw", display: "flex", flexDirection: "column", gap: 10, boxShadow: "0 8px 40px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" },
  title: { fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 4 },
  label: { fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: -4 },
  input: { padding: "9px 12px", borderRadius: 8, border: "1.5px solid #d1d5db", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" as const },
  cancelBtn: { padding: "9px 20px", borderRadius: 8, background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb", fontSize: 14, cursor: "pointer", fontWeight: 500 },
  saveBtn: { padding: "9px 24px", borderRadius: 8, background: "#7b2d2d", color: "#fff", border: "none", fontSize: 14, cursor: "pointer", fontWeight: 600 },
  // Prereq section
  prereqSection: { borderTop: "1px solid #e5e7eb", paddingTop: 14, marginTop: 4, display: "flex", flexDirection: "column", gap: 10 },
  prereqHeader: { display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  prereqTitle: { fontSize: 13, fontWeight: 700, color: "#374151" },
  prereqHint: { fontSize: 11, color: "#9ca3af" },
  loadingText: { fontSize: 13, color: "#9ca3af" },
  emptyText: { fontSize: 13, color: "#9ca3af", fontStyle: "italic" },
  groupCard: { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 },
  groupHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  groupLabel: { fontSize: 13, fontWeight: 600, color: "#111827" },
  deleteGroupBtn: { fontSize: 11, color: "#dc2626", background: "none", border: "none", cursor: "pointer", padding: 0 },
  chipRow: { display: "flex", flexWrap: "wrap", gap: 6 },
  chip: { display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, background: "#f0fdf4", border: "1px solid #86efac", fontSize: 12, color: "#166534" },
  chipX: { background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 15, lineHeight: 1, padding: 0 },
  emptyChip: { fontSize: 12, color: "#9ca3af", fontStyle: "italic" },
  addRow: { display: "flex", gap: 6, alignItems: "center" },
  selectSm: { padding: "5px 8px", borderRadius: 6, border: "1.5px solid #d1d5db", fontSize: 12, outline: "none", flex: 1, minWidth: 0 },
  gradeInput: { padding: "5px 8px", borderRadius: 6, border: "1.5px solid #d1d5db", fontSize: 12, width: 80, outline: "none" },
  addMemberBtn: { padding: "5px 12px", borderRadius: 6, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", fontSize: 12, cursor: "pointer", fontWeight: 500, whiteSpace: "nowrap" as const },
  newGroupBtn: { alignSelf: "flex-start", padding: "6px 14px", borderRadius: 6, background: "#f0fdf4", color: "#166534", border: "1px solid #86efac", fontSize: 12, cursor: "pointer", fontWeight: 600 },
  previewRaw: { fontSize: 12, background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: 6, padding: "8px 10px", color: "#475569" },
  newCourseHint: { fontSize: 12, color: "#9ca3af", fontStyle: "italic", background: "#f9fafb", borderRadius: 6, padding: "8px 12px", border: "1px solid #e5e7eb" },
};
