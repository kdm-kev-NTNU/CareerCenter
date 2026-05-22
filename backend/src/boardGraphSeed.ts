import type { BoardGraph, BoardGraphEdge, BoardGraphNode, CareerTrack, Company } from "@careercenter/shared";
import { careerTracks } from "@careercenter/shared";
import type { CareerMapNodeSeed } from "./seedData.js";

const TRACK_COLUMN_WIDTH = 320;
const LEVEL_ROW_HEIGHT = 200;
const ORIGIN_X = 80;
const ORIGIN_Y = 60;

function trackColumn(track: CareerTrack | undefined): number {
  if (!track) return Math.floor(careerTracks.length / 2);
  const index = careerTracks.indexOf(track);
  return index >= 0 ? index : 0;
}

function matchCompanyId(name: string, companies: Company[]): string | null {
  const normalized = name.trim().toLowerCase();
  const exact = companies.find((c) => c.name.toLowerCase() === normalized);
  if (exact) return exact.id;
  const partial = companies.find(
    (c) =>
      c.name.toLowerCase().includes(normalized) ||
      normalized.includes(c.name.toLowerCase()) ||
      normalized.replace(/\s+/g, "").includes(c.id.replace(/-/g, ""))
  );
  return partial?.id ?? null;
}

export function buildDefaultBoardGraph(
  mapNodeSeeds: CareerMapNodeSeed[],
  companies: Company[]
): BoardGraph {
  const nodes: BoardGraphNode[] = [];
  const edges: BoardGraphEdge[] = [];
  const levelFirstByTrack = new Map<CareerTrack, string>();
  const previousFirstByTrack = new Map<CareerTrack, string>();

  const nowSeed = mapNodeSeeds.find((n) => n.level === 0);
  const nowId = "node-now";
  nodes.push({
    id: nowId,
    type: "milestone",
    position: { x: ORIGIN_X + trackColumn(undefined) * TRACK_COLUMN_WIDTH, y: ORIGIN_Y },
    data: { label: nowSeed?.title ?? "NTNU KI" }
  });

  for (const seed of mapNodeSeeds.filter((n) => n.level > 0)) {
    const col = trackColumn(seed.track);
    const baseX = ORIGIN_X + col * TRACK_COLUMN_WIDTH;
    const baseY = ORIGIN_Y + seed.level * LEVEL_ROW_HEIGHT;

    seed.items.forEach((itemName, itemIndex) => {
      const nodeId = `node-${seed.id}-${itemIndex}`;
      const companyId = matchCompanyId(itemName, companies);
      const x = baseX + (itemIndex % 2) * 140;
      const y = baseY + Math.floor(itemIndex / 2) * 90;

      if (companyId) {
        nodes.push({
          id: nodeId,
          type: "company",
          position: { x, y },
          data: { companyId }
        });
      } else {
        nodes.push({
          id: nodeId,
          type: "milestone",
          position: { x, y },
          data: { label: itemName }
        });
      }

      if (seed.level === 1 && seed.track && itemIndex === 0) {
        levelFirstByTrack.set(seed.track, nodeId);
        edges.push({ id: `e-${nowId}-${nodeId}`, source: nowId, target: nodeId, label: seed.title });
      }

      if (seed.track && itemIndex === 0) {
        const prev = previousFirstByTrack.get(seed.track);
        if (prev) {
          edges.push({
            id: `e-${prev}-${nodeId}`,
            source: prev,
            target: nodeId,
            label: seed.title
          });
        }
        previousFirstByTrack.set(seed.track, nodeId);
      }
    });
  }

  return { nodes, edges };
}

export const emptyBoardGraph = (): BoardGraph => ({ nodes: [], edges: [] });
