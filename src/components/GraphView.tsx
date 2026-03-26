import { useMemo, useCallback, useEffect, useRef } from "react";
import ReactFlow, {
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
} from "reactflow";
import type { Node, NodeMouseHandler, ReactFlowInstance } from "reactflow";
import "reactflow/dist/style.css";

import CourseNode from "./CourseNode";
import Legend from "./Legend";
import type { Course, HighlightMode, PrereqEdge } from "../types/course";
import { computeLayout } from "../utils/layout";
import { buildAdjacency, getDownstream, getUpstream } from "../utils/graph";

interface GraphViewProps {
  courses: Course[];
  prereqEdges: PrereqEdge[];
  mode: HighlightMode | null;
  onSelectCourse: (course: Course | null) => void;
  onHighlight: (nodes: Set<string>) => void;
  elkNodes?: Node[] | null;
  elkEdges?: import("reactflow").Edge[] | null;
  elkLoading?: boolean;
  searchCourseId?: string | null;
}

const nodeTypes = { courseNode: CourseNode };

export default function GraphView({
  courses,
  prereqEdges,
  mode,
  onSelectCourse,
  onHighlight,
  elkNodes,
  elkEdges,
  elkLoading,
  searchCourseId,
}: GraphViewProps) {
  const { downstream, upstream } = useMemo(
    () => buildAdjacency(prereqEdges),
    [prereqEdges]
  );

  const initialLayout = useMemo(
    () => computeLayout(courses, prereqEdges),
    [courses, prereqEdges]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(
    elkNodes ?? initialLayout.nodes
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    elkEdges ?? initialLayout.edges
  );

  // Capture the ReactFlow instance for programmatic pan/zoom
  const reactFlowRef = useRef<ReactFlowInstance | null>(null);

  // When ELK layout arrives, apply it
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => {
    if (elkNodes) setNodes(elkNodes);
    if (elkEdges) setEdges(elkEdges);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elkNodes, elkEdges]);

  // Pan/zoom to a searched course and highlight it
  useEffect(() => {
    if (!searchCourseId || !reactFlowRef.current) return;

    const target = nodes.find((n) => n.id === searchCourseId);
    if (!target) return;

    const course = courses.find((c) => c.id === searchCourseId);
    const nodeHeight = course?.isCS ? 60 : 40;

    reactFlowRef.current.setCenter(
      target.position.x + 90, // 180 / 2 = node horizontal center
      target.position.y + nodeHeight / 2,
      { zoom: 1.5, duration: 800 }
    );

    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          highlight: n.id === searchCourseId ? "selected" : null,
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

    onSelectCourse(course ?? null);
    onHighlight(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchCourseId]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_, node: Node) => {
      const courseId = node.id;
      const course = courses.find((c) => c.id === courseId) || null;
      onSelectCourse(course);

      if (!mode) {
        // No mode: just select, no highlighting
        setNodes((nds) =>
          nds.map((n) => ({
            ...n,
            data: {
              ...n.data,
              highlight: n.id === courseId ? "selected" : null,
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
        onHighlight(new Set());
        return;
      }

      const highlighted =
        mode === "fail"
          ? getDownstream(courseId, downstream)
          : getUpstream(courseId, upstream);

      onHighlight(highlighted);

      const highlightColor = mode === "fail" ? "#dc2626" : "#16a34a";
      const highlightType = mode === "fail" ? "fail" : "plan";

      setNodes((nds) =>
        nds.map((n) => {
          let highlight: string | null = "dimmed";
          if (n.id === courseId) highlight = "selected";
          else if (highlighted.has(n.id)) highlight = highlightType;
          return { ...n, data: { ...n.data, highlight } };
        })
      );

      const highlightedWithSelected = new Set(highlighted);
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
    [mode, courses, downstream, upstream, setNodes, setEdges, onHighlight, onSelectCourse]
  );

  const handlePaneClick = useCallback(() => {
    onSelectCourse(null);
    onHighlight(new Set());
    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, highlight: null } }))
    );
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        style: { stroke: "#9ca3af", strokeWidth: 1.5 },
        markerEnd: { type: "arrowclosed" as const, color: "#9ca3af" },
        animated: false,
      }))
    );
  }, [setNodes, setEdges, onSelectCourse, onHighlight]);

  return (
    <div style={{ flex: 1, position: "relative" }}>
      {elkLoading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(255,255,255,0.7)",
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            color: "#6b7280",
          }}
        >
          Computing layout…
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onInit={(instance) => { reactFlowRef.current = instance; }}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={2}
        attributionPosition="bottom-right"
      >
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            if (n.data?.highlight === "selected") return "#E5751F";
            if (n.data?.highlight === "fail") return "#dc2626";
            if (n.data?.highlight === "plan") return "#16a34a";
            return n.data?.isCS ? "#861F41" : "#9ca3af";
          }}
          style={{ borderRadius: 8 }}
        />
        <Background gap={20} size={1} color="#f1f5f9" />
      </ReactFlow>
      <Legend />
    </div>
  );
}
