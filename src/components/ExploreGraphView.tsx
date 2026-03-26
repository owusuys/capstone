import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import ReactFlow, {
  Controls,
  MiniMap,
  Background,
  Panel,
  useNodesState,
  useEdgesState,
} from "reactflow";
import type { Node, NodeMouseHandler, ReactFlowInstance } from "reactflow";
import "reactflow/dist/style.css";

import CourseNode from "./CourseNode";
import type { Course, HighlightMode, PrereqEdge } from "../types/course";
import { computeLayout } from "../utils/layout";
import { buildAdjacency, getDownstream, getUpstream } from "../utils/graph";

interface ExploreGraphViewProps {
  courses: Course[];
  prereqEdges: PrereqEdge[];
  mode: HighlightMode | null;
  onSelectCourse: (course: Course | null) => void;
  onHighlight: (nodes: Set<string>) => void;
  searchCourseId?: string | null;
  prereqDepth: number;
  unlockedDepth: number;
  onPrereqDepthChange: (d: number) => void;
  onUnlockedDepthChange: (d: number) => void;
  pinnedCourseIds: Set<string>;
}

const nodeTypes = { courseNode: CourseNode };

const DEPTH_STEPS = [1, 2, Infinity];
const depthLabel = (d: number) => (d === Infinity ? "3+" : String(d));
const depthToStep = (d: number) => {
  const i = DEPTH_STEPS.indexOf(d);
  return i === -1 ? 2 : i;
};

export default function ExploreGraphView({
  courses,
  prereqEdges,
  mode,
  onSelectCourse,
  onHighlight,
  searchCourseId,
  prereqDepth,
  unlockedDepth,
  onPrereqDepthChange,
  onUnlockedDepthChange,
  pinnedCourseIds,
}: ExploreGraphViewProps) {
  const { downstream, upstream } = useMemo(
    () => buildAdjacency(prereqEdges),
    [prereqEdges]
  );

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const reactFlowRef = useRef<ReactFlowInstance | null>(null);

  // Compute visible IDs: union of selected course's subgraph + all pinned courses' subgraphs
  const visibleIds = useMemo(() => {
    const ids = new Set<string>();

    const addSubgraph = (courseId: string) => {
      ids.add(courseId);
      getUpstream(courseId, upstream, prereqDepth).forEach((id) => ids.add(id));
      getDownstream(courseId, downstream, unlockedDepth).forEach((id) => ids.add(id));
    };

    if (selectedCourseId) addSubgraph(selectedCourseId);
    for (const pinnedId of pinnedCourseIds) addSubgraph(pinnedId);

    return ids;
  }, [selectedCourseId, pinnedCourseIds, upstream, downstream, prereqDepth, unlockedDepth]);

  // Rebuild graph whenever visible set, mode, or pin state changes
  useEffect(() => {
    if (visibleIds.size === 0) {
      setNodes([]);
      setEdges([]);
      onHighlight(new Set());
      return;
    }

    const visibleCourses = courses.filter((c) => visibleIds.has(c.id));
    const visibleEdgeList = prereqEdges.filter(
      (e) => visibleIds.has(e.source) && visibleIds.has(e.target)
    );
    const layout = computeLayout(visibleCourses, visibleEdgeList);

    // Compute highlighted nodes based on mode + selected course
    const highlighted: Set<string> = selectedCourseId
      ? mode === "fail"
        ? getDownstream(selectedCourseId, downstream, unlockedDepth)
        : mode === "plan"
        ? getUpstream(selectedCourseId, upstream, prereqDepth)
        : new Set<string>()
      : new Set<string>();
    onHighlight(highlighted);

    const highlightType = mode === "fail" ? "fail" : "plan";
    const highlightColor = mode === "fail" ? "#dc2626" : "#16a34a";
    const highlightedWithSelected = new Set([
      ...(selectedCourseId ? [selectedCourseId] : []),
      ...highlighted,
    ]);

    setNodes(
      layout.nodes.map((n) => {
        let highlight: string | null = null;
        if (n.id === selectedCourseId) {
          highlight = "selected";
        } else if (pinnedCourseIds.has(n.id)) {
          highlight = "pinned";
        } else if (mode && highlighted.has(n.id)) {
          highlight = highlightType;
        } else if (mode) {
          highlight = "dimmed";
        }
        return { ...n, data: { ...n.data, highlight } };
      })
    );

    setEdges(
      layout.edges.map((e) => {
        const isRelevant =
          mode !== null &&
          highlightedWithSelected.has(e.source) &&
          highlightedWithSelected.has(e.target);
        return {
          ...e,
          style: {
            stroke: isRelevant ? highlightColor : "#9ca3af",
            strokeWidth: isRelevant ? 2.5 : 1.5,
          },
          markerEnd: {
            type: "arrowclosed" as const,
            color: isRelevant ? highlightColor : "#9ca3af",
          },
          animated: isRelevant,
        };
      })
    );

    setTimeout(() => reactFlowRef.current?.fitView({ padding: 0.2 }), 60);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleIds, mode, selectedCourseId, pinnedCourseIds]);

  // Search: select the course to reveal its subgraph
  useEffect(() => {
    if (!searchCourseId) return;
    const course = courses.find((c) => c.id === searchCourseId);
    if (!course) return;
    setSelectedCourseId(searchCourseId);
    onSelectCourse(course);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchCourseId]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_, node: Node) => {
      if (node.id === selectedCourseId) {
        setSelectedCourseId(null);
        onSelectCourse(null);
        return;
      }
      const course = courses.find((c) => c.id === node.id) || null;
      onSelectCourse(course);
      setSelectedCourseId(node.id);
    },
    [courses, onSelectCourse, selectedCourseId]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedCourseId(null);
    onSelectCourse(null);
  }, [onSelectCourse]);

  const hasContent = visibleIds.size > 0;

  if (!hasContent) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 12,
          backgroundColor: "#fafafa",
        }}
      >
        <div style={{ fontSize: 36, lineHeight: 1 }}>&#128269;</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#374151" }}>
          Start exploring
        </div>
        <div
          style={{
            fontSize: 13,
            color: "#6b7280",
            textAlign: "center",
            maxWidth: 340,
            lineHeight: 1.7,
          }}
        >
          Search for a course above to reveal its prerequisite chain and the
          courses it unlocks. Pin courses in the side panel to keep them visible
          as you explore others.
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, position: "relative" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onInit={(instance) => {
          reactFlowRef.current = instance;
        }}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        attributionPosition="bottom-right"
      >
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            if (n.data?.highlight === "selected") return "#E5751F";
            if (n.data?.highlight === "pinned") return "#7c3aed";
            if (n.data?.highlight === "fail") return "#dc2626";
            if (n.data?.highlight === "plan") return "#16a34a";
            return n.data?.isCS ? "#861F41" : "#9ca3af";
          }}
          style={{ borderRadius: 8 }}
        />
        <Background gap={20} size={1} color="#f1f5f9" />

        <Panel position="top-left">
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: "14px 16px",
              minWidth: 200,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
          >
            <SliderRow
              label="Prerequisite depth"
              color="#16a34a"
              value={prereqDepth}
              onChange={onPrereqDepthChange}
            />
            <div style={{ height: 12 }} />
            <SliderRow
              label="Unlocked courses depth"
              color="#dc2626"
              value={unlockedDepth}
              onChange={onUnlockedDepthChange}
            />
          </div>
        </Panel>

        {pinnedCourseIds.size > 0 && (
          <Panel position="bottom-left">
            <div
              style={{
                background: "#f5f3ff",
                border: "1px solid #7c3aed",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 12,
                color: "#5b21b6",
                fontWeight: 600,
              }}
            >
              {pinnedCourseIds.size} course{pinnedCourseIds.size > 1 ? "s" : ""} pinned
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}

function SliderRow({
  label,
  color,
  value,
  onChange,
}: {
  label: string;
  color: string;
  value: number;
  onChange: (d: number) => void;
}) {
  const step = depthToStep(value);
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>
          {label}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color,
            background: color + "18",
            borderRadius: 4,
            padding: "1px 7px",
            minWidth: 28,
            textAlign: "center",
          }}
        >
          {depthLabel(value)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={2}
        step={1}
        value={step}
        onChange={(e) => onChange(DEPTH_STEPS[Number(e.target.value)])}
        style={{ width: "100%", accentColor: color, cursor: "pointer" }}
      />
      <div
        style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}
      >
        {DEPTH_STEPS.map((d) => (
          <span
            key={d}
            style={{
              fontSize: 10,
              color: value === d ? color : "#9ca3af",
              fontWeight: value === d ? 700 : 400,
            }}
          >
            {depthLabel(d)}
          </span>
        ))}
      </div>
    </div>
  );
}
