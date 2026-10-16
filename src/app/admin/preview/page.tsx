import { Suspense } from "react";
import Header from "@/components/common/Header";
import WorksBrowser from "@/components/portfolio/WorksBrowser";
import { getArchive, publicLayout, publicWork } from "@/lib/archive";
import { getPortfolio } from "@/lib/data";
import { strataLayout } from "@/lib/layouts";
import type { ArchiveWork } from "@/types/archive";
export const dynamic = "force-dynamic";
export default async function PreviewPage() {
  const { data } = await getArchive(),
    works = ((await getPortfolio()) as ArchiveWork[])
      .filter((w) => !w.deleted_at && w.status !== "draft")
      .map(publicWork),
    included = works.filter((w) => !data.draft.excluded.strata?.includes(w.id));
  return (
    <main className="works-page">
      <Header />
      <p className="preview-notice">공개 전 미리보기</p>
      <Suspense>
        <WorksBrowser
          initial={{
            works,
            layout: publicLayout(data.draft),
            strata: {
              phone: strataLayout(included, 360, data.draft.seed),
              desktop: strataLayout(included, 1440, data.draft.seed),
            },
            revision: "preview",
            publishedAt: "",
          }}
          preview
        />
      </Suspense>
    </main>
  );
}
