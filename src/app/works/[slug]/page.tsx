import { notFound } from "next/navigation";
import { Category, Artwork } from "@/types/artwork";
import Header from "@/components/common/Header";
import CategoryContent from "@/components/portfolio/CategoryContent";
import { getCategories } from "@/lib/data";
import { getPublicArchive } from "@/lib/public-content";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);

  const categories = (await getCategories()) as Category[];
  const category = categories.find((c) => c.slug === decodedSlug) || null;

  if (!category) {
    notFound();
  }

  const artworks = ((await getPublicArchive()).works as Artwork[])
    .filter((a) => a.category_id === category.id)
    .sort((a, b) => b.year - a.year);

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <Header />
      <div className="pt-24 pb-16 px-6">
        <CategoryContent category={category} artworks={artworks} />
      </div>
    </main>
  );
}
