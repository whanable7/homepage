import type { WorkGroup } from "@/types/archive";
export const cosmosDefaults = {
  repulsion: 55,
  center: 0.018,
  distance: 44,
  tension: 0.012,
  damping: 0.82,
  rotation: 1,
};
export type CosmosPhysics = typeof cosmosDefaults;
export interface CosmosNode {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  ax: number;
  ay: number;
  az: number;
}
export function cosmosHash(value: string) {
  let h = 2166136261;
  for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}
export function cosmosNodes(ids: string[], groups: WorkGroup[]): CosmosNode[] {
  return ids.map((id, i) => {
    const group = groups.findIndex((g) => g.artworkIds.includes(id));
    const angle =
      group < 0
        ? i * 2.399963
        : (group / Math.max(1, groups.length)) * Math.PI * 2 +
          (cosmosHash(id + "angle") - 0.5) * 0.8;
    const radius =
      30 +
      Math.sqrt(cosmosHash(id + "r")) *
        93 *
        (0.86 + cosmosHash(id + "edge") * 0.14);
    const x = Math.cos(angle) * radius,
      y = Math.sin(angle) * radius,
      z = (cosmosHash(id + "z") - 0.5) * 13;
    return { id, x, y, z, ax: x, ay: y, az: z, vx: 0, vy: 0, vz: 0 };
  });
}
export function stepCosmos(
  nodes: CosmosNode[],
  edges: [CosmosNode, CosmosNode][],
  p: CosmosPhysics,
) {
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j],
        dx = a.x - b.x,
        dy = a.y - b.y,
        dz = a.z - b.z;
      const d2 = dx * dx + dy * dy + dz * dz + 25;
      const f = (p.repulsion * 0.03) / d2;
      a.vx += dx * f;
      a.vy += dy * f;
      a.vz += dz * f * 0.1;
      b.vx -= dx * f;
      b.vy -= dy * f;
      b.vz -= dz * f * 0.1;
    }
  }
  for (const [a, b] of edges) {
    const dx = b.x - a.x,
      dy = b.y - a.y,
      dz = b.z - a.z;
    const d = Math.max(1, Math.hypot(dx, dy, dz)),
      f = ((d - p.distance) / d) * p.tension * 0.3;
    a.vx += dx * f;
    a.vy += dy * f;
    a.vz += dz * f;
    b.vx -= dx * f;
    b.vy -= dy * f;
    b.vz -= dz * f;
  }
  for (const n of nodes) {
    n.vx += (n.ax - n.x) * p.center;
    n.vy += (n.ay - n.y) * p.center;
    n.vz += (n.az - n.z) * 0.08;
    const radius = Math.max(0.01, Math.hypot(n.x, n.y));
    if (radius < 27) {
      n.vx += (n.x / radius) * (27 - radius) * 0.12;
      n.vy += (n.y / radius) * (27 - radius) * 0.12;
    }
    n.vx = Math.max(-2, Math.min(2, n.vx * p.damping));
    n.vy = Math.max(-2, Math.min(2, n.vy * p.damping));
    n.vz = Math.max(-1, Math.min(1, n.vz * p.damping));
    n.x += n.vx;
    n.y += n.vy;
    n.z += n.vz;
    // The central opening is part of the artwork's spatial design.
    const r = Math.hypot(n.x, n.y);
    if (r < 24) {
      n.x *= 24 / Math.max(r, 0.001);
      n.y *= 24 / Math.max(r, 0.001);
    }
  }
}
