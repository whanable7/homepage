import { get, put, BlobPreconditionFailedError } from "@vercel/blob";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { retryArchiveRead } from "./archive-read";

export interface Document<T> {
  revision: string;
  updatedAt: string;
  data: T;
}
const readCounts: Record<string, number> = {};
export const archiveReadCounts = () => ({ ...readCounts });
function recordRead(name: string) {
  readCounts[name] = (readCounts[name] || 0) + 1;
  if (isLocalStore() && process.env.ARCHIVE_READ_METRICS === "1")
    console.info("[archive-read]", name);
}
export class ConflictError extends Error {
  constructor() {
    super(
      "다른 변경이 먼저 저장되었습니다. 새로 불러온 뒤 다시 시도해 주세요.",
    );
  }
}
export const isLocalStore = () =>
  !process.env.VERCEL &&
  (process.env.ARCHIVE_STORAGE === "local" ||
    process.env.NODE_ENV !== "production");
const localDirectory = () =>
  path.resolve(process.env.ARCHIVE_DATA_DIR || ".archive-local");
const token = () => {
  if (!process.env.ARCHIVE_BLOB_READ_WRITE_TOKEN)
    throw new Error("비공개 아카이브 저장 공간 설정이 필요합니다.");
  return process.env.ARCHIVE_BLOB_READ_WRITE_TOKEN;
};
const pathname = (name: string) => {
  if (!/^[a-z_]+$/.test(name)) throw new Error("Invalid document");
  // Preview deployments never mutate the production dataset.
  const branch =
    process.env.ARCHIVE_PREVIEW_BRANCH || process.env.VERCEL_GIT_COMMIT_REF;
  if (process.env.VERCEL_ENV === "preview" && !branch)
    throw new Error(
      "검토 브랜치를 확인할 수 없어 저장 공간 연결을 중단했습니다.",
    );
  const scope =
    process.env.VERCEL_ENV === "preview"
      ? `preview/${createHash("sha256").update(branch!).digest("hex").slice(0, 16)}`
      : "production";
  return `archive/v2/${scope}/${name}.json`;
};

async function seed<T>(name: string, fallback: T): Promise<T> {
  if (
    process.env.VERCEL_ENV === "preview" &&
    ["portfolio", "archive"].includes(name)
  ) {
    const snapshot = JSON.parse(
      await readFile(
        path.join(process.cwd(), "src/data/preview_archive.json"),
        "utf8",
      ),
    );
    return (
      name === "portfolio"
        ? snapshot.works
        : {
            published: snapshot,
            draft: {
              ecosystem: [],
              cosmos: [],
              sequences: [],
              stars: {},
              excluded: {},
              seed: 0,
            },
            backups: [],
          }
    ) as T;
  }
  try {
    return JSON.parse(
      await readFile(
        path.join(process.cwd(), "src/data", `${name}.json`),
        "utf8",
      ),
    ) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return structuredClone(fallback);
    throw error;
  }
}

export async function readDocument<T>(
  name: string,
  fallback: T,
  initialize?: () => Promise<T>,
): Promise<Document<T> & { etag?: string }> {
  if (isLocalStore()) {
    try {
      recordRead(name);
      return JSON.parse(
        await readFile(path.join(localDirectory(), `${name}.json`), "utf8"),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return {
        revision: "seed",
        updatedAt: "",
        data: await seed(name, initialize ? await initialize() : fallback),
      };
    }
  }
  if (
    process.env.VERCEL_ENV === "preview" &&
    !process.env.ARCHIVE_BLOB_READ_WRITE_TOKEN
  )
    return {
      revision: "seed",
      updatedAt: "",
      data: await seed(name, fallback),
    };
  const result = await retryArchiveRead(() => {
    recordRead(name);
    return get(pathname(name), {
      access: "private",
      token: token(),
      useCache: false,
      // Compression changes the HTTP validator to a weak ETag, which cannot guard conditional writes.
      headers: { "Accept-Encoding": "identity" },
      abortSignal: AbortSignal.timeout(6000),
    });
  });
  if (!result && process.env.VERCEL_ENV === "preview")
    return {
      revision: "seed",
      updatedAt: "",
      data: await seed(name, fallback),
    };
  if (!result && name === "appearance")
    return { revision: "seed", updatedAt: "", data: fallback };
  if (!result || !result.stream)
    throw new Error(`아카이브 ${name} 초기 이관을 먼저 완료해 주세요.`);
  const document = (await new Response(result.stream).json()) as Document<T>;
  return { ...document, etag: result.blob.etag };
}

export async function mutateDocument<T>(
  name: string,
  fallback: T,
  mutate: (current: T) => T,
  expectedRevision?: string,
): Promise<Document<T>> {
  const execute = async () => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const current = await readDocument(name, fallback);
      if (
        expectedRevision !== undefined &&
        current.revision !== expectedRevision
      )
        throw new ConflictError();
      const next: Document<T> = {
        revision: randomUUID(),
        updatedAt: new Date().toISOString(),
        data: mutate(structuredClone(current.data)),
      };
      if (isLocalStore()) {
        const history = path.join(localDirectory(), "history", name);
        await mkdir(history, { recursive: true, mode: 0o700 });
        await writeFile(
          path.join(history, `${current.revision}-${randomUUID()}.json`),
          JSON.stringify({
            revision: current.revision,
            updatedAt: current.updatedAt,
            data: current.data,
          }),
          { mode: 0o600 },
        );
        const tmp = path.join(localDirectory(), `${name}.${randomUUID()}.tmp`);
        await writeFile(tmp, JSON.stringify(next), { mode: 0o600 });
        await rename(tmp, path.join(localDirectory(), `${name}.json`));
      } else {
        if (name === "appearance" && current.revision === "seed") {
          try {
            await put(pathname(name), JSON.stringify(next), {
              access: "private",
              token: token(),
              addRandomSuffix: false,
              allowOverwrite: false,
              contentType: "application/json",
            });
            return next;
          } catch (error) {
            const latest = await readDocument(name, fallback);
            if (latest.revision !== "seed") throw new ConflictError();
            throw error;
          }
        }
        if (!current.etag || current.etag.startsWith("W/"))
          throw new Error(
            "저장 버전을 확인할 수 없습니다. 새로 불러온 뒤 다시 시도해 주세요.",
          );
        try {
          await put(
            pathname(name).replace(
              `${name}.json`,
              `history/${name}/${current.revision}-${randomUUID()}.json`,
            ),
            JSON.stringify({
              revision: current.revision,
              updatedAt: current.updatedAt,
              data: current.data,
            }),
            {
              access: "private",
              token: token(),
              addRandomSuffix: false,
              contentType: "application/json",
            },
          );
          await put(pathname(name), JSON.stringify(next), {
            access: "private",
            token: token(),
            addRandomSuffix: false,
            allowOverwrite: true,
            ifMatch: current.etag,
            contentType: "application/json",
          });
        } catch (error) {
          if (error instanceof BlobPreconditionFailedError) {
            if (expectedRevision) throw new ConflictError();
            continue;
          }
          throw error;
        }
      }
      return next;
    }
    throw new ConflictError();
  };
  if (!isLocalStore()) return execute();
  await mkdir(localDirectory(), { recursive: true, mode: 0o700 });
  const lock = path.join(localDirectory(), `${name}.lock`);
  for (let attempt = 0; attempt < 200; attempt++) {
    try {
      await mkdir(lock);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      await new Promise((resolve) => setTimeout(resolve, 10));
      continue;
    }
    try {
      return await execute();
    } finally {
      await rm(lock, { recursive: true, force: true });
    }
  }
  throw new Error("저장 중입니다. 잠시 후 다시 시도해 주세요.");
}
