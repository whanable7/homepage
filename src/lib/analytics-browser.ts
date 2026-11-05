"use client";
import {
  ANALYTICS_EXCLUSION_COOKIE,
  ANALYTICS_EXCLUSION_KEY,
  ANALYTICS_EXCLUSION_EVENT,
} from "./analytics-policy";
export function browserAnalyticsExcluded() {
  try {
    return (
      localStorage.getItem(ANALYTICS_EXCLUSION_KEY) === "1" ||
      document.cookie.split("; ").includes(`${ANALYTICS_EXCLUSION_COOKIE}=1`)
    );
  } catch {
    return true;
  }
}
export function setBrowserAnalyticsExcluded(excluded: boolean) {
  const value = excluded ? "1" : "0";
  // Set cookie first; even browsers restricting local storage retain exclusion on reload.
  document.cookie = `${ANALYTICS_EXCLUSION_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  try {
    localStorage.setItem(ANALYTICS_EXCLUSION_KEY, value);
  } catch {
    /* Cookie remains authoritative. */
  }
  window.dispatchEvent(new Event(ANALYTICS_EXCLUSION_EVENT));
}
