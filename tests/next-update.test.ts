import { test } from "node:test";
import assert from "node:assert/strict";
import {
  containedImageRect,
  magnifierGeometry,
} from "../src/lib/magnifier-geometry";
import { shouldTrack, sanitizedReferrer } from "../src/lib/analytics-policy";
import {
  reportRanges,
  reportBuckets,
  koreanDate,
  percentageChange,
} from "../src/lib/analytics-report";
import { applyCosmosRepulsion } from "../src/lib/cosmos-repulsion";
import {
  cosmosNodes,
  stepCosmos,
  cosmosDefaults,
} from "../src/lib/cosmos-physics";
import {
  ecosystemNodes,
  separateEcosystemNodes,
} from "../src/lib/ecosystem-layout";
import type { ArchiveWork } from "../src/types/archive";
import { readFile } from "node:fs/promises";

test("magnifier samples the same image pixel at the center, edges and corners after relocating", () => {
  for (const ratio of [
    [100, 300],
    [300, 100],
    [1000, 100],
    [100, 100],
  ]) {
    // This DOM rectangle also represents an already transformed image box.
    const box = { left: 30, top: 80, width: 300, height: 450 };
    const image = containedImageRect(box, ...(ratio as [number, number]))!;
    for (const u of [0, 0.5, 1])
      for (const v of [0, 0.5, 1]) {
        const point = {
          x: image.left + u * image.width,
          y: image.top + v * image.height,
        };
        const viewport = { left: 0, top: 0, width: 360, height: 640 };
        const lens = magnifierGeometry(image, point, viewport)!;
        assert.ok(lens.left >= 8 && lens.left + lens.size <= 352);
        assert.ok(lens.top >= 8 && lens.top + lens.size <= 632);
        assert.ok(
          Math.abs(
            (lens.size / 2 - lens.backgroundX) / lens.backgroundWidth - u,
          ) < 1e-9,
        );
        assert.ok(
          Math.abs(
            (lens.size / 2 - lens.backgroundY) / lens.backgroundHeight - v,
          ) < 1e-9,
        );
        assert.ok(
          Number.isFinite(lens.backgroundX) &&
            Number.isFinite(lens.backgroundY),
        );
      }
    assert.equal(
      magnifierGeometry(image, { x: image.left - 1, y: image.top }, box),
      null,
    );
  }
  assert.equal(
    containedImageRect({ left: 0, top: 0, width: 0, height: 0 }, 0, 0),
    null,
  );
});

test("statistics gates collection by canonical deployment, public route and pre-existing exclusion", () => {
  const ordinary = {
    production: true,
    hostname: "jungwhanpark.com",
    pathname: "/works",
    excluded: false,
  };
  assert.equal(shouldTrack(ordinary), true);
  for (const pathname of [
    "/admin",
    "/admin/preview",
    "/admin/login",
    "/typography-preview",
    "/api/works",
  ])
    assert.equal(shouldTrack({ ...ordinary, pathname }), false);
  for (const hostname of [
    "localhost",
    "homepage-preview.vercel.app",
    "jungwhanpark.com.example.org",
  ])
    assert.equal(shouldTrack({ ...ordinary, hostname }), false);
  assert.equal(shouldTrack({ ...ordinary, excluded: true }), false);
  assert.equal(shouldTrack({ ...ordinary, production: false }), false);
  assert.equal(
    sanitizedReferrer(
      "https://example.org/page?email=private@example.org#secret",
    ),
    "https://example.org/page",
  );
  assert.equal(sanitizedReferrer("javascript:alert(1)"), "");
});

test("Korean date boundaries, leap years and matched elapsed comparisons", () => {
  assert.equal(koreanDate(new Date("2026-11-04T15:00:00Z")), "2026-11-05");
  assert.deepEqual(reportRanges("day", "2026-01-05"), {
    current: { start: "2026-01-01", end: "2026-01-05" },
    previous: { start: "2025-12-01", end: "2025-12-05" },
  });
  assert.equal(reportRanges("day", "2024-03-31").previous.end, "2024-02-29");
  assert.equal(reportRanges("month", "2024-02-29").previous.end, "2023-02-28");
  assert.equal(reportBuckets("day", "2024-02-01", "2024-02-29").length, 29);
  assert.equal(reportBuckets("month", "2026-01-01", "2026-11-05").length, 11);
  assert.equal(reportBuckets("year", "2022-01-01", "2026-11-05").length, 5);
  assert.equal(percentageChange(5, 0), null);
  assert.equal(percentageChange(6, 3), 100);
});

test("large cosmos far-field approximation remains close to the original pairwise force", () => {
  const approx = cosmosNodes(
    Array.from({ length: 1000 }, (_, i) => `star${i}`),
    [],
  );
  const exact = structuredClone(approx);
  applyCosmosRepulsion(approx, 55);
  for (const a of exact)
    for (const b of exact)
      if (a !== b) {
        const dx = a.x - b.x,
          dy = a.y - b.y,
          dz = a.z - b.z;
        const f = (55 * 0.03) / (dx * dx + dy * dy + dz * dz + 25);
        a.vx += dx * f;
        a.vy += dy * f;
        a.vz += dz * f * 0.1;
      }
  let error = 0,
    magnitude = 0;
  for (let i = 0; i < exact.length; i++) {
    error += Math.hypot(
      approx[i].vx - exact[i].vx,
      approx[i].vy - exact[i].vy,
      approx[i].vz - exact[i].vz,
    );
    magnitude += Math.hypot(exact[i].vx, exact[i].vy, exact[i].vz);
  }
  assert.ok(
    error / magnitude < 0.025,
    `relative force error ${error / magnitude}`,
  );
  for (let i = 0; i < 100; i++) stepCosmos(approx, [], cosmosDefaults);
  assert.ok(
    approx.every(
      (n) =>
        [n.x, n.y, n.z].every(Number.isFinite) &&
        Math.hypot(n.x, n.y) >= 24 - 1e-8,
    ),
  );
});

test("large ecosystem separation keeps image rectangles apart without rewriting work records", async () => {
  const base: ArchiveWork = JSON.parse(
    await readFile("src/data/preview_archive.json", "utf8"),
  ).works[0];
  const works = Array.from({ length: 1000 }, (_, i) => ({
    ...base,
    id: `w${i}`,
  }));
  const nodes = ecosystemNodes(works, 4000, 2500);
  separateEcosystemNodes(nodes, 4000, 2500, 80, false);
  let overlaps = 0;
  for (let i = 0; i < nodes.length; i++)
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i],
        b = nodes[j];
      if (
        Math.abs(a.x - b.x) < (a.width + b.width) / 2 &&
        Math.abs(a.y - b.y) < (a.height + b.height) / 2
      )
        overlaps++;
    }
  assert.equal(overlaps, 0);
  assert.equal(works[0].id, "w0");
});
