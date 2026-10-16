import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { strataLayout, imageRatio, groupEdges } from "../src/lib/layouts";
import {
  createSession,
  verifySession,
  SESSION_SECONDS,
} from "../src/lib/session";
import {
  mutateDocument,
  readDocument,
  ConflictError,
} from "../src/lib/archive-store";
import { publicWork, publicLayout } from "../src/lib/archive";
import type { ArchiveWork } from "../src/types/archive";
import { retryArchiveRead } from "../src/lib/archive-read";

test("temporary storage read failures retry; authentication failures and exhausted reads do not fall back", async () => {
  let calls = 0;
  const current = { revision: "current", data: ["saved work"] };
  const result = await retryArchiveRead(
    async () => {
      if (++calls < 3)
        throw new Error(
          "Vercel Blob: Failed to fetch blob: 500 Internal Server Error",
        );
      return current;
    },
    async () => {},
  );
  assert.equal(calls, 3);
  assert.equal(result, current);
  calls = 0;
  await assert.rejects(
    () =>
      retryArchiveRead(
        async () => {
          calls++;
          throw new Error("Vercel Blob: Failed to fetch blob: 403 Forbidden");
        },
        async () => {},
      ),
    /403/,
  );
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(
    () =>
      retryArchiveRead(
        async () => {
          calls++;
          throw new Error(
            "Vercel Blob: Failed to fetch blob: 503 Service Unavailable",
          );
        },
        async () => {},
      ),
    /503/,
  );
  assert.equal(calls, 3);
});

test("unissued, tampered, expired and malformed sessions are rejected", async () => {
  process.env.ADMIN_SESSION_SECRET = "a-test-key-with-at-least-32-characters";
  const now = Date.now(),
    token = await createSession(now);
  assert.equal(await verifySession(token, now), true);
  assert.equal(await verifySession("anything", now), false);
  assert.equal(await verifySession(token.slice(0, -6) + "abcdef", now), false);
  assert.equal(
    await verifySession(token, now + (SESSION_SECONDS + 1) * 1000),
    false,
  );
  assert.equal(await verifySession(token, now - SESSION_SECONDS * 1000), false);
});
test("100 simultaneous saves retain every record and stale editors receive a conflict", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-store-"));
  process.env.ARCHIVE_STORAGE = "local";
  process.env.ARCHIVE_DATA_DIR = dir;
  try {
    await Promise.all(
      Array.from({ length: 100 }, (_, i) =>
        mutateDocument("concurrency", [] as number[], (current) => [
          ...current,
          i,
        ]),
      ),
    );
    const document = await readDocument("concurrency", [] as number[]);
    assert.equal(document.data.length, 100);
    assert.equal(new Set(document.data).size, 100);
    await mutateDocument(
      "concurrency",
      [] as number[],
      (x) => [...x, 101],
      document.revision,
    );
    await assert.rejects(
      () =>
        mutateDocument(
          "concurrency",
          [] as number[],
          (x) => [...x, 102],
          document.revision,
        ),
      ConflictError,
    );
    assert.equal(
      (await readDocument("concurrency", [] as number[])).data.length,
      101,
    );
  } finally {
    delete process.env.ARCHIVE_DATA_DIR;
    await rm(dir, { recursive: true, force: true });
  }
});
test("actual archive dimensions preserve ratios, gaps, and repeatable positions", async () => {
  const works = JSON.parse(
    await readFile("src/data/portfolio.json", "utf8"),
  ) as ArchiveWork[];
  for (const width of [320, 360, 768, 1440]) {
    const layout = strataLayout(works, width),
      gap = width < 600 ? 4 : 6;
    assert.deepEqual(layout, strataLayout(works, width));
    assert.equal(layout.length, works.length);
    for (let i = 0; i < layout.length; i++) {
      const a = layout[i],
        work = works.find((w) => w.id === a.id)!;
      assert.ok(a.x >= 0 && a.x + a.width <= width + 0.01);
      assert.ok(Math.abs(a.width / a.height - imageRatio(work)) < 0.001);
      for (let j = i + 1; j < layout.length; j++) {
        const b = layout[j],
          dx = Math.max(a.x - b.x - b.width, b.x - a.x - a.width),
          dy = Math.max(a.y - b.y - b.height, b.y - a.y - a.height);
        assert.ok(
          dx >= gap - 0.02 || dy >= gap - 0.02,
          `touching ${a.id}/${b.id} at ${width}`,
        );
      }
    }
  }
});
test("public snapshots contain neither internal tag names nor private group labels", async () => {
  const work = JSON.parse(
    await readFile("src/data/portfolio.json", "utf8"),
  )[0] as ArchiveWork;
  const clean = publicWork({
    ...work,
    tags: [{ id: "private-id", name: "private-label", created_at: "" }],
  });
  assert.ok(!("tags" in clean));
  assert.ok(!("connections" in clean));
  assert.equal(clean.show_watermark, false);
  const groups = [
    { id: "group", name: "private-label", artworkIds: ["a", "b"] },
  ];
  const layout = publicLayout({
    ecosystem: groups,
    cosmos: groups,
    sequences: [],
    stars: {},
    excluded: {},
    seed: 0,
  });
  assert.ok(!JSON.stringify(layout).includes("private-label"));
});
test("independent constellations stay disconnected and duplicate links are eliminated", () => {
  const edges = groupEdges([
    { id: "a", name: "", artworkIds: ["1", "2", "3"] },
    { id: "b", name: "", artworkIds: ["4", "5"] },
    { id: "c", name: "", artworkIds: ["1", "2"] },
  ]);
  assert.equal(edges.filter(([a, b]) => a === "1" && b === "2").length, 1);
  assert.ok(
    !edges.some(
      ([a, b]) => ["1", "2", "3"].includes(a) && ["4", "5"].includes(b),
    ),
  );
});
