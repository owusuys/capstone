import type { Node, Edge } from "reactflow";
import type { Course } from "../types/course";

const NODE_W = 180;
const NODE_H_CS = 60;
const NODE_H_EXT = 40;
const H_GAP = 40;

export const LAYER_Y = {
  prereqs: 0,
  target: 220,
  dependents: 440,
} as const;

export interface PathwayLayout {
  nodes: Node[];
  edges: Edge[];
  layerY: typeof LAYER_Y;
}

function rowPositions(
  count: number,
  canvasCenterX: number
): number[] {
  if (count === 0) return [];
  const totalRowW = count * NODE_W + (count - 1) * H_GAP;
  const startX = canvasCenterX - totalRowW / 2;
  return Array.from({ length: count }, (_, i) => startX + i * (NODE_W + H_GAP));
}

export function computePathwayLayout(
  targetId: string,
  prereqIds: string[],
  dependentIds: string[],
  courses: Course[],
  coreqIds: string[] = []
): PathwayLayout {
  const courseMap = new Map(courses.map((c) => [c.id, c]));

  // Middle row contains target + corequisites
  const allMiddleIds = [targetId, ...coreqIds];

  // Canvas centre is derived from the widest layer
  const maxCols = Math.max(prereqIds.length || 1, allMiddleIds.length, dependentIds.length || 1);
  const canvasCenterX = (maxCols * NODE_W + (maxCols - 1) * H_GAP) / 2;

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // ── Layer 1: prerequisites ─────────────────────────────────
  if (prereqIds.length > 0) {
    const xs = rowPositions(prereqIds.length, canvasCenterX);
    prereqIds.forEach((id, i) => {
      const course = courseMap.get(id);
      nodes.push({
        id,
        type: "courseNode",
        position: { x: xs[i], y: LAYER_Y.prereqs },
        data: {
          ...(course ?? { id, name: id, credits: 0, prerequisitesRaw: null, notes: null, corequisites: [], isCS: false }),
          highlight: "plan",
        },
      });
      edges.push({
        id: `prereq-${id}-${targetId}`,
        source: id,
        target: targetId,
        sourceHandle: "bottom",
        targetHandle: "top",
        style: { stroke: "#16a34a", strokeWidth: 2 },
        markerEnd: { type: "arrowclosed" as const, color: "#16a34a" },
        animated: false,
      });
    });
  } else {
    // Placeholder
    nodes.push({
      id: "__placeholder_prereq",
      type: "pathwayPlaceholder",
      position: { x: canvasCenterX - NODE_W / 2, y: LAYER_Y.prereqs },
      data: { label: "No prerequisites", isPlaceholder: true },
      selectable: false,
      draggable: false,
    });
  }

  // ── Layer 2: target + corequisites ────────────────────────
  const middleXs = rowPositions(allMiddleIds.length, canvasCenterX);

  allMiddleIds.forEach((id, i) => {
    const course = courseMap.get(id);
    const isTarget = id === targetId;
    nodes.push({
      id,
      type: "courseNode",
      position: { x: middleXs[i], y: LAYER_Y.target },
      data: {
        ...(course ?? { id, name: id, credits: 0, prerequisitesRaw: null, notes: null, corequisites: [], isCS: false }),
        highlight: isTarget ? "selected" : "coreq",
      },
    });

    if (!isTarget) {
      // Dashed horizontal edge from target's right handle to coreq's left handle
      edges.push({
        id: `coreq-${targetId}-${id}`,
        source: targetId,
        target: id,
        sourceHandle: "right",
        targetHandle: "left",
        type: "straight",
        style: { stroke: "#3b82f6", strokeWidth: 1.5, strokeDasharray: "6,3" },
        animated: false,
      });
    }
  });

  // ── Layer 3: dependents ────────────────────────────────────
  if (dependentIds.length > 0) {
    const xs = rowPositions(dependentIds.length, canvasCenterX);
    dependentIds.forEach((id, i) => {
      const course = courseMap.get(id);
      nodes.push({
        id,
        type: "courseNode",
        position: { x: xs[i], y: LAYER_Y.dependents },
        data: {
          ...(course ?? { id, name: id, credits: 0, prerequisitesRaw: null, notes: null, corequisites: [], isCS: false }),
          highlight: "fail",
        },
      });
      edges.push({
        id: `dep-${targetId}-${id}`,
        source: targetId,
        target: id,
        sourceHandle: "bottom",
        targetHandle: "top",
        style: { stroke: "#dc2626", strokeWidth: 2 },
        markerEnd: { type: "arrowclosed" as const, color: "#dc2626" },
        animated: false,
      });
    });
  } else {
    nodes.push({
      id: "__placeholder_dep",
      type: "pathwayPlaceholder",
      position: { x: canvasCenterX - NODE_W / 2, y: LAYER_Y.dependents },
      data: { label: "No courses unlocked", isPlaceholder: true },
      selectable: false,
      draggable: false,
    });
  }

  return { nodes, edges, layerY: LAYER_Y };
}
