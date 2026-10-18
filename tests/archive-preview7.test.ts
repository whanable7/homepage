import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { strataLayout, colorPosition, groupEdges } from "../src/lib/layouts";
import {
  orderedYearWorks,
  moveWorkToYear,
  validateYearOrder,
} from "../src/lib/year-order";
import {
  cosmosNodes,
  cosmosDefaults,
  stepCosmos,
} from "../src/lib/cosmos-physics";
import {
  emptyLayout,
  saveArchiveDraft,
  publishArchive,
} from "../src/lib/archive";
import { mutateDocument, readDocument } from "../src/lib/archive-store";
import type { ArchiveWork, ArchiveState } from "../src/types/archive";
const readWorks = async (): Promise<ArchiveWork[]> =>
  JSON.parse(await readFile("src/data/preview_archive.json", "utf8")).works;

test("nine-column strata preserves spans and never backfills an earlier colour layer", async () => {
  const works = await readWorks(),
    boxes = strataLayout(works, 1440),
    unit = (1440 - 6 * 8) / 9;
  const map = new Map(works.map((w) => [w.id, w]));
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    assert.ok(
      Math.abs(b.width - unit) < 0.001 ||
        Math.abs(b.width - (unit * 2 + 6)) < 0.001,
    );
    assert.ok(
      Math.abs(b.x / (unit + 6) - Math.round(b.x / (unit + 6))) < 0.001,
    );
    if (i) {
      assert.ok(b.y >= boxes[i - 1].y);
      assert.ok(
        colorPosition(map.get(b.id)!) >=
          colorPosition(map.get(boxes[i - 1].id)!),
      );
    }
  }
  const base = works[0];
  const layout = strataLayout(
    [
      { ...base, id: "gray", representative_color: "#888888" },
      { ...base, id: "red", representative_color: "#bb2211" },
      { ...base, id: "yellow", representative_color: "#c7a72d" },
    ],
    1440,
  );
  assert.deepEqual(
    layout.map((b) => b.id),
    ["red", "yellow", "gray"],
  );
});

test("year order persists independently in draft and published archives", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-years-"));
  process.env.ARCHIVE_STORAGE = "local";
  process.env.ARCHIVE_DATA_DIR = dir;
  const base = (await readWorks())[0];
  const works = ["a", "b", "c"].map((id) => ({ ...base, id, year: 2025 }));
  works.push({ ...base, id: "d", year: 2026 });
  const original: ArchiveState = {
    draft: emptyLayout(),
    published: {
      works,
      layout: emptyLayout(),
      strata: { desktop: [], phone: [] },
      revision: "old",
      publishedAt: "",
    },
    backups: [],
  };
  try {
    await mutateDocument("portfolio", works, () => works);
    const doc = await mutateDocument("archive", original, () => original);
    const layout = { ...emptyLayout(), yearOrder: { "2025": ["c", "a", "b"] } };
    validateYearOrder(layout.yearOrder, works);
    const saved = await saveArchiveDraft(layout, doc.revision);
    assert.equal(saved.data.published.revision, "old");
    const published = await publishArchive(saved.revision);
    const read = (await readDocument("archive", original)).data;
    assert.deepEqual(
      orderedYearWorks(read.published.works, 2025, read.published.layout).map(
        (w) => w.id,
      ),
      ["c", "a", "b"],
    );
    assert.deepEqual(published.data.draft.yearOrder?.["2025"], ["c", "a", "b"]);
    assert.deepEqual(published.data.draft.yearOrder?.["2026"], ["d"]);
    const appended = [...works, { ...base, id: "e", year: 2025 }];
    assert.equal(orderedYearWorks(appended, 2025, layout).at(-1)?.id, "e");
    const moved = appended.map((w) =>
      w.id === "a" ? { ...w, year: 2026 } : w,
    );
    const next = {
      ...layout,
      yearOrder: moveWorkToYear(layout, appended, "a", 2026),
    };
    assert.deepEqual(
      orderedYearWorks(moved, 2026, next).map((w) => w.id),
      ["d", "a"],
    );
    assert.throws(() => validateYearOrder({ "2025": ["a", "a"] }, works));
    assert.throws(() => validateYearOrder({ "2025": ["missing"] }, works));
  } finally {
    delete process.env.ARCHIVE_DATA_DIR;
    await rm(dir, { recursive: true, force: true });
  }
});

test("cosmos physics responds to settings, keeps central space and stays finite at extremes", async () => {
  const works = await readWorks(),
    ids = works.map((w) => w.id),
    groups = [{ id: "g", name: "", artworkIds: ids.slice(0, 25) }];
  const solve = (
    repulsion: number,
    center: number,
    distance: number,
    tension: number,
  ) => {
    const nodes = cosmosNodes(ids, groups),
      map = new Map(nodes.map((n) => [n.id, n]));
    const edges = groupEdges(groups).map(
      ([a, b]) =>
        [map.get(a)!, map.get(b)!] as [
          (typeof nodes)[number],
          (typeof nodes)[number],
        ],
    );
    for (let i = 0; i < 600; i++)
      stepCosmos(nodes, edges, {
        ...cosmosDefaults,
        repulsion,
        center,
        distance,
        tension,
        damping: 0.94,
      });
    assert.ok(
      nodes.every(
        (n) =>
          Number.isFinite(n.x + n.y + n.z) &&
          Math.hypot(n.x, n.y) >= 23.999 &&
          Math.hypot(n.x, n.y, n.z) < 1000,
      ),
    );
    return nodes;
  };
  const a = solve(5, 0.06, 15, 0.06),
    b = solve(150, 0.005, 100, 0);
  assert.ok(a.some((n, i) => Math.hypot(n.x - b[i].x, n.y - b[i].y) > 10));
});
