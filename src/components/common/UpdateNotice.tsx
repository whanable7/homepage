"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/i18n";
export default function UpdateNotice() {
  const path = usePathname(),
    { locale } = useLocale(),
    [changed, setChanged] = useState(false);
  useEffect(() => {
    if (path.startsWith("/admin") || path.startsWith("/works")) return;
    let initial = "",
      cancelled = false;
    const check = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch("/api/updates", { cache: "no-store" });
        if (!r.ok) return;
        const { version } = await r.json();
        if (cancelled) return;
        if (!initial) initial = version;
        else if (version !== initial) setChanged(true);
      } catch {}
    };
    void check();
    const timer = setInterval(check, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [path]);
  if (!changed) return null;
  return (
    <button className="works-update" onClick={() => location.reload()}>
      {locale === "ko"
        ? "업데이트된 내용이 있습니다 · 불러오기"
        : "Updated content available · Load"}
    </button>
  );
}
