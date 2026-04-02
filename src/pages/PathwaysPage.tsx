import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import type { Pathway, PathwaySummary, PathwayCourse, PathwayCourseRole } from "../types/pathway";
import type { Course } from "../types/course";

const ROLE_STYLES: Record<PathwayCourseRole, { bg: string; border: string; text: string; label: string }> = {
  essential: { bg: "#eff6ff", border: "#3b82f6", text: "#1d4ed8", label: "Essential Foundations" },
  elective:  { bg: "#f0fdf4", border: "#16a34a", text: "#15803d", label: "Advised Electives" },
  capstone:  { bg: "#fff7ed", border: "#E5751F", text: "#c2410c", label: "Capstone" },
};

function CourseCard({ pc, selected, onClick }: { pc: PathwayCourse; selected: boolean; onClick: () => void }) {
  const s = ROLE_STYLES[pc.role];
  return (
    <div
      onClick={onClick}
      style={{
        padding: "12px 16px",
        borderRadius: 8,
        border: `2px solid ${selected ? "#861F41" : s.border}`,
        backgroundColor: selected ? "#fdf2f4" : s.bg,
        flex: "1 1 200px",
        minWidth: 200,
        maxWidth: 280,
        cursor: "pointer",
        boxShadow: selected ? "0 0 0 3px rgba(134,31,65,0.15)" : "none",
        transition: "box-shadow 0.12s, border-color 0.12s",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 14, color: selected ? "#861F41" : s.text, fontFamily: "monospace" }}>
        {pc.courseId}
      </div>
      <div style={{ fontSize: 13, color: "#374151", marginTop: 3, lineHeight: 1.3 }}>{pc.name}</div>
      <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 5 }}>{pc.credits} credits</div>
    </div>
  );
}

function SectionHeader({ role, count }: { role: PathwayCourseRole; count: number }) {
  const s = ROLE_STYLES[role];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <div style={{
        width: 12, height: 12, borderRadius: 3,
        backgroundColor: s.border, flexShrink: 0,
      }} />
      <span style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{s.label}</span>
      <span style={{
        fontSize: 12, color: s.text, background: s.bg,
        border: `1px solid ${s.border}`, borderRadius: 12,
        padding: "1px 8px", fontWeight: 600,
      }}>{count}</span>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.05em", color: "#6b7280", marginBottom: 4,
};

function CourseDetailPanel({ course, onClose }: { course: Course; onClose: () => void }) {
  return (
    <div style={{
      width: 300, flexShrink: 0,
      borderLeft: "1px solid #e5e7eb",
      backgroundColor: "#fafafa",
      overflowY: "auto",
      padding: 16,
      position: "sticky",
      top: 0,
      maxHeight: "calc(100vh - 56px)",
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: "#861F41", color: "#fff",
        padding: "12px 16px", borderRadius: 8, marginBottom: 16,
        position: "relative",
      }}>
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 8, right: 10,
            background: "none", border: "none", color: "rgba(255,255,255,0.7)",
            fontSize: 18, cursor: "pointer", lineHeight: 1, padding: 0,
          }}
          aria-label="Close"
        >×</button>
        <div style={{ fontWeight: 700, fontSize: 18, fontFamily: "monospace" }}>{course.id}</div>
        <div style={{ fontSize: 13, marginTop: 2 }}>{course.name}</div>
        <div style={{ fontSize: 12, marginTop: 4, opacity: 0.8 }}>
          {course.credits} credit{course.credits !== 1 ? "s" : ""}
        </div>
      </div>

      {course.prerequisitesRaw && (
        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>Prerequisites</div>
          <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>{course.prerequisitesRaw}</div>
        </div>
      )}

      {course.corequisites.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>Corequisites</div>
          <div style={{ fontSize: 13, color: "#374151" }}>{course.corequisites.join(", ")}</div>
        </div>
      )}

      {course.notes && (
        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>Notes</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{course.notes}</div>
        </div>
      )}

      {!course.prerequisitesRaw && course.corequisites.length === 0 && !course.notes && (
        <div style={{ fontSize: 13, color: "#9ca3af" }}>No prerequisite or corequisite information available.</div>
      )}
    </div>
  );
}

export default function PathwaysPage() {
  const [pathways, setPathways] = useState<PathwaySummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | "">("");
  const [detail, setDetail] = useState<Pathway | null>(null);
  const [showElectives, setShowElectives] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courseLoading, setCourseLoading] = useState(false);

  useEffect(() => {
    fetch("/api/pathways")
      .then((r) => r.json())
      .then(setPathways)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedId) { setDetail(null); setSelectedCourse(null); return; }
    setLoading(true);
    fetch(`/api/pathways/${selectedId}`)
      .then((r) => r.json())
      .then((data: Pathway) => { setDetail(data); setShowElectives(true); setSelectedCourse(null); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedId]);

  const handleCardClick = (courseId: string) => {
    if (selectedCourse?.id === courseId) { setSelectedCourse(null); return; }
    setCourseLoading(true);
    fetch(`/api/courses/${encodeURIComponent(courseId)}`)
      .then((r) => r.json())
      .then((data: Course) => setSelectedCourse(data))
      .catch(console.error)
      .finally(() => setCourseLoading(false));
  };

  const essential = detail?.courses.filter((c) => c.role === "essential") ?? [];
  const electives  = detail?.courses.filter((c) => c.role === "elective")  ?? [];
  const capstone   = detail?.courses.filter((c) => c.role === "capstone")  ?? [];

  const renderCards = (courses: PathwayCourse[]) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      {courses.map((c) => (
        <CourseCard
          key={c.courseId}
          pc={c}
          selected={selectedCourse?.id === c.courseId}
          onClick={() => handleCardClick(c.courseId)}
        />
      ))}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        background: "#861F41", color: "#fff",
        padding: "16px 32px", display: "flex",
        alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>CS Pathways</div>
          <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>Virginia Tech Computer Science</div>
        </div>
        <Link to="/" style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, textDecoration: "none" }}>
          ← Back to map
        </Link>
      </div>

      {/* Body: main content + side panel */}
      <div style={{ flex: 1, display: "flex", alignItems: "flex-start" }}>

        {/* Main content */}
        <div style={{ flex: 1, padding: "32px", maxWidth: selectedCourse ? 660 : 960, boxSizing: "border-box" }}>

          {/* Selector */}
          <div style={{ marginBottom: 28 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
              Select a Pathway
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : "")}
                style={{
                  padding: "10px 14px", borderRadius: 8, border: "1.5px solid #d1d5db",
                  fontSize: 15, color: "#111827", background: "#fff",
                  cursor: "pointer", minWidth: 260,
                }}
              >
                <option value="">— Choose a specialization —</option>
                {pathways.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              {detail && electives.length > 0 && (
                <button
                  onClick={() => setShowElectives((v) => !v)}
                  style={{
                    padding: "10px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600,
                    cursor: "pointer", border: "1.5px solid #16a34a",
                    background: showElectives ? "#16a34a" : "#fff",
                    color: showElectives ? "#fff" : "#16a34a",
                    transition: "all 0.15s",
                  }}
                >
                  {showElectives ? "Hide Advised Electives" : "Show Advised Electives"}
                </button>
              )}
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div style={{ color: "#6b7280", fontSize: 14, padding: "20px 0" }}>Loading pathway…</div>
          )}

          {/* Empty state */}
          {!loading && !detail && (
            <div style={{
              textAlign: "center", padding: "60px 20px",
              color: "#9ca3af", border: "2px dashed #e5e7eb",
              borderRadius: 12, background: "#fff",
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎓</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>Select a pathway to get started</div>
              <div style={{ fontSize: 14, marginTop: 6 }}>Each pathway highlights the courses that will help you specialize in that area of CS.</div>
            </div>
          )}

          {/* Pathway detail */}
          {!loading && detail && (
            <div>
              {/* Description */}
              {detail.description && (
                <div style={{
                  background: "#fff", borderRadius: 10,
                  border: "1px solid #e5e7eb", padding: "18px 20px",
                  marginBottom: 28, fontSize: 14, color: "#374151", lineHeight: 1.6,
                }}>
                  {detail.description}
                </div>
              )}

              {/* Legend */}
              <div style={{ display: "flex", gap: 20, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
                {(["essential", "elective", "capstone"] as PathwayCourseRole[]).map((role) => {
                  const s = ROLE_STYLES[role];
                  if (role === "elective" && !showElectives) return null;
                  return (
                    <div key={role} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: s.border }} />
                      <span style={{ fontSize: 13, color: "#374151" }}>{s.label}</span>
                    </div>
                  );
                })}
                {detail && (
                  <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 4 }}>
                    Click a course to see its details
                  </span>
                )}
              </div>

              {/* Essential section */}
              {essential.length > 0 && (
                <div style={{ marginBottom: 28 }}>
                  <SectionHeader role="essential" count={essential.length} />
                  {renderCards(essential)}
                </div>
              )}

              {/* Electives section */}
              {showElectives && electives.length > 0 && (
                <div style={{ marginBottom: 28 }}>
                  <SectionHeader role="elective" count={electives.length} />
                  {renderCards(electives)}
                </div>
              )}

              {/* Capstone section */}
              {capstone.length > 0 && (
                <div style={{ marginBottom: 28 }}>
                  <SectionHeader role="capstone" count={capstone.length} />
                  {renderCards(capstone)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Side panel */}
        {courseLoading && (
          <div style={{ width: 300, flexShrink: 0, padding: 24, borderLeft: "1px solid #e5e7eb", color: "#6b7280", fontSize: 14 }}>
            Loading…
          </div>
        )}
        {!courseLoading && selectedCourse && (
          <CourseDetailPanel course={selectedCourse} onClose={() => setSelectedCourse(null)} />
        )}
      </div>
    </div>
  );
}
