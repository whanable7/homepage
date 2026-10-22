import { Suspense } from "react";
import Header from "@/components/common/Header";
import WorksBrowser from "@/components/portfolio/WorksBrowser";
import { getArchive, publicLayout, publicWork } from "@/lib/archive";
import { getPortfolio } from "@/lib/data";
import { strataLayout } from "@/lib/layouts";
import type { ArchiveWork } from "@/types/archive";
import Slideshow from "@/components/landing/Slideshow";
import Link from "next/link";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "관리자 미리보기 | Jungwhan Park",
  robots: { index: false, follow: false },
};
export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const [{ data, revision }, portfolio, params] = await Promise.all([
    getArchive(),
    getPortfolio(),
    searchParams,
  ]);
  const works = (portfolio as ArchiveWork[])
      .filter((w) => !w.deleted_at && w.status !== "draft")
      .map(publicWork),
    included = works.filter((w) => !data.draft.excluded.strata?.includes(w.id));
  const sequenceCount = data.draft.sequences.reduce(
    (n, s) =>
      n +
      s.steps.reduce(
        (total, step) =>
          total +
          step.artworkIds.filter((id) => works.some((w) => w.id === id)).length,
        0,
      ),
    0,
  );
  if (params.view === "slideshow") {
    const featured = works
      .filter((w) => w.is_featured)
      .sort(
        (a, b) => (a.featured_order ?? a.order) - (b.featured_order ?? b.order),
      );
    return (
      <main className="min-h-screen bg-[var(--background)]">
        <Header />
        <p className="preview-notice">
          대표 이미지 미리보기 · 저장한 선택과 순서입니다. 공개 상태는 바뀌지
          않습니다. <Link href="/admin">관리자로 돌아가기</Link>
        </p>
        <Slideshow artworks={featured} />
      </main>
    );
  }
  return (
    <main className="works-page">
      <Header />
      <p className="preview-notice">
        임시저장 배치 미리보기 · 흐름 {data.draft.sequences.length}개 / 작품
        배치 {sequenceCount}개 · 공식 공개 상태는 바뀌지 않습니다.{" "}
        <Link href="/admin">관리자로 돌아가기</Link>
      </p>
      <Suspense>
        <WorksBrowser
          initial={{
            works,
            layout: publicLayout(data.draft),
            strata: {
              phone: strataLayout(included, 360, data.draft.seed),
              desktop: strataLayout(included, 1440, data.draft.seed),
            },
            revision,
            publishedAt: "",
          }}
          preview
        />
      </Suspense>
    </main>
  );
}
