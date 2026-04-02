import Header from '@/components/common/Header';
import NewsContent from '@/components/news/NewsContent';
import { getNews } from '@/lib/data';

export const revalidate = 3600;

export default async function NewsPage() {
  const news = await getNews();

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <Header />
      <div className="max-w-4xl mx-auto px-6 pt-24 pb-16">
        <NewsContent news={news} />
      </div>
    </main>
  );
}
