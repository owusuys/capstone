import { useState, useMemo, useCallback, useEffect } from "react";
import ReactFlow, {
  Controls,
  Background,
  Panel,
  useNodesState,
  useEdgesState,
} from "reactflow";
import type { Node, NodeMouseHandler, NodeProps } from "reactflow";
import "reactflow/dist/style.css";

import CourseNode from "./CourseNode";
import type { Course, PrereqEdge } from "../types/course";
import { buildAdjacency } from "../utils/graph";
import { computePathwayLayout } from "../utils/pathwayLayout";

// ── Placeholder node ───────────────────────────────────────────────────────
function PlaceholderNode({ data }: NodeProps<{ label: string; isPlaceholder: boolean }>) {
  return (
    <div
      style={{
        padding: "10px 20px",
        borderRadius: 8,
        border: "2px dashed #d1d5db",
        backgroundColor: "#f9fafb",
        color: "#9ca3af",
        fontSize: 12,
        fontStyle: "italic",
        minWidth: 180,
        textAlign: "center",
        userSelect: "none",
      }}
    >
      {data.label}
    </div>
  );
}

// ── nodeTypes MUST be module-level to avoid React Flow remount loop ────────
const nodeTypes = {
  courseNode: CourseNode,
  pathwayPlaceholder: PlaceholderNode,
};

// ── PathwayGraph ─────────────────────────────────────────────────────────
interface PathwayGraphProps {
  targetCourseId: string;
  courses: Course[];
  prereqEdges: PrereqEdge[];
  onSelectCourse: (course: Course | null) => void;
  onHighlight: (nodes: Set<string>) => void;
  onNavigate: (courseId: string) => void;
  onReset: () => void;
}

function PathwayGraph({
  targetCourseId,
  courses,
  prereqEdges,
  onSelectCourse,
  onHighlight,
  onNavigate,
  onReset,
}: PathwayGraphProps) {
  const { upstream, downstream } = useMemo(
    () => buildAdjacency(prereqEdges),
    [prereqEdges]
  );

  const prereqIds = useMemo(
    () => [...(upstream.get(targetCourseId) ?? new Set<string>())],
    [upstream, targetCourseId]
  );
  const depIds = useMemo(
    () => [...(downstream.get(targetCourseId) ?? new Set<string>())],
    [downstream, targetCourseId]
  );
  const coreqIds = useMemo(
    () => courses.find((c) => c.id === targetCourseId)?.corequisites ?? [],
    [courses, targetCourseId]
  );

  const layout = useMemo(
    () => computePathwayLayout(targetCourseId, prereqIds, depIds, courses, coreqIds),
    [targetCourseId, prereqIds, depIds, courses]
  );

  const [nodes, , onNodesChange] = useNodesState(layout.nodes);
  const [edges, , onEdgesChange] = useEdgesState(layout.edges);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_, node: Node) => {
      if (node.data?.isPlaceholder) return;

      const course = courses.find((c) => c.id === node.id) ?? null;
      onSelectCourse(course);
      onHighlight(new Set());

      if (node.id !== targetCourseId) {
        onNavigate(node.id);
      }
    },
    [targetCourseId, courses, onSelectCourse, onHighlight, onNavigate]
  );

  const targetCourse = courses.find((c) => c.id === targetCourseId);

  return (
    <div style={{ flex: 1, position: "relative" }}>
      {/* Top-left controls */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <button
          onClick={onReset}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            backgroundColor: "#fff",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            color: "#374151",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          ← All courses
        </button>
        <div
          style={{
            fontSize: 12,
            color: "#6b7280",
            backgroundColor: "rgba(255,255,255,0.9)",
            padding: "4px 10px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
          }}
        >
          Direct connections for{" "}
          <strong style={{ color: "#861F41" }}>{targetCourseId}</strong>
          {targetCourse ? ` — ${targetCourse.name}` : ""}
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={2}
        attributionPosition="bottom-right"
      >
        <Controls />
        <Background gap={20} size={1} color="#f1f5f9" />

        {/* Layer legend */}
        <Panel position="top-right">
          <div
            style={{
              backgroundColor: "rgba(255,255,255,0.92)",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 12,
              display: "flex",
              flexDirection: "column",
              gap: 5,
              boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  backgroundColor: "#dcfce7",
                  border: "1px solid #16a34a",
                }}
              />
              <span style={{ color: "#374151" }}>Prerequisites</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  backgroundColor: "#E5751F",
                }}
              />
              <span style={{ color: "#374151" }}>Selected course</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  backgroundColor: "#fee2e2",
                  border: "1px solid #dc2626",
                }}
              />
              <span style={{ color: "#374151" }}>Unlocked courses</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  backgroundColor: "#eff6ff",
                  border: "2px dashed #3b82f6",
                }}
              />
              <span style={{ color: "#374151" }}>Corequisites</span>
            </div>
            <div
              style={{
                marginTop: 4,
                paddingTop: 4,
                borderTop: "1px solid #e5e7eb",
                fontSize: 11,
                color: "#9ca3af",
              }}
            >
              Click any course to re-centre
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

// ── PathwayView (default export) ──────────────────────────────────────────
interface PathwayViewProps {
  courses: Course[];
  prereqEdges: PrereqEdge[];
  onSelectCourse: (course: Course | null) => void;
  onHighlight: (nodes: Set<string>) => void;
  searchCourseId?: string | null;
}

export default function PathwayView({
  courses,
  prereqEdges,
  onSelectCourse,
  onHighlight,
  searchCourseId,
}: PathwayViewProps) {
  const [targetCourseId, setTargetCourseId] = useState<string | null>(null);

  // Respond to search box selections
  useEffect(() => {
    if (!searchCourseId) return;
    const course = courses.find((c) => c.id === searchCourseId) ?? null;
    onSelectCourse(course);
    onHighlight(new Set());
    setTargetCourseId(searchCourseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchCourseId]);

  const handleReset = useCallback(() => {
    setTargetCourseId(null);
    onSelectCourse(null);
    onHighlight(new Set());
  }, [onSelectCourse, onHighlight]);

  const handleChipClick = useCallback(
    (courseId: string) => {
      const course = courses.find((c) => c.id === courseId) ?? null;
      onSelectCourse(course);
      onHighlight(new Set());
      setTargetCourseId(courseId);
    },
    [courses, onSelectCourse, onHighlight]
  );

  // ── ALL hooks must come before any conditional return ─────────────────
  const csCourses = useMemo(() => courses.filter((c) => c.isCS), [courses]);

  // ── Pathway graph ────────────────────────────────────────────────────
  if (targetCourseId) {
    return (
      <PathwayGraph
        key={targetCourseId}
        targetCourseId={targetCourseId}
        courses={courses}
        prereqEdges={prereqEdges}
        onSelectCourse={onSelectCourse}
        onHighlight={onHighlight}
        onNavigate={setTargetCourseId}
        onReset={handleReset}
      />
    );
  }

  // ── Default: chip grid ───────────────────────────────────────────────
  const grouped: Record<string, Course[]> = {
    "1000-level": [],
    "2000-level": [],
    "3000-level": [],
    "4000-level": [],
  };
  for (const course of csCourses) {
    const num = parseInt(course.id.replace(/[^0-9]/g, ""), 10);
    if (num < 2000) grouped["1000-level"].push(course);
    else if (num < 3000) grouped["2000-level"].push(course);
    else if (num < 4000) grouped["3000-level"].push(course);
    else grouped["4000-level"].push(course);
  }

  return (
    <div
      style={{
        flex: 1,
        padding: 24,
        overflowY: "auto",
        backgroundColor: "#f9fafb",
      }}
    >
      <p
        style={{
          fontSize: 14,
          color: "#6b7280",
          marginBottom: 20,
          textAlign: "center",
        }}
      >
        Click a course to see its direct prerequisites and what it unlocks
      </p>
      {Object.entries(grouped).map(([level, levelCourses]) => (
        <div key={level} style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              color: "#9ca3af",
              marginBottom: 8,
            }}
          >
            {level}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {levelCourses.map((course) => (
              <button
                key={course.id}
                onClick={() => handleChipClick(course.id)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "2px solid #861F41",
                  backgroundColor: "#fff",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#861F41",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = "#861F41";
                  (e.target as HTMLButtonElement).style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = "#fff";
                  (e.target as HTMLButtonElement).style.color = "#861F41";
                }}
              >
                {course.id}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
