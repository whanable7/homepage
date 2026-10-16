import type { ArchiveWork, Placement, WorkGroup } from "@/types/archive";
export function representativeColor(work: ArchiveWork): string {
  if (/^#[0-9a-f]{6}$/i.test(work.representative_color || ""))
    return work.representative_color!;
  const c = work.dominant_color;
  if (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c)) return c;
  if (c && typeof c === "object") {
    const s = c.s / 100,
      l = c.l / 100,
      a = s * Math.min(l, 1 - l),
      f = (n: number) => {
        const k = (n + c.h / 30) % 12;
        return Math.round(
          255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))),
        )
          .toString(16)
          .padStart(2, "0");
      };
    return `#${f(0)}${f(8)}${f(4)}`;
  }
  return work.palette?.[0]?.hex || "#808080";
}
export function colorPosition(work: ArchiveWork): number {
  const hex = representativeColor(work),
    r = parseInt(hex.slice(1, 3), 16) / 255,
    g = parseInt(hex.slice(3, 5), 16) / 255,
    b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  if (d < 0.08) return 360 + (1 - (max + min) / 2) * 45;
  let hue =
    max === r
      ? ((g - b) / d) % 6
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  hue = (hue * 60 + 360) % 360;
  return (hue + 15) % 360;
}
export function imageRatio(work: ArchiveWork) {
  return Math.max(
    0.12,
    Math.min(
      8,
      work.image_width && work.image_height
        ? work.image_width / work.image_height
        : work.image_aspect_ratio
          ? work.image_aspect_ratio
          : work.width && work.height
            ? work.width / work.height
            : 1,
    ),
  );
}
export function strataLayout(
  works: ArchiveWork[],
  width: number,
  seed = 0,
): Placement[] {
  const gap = width < 600 ? 4 : 6,
    desktop = width >= 600,
    result: Placement[] = [];
  const pending = [...works].sort(
    (a, b) => colorPosition(a) - colorPosition(b) || a.id.localeCompare(b.id),
  );
  type Box = { x: number; y: number; width: number; height: number };
  let free: Box[] = [
    {
      x: 0,
      y: 0,
      width: width + gap,
      height: Math.max(2000, works.length * width * 5),
    },
  ];
  while (pending.length) {
    let best: (Placement & { score: number; index: number }) | null = null;
    pending.slice(0, 3).forEach((work, index) => {
      const ratio = imageRatio(work),
        physical = Math.sqrt(
          Math.max(1, (work.width || 60) * (work.height || 60)),
        ),
        size = Math.max(0.85, Math.min(1.2, Math.pow(physical / 60, 0.22)));
      const base = width * (desktop ? 0.147 : 0.35) * size * Math.sqrt(ratio),
        max = width * (desktop ? 0.238 : 0.54);
      free.forEach((rect) => {
        const sizes = [
          base,
          base * 0.91,
          base * 1.09,
          rect.width - gap,
          (rect.height - gap) * ratio,
        ];
        sizes.forEach((value) => {
          if (value < base * 0.78 || value > base * 1.22) return;
          const w = Math.min(max, Math.max(desktop ? 80 : 44, value)),
            h = w / ratio;
          if (w + gap > rect.width + 0.01 || h + gap > rect.height + 0.01)
            return;
          const score =
            rect.y +
            h * 0.18 +
            index * 14 +
            Math.abs(Math.log(w / base)) * width * 0.03 -
            ((w * h) / width) * 0.7 +
            ((work.id.charCodeAt(0) + seed) % 7) * rect.x * 0.0001;
          if (!best || score < best.score)
            best = {
              id: work.id,
              x: rect.x,
              y: rect.y,
              width: w,
              height: h,
              score,
              index,
            };
        });
      });
    });
    if (!best) throw new Error("작품 배치를 계산할 수 없습니다.");
    const chosen = best as Placement & { score: number; index: number },
      used = {
        ...chosen,
        width: chosen.width + gap,
        height: chosen.height + gap,
      };
    const split: Box[] = [];
    free.forEach((r) => {
      if (
        used.x >= r.x + r.width ||
        used.x + used.width <= r.x ||
        used.y >= r.y + r.height ||
        used.y + used.height <= r.y
      ) {
        split.push(r);
        return;
      }
      if (used.x > r.x) split.push({ ...r, width: used.x - r.x });
      if (used.x + used.width < r.x + r.width)
        split.push({
          ...r,
          x: used.x + used.width,
          width: r.x + r.width - used.x - used.width,
        });
      if (used.y > r.y) split.push({ ...r, height: used.y - r.y });
      if (used.y + used.height < r.y + r.height)
        split.push({
          ...r,
          y: used.y + used.height,
          height: r.y + r.height - used.y - used.height,
        });
    });
    free = split.filter(
      (a, i) =>
        a.width > gap &&
        a.height > gap &&
        !split.some(
          (b, j) =>
            i !== j &&
            a.x >= b.x &&
            a.y >= b.y &&
            a.x + a.width <= b.x + b.width + 0.001 &&
            a.y + a.height <= b.y + b.height + 0.001 &&
            (a.width * b.height !== b.width * a.height || j < i),
        ),
    );
    result.push({
      id: chosen.id,
      x: chosen.x,
      y: chosen.y,
      width: chosen.width,
      height: chosen.height,
    });
    pending.splice(chosen.index, 1);
  }
  return result;
}
export function groupEdges(groups: WorkGroup[]): [string, string][] {
  const unique = new Map<string, [string, string]>();
  groups.forEach((g) => {
    const edges =
      g.edges ??
      g.artworkIds
        .slice(1)
        .map((id, i) => [g.artworkIds[i], id] as [string, string]);
    edges.forEach(([a, b]) => {
      if (a !== b && g.artworkIds.includes(a) && g.artworkIds.includes(b))
        unique.set([a, b].sort().join("|"), [a, b]);
    });
  });
  return [...unique.values()];
}
