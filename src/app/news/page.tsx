import type { News } from "@/types/artwork";
import Header from "@/components/common/Header";
import NewsContent from "@/components/news/NewsContent";
import { readPublicContent } from "@/lib/public-content";

export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const news = await readPublicContent<News[]>("news");

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <Header />
      <div className="max-w-4xl mx-auto px-6 pt-24 pb-16">
        <NewsContent news={news} />
      </div>
    </main>
  );
}
