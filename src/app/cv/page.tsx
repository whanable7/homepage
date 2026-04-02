import Header from '@/components/common/Header';
import AboutContent from '@/components/about/AboutContent';
import { getAbout, getExhibitions } from '@/lib/data';
import { AboutInfo, Exhibition } from '@/types/artwork';

export const revalidate = 3600;

export default async function AboutPage() {
  const aboutInfo = await getAbout() as AboutInfo | null;
  const exhibitions = ((await getExhibitions()) as Exhibition[]).sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    return (a.display_order ?? 0) - (b.display_order ?? 0);
  });

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <Header />
      <div className="max-w-4xl mx-auto px-6 pt-24 pb-16">
        <AboutContent aboutInfo={aboutInfo} exhibitions={exhibitions} />
      </div>
    </main>
  );
}
