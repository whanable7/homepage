import type { SimulationNodeDatum } from "d3-force";
import type { ArchiveWork } from "@/types/archive";
import { imageRatio } from "./layouts";

export interface EcosystemNode extends SimulationNodeDatum {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function ecosystemNodes(
  works: ArchiveWork[],
  width: number,
  height: number,
): EcosystemNode[] {
  return works.map((work, i) => {
    const ratio = imageRatio(work);
    let w = Math.max(38, Math.min(72, 52 * Math.sqrt(ratio)));
    let h = w / ratio;
    const fit = Math.min(1, 110 / Math.max(w, h));
    w *= fit;
    h *= fit;
    return {
      id: work.id,
      x: width / 2 + Math.cos(i * 2.399) * Math.sqrt(i + 1) * 30,
      y: height / 2 + Math.sin(i * 2.399) * Math.sqrt(i + 1) * 25,
      width: w,
      height: h,
    };
  });
}

// Keep image bounds apart while the forces settle, including after dragging.
export function separateEcosystemNodes(
  nodes: EcosystemNode[],
  width: number,
  height: number,
  passes = 4,
  constrain = true,
) {
  if (nodes.length > 200) {
    separateLargeCollection(nodes, width, height, constrain);
    return;
  }
  for (let pass = 0; pass < passes; pass++) {
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = (a.width + b.width) / 2 + 7 - Math.abs(a.x - b.x);
        const dy = (a.height + b.height) / 2 + 7 - Math.abs(a.y - b.y);
        if (dx <= 0 || dy <= 0) continue;
        const fixedA = a.fx != null,
          fixedB = b.fx != null;
        if (fixedA && fixedB) continue;
        const shareA = fixedA ? 0 : fixedB ? 1 : 0.5;
        const shareB = fixedB ? 0 : fixedA ? 1 : 0.5;
        if (dx < dy) {
          const move = (a.x <= b.x ? -1 : 1) * (dx + 0.01);
          a.x += move * shareA;
          b.x -= move * shareB;
        } else {
          const move = (a.y <= b.y ? -1 : 1) * (dy + 0.01);
          a.y += move * shareA;
          b.y -= move * shareB;
        }
      }
    }
    if (constrain)
      nodes.forEach((n) => {
        n.x = Math.max(
          20 + n.width / 2,
          Math.min(width - 20 - n.width / 2, n.x),
        );
        n.y = Math.max(
          20 + n.height / 2,
          Math.min(height - 20 - n.height / 2, n.y),
        );
      });
  }
}

// A spatial index resolves nearby rectangles once, rather than rescanning all
// pairs on every pass. Existing small collections keep their exact movement.
function separateLargeCollection(
  nodes: EcosystemNode[],
  width: number,
  height: number,
  constrain: boolean,
) {
  const cellSize = Math.max(
    1,
    ...nodes.map((n) => Math.max(n.width, n.height) + 7),
  );
  const cells = new Map<string, EcosystemNode[]>();
  const key = (x: number, y: number) =>
    `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;
  const insert = (n: EcosystemNode) => {
    const k = key(n.x, n.y);
    const bucket = cells.get(k);
    if (bucket) bucket.push(n);
    else cells.set(k, [n]);
  };
  const free = (a: EcosystemNode, x: number, y: number) => {
    const cx = Math.floor(x / cellSize),
      cy = Math.floor(y / cellSize);
    for (let i = cx - 1; i <= cx + 1; i++)
      for (let j = cy - 1; j <= cy + 1; j++) {
        for (const b of cells.get(`${i},${j}`) || []) {
          if (
            Math.abs(x - b.x) < (a.width + b.width) / 2 + 7 &&
            Math.abs(y - b.y) < (a.height + b.height) / 2 + 7
          )
            return false;
        }
      }
    return true;
  };
  const fixed = nodes.filter((n) => n.fx != null || n.fy != null);
  fixed.forEach(insert);
  nodes.forEach((n, index) => {
    if (n.fx != null || n.fy != null) return;
    if (constrain) {
      n.x = Math.max(20 + n.width / 2, Math.min(width - 20 - n.width / 2, n.x));
      n.y = Math.max(
        20 + n.height / 2,
        Math.min(height - 20 - n.height / 2, n.y),
      );
    }
    const ox = n.x,
      oy = n.y;
    if (!free(n, ox, oy)) {
      let placed = false;
      for (let ring = 1; ring <= 300 && !placed; ring++) {
        const radius = ring * 8,
          samples = Math.ceil(radius / 5) + 8;
        for (let sample = 0; sample < samples; sample++) {
          const angle = index * 2.399963 + (sample / samples) * Math.PI * 2;
          const x = ox + Math.cos(angle) * radius,
            y = oy + Math.sin(angle) * radius;
          if (
            constrain &&
            (x < 20 + n.width / 2 ||
              x > width - 20 - n.width / 2 ||
              y < 20 + n.height / 2 ||
              y > height - 20 - n.height / 2)
          )
            continue;
          if (free(n, x, y)) {
            n.x = x;
            n.y = y;
            placed = true;
            break;
          }
        }
      }
    }
    insert(n);
  });
}
