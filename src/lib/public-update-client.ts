"use client";
export const UPDATE_INTERVAL = 5 * 60 * 1000;
export type PublicVersion = { version: string; revision: string };
type StoredVersion = PublicVersion & { at: number };
const listeners = new Set<(value: PublicVersion) => void>();
const storageKey = "public-update-v1";
let timer: ReturnType<typeof setTimeout> | undefined;
let inFlight: Promise<void> | undefined;
let latest: StoredVersion | undefined;
let failures = 0;
let nextAttemptAt = 0;

function remembered() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (
      value &&
      typeof value.at === "number" &&
      typeof value.version === "string" &&
      typeof value.revision === "string"
    )
      return value as StoredVersion;
  } catch {}
}
function deliver(value: StoredVersion) {
  latest = value;
  listeners.forEach((listener) => listener(value));
}
async function check(force = false) {
  if (document.hidden || !navigator.onLine) return;
  const stored = remembered();
  if (!force && stored && Date.now() - stored.at < UPDATE_INTERVAL) {
    deliver(stored);
    nextAttemptAt = stored.at + UPDATE_INTERVAL;
    return;
  }
  if (!force && Date.now() < nextAttemptAt) return;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const response = await fetch("/api/updates", {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error("Update check failed");
      const value = await response.json();
      if (
        typeof value.version !== "string" ||
        typeof value.revision !== "string"
      )
        throw new Error("Invalid version");
      const stored: StoredVersion = {
        version: value.version,
        revision: value.revision,
        at: Date.now(),
      };
      failures = 0;
      nextAttemptAt = stored.at + UPDATE_INTERVAL;
      try {
        localStorage.setItem(storageKey, JSON.stringify(stored));
      } catch {}
      deliver(stored);
    } catch {
      failures++;
      nextAttemptAt =
        Date.now() + Math.min(30 * 60 * 1000, UPDATE_INTERVAL * 2 ** failures);
    } finally {
      inFlight = undefined;
    }
  })();
  return inFlight;
}
function schedule() {
  clearTimeout(timer);
  if (!listeners.size) return;
  const delay =
    document.hidden || !navigator.onLine
      ? UPDATE_INTERVAL
      : Math.max(1000, nextAttemptAt - Date.now());
  timer = setTimeout(async () => {
    await check();
    schedule();
  }, delay);
}
function resume() {
  void check().then(schedule);
}
export async function refreshPublicUpdates() {
  if (inFlight) await inFlight;
  await check(true);
  schedule();
}
function storage(event: StorageEvent) {
  if (event.key === storageKey) {
    const value = remembered();
    if (value) deliver(value);
    schedule();
  }
}
export function subscribePublicUpdates(
  listener: (value: PublicVersion) => void,
) {
  listeners.add(listener);
  if (latest) listener(latest);
  if (listeners.size === 1) {
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    window.addEventListener("storage", storage);
    resume();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("storage", storage);
    }
  };
}
