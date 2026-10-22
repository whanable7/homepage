"use client";
import Link from "next/link";
import { useLocale } from "@/i18n";
export default function PageError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const { locale } = useLocale();
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center">
      <p>
        {locale === "ko"
          ? "잠시 내용을 불러오지 못했습니다. 조금 뒤 다시 시도해 주세요."
          : "We couldn't load this page. Please try again shortly."}
      </p>
      <button
        type="button"
        className="border border-current px-5 py-2"
        onClick={reset}
      >
        {locale === "ko" ? "다시 불러오기" : "Try again"}
      </button>
      <Link href="/">{locale === "ko" ? "첫 화면으로" : "Home"}</Link>
    </main>
  );
}
