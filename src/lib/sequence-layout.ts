import type { ArchiveLayout, ArchiveWork, Sequence } from "@/types/archive";
import { imageRatio } from "./layouts";
import { orderedYearWorks } from "./year-order";

export const sequenceKey = (stepId: string, workId: string) =>
  `${stepId}:${workId}`;

export function sequenceLayout(
  sequence: Sequence,
  works: ArchiveWork[],
  layout?: Pick<ArchiveLayout, "yearOrder">,
) {
  const chronological = [...new Set(works.map((w) => w.year))]
    .sort((a, b) => a - b)
    .flatMap((year) => orderedYearWorks(works, year, layout || {}));
  const rank = new Map(chronological.map((w, i) => [w.id, i]));
  const workMap = new Map(
    works.filter((w) => !w.deleted_at).map((w) => [w.id, w]),
  );
  const entries = sequence.steps
    .flatMap((step, stepIndex) =>
      [...new Set(step.artworkIds)]
        .filter((id) => workMap.has(id))
        .map((id) => ({
          step,
          stepIndex,
          work: workMap.get(id)!,
          key: sequenceKey(step.id, id),
        })),
    )
    .sort(
      (a, b) =>
        (rank.get(a.work.id) ?? Infinity) - (rank.get(b.work.id) ?? Infinity) ||
        a.stepIndex - b.stepIndex,
    );
  const nodes = entries.map((entry, i) => {
    const saved = sequence.positions?.[entry.key];
    const memberIndex = entries
      .filter((e) => e.step.id === entry.step.id)
      .findIndex((e) => e.key === entry.key);
    const ratio = imageRatio(entry.work);
    const width = Math.min(182, 152 * ratio),
      height = width / ratio;
    const side = entry.stepIndex % 2 ? 1 : -1;
    return {
      ...entry,
      width,
      height,
      x: saved?.x ?? 130 + i * 225,
      y: saved?.y ?? side * (135 + Math.floor(memberIndex / 3) * 125),
    };
  });
  const placed = nodes.filter((n) => sequence.positions?.[n.key]);
  for (const n of nodes.filter((n) => !sequence.positions?.[n.key])) {
    while (
      placed.some(
        (other) =>
          Math.abs(n.x - other.x) < (n.width + other.width) / 2 + 30 &&
          Math.abs(n.y - other.y) < (n.height + other.height) / 2 + 24,
      )
    )
      n.x += 225;
    placed.push(n);
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

/** Freeze legacy fallback positions before adding anything; new steps grow to the right. */
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
  const members = model.nodes.filter((n) => n.step.id === stepId);
  const side = members[0]
    ? members[0].y < 0
      ? -1
      : 1
    : sequence.steps.indexOf(step) % 2
      ? 1
      : -1;
  let x = members.length
    ? Math.max(...members.map((n) => n.x))
    : (step.anchorX ??
      Math.max(0, ...model.nodes.map((n) => n.x + n.width / 2)) + 200);
  let edge = Math.max(
    80,
    ...members
      .filter((n) => (n.y < 0 ? -1 : 1) === side)
      .map((n) => Math.abs(n.y) + n.height / 2 + 34),
  );
  const additions = [...new Set(ids)].filter(
    (id) =>
      !step.artworkIds.includes(id) &&
      works.some((w) => w.id === id && !w.deleted_at),
  );
  for (const id of additions) {
    const w = works.find((w) => w.id === id)!;
    const ratio = imageRatio(w),
      height = Math.min(182, 152 * ratio) / ratio;
    // Keep large batches inside the stored coordinate range; continue in the next column.
    if (edge + height > 2800) {
      x += 225;
      edge = 80;
    }
    positions[sequenceKey(stepId, id)] = { x, y: side * (edge + height / 2) };
    edge += height + 34;
  }
  return {
    ...sequence,
    positions,
    steps: sequence.steps.map((s) =>
      s.id === stepId
        ? { ...s, artworkIds: [...s.artworkIds, ...additions] }
        : s,
    ),
  };
}
