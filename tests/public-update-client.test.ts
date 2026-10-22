import { test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { subscribePublicUpdates, UPDATE_INTERVAL } from "../src/lib/public-update-client";

test("one update request serves multiple subscribers, waits five minutes, pauses while hidden/offline and backs off failures", async (t) => {
  const saved = Object.fromEntries(["document", "window", "navigator", "localStorage", "fetch"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const doc = Object.assign(new EventTarget(), { hidden: false });
  const win = new EventTarget();
  const navigator = { onLine: true };
  const memory = new Map<string, string>();
  let reads = 0, failing = false;
  const received: string[] = [];
  Object.defineProperties(globalThis, {
    document: { configurable: true, value: doc },
    window: { configurable: true, value: win },
    navigator: { configurable: true, value: navigator },
    localStorage: { configurable: true, value: { getItem: (k: string) => memory.get(k), setItem: (k: string, v: string) => memory.set(k, v) } },
    fetch: { configurable: true, value: async () => { reads++; return new Response(JSON.stringify({ version: `v${reads}`, revision: `r${reads}` }), { status: failing ? 503 : 200 }); } },
  });
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1000000 });
  let a = () => {}, b = () => {};
  try {
    a = subscribePublicUpdates((v) => received.push(v.version));
    b = subscribePublicUpdates((v) => received.push(v.version));
    await setImmediate();
    assert.equal(reads, 1);
    assert.deepEqual(received, ["v1", "v1"]);
    t.mock.timers.tick(UPDATE_INTERVAL - 1); await setImmediate(); assert.equal(reads, 1);
    t.mock.timers.tick(1); await setImmediate(); assert.equal(reads, 2);
    doc.hidden = true; t.mock.timers.tick(UPDATE_INTERVAL); await setImmediate(); assert.equal(reads, 2);
    doc.hidden = false; doc.dispatchEvent(new Event("visibilitychange")); await setImmediate(); assert.equal(reads, 3);
    navigator.onLine = false; t.mock.timers.tick(UPDATE_INTERVAL); await setImmediate(); assert.equal(reads, 3);
    navigator.onLine = true; win.dispatchEvent(new Event("online")); await setImmediate(); assert.equal(reads, 4);
    failing = true; t.mock.timers.tick(UPDATE_INTERVAL); await setImmediate(); assert.equal(reads, 5);
    for (let i = 0; i < 10; i++) doc.dispatchEvent(new Event("visibilitychange"));
    await setImmediate(); assert.equal(reads, 5, "refocusing cannot bypass failure cooldown");
    t.mock.timers.tick(UPDATE_INTERVAL); await setImmediate(); assert.equal(reads, 5);
    t.mock.timers.tick(UPDATE_INTERVAL); await setImmediate(); assert.equal(reads, 6);
    a(); b(); t.mock.timers.tick(60 * 60 * 1000); await setImmediate(); assert.equal(reads, 6);
  } finally {
    a(); b(); t.mock.timers.reset();
    for (const [key, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
