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
  prereqDepth: number;
  unlockedDepth: number;
  onPrereqDepthChange: (d: number) => void;
  onUnlockedDepthChange: (d: number) => void;
}

const nodeTypes = { courseNode: CourseNode };

const DEPTH_STEPS = [1, 2, Infinity];
const depthLabel = (d: number) => (d === Infinity ? "3+" : String(d));
const depthToStep = (d: number) => { const i = DEPTH_STEPS.indexOf(d); return i === -1 ? 2 : i; };

// Reset edge styles to default grey
const defaultEdgeStyle = (e: import("reactflow").Edge) => ({
  ...e,
  style: { stroke: "#9ca3af", strokeWidth: 1.5 },
  markerEnd: { type: "arrowclosed" as const, color: "#9ca3af" },
  animated: false,
});

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
  prereqDepth,
  unlockedDepth,
  onPrereqDepthChange,
  onUnlockedDepthChange,
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

  // Track selected course for toggle + depth-change re-application
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  // Store original (full-graph) node positions so we can restore them on deselect
  const originalNodesRef = useRef<Node[]>(elkNodes ?? initialLayout.nodes);

  const reactFlowRef = useRef<ReactFlowInstance | null>(null);

  // When ELK layout arrives, apply it and store as the canonical "original" positions
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => {
    if (elkNodes) {
      setNodes(elkNodes);
      originalNodesRef.current = elkNodes;
    }
    if (elkEdges) setEdges(elkEdges);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elkNodes, elkEdges]);

  // ── Deselect helper (restores full graph layout) ─────────────────────────
  const deselect = useCallback(() => {
    setSelectedCourseId(null);
    onSelectCourse(null);
    onHighlight(new Set());
    setNodes(originalNodesRef.current.map((n) => ({
      ...n,
      hidden: false,
      data: { ...n.data, highlight: null },
    })));
    setEdges((eds) => eds.map(defaultEdgeStyle));
    setTimeout(() => reactFlowRef.current?.fitView({ padding: 0.15 }), 50);
  }, [onSelectCourse, onHighlight, setNodes, setEdges]);

  // ── Core selection + layout effect ───────────────────────────────────────
  // Runs whenever the selected course, depth sliders, or mode changes.
  useEffect(() => {
    if (!selectedCourseId) return;

    const upSet   = getUpstream(selectedCourseId, upstream, prereqDepth);
    const downSet = getDownstream(selectedCourseId, downstream, unlockedDepth);
    const visibleIds = new Set([selectedCourseId, ...upSet, ...downSet]);

    // Mode-specific highlight set and colours
    const highlighted: Set<string> =
      mode === "fail" ? downSet : mode === "plan" ? upSet : new Set();
    const highlightType = mode === "fail" ? "fail" : "plan";
    const highlightColor = mode === "fail" ? "#dc2626" : "#16a34a";
    onHighlight(highlighted);

    // Run dagre on just the visible subgraph to get a clean layered layout
    const visibleCourses = courses.filter((c) => visibleIds.has(c.id));
    const visibleEdges   = prereqEdges.filter(
      (e) => visibleIds.has(e.source) && visibleIds.has(e.target)
    );
    const subLayout = computeLayout(visibleCourses, visibleEdges);
    const posMap = new Map(subLayout.nodes.map((n) => [n.id, n.position]));

    setNodes((nds) =>
      nds.map((n) => {
        const isVisible = visibleIds.has(n.id);
        let highlight: string | null = null;
        if (n.id === selectedCourseId) {
          highlight = "selected";
        } else if (mode && highlighted.has(n.id)) {
          highlight = highlightType;
        } else if (isVisible && mode) {
          highlight = "dimmed";
        }
        return {
          ...n,
          position: posMap.get(n.id) ?? n.position,
          hidden: !isVisible,
          data: { ...n.data, highlight },
        };
      })
    );

    const highlightedWithSelected = new Set([selectedCourseId, ...highlighted]);
    setEdges((eds) =>
      eds.map((e) => {
        const isRelevant =
          highlightedWithSelected.has(e.source) &&
          highlightedWithSelected.has(e.target);
        return {
          ...e,
          style: {
            stroke: isRelevant ? highlightColor : "#9ca3af",
            strokeWidth: isRelevant ? 2.5 : 1,
          },
          markerEnd: {
            type: "arrowclosed" as const,
            color: isRelevant ? highlightColor : "#9ca3af",
          },
          animated: isRelevant,
        };
      })
    );

    // Fit viewport to the rearranged subgraph
    setTimeout(() => reactFlowRef.current?.fitView({ padding: 0.2 }), 60);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId, prereqDepth, unlockedDepth, mode, upstream, downstream, courses, prereqEdges]);

  // ── Search: pan/zoom to searched course ──────────────────────────────────
  useEffect(() => {
    if (!searchCourseId || !reactFlowRef.current) return;

    const target = nodes.find((n) => n.id === searchCourseId);
    if (!target) return;

    const course = courses.find((c) => c.id === searchCourseId);
    const nodeHeight = course?.isCS ? 60 : 40;

    reactFlowRef.current.setCenter(
      target.position.x + 90,
      target.position.y + nodeHeight / 2,
      { zoom: 1.5, duration: 800 }
    );

    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        hidden: false,
        data: { ...n.data, highlight: n.id === searchCourseId ? "selected" : null },
      }))
    );
    setEdges((eds) => eds.map(defaultEdgeStyle));

    setSelectedCourseId(null);
    onSelectCourse(course ?? null);
    onHighlight(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchCourseId]);

  // ── Node click ────────────────────────────────────────────────────────────
  const handleNodeClick: NodeMouseHandler = useCallback(
    (_, node: Node) => {
      // Re-clicking the selected course → deselect (toggle off)
      if (node.id === selectedCourseId) {
        deselect();
        return;
      }
      const course = courses.find((c) => c.id === node.id) || null;
      onSelectCourse(course);
      setSelectedCourseId(node.id); // triggers the useEffect above
    },
    [courses, onSelectCourse, selectedCourseId, deselect]
  );

  // ── Pane click (deselect) ─────────────────────────────────────────────────
  const handlePaneClick = useCallback(() => {
    deselect();
  }, [deselect]);

  const hasSelection = selectedCourseId !== null;

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

        {/* ── Depth sliders panel ── */}
        <Panel position="top-left">
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: "14px 16px",
              minWidth: 200,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              opacity: hasSelection ? 1 : 0.45,
              pointerEvents: hasSelection ? "auto" : "none",
              transition: "opacity 0.2s",
            }}
          >
            {!hasSelection && (
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 10, fontStyle: "italic" }}>
                Select a course to filter depth
              </div>
            )}
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
      </ReactFlow>
      <Legend />
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color, background: color + "18", borderRadius: 4, padding: "1px 7px", minWidth: 28, textAlign: "center" }}>
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
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        {DEPTH_STEPS.map((d) => (
          <span key={d} style={{ fontSize: 10, color: value === d ? color : "#9ca3af", fontWeight: value === d ? 700 : 400 }}>
            {depthLabel(d)}
          </span>
        ))}
      </div>
    </div>
  );
}
