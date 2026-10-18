"use client";
import { useState } from "react";
import Link from "next/link";
import { useLocale } from "@/i18n";
import type { ArchiveText } from "@/types/archive";
export default function TextIndex({ texts }: { texts: ArchiveText[] }) {
  const { locale } = useLocale(),
    [category, setCategory] = useState<"notes" | "studies">("notes"),
    items = texts.filter((t) => t.category === category && t[locale].published);
  return (
    <div className="texts-index">
      <nav aria-label="Text categories">
        <button
          onClick={() => setCategory("notes")}
          aria-current={category === "notes" ? "page" : undefined}
        >
          Artist’s Notes
        </button>
        <button
          onClick={() => setCategory("studies")}
          aria-current={category === "studies" ? "page" : undefined}
        >
          Studies
        </button>
      </nav>
      {items.map((t) => (
        <Link key={t.id} className="text-index-row" href={`/texts/${t.id}`}>
          <span>{t[locale].title}</span>
          <time>{t.date}</time>
        </Link>
      ))}
      {!items.length && (
        <p className="works-empty">
          {locale === "ko" ? "글을 준비 중입니다." : "Texts coming soon."}
        </p>
      )}
    </div>
  );
}
