import type { WorkGroup } from "@/types/archive";
import { groupEdges } from "./layouts";

export const edgeKey = (a: string, b: string) => [a, b].sort().join("|");

// Membership changes must not replace an explicitly edited connection map.
export function changeGroupMembers(
  group: WorkGroup,
  ids: string[],
  remove = false,
): WorkGroup {
  const artworkIds = remove
    ? group.artworkIds.filter((id) => !ids.includes(id))
    : [...new Set([...group.artworkIds, ...ids])];
  return {
    ...group,
    artworkIds,
    ...(group.edges !== undefined
      ? {
          edges: group.edges.filter(
            ([a, b]) => artworkIds.includes(a) && artworkIds.includes(b),
          ),
        }
      : {}),
  };
}

export function groupFocus(
  groups: WorkGroup[],
  workId?: string,
  groupId?: string,
) {
  const matching = groupId
    ? groups.filter((g) => g.id === groupId)
    : workId
      ? groups.filter((g) => g.artworkIds.includes(workId))
      : [];
  const ids = new Set(matching.flatMap((g) => g.artworkIds));
  if (workId && !groupId) ids.add(workId);
  return {
    enabled: Boolean(groupId || workId),
    ids,
    edges: new Set(groupEdges(matching).map(([a, b]) => edgeKey(a, b))),
  };
}
