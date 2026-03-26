import type { Course, HighlightMode } from "../types/course";

interface InfoPanelProps {
  course: Course | null;
  mode: HighlightMode | null;
  highlightedNodes: Set<string>;
  allCourses: Course[];
}

export default function InfoPanel({
  course,
  mode,
  highlightedNodes,
  allCourses,
}: InfoPanelProps) {
  if (!course) {
    return (
      <div style={panelStyle}>
        <div style={{ color: "#6b7280", textAlign: "center", marginTop: 40 }}>
          <p style={{ fontSize: 16, fontWeight: 600 }}>Select a course</p>
          <p style={{ fontSize: 13, marginTop: 8 }}>
            Choose a mode above, then click a course node to see its
            relationships.
          </p>
        </div>
      </div>
    );
  }

  const highlighted = [...highlightedNodes]
    .sort()
    .map((id) => allCourses.find((c) => c.id === id))
    .filter(Boolean) as Course[];

  return (
    <div style={panelStyle}>
      <div
        style={{
          backgroundColor: "#861F41",
          color: "#fff",
          padding: "12px 16px",
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 18 }}>{course.id}</div>
        <div style={{ fontSize: 13, marginTop: 2 }}>{course.name}</div>
        <div style={{ fontSize: 12, marginTop: 4, opacity: 0.8 }}>
          {course.credits} credit{course.credits !== 1 ? "s" : ""}
        </div>
      </div>

      {course.prerequisitesRaw && (
        <div style={{ marginBottom: 12 }}>
          <div style={labelStyle}>Prerequisites</div>
          <div style={{ fontSize: 13, color: "#374151" }}>
            {course.prerequisitesRaw}
          </div>
        </div>
      )}

      {course.corequisites.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={labelStyle}>Corequisites</div>
          <div style={{ fontSize: 13, color: "#374151" }}>
            {course.corequisites.join(", ")}
          </div>
        </div>
      )}

      {course.notes && (
        <div style={{ marginBottom: 12 }}>
          <div style={labelStyle}>Notes</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>{course.notes}</div>
        </div>
      )}

      {mode && highlighted.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              ...labelStyle,
              color: mode === "fail" ? "#dc2626" : "#16a34a",
            }}
          >
            {mode === "fail"
              ? `Affected courses (${highlighted.length})`
              : `Required prerequisites (${highlighted.length})`}
          </div>
          <div
            style={{
              maxHeight: 300,
              overflowY: "auto",
              marginTop: 8,
            }}
          >
            {highlighted.map((c) => (
              <div
                key={c.id}
                style={{
                  padding: "6px 10px",
                  marginBottom: 4,
                  borderRadius: 4,
                  backgroundColor:
                    mode === "fail" ? "#fef2f2" : "#f0fdf4",
                  fontSize: 12,
                  borderLeft: `3px solid ${mode === "fail" ? "#dc2626" : "#16a34a"}`,
                }}
              >
                <span style={{ fontWeight: 600 }}>{c.id}</span>
                {c.isCS && (
                  <span style={{ color: "#6b7280", marginLeft: 6 }}>
                    {c.name}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  width: 300,
  padding: 16,
  borderLeft: "1px solid #e5e7eb",
  overflowY: "auto",
  backgroundColor: "#fafafa",
  flexShrink: 0,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#6b7280",
  marginBottom: 4,
};
