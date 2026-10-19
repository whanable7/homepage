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
