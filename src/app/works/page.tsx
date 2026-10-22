import { Suspense } from "react";
import Header from "@/components/common/Header";
import WorksBrowser from "@/components/portfolio/WorksBrowser";
import { publicLayout } from "@/lib/archive";
import { getPublicArchive } from "@/lib/public-content";
export const dynamic = "force-dynamic";
export const metadata = { title: "Works | Jungwhan Park" };
export default async function WorksPage() {
  const data = { published: await getPublicArchive() };
  return (
    <main className="works-page">
      <Header />
      {process.env.VERCEL_ENV === "preview" &&
        !process.env.ARCHIVE_BLOB_READ_WRITE_TOKEN && (
          <p className="preview-notice">검토 화면 · 저장 기능 연결 전</p>
        )}
      <Suspense>
        <WorksBrowser
          initial={{
            ...data.published,
            layout: publicLayout(data.published.layout),
          }}
        />
      </Suspense>
    </main>
  );
}
