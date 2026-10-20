import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  getPortfolio,
  reorderFeaturedArtworks,
  updateArtwork,
  addArtwork,
} from "../src/lib/data";
import { archiveSeed, getArchive, publishFeatured } from "../src/lib/archive";
import { ConflictError, readDocument } from "../src/lib/archive-store";
import { adminReturnTo } from "../src/lib/admin-return-to";
import type { ArchiveWork } from "../src/types/archive";

test("reorder response permits unfeaturing without refresh, while stale edits are still rejected; home-only publication preserves private flows", async () => {
  const previous = {
    storage: process.env.ARCHIVE_STORAGE,
    dir: process.env.ARCHIVE_DATA_DIR,
    vercel: process.env.VERCEL,
  };
  const directory = await mkdtemp(path.join(os.tmpdir(), "featured-review-"));
  process.env.ARCHIVE_STORAGE = "local";
  process.env.ARCHIVE_DATA_DIR = directory;
  delete process.env.VERCEL;
  try {
    const base: ArchiveWork = JSON.parse(
      await readFile("src/data/preview_archive.json", "utf8"),
    ).works[0];
    const works = ["a", "b"].map((id, i) => ({
      ...base,
      id,
      status: "published" as const,
      is_featured: true,
      featured_order: i,
      updated_at: "2020-01-01T00:00:00.000Z",
    }));
    await writeFile(
      path.join(directory, "portfolio.json"),
      JSON.stringify({ revision: "start", updatedAt: "", data: works }),
    );
    const initial = await archiveSeed(works);
    initial.draft.sequences = [
      {
        id: "private",
        title: "Private flow",
        title_en: "",
        steps: [{ id: "step", title: "", title_en: "", artworkIds: ["a"] }],
        positions: { "step:a": { x: 700, y: -220 } },
      },
    ];
    await writeFile(
      path.join(directory, "archive.json"),
      JSON.stringify({
        revision: "archive-before",
        updatedAt: "",
        data: initial,
      }),
    );
    const saved = await reorderFeaturedArtworks(["b", "a"]);
    const currentA = saved.find((w) => w.id === "a")!;
    assert.notEqual(currentA.updated_at, works[0].updated_at);
    assert.equal(currentA.featured_order, 1);
    await assert.rejects(
      updateArtwork("a", {
        is_featured: false,
        _expected_updated_at: works[0].updated_at,
      }),
      ConflictError,
    );
    await updateArtwork("a", {
      is_featured: false,
      title: "Unpublished caption edit",
      _expected_updated_at: currentA.updated_at,
    });
    assert.equal(
      (await getPortfolio()).find((w) => w.id === "a").is_featured,
      false,
    );
    assert.equal(
      (await getArchive()).data.published.works.find((w) => w.id === "a")!
        .is_featured,
      true,
    );
    const published = await publishFeatured("archive-before");
    assert.deepEqual(published.data.draft, initial.draft);
    assert.deepEqual(published.data.published.layout, initial.published.layout);
    assert.deepEqual(published.data.published.strata, initial.published.strata);
    assert.deepEqual(published.data.backups, initial.backups);
    const publicA = published.data.published.works.find((w) => w.id === "a")!;
    assert.equal(publicA.is_featured, false);
    assert.equal(publicA.featured_order, 1);
    assert.equal(publicA.title, works[0].title);
    await assert.rejects(publishFeatured("archive-before"), ConflictError);
    await addArtwork({
      ...base,
      id: "new",
      status: "published",
      is_featured: true,
    });
    await assert.rejects(
      publishFeatured(published.revision),
      /아직 공개하지 않은/,
    );
    assert.equal((await getArchive()).revision, published.revision);
    const version = (await readDocument("portfolio", [])).revision;
    for (const invalid of [["b", "b"], ["missing"], ["a"], null])
      await assert.rejects(reorderFeaturedArtworks(invalid));
    assert.equal((await readDocument("portfolio", [])).revision, version);
  } finally {
    if (previous.storage === undefined) delete process.env.ARCHIVE_STORAGE;
    else process.env.ARCHIVE_STORAGE = previous.storage;
    if (previous.dir === undefined) delete process.env.ARCHIVE_DATA_DIR;
    else process.env.ARCHIVE_DATA_DIR = previous.dir;
    if (previous.vercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previous.vercel;
    await rm(directory, { recursive: true, force: true });
  }
});

test("login returns to the chosen private preview and rejects external or malformed destinations", () => {
  for (const view of ["sequences", "slideshow", "ecosystem"])
    assert.equal(
      adminReturnTo(`/admin/preview?view=${view}`),
      `/admin/preview?view=${view}`,
    );
  for (const input of [
    null,
    "https://outside.example",
    "//outside.example",
    "/\\outside.example",
    "/admin/preview\n?view=sequences",
    "/admin/preview/../../outside",
    "/api/archive",
    "/admin/preview-malicious",
  ])
    assert.equal(adminReturnTo(input), "/admin");
  assert.equal(
    adminReturnTo("/admin/preview?view=sequences&next=https://outside.example"),
    "/admin/preview?view=sequences",
  );
});
