import { describe, expect, it } from "vitest";
import type { Node } from "@vue-flow/core";
import { flowToGraph, graphToFlow, newNodeId } from "./boardFlow.js";

describe("boardFlow", () => {
  it("round-trips graph data through vue-flow nodes and edges", () => {
    const graph = {
      nodes: [
        {
          id: "n1",
          type: "milestone" as const,
          position: { x: 1, y: 2 },
          data: { label: "Start" }
        }
      ],
      edges: [{ id: "e1", source: "n1", target: "n1", label: "loop" }]
    };

    const { nodes, edges } = graphToFlow(graph);
    expect(flowToGraph(nodes, edges)).toEqual(graph);
  });

  it("reads edge labels from data when the edge label is not a string", () => {
    const nodes: Node[] = [
      {
        id: "n1",
        type: "milestone",
        position: { x: 0, y: 0 },
        data: { label: "A" }
      }
    ];
    const edges = [
      {
        id: "e1",
        source: "n1",
        target: "n1",
        data: { label: "from-data" }
      }
    ] as Parameters<typeof flowToGraph>[1];

    expect(flowToGraph(nodes, edges).edges[0].label).toBe("from-data");
  });

  it("creates unique node ids", () => {
    expect(newNodeId("note")).not.toBe(newNodeId("note"));
  });
});
