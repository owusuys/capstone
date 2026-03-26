import type { HighlightMode } from "../types/course";

interface ModeToggleProps {
  mode: HighlightMode | null;
  onModeChange: (mode: HighlightMode | null) => void;
}

export default function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        onClick={() => onModeChange(mode === "fail" ? null : "fail")}
        style={{
          padding: "8px 14px",
          borderRadius: 6,
          border: "none",
          cursor: "pointer",
          fontWeight: 600,
          fontSize: 13,
          backgroundColor: mode === "fail" ? "#dc2626" : "rgba(255,255,255,0.2)",
          color: mode === "fail" ? "#fff" : "rgba(255,255,255,0.8)",
          transition: "all 0.15s ease",
          whiteSpace: "nowrap",
        }}
      >
        If I fail?
      </button>
      <button
        onClick={() => onModeChange(mode === "plan" ? null : "plan")}
        style={{
          padding: "8px 14px",
          borderRadius: 6,
          border: "none",
          cursor: "pointer",
          fontWeight: 600,
          fontSize: 13,
          backgroundColor: mode === "plan" ? "#16a34a" : "rgba(255,255,255,0.2)",
          color: mode === "plan" ? "#fff" : "rgba(255,255,255,0.8)",
          transition: "all 0.15s ease",
          whiteSpace: "nowrap",
        }}
      >
        What do I need?
      </button>
    </div>
  );
}
