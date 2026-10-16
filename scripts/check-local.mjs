import assert from "node:assert/strict";
import { readFile, writeFile, rm } from "node:fs/promises";
const origin = process.env.LOCAL_TEST_ORIGIN || "http://127.0.0.1:3100";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname))
  throw new Error("This check only targets an isolated local server.");
if (
  process.env.ARCHIVE_STORAGE !== "local" ||
  !process.env.LOCAL_ADMIN_PASSWORD
)
  throw new Error(
    "Explicit local storage and a local-only test password are required.",
  );
const originals = new Map();
for (const name of ["portfolio", "archive", "texts"]) {
  try {
    originals.set(name, await readFile(`.archive-local/${name}.json`));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    originals.set(name, null);
  }
}
let cookie = "";
async function request(path, method = "GET", body, authenticated = true) {
  const r = await fetch(origin + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(authenticated && cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { r, data: await r.json() };
}
try {
  for (const path of [
    "/api/tags",
    "/api/admin-settings",
    "/api/portfolio/graph",
  ]) {
    const r = await fetch(origin + path, {
      headers: { cookie: "admin_session=forged" },
    });
    assert.equal(r.status, 401);
  }
  let result = await request(
    "/api/auth",
    "POST",
    { password: process.env.LOCAL_ADMIN_PASSWORD },
    false,
  );
  assert.equal(result.r.status, 200);
  cookie = result.r.headers.get("set-cookie").split(";")[0];
  result = await request("/api/admin-settings");
  assert.equal(result.r.status, 200);
  assert.ok(!("password_hash" in result.data));
  const before = (await request("/api/works", undefined, undefined, false))
    .data;
  const existing = before.works[0],
    id = crypto.randomUUID();
  const input = {
    id,
    title: "Local regression test",
    year: 2026,
    width: 12.5,
    height: 9.75,
    image_url: existing.image_url,
    thumbnail_url: existing.thumbnail_url,
    status: "draft",
  };
  result = await request("/api/portfolio", "POST", input);
  assert.equal(result.r.status, 201);
  assert.equal(result.data.width, 12.5);
  result = await request("/api/portfolio", "POST", input);
  assert.equal(result.data.id, id);
  const adminWorks = (await request("/api/portfolio")).data;
  assert.equal(adminWorks.filter((w) => w.id === id).length, 1);
  const record = adminWorks.find((w) => w.id === id);
  result = await request(`/api/portfolio/${id}`, "PATCH", {
    title: "Saved once",
    _expected_updated_at: record.updated_at,
  });
  assert.equal(result.r.status, 200);
  result = await request(`/api/portfolio/${id}`, "PATCH", {
    title: "Stale editor",
    _expected_updated_at: record.updated_at,
  });
  assert.equal(result.r.status, 409);
  assert.equal(
    (await request(`/api/portfolio/${id}`, "GET", undefined, false)).r.status,
    404,
  );
  const after = (await request("/api/works", undefined, undefined, false)).data;
  assert.equal(after.works.length, before.works.length);
  assert.ok(after.works.every((w) => !("tags" in w) && !("connections" in w)));
  const archive = (await request("/api/archive")).data;
  result = await request("/api/archive", "PUT", {
    action: "save",
    revision: archive.revision,
    layout: {
      ...archive.data.draft,
      ecosystem: [
        {
          id: "test-group",
          name: "PRIVATE LABEL NEVER PUBLIC",
          artworkIds: [existing.id],
        },
      ],
    },
  });
  assert.equal(result.r.status, 200);
  const stillPublic = (await request("/api/works", undefined, undefined, false))
    .data;
  assert.ok(
    !JSON.stringify(stillPublic).includes("PRIVATE LABEL NEVER PUBLIC"),
  );
  assert.equal(stillPublic.revision, before.revision);
  const savedArchive = (await request("/api/archive")).data;
  result = await request("/api/archive", "PUT", {
    action: "publish",
    revision: savedArchive.revision,
  });
  assert.equal(result.r.status, 200);
  const published = (await request("/api/works", undefined, undefined, false))
    .data;
  assert.notEqual(published.revision, before.revision);
  assert.ok(!JSON.stringify(published).includes("PRIVATE LABEL NEVER PUBLIC"));
  assert.equal(published.works.length, before.works.length);
  result = await request("/api/archive", "PUT", {
    action: "publish",
    revision: savedArchive.revision,
  });
  assert.equal(result.r.status, 409);
  const textDoc = (await request("/api/texts")).data;
  const text = {
    id: crypto.randomUUID(),
    category: "notes",
    date: "2026-10-16",
    ko: {
      title: "한국어 공개 글",
      published: true,
      blocks: [
        {
          id: crypto.randomUUID(),
          text: "본문 검사",
          align: "left",
          size: 16,
          color: "#1A1A1A",
          style: "paragraph",
        },
      ],
    },
    en: { title: "PRIVATE ENGLISH DRAFT", published: false, blocks: [] },
    updated_at: "",
  };
  result = await request("/api/texts", "PUT", { text });
  assert.equal(result.r.status, 400);
  result = await request("/api/texts", "PUT", {
    text,
    revision: textDoc.revision,
  });
  assert.equal(result.r.status, 200);
  result = await request("/api/texts?locale=en", "GET", undefined, false);
  assert.ok(!JSON.stringify(result.data).includes("PRIVATE ENGLISH DRAFT"));
  result = await request("/api/texts?locale=ko", "GET", undefined, false);
  assert.ok(result.data.some((t) => t.title === "한국어 공개 글"));
  result = await request("/api/auth", "DELETE");
  assert.equal(result.r.status, 200);
  console.log(
    "PASS: forged sessions, settings privacy, idempotent registration, decimal dimensions, stale saves, draft isolation, private labels, language-specific publishing, logout.",
  );
} finally {
  for (const [name, content] of originals) {
    if (content)
      await writeFile(`.archive-local/${name}.json`, content, { mode: 0o600 });
    else await rm(`.archive-local/${name}.json`, { force: true });
  }
}
