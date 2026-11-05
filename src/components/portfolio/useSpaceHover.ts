"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ArchiveWork } from "@/types/archive";

// Keep the preview and its group emphasis on the same work during the grace period.
export function useSpaceHover() {
  const [hover, setHover] = useState<ArchiveWork | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const show = useCallback(
    (work: ArchiveWork | null) => {
      cancel();
      setHover(work);
    },
    [cancel],
  );
  const leave = useCallback(() => {
    cancel();
    timer.current = setTimeout(() => {
      setHover(null);
      timer.current = null;
    }, 1000);
  }, [cancel]);
  useEffect(() => cancel, [cancel]);
  return { hover, show, leave };
}
