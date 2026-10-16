import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { get, put } from "@vercel/blob";
import { archiveSeed } from "../src/lib/archive";
import type { ArchiveWork } from "../src/types/archive";
const args = process.argv.slice(2),
  value = (flag: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };
const directory = path.resolve(
  value("--directory") || ".archive-migration/latest",
);
const names = [
  "portfolio",
  "tags",
  "categories",
  "about",
  "exhibitions",
  "news",
  "admin_settings",
];
const hash = (data: unknown) =>
  createHash("sha256").update(JSON.stringify(data)).digest("hex");
const base = "https://tgbsyi4o90fqlezu.public.blob.vercel-storage.com/data";
async function download() {
  const result: Record<string, unknown> = {};
  for (const name of names) {
    const response = await fetch(
      `${base}/${name}.json?backup=${randomUUID()}`,
      { cache: "no-store" },
    );
    if (!response.ok)
      throw new Error(`기존 ${name} 백업 실패: ${response.status}`);
    result[name] = await response.json();
  }
  return result;
}
async function main() {
  if (!args.includes("--apply")) {
    const first = await download(),
      second = await download();
    if (names.some((name) => hash(first[name]) !== hash(second[name])))
      throw new Error(
        "기존 데이터가 변경 중입니다. 관리자 편집을 잠시 멈추고 다시 백업해 주세요.",
      );
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const data = {
      ...first,
      archive: await archiveSeed(first.portfolio as ArchiveWork[]),
      texts: [],
      files: [],
    };
    await writeFile(
      path.join(directory, "snapshot.json"),
      JSON.stringify(data),
      { mode: 0o600 },
    );
    await writeFile(
      path.join(directory, "manifest.json"),
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          hashes: Object.fromEntries(
            Object.entries(data).map(([name, data]) => [name, hash(data)]),
          ),
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    console.log("읽기 전용 백업 완료. 기존 저장 공간은 변경하지 않았습니다.");
  } else {
    const scope = value("--scope") || "";
    if (!["production", "preview"].includes(scope))
      throw new Error("--scope production 또는 preview가 필요합니다.");
    const token = process.env.ARCHIVE_BLOB_READ_WRITE_TOKEN;
    if (!token) throw new Error("새 PRIVATE Blob 저장 공간 연결이 필요합니다.");
    const branch = scope === "preview" ? value("--branch") || "" : "";
    if (scope === "preview" && !branch)
      throw new Error("검토 브랜치 이름이 필요합니다.");
    const prefix =
      scope === "production"
        ? "production"
        : `preview/${createHash("sha256").update(branch).digest("hex").slice(0, 16)}`;
    const data = JSON.parse(
        await readFile(path.join(directory, "snapshot.json"), "utf8"),
      ) as Record<string, unknown>,
      manifest = JSON.parse(
        await readFile(path.join(directory, "manifest.json"), "utf8"),
      );
    for (const [name, contents] of Object.entries(data)) {
      if (hash(contents) !== manifest.hashes[name])
        throw new Error(`${name} 백업 검증 실패`);
      const pathname = `archive/v2/${prefix}/${name}.json`,
        existing = await get(pathname, {
          access: "private",
          token,
          useCache: false,
        });
      if (existing?.stream) {
        const current = await new Response(existing.stream).json();
        if (hash(current.data) !== hash(contents))
          throw new Error(
            `${name}에 다른 데이터가 있습니다. 덮어쓰지 않고 중단합니다.`,
          );
        continue;
      }
      await put(
        pathname,
        JSON.stringify({
          revision: randomUUID(),
          updatedAt: new Date().toISOString(),
          data: contents,
        }),
        {
          access: "private",
          token,
          addRandomSuffix: false,
          contentType: "application/json",
        },
      );
      const check = await get(pathname, {
        access: "private",
        token,
        useCache: false,
      });
      if (
        !check?.stream ||
        hash((await new Response(check.stream).json()).data) !== hash(contents)
      )
        throw new Error(`${name} 이관 검증 실패`);
      console.log(`${name}: 비공개 사본 검증 완료`);
    }
    console.log(
      "새 저장 공간 사본 준비 완료. 기존 데이터와 운영 배포는 변경하지 않았습니다.",
    );
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
