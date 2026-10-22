import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  archiveSeed,
  getArchive,
  saveArchiveDraft,
  publishFeatured,
  publishArchive,
} from "../src/lib/archive";
import {
  getPublicArchive,
  getPublishedTexts,
  getPublicAppearance,
  readPublicContent,
  mutateContent,
  publicVersions,
  publicCacheScope,
} from "../src/lib/public-content";
import {
  archiveReadCounts,
  readDocument,
  ConflictError,
} from "../src/lib/archive-store";
import { publicProjection } from "../src/lib/public-content-shape";
import { appearanceSeed } from "../src/lib/appearance";
import { updateArtwork } from "../src/lib/data";
import type { ArchiveWork, ArchiveText } from "../src/types/archive";

const total = () =>
  Object.values(archiveReadCounts()).reduce((a, b) => a + b, 0);
test("public cache reuses reads, isolates drafts, refreshes committed publications, and retains conflict checks", async () => {
  const old = { ...process.env };
  const directory = await mkdtemp(path.join(os.tmpdir(), "public-content-"));
  process.env.ARCHIVE_STORAGE = "local";
  process.env.ARCHIVE_DATA_DIR = directory;
  delete process.env.VERCEL;
  delete process.env.NEXT_RUNTIME;
  delete process.env.VERCEL_ENV;
  const write = (name: string, data: unknown, revision = "before") =>
    writeFile(
      path.join(directory, `${name}.json`),
      JSON.stringify({ revision, updatedAt: "", data }),
    );
  try {
    const base: ArchiveWork = JSON.parse(
      await readFile("src/data/preview_archive.json", "utf8"),
    ).works[0];
    const works = ["a", "b"].map((id) => ({
      ...base,
      id,
      status: "published" as const,
      is_featured: true,
      updated_at: "before",
    }));
    const state = await archiveSeed(works);
    state.draft.sequences = [
      {
        id: "private",
        title: "Secret flow",
        title_en: "",
        steps: [{ id: "step", title: "", title_en: "", artworkIds: ["a"] }],
        positions: { "step:a": { x: 400, y: -220 } },
      },
    ];
    const hidden = {
      title: "Unpublished English",
      blocks: [],
      published: false,
    };
    const texts: ArchiveText[] = [
      {
        id: "t",
        category: "notes",
        date: "2026",
        updated_at: "before",
        ko: { title: "Public Korean", published: true, blocks: [] },
        en: hidden,
      },
    ];
    await Promise.all([
      write("portfolio", works),
      write("archive", state),
      write("about", {
        artist_name: "Artist",
        contact_phone: "PRIVATE",
        phone_visible: false,
        password_hash: "NEVER",
      }),
      write("texts", texts),
      write("news", []),
      write("exhibitions", []),
      write("appearance", appearanceSeed()),
    ]);
    const before = total();
    const version = await publicVersions();
    const cold = total() - before;
    assert.equal(cold, 6, "no redundant portfolio seed read");
    await Promise.all(Array.from({ length: 100 }, () => publicVersions()));
    for (let i = 0; i < 100; i++) await getPublicArchive();
    assert.equal(
      total() - before,
      6,
      "repeat visits and version polls reuse the six public entries",
    );
    const cached = JSON.stringify(await getPublicArchive());
    assert.ok(!cached.includes("Secret flow"));
    assert.ok(!cached.includes('"tags"'));
    assert.ok(
      !JSON.stringify(await readPublicContent("about")).includes("PRIVATE"),
    );
    assert.ok(
      !JSON.stringify(await readPublicContent("about")).includes("NEVER"),
    );
    assert.ok(
      !JSON.stringify(await getPublishedTexts()).includes(
        "Unpublished English",
      ),
    );
    const adminBefore = total();
    assert.equal((await getArchive()).revision, "before");
    assert.equal(
      total() - adminBefore,
      1,
      "admin reads raw current archive without a seed portfolio read",
    );
    const draft = structuredClone(state.draft);
    draft.sequences[0].title = "Changed private flow";
    const saved = await saveArchiveDraft(draft, "before");
    assert.deepEqual(
      await publicVersions(),
      version,
      "draft edits don't change public versions",
    );
    await assert.rejects(
      saveArchiveDraft(state.draft, "before"),
      ConflictError,
    );
    await mutateContent(
      "texts",
      texts,
      (items) => {
        items[0].en.title = "Another hidden draft";
        return items;
      },
      "before",
    );
    assert.deepEqual(await publicVersions(), version);
    const typography = await readDocument("appearance", appearanceSeed());
    await mutateContent(
      "appearance",
      appearanceSeed(),
      (v) => ({ ...v, draft: { ...v.draft, name: 30 } }),
      typography.revision,
    );
    assert.equal((await getPublicAppearance()).name, 22);
    assert.deepEqual(await publicVersions(), version);
    await updateArtwork("a", {
      is_featured: false,
      title: "Private caption",
      _expected_updated_at: "before",
    });
    const home = await publishFeatured(saved.revision);
    const publicA = (await getPublicArchive()).works.find((w) => w.id === "a")!;
    assert.equal(publicA.is_featured, false);
    assert.equal(
      publicA.title,
      works[0].title,
      "home publication cannot leak caption drafts",
    );
    assert.deepEqual(home.data.draft, draft);
    assert.notEqual((await publicVersions()).version, version.version);
    await assert.rejects(publishFeatured(saved.revision), ConflictError);
    const textDoc = await readDocument("texts", texts);
    await mutateContent(
      "texts",
      texts,
      (items) => {
        items[0].ko.published = false;
        return items;
      },
      textDoc.revision,
    );
    assert.deepEqual(
      await getPublishedTexts(),
      [],
      "withdrawn text does not remain in cache",
    );
    const current = await getArchive();
    await updateArtwork("b", {
      status: "draft",
      _expected_updated_at: "before",
    });
    const published = await publishArchive(current.revision);
    assert.equal(
      (await getPublicArchive()).works.some((w) => w.id === "b"),
      false,
    );
    assert.deepEqual(
      published.data.draft.sequences,
      draft.sequences,
      "withdrawal keeps manual draft coordinates",
    );
    const scope = publicCacheScope();
    process.env.ARCHIVE_PREVIEW_BRANCH = "preview-a";
    process.env.VERCEL_ENV = "preview";
    const previewA = publicCacheScope();
    process.env.ARCHIVE_PREVIEW_BRANCH = "preview-b";
    assert.notEqual(publicCacheScope(), previewA);
    assert.notEqual(publicCacheScope(), scope);
    delete process.env.ARCHIVE_PREVIEW_BRANCH;
    delete process.env.VERCEL_GIT_COMMIT_REF;
    assert.throws(publicCacheScope, /브랜치/);
    console.log(
      JSON.stringify({
        scenario: "100 version checks plus 100 archive views",
        previousReads: 800,
        newReads: cold,
        reductionPercent: (1 - cold / 800) * 100,
      }),
    );
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in old)) delete process.env[key];
    Object.assign(process.env, old);
    await rm(directory, { recursive: true, force: true });
  }
});

test("cache misses fail closed and do not turn a read failure into an empty publication", async () => {
  const old = { ...process.env };
  const directory = await mkdtemp(path.join(os.tmpdir(), "public-failure-"));
  process.env.ARCHIVE_STORAGE = "local";
  process.env.ARCHIVE_DATA_DIR = directory;
  delete process.env.VERCEL;
  delete process.env.NEXT_RUNTIME;
  delete process.env.VERCEL_ENV;
  try {
    await writeFile(path.join(directory, "about.json"), "invalid JSON");
    const before = total();
    for (let i = 0; i < 100; i++)
      await assert.rejects(readPublicContent("about"));
    assert.equal(
      total() - before,
      1,
      "cooldown bounds repeated origin failures",
    );
    assert.equal(
      await readFile(path.join(directory, "about.json"), "utf8"),
      "invalid JSON",
    );
    assert.equal(
      publicProjection("appearance", appearanceSeed()) instanceof Object,
      true,
    );
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in old)) delete process.env[key];
    Object.assign(process.env, old);
    await rm(directory, { recursive: true, force: true });
  }
});
