import type { PrereqEdge } from "../types/course";

/**
 * Returns all node IDs and edges within `degrees` hops of `courseId`,
 * traversing both upstream (prerequisites) and downstream (dependents).
 */
export function getNeighborhood(
  courseId: string,
  edges: PrereqEdge[],
  degrees: number = 2
): { nodeIds: Set<string>; edges: PrereqEdge[] } {
  // Build adjacency in both directions
  const outgoing = new Map<string, string[]>(); // downstream
  const incoming = new Map<string, string[]>(); // upstream

  for (const edge of edges) {
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
    outgoing.get(edge.source)!.push(edge.target);

    if (!incoming.has(edge.target)) incoming.set(edge.target, []);
    incoming.get(edge.target)!.push(edge.source);
  }

  // BFS in both directions
  const visited = new Set<string>([courseId]);
  let frontier = [courseId];

  for (let i = 0; i < degrees; i++) {
    const next: string[] = [];
    for (const node of frontier) {
      for (const neighbor of [
        ...(outgoing.get(node) ?? []),
        ...(incoming.get(node) ?? []),
      ]) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }

  // Keep only edges where both endpoints are in the neighborhood
  const neighborEdges = edges.filter(
    (e) => visited.has(e.source) && visited.has(e.target)
  );

  return { nodeIds: visited, edges: neighborEdges };
}
