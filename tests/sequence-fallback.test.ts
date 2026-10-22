import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import type { ArchiveWork, Sequence } from "../src/types/archive";
import {
  addSequenceStep,
  fitSequence,
  sequenceLayout,
  validateSequencePositions,
} from "../src/lib/sequence-layout";

async function fixture(count: number) {
  const base: ArchiveWork = JSON.parse(
    await readFile("src/data/preview_archive.json", "utf8"),
  ).works[0];
  const works = Array.from({ length: count }, (_, i) => ({
    ...base,
    id: `work-${i}`,
    year: 2026 - (i % 8),
    image_aspect_ratio: [1, 0.65, 2.8, 8, 0.12][i % 5],
    image_width: undefined,
    image_height: undefined,
  }));
  const sequence: Sequence = {
    id: "flow",
    title: "",
    title_en: "",
    steps: [
      {
        id: "stage",
        title: "",
        title_en: "",
        artworkIds: works.map((w) => w.id),
      },
    ],
  };
  return { works, sequence };
}

test("125 unpositioned works form compact shared columns without overlaps or mutation", async () => {
  const { works, sequence } = await fixture(125);
  const before = JSON.stringify(sequence);
  const model = sequenceLayout(sequence, works);
  assert.equal(JSON.stringify(sequence), before);
  assert.equal(model.nodes.length, 125);
  assert.ok(model.width < 4000, "the old diagonal was over 28,000 units wide");
  assert.ok(model.height < 1800);
  assert.ok(model.nodes.some((n) => n.y > 0));
  assert.ok(model.nodes.some((n) => n.y < 0));
  assert.equal(new Set(model.nodes.map((n) => n.x)).size, 16);
  assert.ok(fitSequence(model.width, model.height, 1280, 600) > 0.3);
  for (const [i, n] of model.nodes.entries()) {
    assert.ok(Math.abs(n.y) - n.height / 2 >= 80);
    for (const other of model.nodes.slice(i + 1)) {
      assert.ok(
        Math.abs(n.x - other.x) >= (n.width + other.width) / 2 + 28 ||
          Math.abs(n.y - other.y) >= (n.height + other.height) / 2 + 24,
      );
    }
  }
  const changedYears = works.map((w, i) => ({ ...w, year: 1900 + i }));
  assert.deepEqual(
    sequenceLayout(sequence, changedYears).nodes.map(({ key, x, y }) => ({
      key,
      x,
      y,
    })),
    model.nodes.map(({ key, x, y }) => ({ key, x, y })),
  );
});

test("partial manual layouts stay fixed while unsaved works avoid them and later steps stay to the right", async () => {
  const { works, sequence } = await fixture(20);
  sequence.positions = {
    "stage:work-0": { x: 450, y: -200 },
    "stage:work-1": { x: 450, y: -430 },
  };
  sequence.steps.push({
    id: "next",
    title: "",
    title_en: "",
    artworkIds: ["work-19"],
  });
  sequence.steps[0].artworkIds.pop();
  const model = sequenceLayout(sequence, works);
  for (const [key, position] of Object.entries(sequence.positions)) {
    const node = model.nodes.find((n) => n.key === key)!;
    assert.deepEqual({ x: node.x, y: node.y }, position);
  }
  const first = model.nodes.filter((n) => n.step.id === "stage");
  const next = model.nodes.find((n) => n.step.id === "next")!;
  assert.ok(
    next.x - next.width / 2 > Math.max(...first.map((n) => n.x + n.width / 2)),
  );
});

test("batch creation uses the same compact arrangement and freezes valid positions", async () => {
  const { works } = await fixture(125);
  const next = addSequenceStep(
    { id: "new", title: "", title_en: "", steps: [] },
    works.map((w) => w.id),
    works,
  );
  validateSequencePositions(next);
  assert.equal(Object.keys(next.positions!).length, 125);
  assert.ok(sequenceLayout(next, works).width < 4000);
  const before = JSON.stringify(next.positions);
  addSequenceStep(next, [], works);
  assert.equal(JSON.stringify(next.positions), before);
});
