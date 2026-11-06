import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyCVCommand,
  cleanCVRow,
  cvSnapshot,
  cvFields,
  type CVAbout,
  type CVRow,
} from "../src/lib/cv-editor";
const now = "2026-11-06T09:00:00Z";
test("all nine CV sections accept either language, preserve fields, delete and restore without affecting other records", () => {
  for (const [section, fields] of Object.entries(cvFields)) {
    let a: CVAbout = {
        artist_name: "kept",
        projects: [{ id: "unrelated", year: "2020", title: "keep" }],
      },
      ex: CVRow[] = [];
    const apply = (c: Record<string, unknown>) => {
      const result = applyCVCommand(
        a,
        ex,
        { section, revision: "test", ...c } as Parameters<
          typeof applyCVCommand
        >[2],
        now,
      );
      if (Array.isArray(result)) ex = result;
      else a = result;
    };
    apply({
      action: "save",
      id: "new-record",
      fields: { year: "2026~", [fields[0][0] + "_en"]: "English only" },
    });
    let row = cvSnapshot(a, ex).sections[section].find(
      (r) => r.id === "new-record",
    )!;
    assert.equal(row.year, "2026~");
    assert.equal(row[fields[0][0] + "_en"], "English only");
    apply({
      action: "save",
      id: "new-record",
      fields: { ...row, [fields[0][0]]: "한글" },
    });
    assert.equal(
      cvSnapshot(a, ex).sections[section].filter((r) => r.id === "new-record")
        .length,
      1,
    );
    apply({ action: "delete", id: "new-record" });
    assert.ok(
      !cvSnapshot(a, ex).sections[section].some((r) => r.id === "new-record"),
    );
    apply({ action: "restore", id: "new-record" });
    row = cvSnapshot(a, ex).sections[section].find(
      (r) => r.id === "new-record",
    )!;
    assert.equal(row[fields[0][0]], "한글");
    assert.equal(a.artist_name, "kept");
  }
});
test("legacy rows acquire stable IDs through reorder and retain unknown fields", () => {
  const a = {
    education: [
      { year: "2024", description: "A", extra: "preserve" },
      { year: "2024", description: "B" },
    ],
    contact_email: "keep",
  };
  const snap = cvSnapshot(a, []),
    ids = snap.sections.education.map((r) => r.id).reverse();
  const reordered = applyCVCommand(
    a,
    [],
    { action: "reorder", section: "education", ids, revision: "x" },
    now,
  ) as CVAbout;
  assert.deepEqual(
    cvSnapshot(reordered, []).sections.education.map((r) => r.id),
    ids,
  );
  assert.equal(
    cvSnapshot(reordered, []).sections.education[1].extra,
    "preserve",
  );
  assert.throws(() =>
    applyCVCommand(
      a,
      [],
      {
        action: "reorder",
        section: "education",
        ids: [ids[0], ids[0]],
        revision: "x",
      },
      now,
    ),
  );
});
test("validation never silently discards incomplete records or accepts unsafe links", () => {
  assert.throws(() => cleanCVRow("education", { year: "2026" }));
  assert.throws(() =>
    cleanCVRow("projects", {
      year: "2026",
      title: "A",
      url: "javascript:alert(1)",
    }),
  );
  assert.throws(() => cleanCVRow("solo", { year: 2026, title: "A" }));
});
test("exhibition ordering preserves other groups and original metadata on update", () => {
  const ex = [
    {
      id: "a",
      year: "2024",
      title: "A",
      type: "solo",
      created_at: "original",
      external_url: "https://example.com",
      custom: "keep",
    },
    { id: "b", year: "2025", title: "B", type: "solo" },
    { id: "c", year: "2023", title: "C", type: "group" },
  ] as CVRow[];
  const next = applyCVCommand(
    {},
    ex,
    {
      action: "save",
      section: "solo",
      id: "a",
      fields: {
        year: "2024",
        title: "A revised",
        external_url: "https://example.com",
      },
      revision: "x",
    },
    now,
  ) as CVRow[];
  assert.equal(next[0].custom, "keep");
  assert.equal(next[0].created_at, "original");
  assert.deepEqual(next[2], ex[2]);
  const a = applyCVCommand(
    { cv_exhibition_order: ["c"] },
    ex,
    { action: "reorder", section: "solo", ids: ["a", "b"], revision: "x" },
    now,
  ) as CVAbout;
  assert.deepEqual(a.cv_exhibition_order, ["a", "b", "c"]);
});
