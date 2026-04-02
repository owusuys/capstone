import { useState, useEffect } from "react";
import type { Course } from "../../types/course";
import type { Pathway, PathwaySummary, PathwayCourseRole } from "../../types/pathway";

interface Props {
  courses: Course[];
  password: string;
}

const ROLE_LABELS: Record<PathwayCourseRole, string> = {
  essential: "Essential Foundations",
  elective: "Advised Electives",
  capstone: "Capstone",
};

const ROLE_COLORS: Record<PathwayCourseRole, { text: string; bg: string; border: string }> = {
  essential: { text: "#1d4ed8", bg: "#eff6ff", border: "#3b82f6" },
  elective:  { text: "#15803d", bg: "#f0fdf4", border: "#16a34a" },
  capstone:  { text: "#c2410c", bg: "#fff7ed", border: "#E5751F" },
};

function RoleBadge({ role }: { role: PathwayCourseRole }) {
  const c = ROLE_COLORS[role];
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
      color: c.text, background: c.bg, border: `1px solid ${c.border}`,
    }}>
      {ROLE_LABELS[role]}
    </span>
  );
}

interface ModalProps {
  initial: { name: string; description: string } | null;
  onSave: (name: string, description: string) => void;
  onClose: () => void;
}

function PathwayModal({ initial, onSave, onClose }: ModalProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: 12, padding: "28px 28px",
        width: 480, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", display: "flex",
        flexDirection: "column", gap: 14,
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>
          {initial ? "Edit Pathway" : "New Pathway"}
        </div>

        <div>
          <label style={s.label}>Name *</label>
          <input
            style={s.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. AI/ML Engineer"
            autoFocus
          />
        </div>

        <div>
          <label style={s.label}>Description</label>
          <textarea
            style={{ ...s.input, height: 100, resize: "vertical" }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this pathway…"
          />
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
          <button style={s.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            style={{ ...s.primaryBtn, opacity: name.trim() ? 1 : 0.5 }}
            disabled={!name.trim()}
            onClick={() => onSave(name.trim(), description.trim())}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PathwaysEditor({ courses, password }: Props) {
  const [pathways, setPathways] = useState<PathwaySummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Pathway | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [addCourseId, setAddCourseId] = useState("");
  const [addRole, setAddRole] = useState<PathwayCourseRole>("essential");
  const [saving, setSaving] = useState(false);

  const authHeader = { Authorization: `Bearer ${password}` };

  const loadList = () =>
    fetch("/api/pathways")
      .then((r) => r.json())
      .then(setPathways)
      .catch(console.error);

  const loadDetail = (id: number) =>
    fetch(`/api/pathways/${id}`)
      .then((r) => r.json())
      .then(setDetail)
      .catch(console.error);

  useEffect(() => { loadList(); }, []);

  useEffect(() => {
    if (selectedId === null) { setDetail(null); return; }
    loadDetail(selectedId);
  }, [selectedId]);

  const handleCreate = async (name: string, description: string) => {
    setSaving(true);
    const r = await fetch("/api/pathways", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ name, description, sortOrder: pathways.length }),
    });
    const data = await r.json();
    await loadList();
    setSelectedId(data.id);
    setModalMode(null);
    setSaving(false);
  };

  const handleEdit = async (name: string, description: string) => {
    if (!detail) return;
    setSaving(true);
    await fetch(`/api/pathways/${detail.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ name, description, sortOrder: detail.sortOrder }),
    });
    await Promise.all([loadList(), loadDetail(detail.id)]);
    setModalMode(null);
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    const pw = pathways.find((p) => p.id === id);
    if (!confirm(`Delete pathway "${pw?.name}"? This cannot be undone.`)) return;
    await fetch(`/api/pathways/${id}`, { method: "DELETE", headers: authHeader });
    if (selectedId === id) { setSelectedId(null); setDetail(null); }
    await loadList();
  };

  const handleAddCourse = async () => {
    if (!detail || !addCourseId) return;
    setSaving(true);
    await fetch(`/api/pathways/${detail.id}/courses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ courseId: addCourseId, role: addRole, sortOrder: detail.courses.filter((c) => c.role === addRole).length }),
    });
    await Promise.all([loadDetail(detail.id), loadList()]);
    setAddCourseId("");
    setSaving(false);
  };

  const handleRemoveCourse = async (courseId: string) => {
    if (!detail) return;
    await fetch(`/api/pathways/${detail.id}/courses/${encodeURIComponent(courseId)}`, {
      method: "DELETE",
      headers: authHeader,
    });
    await Promise.all([loadDetail(detail.id), loadList()]);
  };

  // Courses not already in this pathway
  const availableCourses = detail
    ? courses.filter((c) => !detail.courses.find((pc) => pc.courseId === c.id))
    : courses;

  return (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
      {/* Left panel — pathway list */}
      <div style={{ width: 280, flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>Pathways</div>
          <button style={s.primaryBtn} onClick={() => setModalMode("create")}>+ New</button>
        </div>

        {pathways.length === 0 && (
          <div style={{ color: "#9ca3af", fontSize: 13, padding: "12px 0" }}>No pathways yet.</div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {pathways.map((p) => (
            <div
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              style={{
                padding: "10px 14px", borderRadius: 8, cursor: "pointer",
                border: `1.5px solid ${selectedId === p.id ? "#7b2d2d" : "#e5e7eb"}`,
                background: selectedId === p.id ? "#fdf2f4" : "#fff",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>{p.name}</div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{p.courseCount} courses</div>
              </div>
              <button
                style={s.dangerSmallBtn}
                onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — pathway detail */}
      {!detail ? (
        <div style={{
          flex: 1, background: "#fff", borderRadius: 10, border: "1.5px dashed #e5e7eb",
          padding: "48px 24px", textAlign: "center", color: "#9ca3af", fontSize: 14,
        }}>
          Select a pathway to view and edit its courses.
        </div>
      ) : (
        <div style={{ flex: 1, background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: "20px 24px" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>{detail.name}</div>
              {detail.description && (
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4, maxWidth: 500 }}>{detail.description}</div>
              )}
            </div>
            <button style={s.secondaryBtn} onClick={() => setModalMode("edit")}>Edit Info</button>
          </div>

          {/* Courses by role */}
          {(["essential", "elective", "capstone"] as PathwayCourseRole[]).map((role) => {
            const roleCourses = detail.courses.filter((c) => c.role === role);
            const c = ROLE_COLORS[role];
            return (
              <div key={role} style={{ marginBottom: 20 }}>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: c.text,
                  background: c.bg, border: `1px solid ${c.border}`,
                  borderRadius: 6, padding: "4px 10px", display: "inline-block", marginBottom: 8,
                }}>
                  {ROLE_LABELS[role]}
                </div>

                {roleCourses.length === 0 ? (
                  <div style={{ fontSize: 13, color: "#9ca3af", padding: "4px 0" }}>None added.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {roleCourses.map((pc) => (
                      <div key={pc.courseId} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "8px 12px", borderRadius: 6, background: "#f9fafb",
                        border: "1px solid #f3f4f6",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "#374151" }}>
                            {pc.courseId}
                          </span>
                          <span style={{ fontSize: 13, color: "#6b7280" }}>{pc.name}</span>
                          <span style={{ fontSize: 12, color: "#9ca3af" }}>{pc.credits} cr</span>
                        </div>
                        <button
                          style={s.dangerSmallBtn}
                          onClick={() => handleRemoveCourse(pc.courseId)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add course form */}
          <div style={{
            marginTop: 8, paddingTop: 16, borderTop: "1px solid #f3f4f6",
            display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
          }}>
            <select
              value={addCourseId}
              onChange={(e) => setAddCourseId(e.target.value)}
              style={{ ...s.input, flex: "1 1 200px", minWidth: 160 }}
            >
              <option value="">— Select course —</option>
              {availableCourses.map((c) => (
                <option key={c.id} value={c.id}>{c.id} — {c.name}</option>
              ))}
            </select>

            <select
              value={addRole}
              onChange={(e) => setAddRole(e.target.value as PathwayCourseRole)}
              style={{ ...s.input, width: 160 }}
            >
              <option value="essential">Essential</option>
              <option value="elective">Elective</option>
              <option value="capstone">Capstone</option>
            </select>

            <button
              style={{ ...s.primaryBtn, opacity: addCourseId && !saving ? 1 : 0.5 }}
              disabled={!addCourseId || saving}
              onClick={handleAddCourse}
            >
              Add Course
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalMode && (
        <PathwayModal
          initial={modalMode === "edit" && detail
            ? { name: detail.name, description: detail.description ?? "" }
            : null}
          onSave={modalMode === "edit" ? handleEdit : handleCreate}
          onClose={() => setModalMode(null)}
        />
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  label: { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 },
  input: { width: "100%", padding: "8px 10px", borderRadius: 7, border: "1.5px solid #d1d5db", fontSize: 14, boxSizing: "border-box" },
  primaryBtn: { padding: "8px 14px", borderRadius: 7, background: "#7b2d2d", color: "#fff", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  secondaryBtn: { padding: "7px 12px", borderRadius: 7, background: "#fff", color: "#374151", border: "1.5px solid #d1d5db", fontWeight: 500, fontSize: 13, cursor: "pointer" },
  cancelBtn: { padding: "8px 14px", borderRadius: 7, background: "#f3f4f6", color: "#374151", border: "none", fontWeight: 500, fontSize: 13, cursor: "pointer" },
  dangerSmallBtn: { padding: "4px 10px", borderRadius: 6, background: "#fff", color: "#dc2626", border: "1px solid #fca5a5", fontWeight: 500, fontSize: 12, cursor: "pointer" },
};
