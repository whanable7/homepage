import { readFile, writeFile } from "node:fs/promises";
import { analyzeArtworkImage } from "../src/lib/palette";
import { mutateDocument } from "../src/lib/archive-store";
import { archiveSeed } from "../src/lib/archive";
import type { ArchiveWork } from "../src/types/archive";
import { createHash } from "node:crypto";
async function main() {
  if (process.env.VERCEL || process.env.ARCHIVE_STORAGE !== "local")
    throw new Error("검증용 로컬 사본에만 실행할 수 있습니다.");
  const doc = JSON.parse(
      await readFile(".archive-local/portfolio.json", "utf8"),
    ) as { data: ArchiveWork[] },
    results = new Map<
      string,
      Awaited<ReturnType<typeof analyzeArtworkImage>>
    >();
  let cursor = 0,
    complete = 0;
  const failed: string[] = [];
  async function worker() {
    while (cursor < doc.data.length) {
      const work = doc.data[cursor++];
      try {
        const name = new URL(work.image_url).pathname.split("/")[1];
        results.set(work.id, await analyzeArtworkImage(work.image_url, name));
      } catch {
        failed.push(work.id);
      }
      complete++;
      if (complete % 20 === 0)
        console.log(`검증용 색 분석 ${complete}/${doc.data.length}`);
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  const updated = await mutateDocument(
    "portfolio",
    [] as ArchiveWork[],
    (works) =>
      works.map((work) => {
        const palette = results.get(work.id);
        return palette
          ? {
              ...work,
              ...palette,
              representative_color:
                work.representative_color || palette.representative_color,
              updated_at: new Date().toISOString(),
            }
          : work;
      }),
  );
  // Prepare, but do not upload, a reviewed migration copy. Preserve raw backup.
  const folder = process.argv[2];
  if (folder) {
    const file = `${folder}/snapshot.json`,
      snapshot = JSON.parse(await readFile(file, "utf8"));
    await writeFile(
      `${folder}/original-snapshot.json`,
      JSON.stringify(snapshot),
      { mode: 0o600 },
    );
    snapshot.portfolio = (snapshot.portfolio as ArchiveWork[]).map((work) => {
      const palette = results.get(work.id);
      return palette
        ? {
            ...work,
            ...palette,
            representative_color:
              work.representative_color || palette.representative_color,
          }
        : work;
    });
    snapshot.archive = await archiveSeed(snapshot.portfolio);
    await writeFile(file, JSON.stringify(snapshot), { mode: 0o600 });
    await writeFile(
      `${folder}/manifest.json`,
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          hashes: Object.fromEntries(
            Object.entries(snapshot).map(([name, data]) => [
              name,
              createHash("sha256").update(JSON.stringify(data)).digest("hex"),
            ]),
          ),
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
  }
  console.log(
    JSON.stringify({
      analyzed: results.size,
      failed: failed.length,
      localRecords: updated.data.length,
      operatingDataChanged: false,
    }),
  );
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
