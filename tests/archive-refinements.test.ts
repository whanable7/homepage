import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  forceSimulation,
  forceManyBody,
  forceX,
  forceY,
  forceLink,
  forceCollide,
} from "d3-force";
import type { ArchiveWork, ArchiveState } from "../src/types/archive";
import { compareWorks, workDimensions } from "../src/lib/admin-work-list";
import {
  ecosystemNodes,
  separateEcosystemNodes,
} from "../src/lib/ecosystem-layout";
import { strataLayout } from "../src/lib/layouts";
import type { EcosystemNode } from "../src/lib/ecosystem-layout";
import type { SimulationLinkDatum } from "d3-force";
import {
  parseContactMessage,
  contactMessageText,
} from "../src/lib/contact-message";
import { emptyLayout, publishArchive } from "../src/lib/archive";
import { mutateDocument, readDocument } from "../src/lib/archive-store";

async function artworks(): Promise<ArchiveWork[]> {
  return JSON.parse(await readFile("src/data/preview_archive.json", "utf8"))
    .works;
}
test("explicit title and year sorting remains independent of missing classification", async () => {
  const base = (await artworks())[0];
  const works = [
    { ...base, id: "a", title: "작품 10", year: 2024 },
    { ...base, id: "b", title: "작품 2", year: 2026 },
    { ...base, id: "c", title: "가", year: 2025 },
  ];
  for (const [sort, ids] of [
    ["title-asc", ["c", "b", "a"]],
    ["title-desc", ["a", "b", "c"]],
    ["year-asc", ["a", "c", "b"]],
    ["year-desc", ["b", "c", "a"]],
  ] as const)
    assert.deepEqual(
      [...works].sort((a, b) => compareWorks(a, b, sort)).map((w) => w.id),
      ids,
    );
  assert.equal(
    workDimensions({ ...base, height: 12.5, width: 18.75 }),
    "12.5 × 18.75 cm",
  );
  assert.match(
    workDimensions({ ...base, height: null, width: null }),
    /미입력/,
  );
});
test("smaller strata shows more artworks while retaining every image", async () => {
  const baseline = JSON.parse(
    await readFile("src/data/preview_archive.json", "utf8"),
  );
  const next = strataLayout(baseline.works, 1440);
  const area = (items: { width: number; height: number }[]) =>
    items.reduce((n, p) => n + p.width * p.height, 0);
  assert.equal(next.length, 125);
  assert.ok(area(next) < area(baseline.strata.desktop) * 0.75);
  assert.ok(next.every((p) => p.width <= 1440 * 0.238 + 0.01));
});
test("thumbnail bounds stay apart after linked forces settle at several tensions", async () => {
  const works = await artworks(),
    width = 1400,
    height = 1050;
  for (const tension of [0.1, 0.8, 1]) {
    const nodes = ecosystemNodes(works, width, height);
    const sim = forceSimulation(nodes)
      .force("charge", forceManyBody().strength(-120))
      .force("x", forceX(width / 2).strength(0.05))
      .force("y", forceY(height / 2).strength(0.05))
      .force(
        "links",
        forceLink<EcosystemNode, SimulationLinkDatum<EcosystemNode>>(
          nodes.slice(1).map((n, i) => ({ source: nodes[i].id, target: n.id })),
        )
          .id((n) => n.id)
          .distance(130)
          .strength(tension),
      )
      .force(
        "collision",
        forceCollide<EcosystemNode>().radius(
          (n) => Math.hypot(n.width, n.height) / 2 + 7,
        ),
      )
      .stop();
    for (let i = 0; i < 240; i++) {
      sim.tick();
      separateEcosystemNodes(nodes, width, height, 5);
    }
    separateEcosystemNodes(nodes, width, height, 100);
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      assert.ok(a.x - a.width / 2 >= 0 && a.x + a.width / 2 <= width);
      assert.ok(a.y - a.height / 2 >= 0 && a.y + a.height / 2 <= height);
      for (const b of nodes.slice(i + 1))
        assert.ok(
          Math.abs(a.x - b.x) >= (a.width + b.width) / 2 + 6.9 ||
            Math.abs(a.y - b.y) >= (a.height + b.height) / 2 + 6.9,
        );
    }
  }
});
test("publishing empty relations requires confirmation and preserves a relation backup", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-publish-"));
  process.env.ARCHIVE_STORAGE = "local";
  process.env.ARCHIVE_DATA_DIR = dir;
  const works = (await artworks()).slice(0, 2),
    previous = emptyLayout();
  previous.ecosystem = [
    { id: "old", name: "kept", artworkIds: works.map((w) => w.id) },
  ];
  const state: ArchiveState = {
    published: {
      works,
      layout: previous,
      strata: { phone: [], desktop: [] },
      revision: "previous",
      publishedAt: "",
    },
    draft: emptyLayout(),
    backups: [],
  };
  try {
    await mutateDocument("portfolio", works, () => works);
    const original = await mutateDocument("archive", state, () => state);
    await assert.rejects(() => publishArchive(original.revision), /별도 확인/);
    assert.equal(
      (await readDocument("archive", state)).revision,
      original.revision,
    );
    const result = await publishArchive(original.revision, true);
    assert.equal(result.data.published.layout.ecosystem.length, 0);
    assert.deepEqual(
      result.data.backups.at(-1)?.layout.ecosystem,
      previous.ecosystem,
    );
  } finally {
    delete process.env.ARCHIVE_DATA_DIR;
    await rm(dir, { recursive: true, force: true });
  }
});

test("contact accepts ordinary text and rejects oversized or injected headers", () => {
  const value = {
    name: "정환",
    email: "artist@example.com",
    subject: "작품 문의",
    message: "<b>본문</b>\n둘째 줄",
  };
  assert.equal(parseContactMessage(value).name, "정환");
  assert.match(contactMessageText(value), /<b>본문<\/b>/);
  assert.throws(() =>
    parseContactMessage({
      ...value,
      subject: "제목\r\nBcc: other@example.com",
    }),
  );
  assert.throws(() =>
    parseContactMessage({ ...value, message: "x".repeat(20001) }),
  );
  assert.throws(() => parseContactMessage({ ...value, email: 12 }));
});
