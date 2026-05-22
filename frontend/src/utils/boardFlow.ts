import type { BoardGraph, BoardGraphEdge, BoardGraphNode, BoardNodeType } from "@careercenter/shared";
import { MarkerType, type Edge, type Node } from "@vue-flow/core";

export const BOARD_EDGE_TYPE = "board";

export const defaultBoardEdgeOptions = {
  type: BOARD_EDGE_TYPE,
  markerEnd: MarkerType.ArrowClosed,
  animated: false
} as const;

export function graphToFlow(graph: BoardGraph): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: { ...node.position },
      data: { ...node.data }
    })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: BOARD_EDGE_TYPE,
      markerEnd: MarkerType.ArrowClosed,
      label: edge.label,
      data: { label: edge.label ?? "" }
    }))
  };
}

export function flowToGraph(nodes: Node[], edges: Edge[]): BoardGraph {
  const boardNodes: BoardGraphNode[] = nodes.map((node) => {
    const position = { x: Number(node.position.x), y: Number(node.position.y) };
    const type = (node.type ?? "milestone") as BoardNodeType;
    return {
      id: String(node.id),
      type,
      position,
      data: node.data as BoardGraphNode["data"]
    };
  });

  const boardEdges: BoardGraphEdge[] = edges.map((edge) => ({
    id: String(edge.id),
    source: String(edge.source),
    target: String(edge.target),
    label: typeof edge.label === "string" ? edge.label : (edge.data as { label?: string } | undefined)?.label
  }));

  return { nodes: boardNodes, edges: boardEdges };
}

export function newNodeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}
