import Header from '@/components/common/Header';
import NewsDetail from '@/components/news/NewsDetail';
import { getNewsById } from '@/lib/data';
import { News } from '@/types/artwork';
import { notFound } from 'next/navigation';

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function NewsDetailPage({ params }: PageProps) {
  const { id } = await params;
  const news = await getNewsById(id) as News | null;

  if (!news) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <Header />
      <div className="max-w-4xl mx-auto px-6 pt-24 pb-16">
        <NewsDetail news={news} />
      </div>
    </main>
  );
}
