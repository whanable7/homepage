import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultAppearance,
  validateAppearance,
  fontStack,
  fontOptions,
  appearanceStyle,
} from "../src/lib/appearance";
import {
  addSequenceStep,
  addSequenceMembers,
  sequenceLayout,
  validateSequencePositions,
} from "../src/lib/sequence-layout";
import { readFile } from "node:fs/promises";
import type { Sequence, ArchiveWork } from "../src/types/archive";
test("appearance validates only supported fonts and bounded finite sizes", () => {
  assert.deepEqual(validateAppearance(defaultAppearance), defaultAppearance);
  for (const bad of [
    { name: NaN },
    { menu: 50 },
    { ko: "Inter" },
    { textKo: "Cormorant Garamond" },
    { en: "missing" },
    { spacing: Infinity },
  ])
    assert.throws(() => validateAppearance({ ...defaultAppearance, ...bad }));
  assert.equal(fontOptions.filter((f) => f.ko).length, 4);
  assert.match(
    fontStack("Noto Sans KR", "Nanum Myeongjo"),
    /Site Noto Latin.*Nanum Myeongjo/,
  );
  assert.equal(
    appearanceStyle(defaultAppearance)[
      "--site-name-size" as keyof ReturnType<typeof appearanceStyle>
    ],
    "22px",
  );
});
test("new sequence steps append after the rightmost saved group independently of years and retain existing positions", async () => {
  const base: ArchiveWork = JSON.parse(
    await readFile("src/data/preview_archive.json", "utf8"),
  ).works[0];
  const works = [
    { ...base, id: "a", year: 2026 },
    { ...base, id: "b", year: 2018 },
    { ...base, id: "c", year: 2010 },
  ];
  const sequence: Sequence = {
    id: "flow",
    title: "",
    title_en: "",
    steps: [{ id: "a-step", title: "", title_en: "", artworkIds: ["a"] }],
    positions: { "a-step:a": { x: 1400, y: -240 } },
  };
  const next = addSequenceStep(sequence, ["b"], works);
  assert.deepEqual(
    next.positions?.["a-step:a"],
    sequence.positions?.["a-step:a"],
  );
  const model = sequenceLayout(next, works),
    b = model.nodes.find((n) => n.work.id === "b")!;
  assert.ok(
    b.x - b.width / 2 >
      1400 + model.nodes.find((n) => n.work.id === "a")!.width / 2,
  );
  const empty = addSequenceStep(next, [], works);
  const another = addSequenceStep(empty, [], works);
  assert.ok(another.steps.at(-1)!.anchorX! > empty.steps.at(-1)!.anchorX!);
  const more = addSequenceMembers(next, next.steps[1].id, ["c"], works);
  assert.deepEqual(
    more.positions?.[`${next.steps[1].id}:b`],
    next.positions?.[`${next.steps[1].id}:b`],
  );
  assert.ok(more.positions?.[`${next.steps[1].id}:c`]);
});

test("large sequence groups wrap into columns without exceeding saved coordinate bounds", async () => {
  const base: ArchiveWork = JSON.parse(
    await readFile("src/data/preview_archive.json", "utf8"),
  ).works[0];
  const works = Array.from({ length: 70 }, (_, i) => ({
    ...base,
    id: `batch-${i}`,
  }));
  const next = addSequenceStep(
    { id: "flow", title: "", title_en: "", steps: [] },
    works.map((w) => w.id),
    works,
  );
  validateSequencePositions(next);
  assert.equal(Object.keys(next.positions!).length, 70);
  assert.ok(new Set(Object.values(next.positions!).map((p) => p.x)).size > 1);
});
