// @ts-ignore - elkjs bundled build doesn't have perfect TS types
import ELK from "elkjs/lib/elk.bundled.js";
import type { Node, Edge } from "reactflow";
import type { Course, PrereqEdge } from "../types/course";

const NODE_WIDTH = 180;
const NODE_HEIGHT_CS = 60;
const NODE_HEIGHT_EXT = 40;

const elk = new ELK();

export async function computeElkLayout(
  courses: Course[],
  prereqEdges: PrereqEdge[]
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const elkNodes = courses.map((course) => ({
    id: course.id,
    width: NODE_WIDTH,
    height: course.isCS ? NODE_HEIGHT_CS : NODE_HEIGHT_EXT,
  }));

  const elkEdges = prereqEdges.map((e, i) => ({
    id: `e-${i}`,
    sources: [e.source],
    targets: [e.target],
  }));

  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      "elk.spacing.nodeNode": "60",
      "elk.layered.spacing.nodeNodeBetweenLayers": "100",
      "elk.layered.spacing.edgeNodeBetweenLayers": "20",
      "elk.spacing.edgeNode": "20",
    },
    children: elkNodes,
    edges: elkEdges,
  };

  const layout = await elk.layout(graph);

  const nodes: Node[] = courses.map((course) => {
    const elkNode = layout.children?.find((n: { id: string }) => n.id === course.id);
    return {
      id: course.id,
      type: "courseNode",
      position: {
        x: (elkNode?.x ?? 0),
        y: (elkNode?.y ?? 0),
      },
      data: course,
    };
  });

  const edges: Edge[] = prereqEdges.map((e, i) => ({
    id: `e-${i}`,
    source: e.source,
    target: e.target,
    label: e.gradeReq ? `${e.gradeReq} req` : undefined,
    animated: false,
    style: { stroke: "#9ca3af", strokeWidth: 1.5 },
    markerEnd: { type: "arrowclosed" as const, color: "#9ca3af" },
  }));

  return { nodes, edges };
}
