import { Artwork } from "@/types/artwork";
import Slideshow from "@/components/landing/Slideshow";
import Header from "@/components/common/Header";
import { getPublicArchive } from "@/lib/public-content";

export const dynamic = "force-dynamic";

export default async function Home() {
  const featuredArtworks = (await getPublicArchive()).works
    .filter((w) => w.is_featured)
    .sort(
      (a, b) => (a.featured_order ?? a.order) - (b.featured_order ?? b.order),
    ) as Artwork[];

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <Header />
      <Slideshow artworks={featuredArtworks} />
    </main>
  );
}
