import type { CosmosNode } from "./cosmos-physics";
interface Cell {
  left: number;
  top: number;
  back: number;
  size: number;
  x: number;
  y: number;
  z: number;
  count: number;
  children?: Cell[];
  points?: CosmosNode[];
}
function build(
  points: CosmosNode[],
  left: number,
  top: number,
  back: number,
  size: number,
  depth = 0,
): Cell {
  const cell: Cell = {
    left,
    top,
    back,
    size,
    count: points.length,
    x: 0,
    y: 0,
    z: 0,
  };
  for (const p of points) {
    cell.x += p.x;
    cell.y += p.y;
    cell.z += p.z;
  }
  const count = Math.max(1, cell.count);
  cell.x /= count;
  cell.y /= count;
  cell.z /= count;
  if (points.length <= 8 || depth >= 18 || size < 0.01) {
    cell.points = points;
    return cell;
  }
  const half = size / 2,
    buckets: CosmosNode[][] = Array.from({ length: 8 }, () => []);
  for (const p of points)
    buckets[
      (p.x >= left + half ? 1 : 0) |
        (p.y >= top + half ? 2 : 0) |
        (p.z >= back + half ? 4 : 0)
    ].push(p);
  cell.children = buckets.flatMap((items, i) =>
    items.length
      ? [
          build(
            items,
            left + (i & 1 ? half : 0),
            top + (i & 2 ? half : 0),
            back + (i & 4 ? half : 0),
            half,
            depth + 1,
          ),
        ]
      : [],
  );
  return cell;
}
// For large collections, approximate only distant cells. Nearby stars retain the original force.
export function applyCosmosRepulsion(nodes: CosmosNode[], repulsion: number) {
  const strength = repulsion * 0.03;
  const apply = (
    a: CosmosNode,
    x: number,
    y: number,
    z: number,
    count: number,
  ) => {
    const dx = a.x - x,
      dy = a.y - y,
      dz = a.z - z;
    const f = (strength * count) / (dx * dx + dy * dy + dz * dz + 25);
    a.vx += dx * f;
    a.vy += dy * f;
    a.vz += dz * f * 0.1;
  };
  if (nodes.length <= 200) {
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i],
          b = nodes[j],
          dx = a.x - b.x,
          dy = a.y - b.y,
          dz = a.z - b.z;
        const f = strength / (dx * dx + dy * dy + dz * dz + 25);
        a.vx += dx * f;
        a.vy += dy * f;
        a.vz += dz * f * 0.1;
        b.vx -= dx * f;
        b.vy -= dy * f;
        b.vz -= dz * f * 0.1;
      }
    return;
  }
  let left = Infinity,
    top = Infinity,
    back = Infinity,
    right = -Infinity,
    bottom = -Infinity,
    front = -Infinity;
  for (const p of nodes) {
    left = Math.min(left, p.x);
    top = Math.min(top, p.y);
    back = Math.min(back, p.z);
    right = Math.max(right, p.x);
    bottom = Math.max(bottom, p.y);
    front = Math.max(front, p.z);
  }
  const root = build(
    nodes,
    left,
    top,
    back,
    Math.max(right - left, bottom - top, front - back, 1) + 0.001,
  );
  function visit(a: CosmosNode, c: Cell) {
    if (c.points) {
      for (const b of c.points) if (a !== b) apply(a, b.x, b.y, b.z, 1);
      return;
    }
    const inside =
      a.x >= c.left &&
      a.x <= c.left + c.size &&
      a.y >= c.top &&
      a.y <= c.top + c.size &&
      a.z >= c.back &&
      a.z <= c.back + c.size;
    const d2 = (a.x - c.x) ** 2 + (a.y - c.y) ** 2 + (a.z - c.z) ** 2;
    if (!inside && c.size * c.size < d2 * 0.36)
      apply(a, c.x, c.y, c.z, c.count);
    else for (const child of c.children!) visit(a, child);
  }
  for (const a of nodes) visit(a, root);
}
