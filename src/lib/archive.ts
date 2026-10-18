import type { ArchiveLayout, ArchiveState, ArchiveWork } from "@/types/archive";
import {
  readDocument,
  mutateDocument,
  isLocalStore,
  ConflictError,
} from "./archive-store";
import { getPortfolio } from "./data";
import { strataLayout } from "./layouts";
import { currentYearOrder } from "./year-order";
import { removesAllRelations } from "./archive-publication";
export const emptyLayout = (): ArchiveLayout => ({
  ecosystem: [],
  cosmos: [],
  sequences: [],
  stars: {},
  excluded: {},
  seed: 0,
  yearOrder: {},
});
export function publicWork(work: ArchiveWork): ArchiveWork {
  const { tags, connections, ...rest } = work;
  void tags;
  void connections;
  return { ...rest, show_watermark: false };
}
let seedCache: { key: string; value: ArchiveState } | undefined;
export async function archiveSeed(
  source?: ArchiveWork[],
): Promise<ArchiveState> {
  const works = (source || ((await getPortfolio()) as ArchiveWork[])).filter(
    (w) => w.status !== "draft" && !w.deleted_at,
  );
  const key = works
    .map((w) => `${w.id}:${w.updated_at}:${w.is_featured}:${w.featured_order}`)
    .join("|");
  if (seedCache?.key === key) return structuredClone(seedCache.value);
  const layout = emptyLayout();
  const groups = new Map<
    string,
    { id: string; name: string; artworkIds: string[] }
  >();
  works.forEach((w) =>
    w.tags?.forEach((t) => {
      if (!groups.has(t.id))
        groups.set(t.id, { id: t.id, name: t.name, artworkIds: [] });
      groups.get(t.id)!.artworkIds.push(w.id);
    }),
  );
  layout.ecosystem = [...groups.values()];
  const value: ArchiveState = {
    published: {
      works: works.map(publicWork),
      layout,
      strata: {
        phone: strataLayout(works, 360),
        desktop: strataLayout(works, 1440),
      },
      revision: "legacy",
      publishedAt: "",
    },
    draft: emptyLayout(),
    backups: [
      { savedAt: new Date().toISOString(), layout: structuredClone(layout) },
    ],
  };
  seedCache = { key, value };
  return structuredClone(value);
}
export async function getArchive() {
  const initial = await archiveSeed(),
    doc = await readDocument("archive", initial);
  if (isLocalStore() && doc.revision === "seed") {
    try {
      return await mutateDocument(
        "archive",
        initial,
        (current) => current,
        "seed",
      );
    } catch (error) {
      if (!(error instanceof ConflictError)) throw error;
      return readDocument("archive", initial);
    }
  }
  return doc;
}
export async function saveArchiveDraft(
  layout: ArchiveLayout,
  revision: string,
) {
  return mutateDocument(
    "archive",
    await archiveSeed(),
    (state) => ({ ...state, draft: layout }),
    revision,
  );
}
export async function publishArchive(
  revision: string,
  confirmEmptyRelations = false,
) {
  const allWorks = ((await getPortfolio()) as ArchiveWork[]).filter(
    (w) => !w.deleted_at,
  );
  const works = allWorks.filter((w) => w.status !== "draft");
  return mutateDocument(
    "archive",
    await archiveSeed(),
    (state) => {
      if (
        removesAllRelations(state.published.layout, state.draft) &&
        !confirmEmptyRelations
      )
        throw new Error(
          "연결을 모두 비운 상태로 공개하려면 별도 확인이 필요합니다.",
        );
      const nextLayout = {
        ...state.draft,
        yearOrder: currentYearOrder(state.draft, allWorks),
      };
      const included = works.filter(
        (w) => !state.draft.excluded.strata?.includes(w.id),
      );
      return {
        ...state,
        draft: nextLayout,
        backups: removesAllRelations(state.published.layout, state.draft)
          ? [
              ...state.backups,
              {
                savedAt: new Date().toISOString(),
                layout: structuredClone(state.published.layout),
              },
            ].slice(-20)
          : state.backups,
        published: {
          works: works.map(publicWork),
          layout: {
            ...structuredClone(nextLayout),
            yearOrder: currentYearOrder(nextLayout, works),
          },
          strata: {
            phone: strataLayout(included, 360, state.draft.seed),
            desktop: strataLayout(included, 1440, state.draft.seed),
          },
          revision: crypto.randomUUID(),
          publishedAt: new Date().toISOString(),
        },
      };
    },
    revision,
  );
}
export function publicLayout(layout: ArchiveLayout): ArchiveLayout {
  return {
    ...layout,
    ecosystem: layout.ecosystem.map((g) => ({ ...g, name: "" })),
    cosmos: layout.cosmos.map((g) => ({ ...g, name: "" })),
  };
}
