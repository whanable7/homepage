import { readDocument, mutateDocument, ConflictError } from "./archive-store";
import { mutateContent, readPublicContent } from "./public-content";
// Legacy CMS handlers accept heterogeneous records; validate at each API boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RecordData = any;
const read = async <T>(name: string, fallback: T) =>
  (await readDocument(name, fallback)).data;
const replace = async <T>(name: string, data: T) => {
  await mutateContent(name, data, () => data);
};
export const mutateRecords = (
  name: string,
  fn: (records: RecordData[]) => RecordData[],
) => mutateDocument(name, [] as RecordData[], fn);
export const getPortfolio = async (): Promise<RecordData[]> =>
  [...(await read("portfolio", [] as RecordData[]))].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );
export const getPortfolioById = async (id: string) =>
  (await getPortfolio()).find((a) => a.id === id && !a.deleted_at);
export async function reorderFeaturedArtworks(ids: unknown) {
  if (
    !Array.isArray(ids) ||
    ids.some((id) => typeof id !== "string") ||
    new Set(ids).size !== ids.length
  )
    throw new Error("순서를 확인해 주세요.");
  const order = new Map(ids.map((id, index) => [id, index]));
  const saved = await mutateRecords("portfolio", (records) => {
    if (
      ids.some(
        (id) =>
          !records.some((w) => w.id === id && w.is_featured && !w.deleted_at),
      )
    )
      throw new Error("대표 이미지 목록이 바뀌었습니다. 다시 불러와 주세요.");
    const updatedAt = new Date().toISOString();
    return records.map((w) =>
      order.has(w.id)
        ? { ...w, featured_order: order.get(w.id), updated_at: updatedAt }
        : w,
    );
  });
  return saved.data.filter((w) => order.has(w.id));
}
export const getFeaturedArtworks = async () =>
  (await getPortfolio())
    .filter((a) => a.is_featured && a.status !== "draft" && !a.deleted_at)
    .sort(
      (a, b) =>
        (a.featured_order ?? a.order ?? 0) - (b.featured_order ?? b.order ?? 0),
    );
export const getCategories = async () =>
  await readPublicContent<RecordData[]>("categories");
export const getCategoryById = async (id: string) =>
  (await getCategories()).find((a) => a.id === id);
export const getTags = async () =>
  (await read("tags", [] as RecordData[])).filter((a) => !a.deleted_at);
export const getTagById = async (id: string) =>
  (await getTags()).find((a) => a.id === id);
export const getAbout = () => read("about", {} as RecordData);
export async function getPublicAbout() {
  return readPublicContent<RecordData>("about");
}
export const getExhibitions = async () =>
  (await read("exhibitions", [] as RecordData[])).filter((a) => !a.deleted_at);
export const getExhibitionById = async (id: string) =>
  (await getExhibitions()).find((a) => a.id === id);
export const getNews = async () =>
  (await read("news", [] as RecordData[])).filter((a) => !a.deleted_at);
export const getNewsById = async (id: string) =>
  (await getNews()).find((a) => a.id === id);
export const getAdminSettings = () => read("admin_settings", {} as RecordData);

export async function addTag(tag: RecordData) {
  let result: RecordData = {};
  await mutateRecords("tags", (records) => {
    const name = String(tag.name || "").trim();
    if (!name) throw new Error("태그 이름을 입력해 주세요.");
    const found = records.find(
      (t) => t.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
    result = found || {
      id: crypto.randomUUID(),
      name,
      created_at: new Date().toISOString(),
    };
    return found ? records : [...records, result];
  });
  return result;
}
export async function addArtwork(artwork: RecordData) {
  let result: RecordData = {};
  await mutateRecords("portfolio", (records) => {
    const existing = artwork.id && records.find((a) => a.id === artwork.id);
    if (existing) {
      result = existing;
      return records;
    }
    result = {
      ...artwork,
      id: artwork.id || crypto.randomUUID(),
      tags: [],
      order: Math.max(-1, ...records.map((a) => a.order ?? 0)) + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return [...records, result];
  });
  return result;
}
export async function updateArtwork(id: string, updates: RecordData) {
  let result: RecordData | null = null;
  await mutateRecords("portfolio", (records) => {
    result = null;
    return records.map((a) => {
      if (a.id !== id || a.deleted_at) return a;
      if (
        updates._expected_updated_at &&
        updates._expected_updated_at !== a.updated_at
      )
        throw new ConflictError();
      const clean = { ...updates };
      delete clean._expected_updated_at;
      if (
        clean.title !== undefined &&
        (typeof clean.title !== "string" || !clean.title.trim())
      )
        throw new Error("제목을 입력해 주세요.");
      if (
        clean.year !== undefined &&
        (!Number.isInteger(clean.year) ||
          clean.year < 1900 ||
          clean.year > new Date().getFullYear() + 1)
      )
        throw new Error("제작연도를 확인해 주세요.");
      if (
        [clean.width, clean.height].some(
          (n) =>
            n !== undefined && n !== null && (!Number.isFinite(n) || n <= 0),
        )
      )
        throw new Error("치수를 확인해 주세요.");
      if (clean.image_url && clean.image_url !== a.image_url) {
        clean.dominant_color = null;
        clean.palette = [];
        clean.representative_color = null;
      }
      result = {
        ...a,
        ...clean,
        id: a.id,
        created_at: a.created_at,
        updated_at: new Date().toISOString(),
      };
      return result;
    });
  });
  return result;
}
export async function deleteArtwork(id: string) {
  // Retain metadata and original images for recovery.
  return !!(await updateArtwork(id, {
    deleted_at: new Date().toISOString(),
    status: "draft",
    is_featured: false,
  }));
}
export const updatePortfolio = (data: RecordData[]) =>
  replace("portfolio", data);
export const updateCategories = (data: RecordData[]) =>
  replace("categories", data);
export const updateTags = (data: RecordData[]) => replace("tags", data);
export const updateAbout = (data: RecordData) => replace("about", data);
export const updateExhibitions = (data: RecordData[]) =>
  replace("exhibitions", data);
export const updateNews = (data: RecordData[]) => replace("news", data);
export const updateAdminSettings = async (updates: RecordData) => {
  await mutateDocument("admin_settings", {} as RecordData, (current) => ({
    ...current,
    ...updates,
  }));
};
