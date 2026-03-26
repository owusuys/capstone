import dagre from "dagre";
import type { Node, Edge } from "reactflow";
import type { Course, PrereqEdge } from "../types/course";

const NODE_WIDTH = 180;
const NODE_HEIGHT_CS = 60;
const NODE_HEIGHT_EXT = 40;

export function computeLayout(
  courses: Course[],
  prereqEdges: PrereqEdge[]
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "TB",
    nodesep: 60,
    ranksep: 100,
    marginx: 40,
    marginy: 40,
  });

  // Add nodes
  for (const course of courses) {
    const height = course.isCS ? NODE_HEIGHT_CS : NODE_HEIGHT_EXT;
    g.setNode(course.id, { width: NODE_WIDTH, height });
  }

  // Add edges
  for (const edge of prereqEdges) {
    // Only add edge if both nodes exist
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  const nodes: Node[] = courses.map((course) => {
    const pos = g.node(course.id);
    return {
      id: course.id,
      type: "courseNode",
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - (course.isCS ? NODE_HEIGHT_CS : NODE_HEIGHT_EXT) / 2,
      },
      data: course,
    };
  });

  const edges: Edge[] = prereqEdges
    .filter((e) => g.hasNode(e.source) && g.hasNode(e.target))
    .map((e, i) => ({
      id: `e-${i}`,
      source: e.source,
      target: e.target,
      sourceHandle: "bottom",
      targetHandle: "top",
      label: e.gradeReq ? `${e.gradeReq} req` : undefined,
      animated: false,
      style: { stroke: "#9ca3af", strokeWidth: 1.5 },
      markerEnd: { type: "arrowclosed" as const, color: "#9ca3af" },
    }));

  return { nodes, edges };
}
