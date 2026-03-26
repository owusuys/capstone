export default function Legend() {
  const items = [
    { color: "#E5751F", label: "Selected", border: "#c25e14" },
    { color: "#fee2e2", label: "Affected (fail)", border: "#dc2626" },
    { color: "#dcfce7", label: "Required (plan)", border: "#16a34a" },
    { color: "#ffffff", label: "CS Course", border: "#861F41" },
    { color: "#ffffff", label: "Non-CS", border: "#9ca3af", dashed: true },
  ];

  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        left: 16,
        backgroundColor: "rgba(255,255,255,0.95)",
        borderRadius: 8,
        padding: "10px 14px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        zIndex: 10,
        fontSize: 11,
      }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}
        >
          <div
            style={{
              width: 16,
              height: 12,
              borderRadius: 3,
              backgroundColor: item.color,
              border: `2px ${item.dashed ? "dashed" : "solid"} ${item.border}`,
              flexShrink: 0,
            }}
          />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
