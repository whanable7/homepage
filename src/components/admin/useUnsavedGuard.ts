"use client";
import { useEffect } from "react";
export function confirmAdminNavigation() {
  return window.dispatchEvent(
    new Event("archive:navigate", { cancelable: true }),
  );
}
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const leave = (event: BeforeUnloadEvent) => event.preventDefault();
    const navigate = (event: Event) => {
      event.preventDefault();
      window.dispatchEvent(new Event("archive:unsaved"));
    };
    window.addEventListener("beforeunload", leave);
    window.addEventListener("archive:navigate", navigate);
    return () => {
      window.removeEventListener("beforeunload", leave);
      window.removeEventListener("archive:navigate", navigate);
    };
  }, [dirty]);
}
