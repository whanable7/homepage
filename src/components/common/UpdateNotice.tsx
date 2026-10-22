"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/i18n";
import { subscribePublicUpdates } from "@/lib/public-update-client";
export default function UpdateNotice() {
  const path = usePathname(),
    { locale } = useLocale(),
    [changed, setChanged] = useState(false);
  useEffect(() => {
    if (path.startsWith("/admin") || path.startsWith("/works")) return;
    let initial = "";
    return subscribePublicUpdates(({ version }) => {
      if (!initial) initial = version;
      else if (version !== initial) setChanged(true);
    });
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
