import type { ArchiveWork } from "@/types/archive";

export type WorkSort =
  "recent" | "title-asc" | "title-desc" | "year-asc" | "year-desc";
const titles = new Intl.Collator("ko", { numeric: true, sensitivity: "base" });
export function compareWorks(a: ArchiveWork, b: ArchiveWork, sort: WorkSort) {
  const title = titles.compare(a.title, b.title);
  if (sort === "title-asc") return title || a.id.localeCompare(b.id);
  if (sort === "title-desc") return -title || a.id.localeCompare(b.id);
  if (sort === "year-asc")
    return a.year - b.year || title || a.id.localeCompare(b.id);
  if (sort === "year-desc")
    return b.year - a.year || title || a.id.localeCompare(b.id);
  return b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id);
}

export function workDimensions(work: ArchiveWork) {
  if (work.height && work.width) return `${work.height} × ${work.width} cm`;
  if (work.height) return `세로 ${work.height} cm · 가로 미입력`;
  if (work.width) return `가로 ${work.width} cm · 세로 미입력`;
  return "치수 미입력";
}
