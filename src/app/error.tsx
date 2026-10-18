"use client";

import Header from "@/components/common/Header";
import { useLocale } from "@/i18n";

export default function ArchiveError({ reset }: { reset: () => void }) {
  const { locale } = useLocale();
  return (
    <main className="works-page">
      <Header />
      <section className="px-6 pt-[28vh] pb-24 text-center" role="alert">
        <h1 className="text-base font-normal">
          {locale === "ko"
            ? "자료를 잠시 불러오지 못했습니다."
            : "We could not load this page."}
        </h1>
        <button
          type="button"
          onClick={reset}
          className="mt-8 min-h-11 border-b border-[var(--text-secondary)] px-2 text-sm"
        >
          {locale === "ko" ? "다시 불러오기" : "Try again"}
        </button>
      </section>
    </main>
  );
}
