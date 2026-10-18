import type { ArchiveLayout } from "@/types/archive";
import { groupEdges } from "./layouts";

export function removesAllRelations(
  previous: ArchiveLayout,
  next: ArchiveLayout,
) {
  return (["ecosystem", "cosmos"] as const).some(
    (view) =>
      groupEdges(previous[view]).length > 0 &&
      groupEdges(next[view]).length === 0,
  );
}
