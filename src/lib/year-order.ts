import type { ArchiveLayout, ArchiveWork } from "@/types/archive";

export function orderedYearWorks(
  works: ArchiveWork[],
  year: number,
  layout: Pick<ArchiveLayout, "yearOrder">,
) {
  const order = new Map(
    (layout.yearOrder?.[String(year)] || []).map((id, i) => [id, i]),
  );
  return works
    .filter((w) => w.year === year && !w.deleted_at)
    .sort(
      (a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity),
    );
}

export function withoutYearWork(order: ArchiveLayout["yearOrder"], id: string) {
  return Object.fromEntries(
    Object.entries(order || {}).map(([year, ids]) => [
      year,
      ids.filter((x) => x !== id),
    ]),
  );
}

export function moveWorkToYear(
  layout: ArchiveLayout,
  works: ArchiveWork[],
  id: string,
  year: number,
) {
  const existing = orderedYearWorks(works, year, layout)
    .filter((w) => w.id !== id)
    .map((w) => w.id);
  return {
    ...withoutYearWork(layout.yearOrder, id),
    [String(year)]: [...existing, id],
  };
}

export function currentYearOrder(layout: ArchiveLayout, works: ArchiveWork[]) {
  return Object.fromEntries(
    [...new Set(works.filter((w) => !w.deleted_at).map((w) => w.year))].map(
      (year) => [
        String(year),
        orderedYearWorks(works, year, layout).map((w) => w.id),
      ],
    ),
  );
}

export function validateYearOrder(
  order: unknown,
  works: Pick<ArchiveWork, "id" | "year">[],
) {
  if (order === undefined) return;
  if (!order || typeof order !== "object" || Array.isArray(order))
    throw new Error("연도별 순서를 확인해 주세요.");
  const map = new Map(works.map((w) => [w.id, w.year]));
  const entries = Object.entries(order);
  if (entries.length > 300) throw new Error("연도별 순서를 확인해 주세요.");
  for (const [year, ids] of entries) {
    if (
      !/^\d{4}$/.test(year) ||
      !Array.isArray(ids) ||
      ids.length > works.length ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => typeof id !== "string" || !map.has(id))
    )
      throw new Error(
        "연도별 작품 목록을 확인해 주세요. 제작연도가 바뀌었다면 목록을 다시 불러와 주세요.",
      );
  }
}
