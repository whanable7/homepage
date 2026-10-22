import { createHash } from "node:crypto";
import path from "node:path";
import { readDocument, mutateDocument, isLocalStore } from "./archive-store";
import { appearanceSeed, type Appearance } from "./appearance";
import {
  publicProjection,
  publicChanged,
  contentHash,
  type PublicName,
} from "./public-content-shape";
import type {
  ArchiveState,
  ArchiveText,
  PublishedArchive,
  ArchiveFile,
} from "@/types/archive";

export function publicCacheScope() {
  const branch =
    process.env.ARCHIVE_PREVIEW_BRANCH || process.env.VERCEL_GIT_COMMIT_REF;
  if (process.env.VERCEL_ENV === "preview" && !branch)
    throw new Error("검토 브랜치를 확인할 수 없습니다.");
  return createHash("sha256")
    .update(
      JSON.stringify([
        isLocalStore()
          ? path.resolve(process.env.ARCHIVE_DATA_DIR || ".archive-local")
          : process.env.ARCHIVE_BLOB_READ_WRITE_TOKEN,
        process.env.VERCEL_ENV || "local",
        process.env.VERCEL_ENV === "preview" ? branch : "production",
      ]),
    )
    .digest("hex")
    .slice(0, 24);
}
const tag = (name: PublicName) => `visitor-v1:${publicCacheScope()}:${name}`;
const pending = new Map<string, Promise<unknown>>();
// Scripts/tests have no Next Data Cache; the application always uses its persistent adapter.
const scriptCache = new Map<string, unknown>();
const failures = new Map<string, { until: number; error: unknown }>();
async function load(name: PublicName) {
  const fallback =
    name === "appearance" ? appearanceSeed() : name === "about" ? {} : [];
  const doc =
    name === "archive"
      ? await readDocument("archive", {} as ArchiveState, async () =>
          (await import("./archive")).archiveSeed(),
        )
      : await readDocument(name, fallback);
  return publicProjection(name, doc.data);
}
export async function readPublicContent<T>(name: PublicName): Promise<T> {
  const key = tag(name);
  const inFlight = pending.get(key);
  if (inFlight) return structuredClone(await inFlight) as T;
  const read = async () => {
    const failure = failures.get(key);
    if (failure && failure.until > Date.now()) throw failure.error;
    try {
      const data = await load(name);
      failures.delete(key);
      return data;
    } catch (error) {
      failures.set(key, { until: Date.now() + 30000, error });
      throw error;
    }
  };
  const task = (async () => {
    if (!process.env.NEXT_RUNTIME) {
      if (!scriptCache.has(key)) scriptCache.set(key, await read());
      return scriptCache.get(key);
    }
    const { unstable_cache } = await import("next/cache");
    return unstable_cache(read, ["visitor-v1", publicCacheScope(), name], {
      tags: [key],
      revalidate: false,
    })();
  })();
  pending.set(key, task);
  try {
    return structuredClone(await task) as T;
  } finally {
    if (pending.get(key) === task) pending.delete(key);
  }
}
async function invalidatePublicContent(name: PublicName) {
  const key = tag(name);
  // Let an older local fill finish before expiring it; it must not overwrite a new publication.
  await pending.get(key)?.catch(() => undefined);
  scriptCache.delete(key);
  failures.delete(key);
  pending.delete(key);
  if (process.env.NEXT_RUNTIME) {
    const { revalidateTag } = await import("next/cache");
    revalidateTag(key);
  }
}
/** Writes still use raw strong ETags. Invalidation happens only after a committed public change. */
export async function mutateContent<T>(
  name: string,
  fallback: T,
  mutate: (current: T) => T,
  revision?: string,
) {
  let changed = false;
  const saved = await mutateDocument(
    name,
    fallback,
    (current) => {
      const before = structuredClone(current);
      const next = mutate(current);
      changed = publicChanged(name, before, next);
      return next;
    },
    revision,
  );
  if (changed) {
    try {
      await invalidatePublicContent(name as PublicName);
    } catch {
      throw new Error(
        `저장은 완료했지만 공개 화면 갱신을 끝내지 못했습니다. 새로 불러온 뒤 공개를 다시 눌러 주세요. 저장 버전: ${saved.revision}`,
      );
    }
  }
  return saved;
}
export const getPublicArchive = () =>
  readPublicContent<PublishedArchive>("archive");
export const getPublicAppearance = () =>
  readPublicContent<Appearance>("appearance");
export const getPublishedTexts = () =>
  readPublicContent<ArchiveText[]>("texts");
export const getPublicFiles = () => readPublicContent<ArchiveFile[]>("files");
export async function publicVersions() {
  const names = [
    "archive",
    "about",
    "texts",
    "news",
    "exhibitions",
    "appearance",
  ] as const;
  const values = await Promise.all(
    names.map((name) => readPublicContent(name)),
  );
  return {
    version: contentHash(values),
    revision: (values[0] as PublishedArchive).revision,
  };
}
