import type { Exhibition } from "@/types/artwork";
import { readPublicContent } from "@/lib/public-content";
import Header from "@/components/common/Header";
import AboutContent from "@/components/about/AboutContent";
import { getPublicAbout as getAbout } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const [aboutInfo, exhibitions] = await Promise.all([
    getAbout().catch(() => null),
    readPublicContent<Exhibition[]>("exhibitions").catch(() => []),
  ]);

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <Header />

      <div className="max-w-4xl mx-auto px-6 pt-24 pb-16">
        <AboutContent aboutInfo={aboutInfo} exhibitions={exhibitions} />
      </div>
    </main>
  );
}
