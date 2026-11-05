"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  ANALYTICS_EXCLUSION_COOKIE,
  ANALYTICS_EXCLUSION_EVENT,
  ANALYTICS_EXCLUSION_KEY,
  sanitizedReferrer,
  shouldTrack,
} from "@/lib/analytics-policy";

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  jpTracker?: { id: string; path: string; previous: string; ready: boolean };
  [key: `ga-disable-${string}`]: boolean;
};
export default function VisitorTracker({
  measurementId,
  production,
  initialExcluded,
}: {
  measurementId: string;
  production: boolean;
  initialExcluded: boolean;
}) {
  const pathname = usePathname();
  useEffect(() => {
    if (!/^G-[A-Z0-9]+$/.test(measurementId)) return;
    const w = window as unknown as AnalyticsWindow;
    const excluded = () => {
      try {
        return (
          initialExcluded ||
          localStorage.getItem(ANALYTICS_EXCLUSION_KEY) === "1" ||
          document.cookie
            .split("; ")
            .includes(`${ANALYTICS_EXCLUSION_COOKIE}=1`)
        );
      } catch {
        return true;
      } // If exclusion state cannot be read, collect nothing.
    };
    const sync = () => {
      const disabled = !shouldTrack({
        production,
        hostname: location.hostname,
        pathname: location.pathname,
        excluded: excluded(),
      });
      w[`ga-disable-${measurementId}`] = disabled;
      if (disabled) {
        if (w.jpTracker) w.jpTracker.path = "";
        return;
      }
      if (!w.jpTracker) {
        w.dataLayer = w.dataLayer || [];
        // gtag expects an Arguments object, not an array.
        // eslint-disable-next-line prefer-rest-params -- Google tag's command queue consumes Arguments objects.
        w.gtag = function () {
          w.dataLayer!.push(arguments);
        };
        w.jpTracker = {
          id: measurementId,
          path: "",
          previous: sanitizedReferrer(document.referrer),
          ready: false,
        };
        w.gtag("js", new Date());
        w.gtag("config", measurementId, {
          send_page_view: false,
          page_location: location.origin + location.pathname,
          page_referrer: sanitizedReferrer(document.referrer),
          allow_google_signals: false,
          allow_ad_personalization_signals: false,
        });
        const script = document.createElement("script");
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
        script.onload = () => {
          if (w.jpTracker) w.jpTracker.ready = true;
          sync(); // Recheck exclusion after loading; do not queue a page view beforehand.
        };
        document.head.appendChild(script);
      }
      const tracker = w.jpTracker;
      if (!tracker.ready || tracker.path === location.pathname) return;
      const page = location.origin + location.pathname;
      w.gtag?.("set", { page_location: page, page_referrer: tracker.previous });
      w.gtag?.("event", "page_view", {
        send_to: measurementId,
        page_location: page,
        page_referrer: tracker.previous,
        page_title:
          location.pathname === "/" ? "home" : location.pathname.split("/")[1],
      });
      tracker.previous = page;
      tracker.path = location.pathname;
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(ANALYTICS_EXCLUSION_EVENT, sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(ANALYTICS_EXCLUSION_EVENT, sync);
      window.removeEventListener("focus", sync);
    };
  }, [pathname, measurementId, production, initialExcluded]);
  return null;
}
