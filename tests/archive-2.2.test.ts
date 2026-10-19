import { test } from "node:test";
import assert from "node:assert/strict";
import { sequenceConnections, fitSequence } from "../src/lib/sequence-layout";

test("aligned artworks share a single vertical stem with gaps at every artwork", () => {
  const nodes = [-130, -300, -480].map((y) => ({
    x: 200,
    y,
    width: 100,
    height: 80,
    step: { id: "same" },
  }));
  const lines = sequenceConnections(nodes, 600);
  assert.equal(lines.length, 3);
  assert.ok(lines.every((l) => l.x1 === 200 && l.x2 === 200));
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    for (const n of nodes)
      assert.ok(l.y2 <= 600 + n.y - 43 || l.y1 >= 600 + n.y + 43);
    for (const other of lines.slice(i + 1))
      assert.ok(l.y2 <= other.y1 || other.y2 <= l.y1);
  }
});
test("steps spanning both sides of the axis connect separately without crossing artworks", () => {
  const nodes = [
    { x: 150, y: -180, width: 100, height: 90, step: { id: "a" } },
    { x: 450, y: 180, width: 100, height: 90, step: { id: "a" } },
    { x: 650, y: 180, width: 100, height: 90, step: { id: "b" } },
  ];
  const lines = sequenceConnections(nodes, 400);
  assert.ok(lines.some((l) => l.x1 === 150 && l.y1 < 400));
  assert.ok(lines.some((l) => l.x1 === 450 && l.y1 >= 400));
  assert.ok(!lines.some((l) => l.x1 !== l.x2)); // Separate branches are not arbitrarily joined across the axis or across steps.
});
test("whole view fits tall and wide saved arrangements without changing coordinates", () => {
  for (const [w, h, vw, vh] of [
    [15000, 1300, 1300, 650],
    [2000, 6000, 1100, 550],
    [900, 440, 390, 400],
  ]) {
    const scale = fitSequence(w, h, vw, vh);
    assert.ok(w * scale <= vw - 24 + 1e-8);
    assert.ok(h * scale <= vh - 24 + 1e-8);
    assert.ok(scale > 0 && scale <= 1);
  }
});
