// This flag is unrelated to authentication and survives administrator logout.
export const ANALYTICS_EXCLUSION_COOKIE = "jp_analytics_excluded";
export const ANALYTICS_EXCLUSION_KEY = "jp:analytics-excluded";
export const ANALYTICS_EXCLUSION_EVENT = "jp:analytics-exclusion";
export function isAnalyticsPublicPath(path: string) {
  return (
    path === "/" || /^\/(works|texts|cv|contact|news)(\/[^?#]*)?\/?$/.test(path)
  );
}
export function shouldTrack({
  production,
  hostname,
  pathname,
  excluded,
}: {
  production: boolean;
  hostname: string;
  pathname: string;
  excluded: boolean;
}) {
  return (
    production &&
    hostname === "jungwhanpark.com" &&
    isAnalyticsPublicPath(pathname) &&
    !excluded
  );
}
export function sanitizedReferrer(value: string) {
  try {
    const u = new URL(value);
    return /^https?:$/.test(u.protocol) ? u.origin + u.pathname : "";
  } catch {
    return "";
  }
}
