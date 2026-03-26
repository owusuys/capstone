export type ViewMode = "overview" | "focus" | "pathway" | "explore";

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

const tabs: { value: ViewMode; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "focus",    label: "Focus" },
  { value: "pathway",  label: "Pathway" },
  { value: "explore",  label: "Explore" },
];

export default function ViewModeToggle({
  viewMode,
  onViewModeChange,
}: ViewModeToggleProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {tabs.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onViewModeChange(value)}
          style={{
            padding: "6px 11px",
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 13,
            backgroundColor:
              viewMode === value ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.2)",
            color: viewMode === value ? "#861F41" : "rgba(255,255,255,0.8)",
            transition: "all 0.15s ease",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
