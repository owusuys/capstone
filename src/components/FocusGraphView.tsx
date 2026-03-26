import { useState, useMemo, useCallback, useEffect } from "react";
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
} from "reactflow";
import type { Node, NodeMouseHandler } from "reactflow";
import "reactflow/dist/style.css";

import CourseNode from "./CourseNode";
import Legend from "./Legend";
import type { Course, HighlightMode, PrereqEdge } from "../types/course";
import { computeLayout } from "../utils/layout";
import { getNeighborhood } from "../utils/neighborhood";
import { buildAdjacency, getDownstream, getUpstream } from "../utils/graph";

interface FocusGraphViewProps {
  courses: Course[];
  prereqEdges: PrereqEdge[];
  mode: HighlightMode | null;
  onSelectCourse: (course: Course | null) => void;
  onHighlight: (nodes: Set<string>) => void;
  searchCourseId?: string | null;
}

const nodeTypes = { courseNode: CourseNode };

function NeighborhoodGraph({
  focusCourseId,
  courses,
  prereqEdges,
  mode,
  onSelectCourse,
  onHighlight,
  onReset,
}: {
  focusCourseId: string;
  courses: Course[];
  prereqEdges: PrereqEdge[];
  mode: HighlightMode | null;
  onSelectCourse: (course: Course | null) => void;
  onHighlight: (nodes: Set<string>) => void;
  onReset: () => void;
}) {
  const { downstream, upstream } = useMemo(
    () => buildAdjacency(prereqEdges),
    [prereqEdges]
  );

  const { nodeIds: neighborIds, edges: neighborEdges } = useMemo(
    () => getNeighborhood(focusCourseId, prereqEdges, 2),
    [focusCourseId, prereqEdges]
  );

  const neighborCourses = useMemo(
    () => courses.filter((c) => neighborIds.has(c.id)),
    [courses, neighborIds]
  );

  const initialLayout = useMemo(
    () => computeLayout(neighborCourses, neighborEdges),
    [neighborCourses, neighborEdges]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialLayout.nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        highlight: n.id === focusCourseId ? "selected" : null,
      },
    }))
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialLayout.edges);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_, node: Node) => {
      const courseId = node.id;
      const course = courses.find((c) => c.id === courseId) || null;
      onSelectCourse(course);

      if (!mode) {
        setNodes((nds) =>
          nds.map((n) => ({
            ...n,
            data: { ...n.data, highlight: n.id === courseId ? "selected" : null },
          }))
        );
        setEdges((eds) =>
          eds.map((e) => ({
            ...e,
            style: { stroke: "#9ca3af", strokeWidth: 1.5 },
            markerEnd: { type: "arrowclosed" as const, color: "#9ca3af" },
            animated: false,
          }))
        );
        onHighlight(new Set());
        return;
      }

      const highlighted =
        mode === "fail"
          ? getDownstream(courseId, downstream)
          : getUpstream(courseId, upstream);

      // Filter to only nodes present in this neighborhood
      const localHighlighted = new Set(
        [...highlighted].filter((id) => neighborIds.has(id))
      );
      onHighlight(localHighlighted);

      const highlightColor = mode === "fail" ? "#dc2626" : "#16a34a";
      const highlightType = mode === "fail" ? "fail" : "plan";

      setNodes((nds) =>
        nds.map((n) => {
          let highlight: string | null = "dimmed";
          if (n.id === courseId) highlight = "selected";
          else if (localHighlighted.has(n.id)) highlight = highlightType;
          return { ...n, data: { ...n.data, highlight } };
        })
      );

      const highlightedWithSelected = new Set(localHighlighted);
      highlightedWithSelected.add(courseId);

      setEdges((eds) =>
        eds.map((e) => {
          const isRelevant =
            highlightedWithSelected.has(e.source) &&
            highlightedWithSelected.has(e.target);
          return {
            ...e,
            style: {
              stroke: isRelevant ? highlightColor : "#e5e7eb",
              strokeWidth: isRelevant ? 2.5 : 1,
            },
            markerEnd: {
              type: "arrowclosed" as const,
              color: isRelevant ? highlightColor : "#e5e7eb",
            },
            animated: isRelevant,
          };
        })
      );
    },
    [
      mode,
      courses,
      downstream,
      upstream,
      neighborIds,
      setNodes,
      setEdges,
      onHighlight,
      onSelectCourse,
    ]
  );

  const handlePaneClick = useCallback(() => {
    onSelectCourse(null);
    onHighlight(new Set());
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          highlight: n.id === focusCourseId ? "selected" : null,
        },
      }))
    );
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        style: { stroke: "#9ca3af", strokeWidth: 1.5 },
        markerEnd: { type: "arrowclosed" as const, color: "#9ca3af" },
        animated: false,
      }))
    );
  }, [focusCourseId, setNodes, setEdges, onSelectCourse, onHighlight]);

  return (
    <div style={{ flex: 1, position: "relative" }}>
      <button
        onClick={onReset}
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 10,
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
          position: "absolute",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          fontSize: 12,
          color: "#6b7280",
          backgroundColor: "rgba(255,255,255,0.9)",
          padding: "4px 10px",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
        }}
      >
        Showing {neighborCourses.length} courses within 2 hops of{" "}
        <strong>{focusCourseId}</strong>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        attributionPosition="bottom-right"
      >
        <Controls />
        <Background gap={20} size={1} color="#f1f5f9" />
      </ReactFlow>
      <Legend />
    </div>
  );
}

export default function FocusGraphView({
  courses,
  prereqEdges,
  mode,
  onSelectCourse,
  onHighlight,
  searchCourseId,
}: FocusGraphViewProps) {
  const [focusCourseId, setFocusCourseId] = useState<string | null>(null);

  // When a course is searched, open its neighborhood graph
  useEffect(() => {
    if (!searchCourseId) return;
    const course = courses.find((c) => c.id === searchCourseId) ?? null;
    onSelectCourse(course);
    onHighlight(new Set());
    setFocusCourseId(searchCourseId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchCourseId]);

  const csCourses = useMemo(() => courses.filter((c) => c.isCS), [courses]);

  const handleChipClick = useCallback(
    (courseId: string) => {
      const course = courses.find((c) => c.id === courseId) || null;
      onSelectCourse(course);
      onHighlight(new Set());
      setFocusCourseId(courseId);
    },
    [courses, onSelectCourse, onHighlight]
  );

  const handleReset = useCallback(() => {
    setFocusCourseId(null);
    onSelectCourse(null);
    onHighlight(new Set());
  }, [onSelectCourse, onHighlight]);

  if (focusCourseId) {
    return (
      <NeighborhoodGraph
        focusCourseId={focusCourseId}
        courses={courses}
        prereqEdges={prereqEdges}
        mode={mode}
        onSelectCourse={onSelectCourse}
        onHighlight={onHighlight}
        onReset={handleReset}
      />
    );
  }

  // Group courses by level
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
        Click a course to explore its prerequisite connections
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
                  (e.target as HTMLButtonElement).style.backgroundColor =
                    "#861F41";
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
