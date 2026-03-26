import type { PrereqEdge } from "../types/course";

// Build adjacency lists from edges
export function buildAdjacency(edges: PrereqEdge[]) {
  const downstream = new Map<string, Set<string>>(); // course -> courses that depend on it
  const upstream = new Map<string, Set<string>>(); // course -> courses it depends on

  for (const edge of edges) {
    if (!downstream.has(edge.source)) downstream.set(edge.source, new Set());
    downstream.get(edge.source)!.add(edge.target);

    if (!upstream.has(edge.target)) upstream.set(edge.target, new Set());
    upstream.get(edge.target)!.add(edge.source);
  }

  return { downstream, upstream };
}

// BFS to get all downstream courses (affected if you fail this course).
// maxDepth limits how many hops to follow (default: unlimited).
export function getDownstream(
  courseId: string,
  downstream: Map<string, Set<string>>,
  maxDepth = Infinity
): Set<string> {
  const visited = new Set<string>();
  const queue: [string, number][] = [[courseId, 0]];

  while (queue.length > 0) {
    const [current, depth] = queue.shift()!;
    const deps = downstream.get(current);
    if (!deps) continue;
    for (const dep of deps) {
      if (!visited.has(dep)) {
        visited.add(dep);
        if (depth + 1 < maxDepth) queue.push([dep, depth + 1]);
      }
    }
  }

  return visited;
}

// BFS to get all upstream courses (prerequisites needed to take this course).
// maxDepth limits how many hops to follow (default: unlimited).
export function getUpstream(
  courseId: string,
  upstream: Map<string, Set<string>>,
  maxDepth = Infinity
): Set<string> {
  const visited = new Set<string>();
  const queue: [string, number][] = [[courseId, 0]];

  while (queue.length > 0) {
    const [current, depth] = queue.shift()!;
    const prereqs = upstream.get(current);
    if (!prereqs) continue;
    for (const prereq of prereqs) {
      if (!visited.has(prereq)) {
        visited.add(prereq);
        if (depth + 1 < maxDepth) queue.push([prereq, depth + 1]);
      }
    }
  }

  return visited;
}
