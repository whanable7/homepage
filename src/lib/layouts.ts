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
  const linear = (v: number) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  const [lr, lg, lb] = [r, g, b].map(linear);
  const l = Math.cbrt(
    0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb,
  );
  const m = Math.cbrt(
    0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb,
  );
  const s = Math.cbrt(
    0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb,
  );
  const light = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const chroma = Math.hypot(
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  );
  if (chroma < 0.025 || d < 0.035) return 360 + (1 - light) * 45;
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
// A skyline never fills older holes: later colours cannot jump back up a layer.
export function strataLayout(
  works: ArchiveWork[],
  width: number,
  seed = 0,
): Placement[] {
  const gap = width < 600 ? 4 : 6;
  const columns = width < 600 ? 2 : width < 1100 ? 5 : 9;
  const unit = (width - gap * (columns - 1)) / columns;
  const heights = Array<number>(columns).fill(0);
  let frontier = 0;
  return [...works]
    .sort(
      (a, b) => colorPosition(a) - colorPosition(b) || a.id.localeCompare(b.id),
    )
    .map((work) => {
      const ratio = imageRatio(work);
      const span = ratio >= 1.45 ? 2 : 1;
      let column = 0,
        y = Infinity;
      for (let i = 0; i <= columns - span; i++) {
        const candidate = Math.max(frontier, ...heights.slice(i, i + span));
        if (
          candidate < y - 0.01 ||
          (Math.abs(candidate - y) < 0.01 && seed % 2 === 1)
        ) {
          column = i;
          y = candidate;
        }
      }
      const w = unit * span + gap * (span - 1),
        h = w / ratio;
      for (let i = column; i < column + span; i++) heights[i] = y + h + gap;
      frontier = y;
      return { id: work.id, x: column * (unit + gap), y, width: w, height: h };
    });
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
