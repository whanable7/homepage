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
) {
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
    nodes.forEach((n) => {
      n.x = Math.max(20 + n.width / 2, Math.min(width - 20 - n.width / 2, n.x));
      n.y = Math.max(
        20 + n.height / 2,
        Math.min(height - 20 - n.height / 2, n.y),
      );
    });
  }
}
