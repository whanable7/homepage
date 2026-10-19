import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { ArchiveWork, Sequence, WorkGroup } from "../src/types/archive";
import {
  changeGroupMembers,
  edgeKey,
  groupFocus,
} from "../src/lib/group-relations";
import {
  sequenceLayout,
  sequenceKey,
  validateSequencePositions,
} from "../src/lib/sequence-layout";

test("self-hosted font references exist, retain their content hashes, and do not fetch fonts during builds", async () => {
  const css = await readFile("src/app/fonts.css", "utf8");
  const files = [...css.matchAll(/url\(['"]?\/fonts\/([^'"\)]+)['"]?\)/g)].map(
    (m) => m[1],
  );
  assert.equal(new Set(files).size, 8);
  for (const name of files) {
    const bytes = await readFile("public/fonts/" + name);
    assert.equal(bytes.subarray(0, 4).toString(), "wOF2");
    assert.ok(
      name.includes(
        createHash("sha256").update(bytes).digest("hex").slice(0, 12),
      ),
    );
  }
  for (const family of ["cormorantgaramond", "notosanskr", "nanummyeongjo"])
    assert.match(
      await readFile(`public/fonts/LICENSE-${family}.txt`, "utf8"),
      /SIL OPEN FONT LICENSE/,
    );
  assert.ok(
    !(await readFile("src/app/layout.tsx", "utf8")).includes(
      "next/font/google",
    ),
  );
});

test("membership editing preserves deliberate links, including a deliberately empty map", () => {
  const g: WorkGroup = {
    id: "g",
    name: "group",
    artworkIds: ["a", "b", "c"],
    edges: [["a", "c"]],
  };
  assert.deepEqual(changeGroupMembers(g, ["d"]).edges, [["a", "c"]]);
  assert.deepEqual(changeGroupMembers(g, ["b"], true).edges, [["a", "c"]]);
  assert.deepEqual(changeGroupMembers(g, ["a"], true).edges, []);
  assert.deepEqual(changeGroupMembers({ ...g, edges: [] }, ["d"]).edges, []);
  assert.equal(
    changeGroupMembers({ id: "legacy", name: "", artworkIds: ["a", "b"] }, [
      "c",
    ]).edges,
    undefined,
  );
  assert.deepEqual(g.artworkIds, ["a", "b", "c"]);
});

test("focus includes all directly matching groups but does not recursively flood the graph", () => {
  const groups = [
    { id: "one", name: "", artworkIds: ["a", "b", "c"] },
    {
      id: "two",
      name: "",
      artworkIds: ["a", "d"],
      edges: [["a", "d"]] as [string, string][],
    },
    { id: "three", name: "", artworkIds: ["d", "e"] },
  ];
  const focus = groupFocus(groups, "a");
  assert.deepEqual([...focus.ids].sort(), ["a", "b", "c", "d"]);
  assert.ok(focus.edges.has(edgeKey("b", "c")));
  assert.ok(!focus.edges.has(edgeKey("d", "e")));
  assert.deepEqual([...groupFocus(groups, "d", "one").ids], ["a", "b", "c"]);
});

test("sequences seed chronologically, retain year order, preserve manual positions, and reject invalid coordinates", async () => {
  const base: ArchiveWork = JSON.parse(
    await readFile("src/data/preview_archive.json", "utf8"),
  ).works[0];
  const works = [
    { ...base, id: "a", year: 2025 },
    { ...base, id: "b", year: 2024 },
    { ...base, id: "c", year: 2025 },
  ];
  const sequence: Sequence = {
    id: "s",
    title: "흐름",
    title_en: "Flow",
    steps: [
      {
        id: "step",
        title: "같은 단계",
        title_en: "Same stage",
        artworkIds: ["a", "c", "b"],
      },
    ],
  };
  const layout = { yearOrder: { "2025": ["c", "a"] } };
  const seeded = sequenceLayout(sequence, works, layout);
  assert.deepEqual(
    seeded.nodes.map((n) => n.work.id),
    ["b", "c", "a"],
  );
  sequence.positions = Object.fromEntries(
    seeded.nodes.map((n) => [n.key, { x: n.x, y: n.y }]),
  );
  sequence.positions[sequenceKey("step", "a")] = { x: 300, y: 250 };
  validateSequencePositions(sequence);
  const laterWorks = [...works, { ...base, id: "new", year: 2020 }];
  sequence.steps[0].artworkIds.push("new");
  const next = sequenceLayout(sequence, laterWorks, layout);
  const a = next.nodes.find((n) => n.work.id === "a")!;
  assert.equal(a.x, 300);
  assert.equal(a.y, 250);
  for (const node of next.nodes) {
    assert.ok(node.x - node.width / 2 >= 0);
    assert.ok(node.y + next.axisY - node.height / 2 >= 0);
    assert.ok(node.x + node.width / 2 < next.width);
  }
  sequence.positions[sequenceKey("step", "a")].x = NaN;
  assert.throws(() => validateSequencePositions(sequence));
});
