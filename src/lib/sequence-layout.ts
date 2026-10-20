import type { ArchiveLayout, ArchiveWork, Sequence } from "@/types/archive";
import { imageRatio } from "./layouts";

export const sequenceKey = (stepId: string, workId: string) =>
  `${stepId}:${workId}`;

export function sequenceLayout(
  sequence: Sequence,
  works: ArchiveWork[],
  _layout?: Pick<ArchiveLayout, "yearOrder">,
) {
  // Keep the existing caller signature; year ordering no longer controls a flow.
  void _layout;
  const workMap = new Map(
    works.filter((w) => !w.deleted_at).map((w) => [w.id, w]),
  );
  const entries = sequence.steps.flatMap((step, stepIndex) =>
    [...new Set(step.artworkIds)]
      .filter((id) => workMap.has(id))
      .map((id) => ({
        step,
        stepIndex,
        work: workMap.get(id)!,
        key: sequenceKey(step.id, id),
      })),
  );
  const nodes = entries.map((entry) => {
    const saved = sequence.positions?.[entry.key];
    const ratio = imageRatio(entry.work);
    const width = Math.min(182, 152 * ratio),
      height = width / ratio;
    return {
      ...entry,
      width,
      height,
      x: saved?.x ?? 0,
      y: saved?.y ?? 0,
    };
  });
  const placed = nodes.filter((n) => sequence.positions?.[n.key]);
  let right = Math.max(0, ...placed.map((n) => n.x + n.width / 2));
  for (const [stepIndex, step] of sequence.steps.entries()) {
    const members = nodes.filter((n) => n.step.id === step.id);
    const saved = members.filter((n) => sequence.positions?.[n.key]);
    const pending = members.filter((n) => !sequence.positions?.[n.key]);
    let x = saved.length
      ? Math.max(...saved.map((n) => n.x + n.width / 2)) + 140
      : (step.anchorX ?? (right ? right + 140 : 130));
    // A stage grows in shared columns on both sides of the axis, never in a
    // year-based diagonal. Limit each column to four works above and four below.
    for (let start = 0; start < pending.length; start += 8) {
      const column = pending.slice(start, start + 8);
      const edges = [80, 80];
      for (const [index, n] of column.entries()) {
        const sideIndex = Math.floor(index / 4);
        const side = (stepIndex % 2 ? 1 : -1) * (sideIndex ? -1 : 1);
        n.y = side * (edges[sideIndex] + n.height / 2);
        edges[sideIndex] += n.height + 28;
      }
      while (
        column.some((n) =>
          placed.some(
            (other) =>
              Math.abs(x - other.x) < (n.width + other.width) / 2 + 30 &&
              Math.abs(n.y - other.y) < (n.height + other.height) / 2 + 24,
          ),
        )
      )
        x += 225;
      for (const n of column) n.x = x;
      placed.push(...column);
      x += 225;
    }
    right = Math.max(
      right,
      step.anchorX ?? 0,
      ...members.map((n) => n.x + n.width / 2),
    );
  }
  const minY = Math.min(-220, ...nodes.map((n) => n.y - n.height / 2 - 55));
  const maxY = Math.max(220, ...nodes.map((n) => n.y + n.height / 2 + 55));
  return {
    nodes,
    width: Math.max(900, ...nodes.map((n) => n.x + n.width / 2 + 110)),
    height: maxY - minY,
    axisY: -minY,
  };
}

export function validateSequencePositions(sequence: Sequence) {
  if (sequence.positions === undefined) return;
  if (
    !sequence.positions ||
    typeof sequence.positions !== "object" ||
    Array.isArray(sequence.positions)
  )
    throw new Error("흐름 배치를 확인해 주세요.");
  const keys = new Set(
    sequence.steps.flatMap((s) =>
      s.artworkIds.map((id) => sequenceKey(s.id, id)),
    ),
  );
  if (Object.keys(sequence.positions).length > 5000)
    throw new Error("흐름 배치를 확인해 주세요.");
  for (const [key, p] of Object.entries(sequence.positions)) {
    if (
      !keys.has(key) ||
      !p ||
      !Number.isFinite(p.x) ||
      !Number.isFinite(p.y) ||
      p.x < 70 ||
      p.x > 50000 ||
      Math.abs(p.y) > 3000
    )
      throw new Error("흐름의 작품 위치를 확인해 주세요.");
  }
}

export type SequenceNodeGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  step: { id: string };
};
export type SequenceSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};
/** Share vertical stems, then cut out artwork rectangles so no line crosses an image. */
export function sequenceConnections(
  nodes: SequenceNodeGeometry[],
  axisY: number,
): SequenceSegment[] {
  // Nearby saved x coordinates form one stable column, independently of zoom.
  const rails = new Map<SequenceNodeGeometry, number>();
  {
    const sorted = [...nodes].sort((a, b) => a.x - b.x);
    let cluster: SequenceNodeGeometry[] = [];
    const flush = () => {
      if (!cluster.length) return;
      const x = cluster[Math.floor(cluster.length / 2)].x;
      for (const n of cluster) rails.set(n, x);
      cluster = [];
    };
    for (const n of sorted) {
      if (cluster.length && n.x - cluster[0].x > 4) flush();
      cluster.push(n);
    }
    flush();
  }
  const horizontal = new Map<number, [number, number][]>();
  const segments: SequenceSegment[] = [];
  const vertical = new Map<number, [number, number][]>();
  const addVertical = (x: number, a: number, b: number) => {
    const ranges = vertical.get(x) || [];
    ranges.push([Math.min(a, b), Math.max(a, b)]);
    vertical.set(x, ranges);
  };
  for (const id of new Set(nodes.map((n) => n.step.id))) {
    for (const side of [-1, 1]) {
      const branch = nodes.filter(
        (n) => n.step.id === id && (n.y < 0 ? -1 : 1) === side,
      );
      if (!branch.length) continue;
      const xs = branch.map((n) => rails.get(n)!),
        joint = axisY + side * 45;
      const anchor = Math.min(...xs);
      addVertical(anchor, axisY, joint);
      if (Math.max(...xs) > anchor) {
        const intervals = horizontal.get(joint) || [];
        intervals.push([anchor, Math.max(...xs)]);
        horizontal.set(joint, intervals);
      }
      for (const n of branch) addVertical(rails.get(n)!, joint, axisY + n.y);
    }
  }
  for (const [x, intervals] of vertical) {
    const merged: [number, number][] = [];
    for (const range of intervals.sort((a, b) => a[0] - b[0])) {
      const last = merged.at(-1);
      if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
      else merged.push([...range]);
    }
    let visible = merged;
    for (const n of nodes.filter((n) => Math.abs(n.x - x) <= n.width / 2 + 2)) {
      const top = axisY + n.y - n.height / 2 - 3,
        bottom = axisY + n.y + n.height / 2 + 3;
      visible = visible.flatMap(([a, b]): [number, number][] =>
        b <= top || a >= bottom
          ? [[a, b]]
          : [
              ...(a < top ? [[a, top] as [number, number]] : []),
              ...(b > bottom ? [[bottom, b] as [number, number]] : []),
            ],
      );
    }
    segments.push(
      ...visible
        .filter(([a, b]) => b > a)
        .map(([a, b]) => ({ x1: x, x2: x, y1: a, y2: b })),
    );
  }
  for (const [y, intervals] of horizontal) {
    const merged: [number, number][] = [];
    for (const range of intervals.sort((a, b) => a[0] - b[0])) {
      const last = merged.at(-1);
      if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
      else merged.push([...range]);
    }
    for (const [a, b] of merged) segments.push({ x1: a, x2: b, y1: y, y2: y });
  }
  return segments;
}

export function fitSequence(
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  return Math.min(
    1,
    Math.max(1, viewportWidth - 24) / width,
    Math.max(1, viewportHeight - 24) / height,
  );
}

/** Freeze existing positions before adding anything; new steps grow to the right. */
export function addSequenceStep(
  sequence: Sequence,
  ids: string[],
  works: ArchiveWork[],
  layout?: Pick<ArchiveLayout, "yearOrder">,
): Sequence {
  const model = sequenceLayout(sequence, works, layout);
  const right = Math.max(
    0,
    ...model.nodes.map((n) => n.x + n.width / 2),
    ...sequence.steps.map((s) => s.anchorX || 0),
  );
  const id = crypto.randomUUID();
  const next = {
    ...sequence,
    positions: Object.fromEntries(
      model.nodes.map((n) => [n.key, { x: n.x, y: n.y }]),
    ),
    steps: [
      ...sequence.steps,
      {
        id,
        title: "새 단계",
        title_en: "",
        artworkIds: [],
        anchorX: right ? right + 200 : 130,
      },
    ],
  };
  return addSequenceMembers(next, id, ids, works, layout);
}
export function addSequenceMembers(
  sequence: Sequence,
  stepId: string,
  ids: string[],
  works: ArchiveWork[],
  layout?: Pick<ArchiveLayout, "yearOrder">,
): Sequence {
  const model = sequenceLayout(sequence, works, layout),
    step = sequence.steps.find((s) => s.id === stepId);
  if (!step) return sequence;
  const positions = Object.fromEntries(
    model.nodes.map((n) => [n.key, { x: n.x, y: n.y }]),
  );
  const additions = [...new Set(ids)].filter(
    (id) =>
      !step.artworkIds.includes(id) &&
      works.some((w) => w.id === id && !w.deleted_at),
  );
  const next = {
    ...sequence,
    positions,
    steps: sequence.steps.map((s) =>
      s.id === stepId
        ? { ...s, artworkIds: [...s.artworkIds, ...additions] }
        : s,
    ),
  };
  return {
    ...next,
    positions: Object.fromEntries(
      sequenceLayout(next, works, layout).nodes.map((n) => [
        n.key,
        { x: n.x, y: n.y },
      ]),
    ),
  };
}
