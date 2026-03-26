import { memo } from "react";
import { Handle, Position } from "reactflow";
import type { NodeProps } from "reactflow";
import type { Course } from "../types/course";

interface CourseNodeData extends Course {
  highlight?: "selected" | "fail" | "plan" | "dimmed" | "coreq" | "pinned" | null;
}

function CourseNode({ data }: NodeProps<CourseNodeData>) {
  const highlight = data.highlight || null;

  let bgColor = "#ffffff";
  let borderColor = data.isCS ? "#861F41" : "#9ca3af";
  let borderStyle = data.isCS ? "solid" : "dashed";
  let opacity = 1;
  let textColor = "#1f2937";

  switch (highlight) {
    case "selected":
      bgColor = "#E5751F";
      borderColor = "#c25e14";
      textColor = "#ffffff";
      break;
    case "fail":
      bgColor = "#fee2e2";
      borderColor = "#dc2626";
      break;
    case "plan":
      bgColor = "#dcfce7";
      borderColor = "#16a34a";
      break;
    case "coreq":
      bgColor = "#eff6ff";
      borderColor = "#3b82f6";
      borderStyle = "dashed";
      textColor = "#1e40af";
      break;
    case "pinned":
      bgColor = "#f5f3ff";
      borderColor = "#7c3aed";
      borderStyle = "solid";
      textColor = "#5b21b6";
      break;
    case "dimmed":
      opacity = 0.25;
      break;
  }

  return (
    <div
      style={{
        padding: data.isCS ? "8px 12px" : "4px 8px",
        borderRadius: 8,
        border: `2px ${borderStyle} ${borderColor}`,
        backgroundColor: bgColor,
        opacity,
        transition: "all 0.2s ease",
        minWidth: data.isCS ? 160 : 100,
        textAlign: "center",
        cursor: "pointer",
        fontSize: data.isCS ? 13 : 11,
        color: textColor,
        boxShadow:
          highlight === "selected"
            ? "0 4px 12px rgba(229, 117, 31, 0.4)"
            : "0 1px 3px rgba(0,0,0,0.1)",
      }}
    >
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        style={{ visibility: "hidden", width: 0, height: 0 }}
      />
      <Handle
        id="left"
        type="target"
        position={Position.Left}
        style={{ visibility: "hidden", width: 0, height: 0 }}
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        style={{ visibility: "hidden", width: 0, height: 0 }}
      />
      <div style={{ fontWeight: 700, fontSize: data.isCS ? 14 : 11 }}>
        {data.id}
      </div>
      {data.isCS && (
        <div
          style={{
            fontSize: 10,
            marginTop: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 155,
          }}
        >
          {data.name}
        </div>
      )}
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        style={{ visibility: "hidden", width: 0, height: 0 }}
      />
    </div>
  );
}

export default memo(CourseNode);
