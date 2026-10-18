"use client";

import Link from "next/link";
import { Category, Artwork } from "@/types/artwork";
import ArtworkList from "./ArtworkList";
import { useLocale } from "@/i18n";
import { getLocalizedValue } from "@/lib/i18n-utils";

interface CategoryContentProps {
  category: Category;
  artworks: Artwork[];
}

export default function CategoryContent({
  category,
  artworks,
}: CategoryContentProps) {
  const { locale, t } = useLocale();

  const categoryName = getLocalizedValue(
    locale,
    category.name,
    category.name_en,
  );
  const categoryDescription = getLocalizedValue(
    locale,
    category.description,
    category.description_en,
  );

  return (
    <div className="max-w-6xl mx-auto">
      <Link
        href="/works"
        className="inline-flex items-center text-sm text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors mb-8"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-4 h-4 mr-1"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 19.5L8.25 12l7.5-7.5"
          />
        </svg>
        {t.portfolio.backToPortfolio}
      </Link>

      <h1 className="text-3xl font-light tracking-wide mb-2 text-[var(--foreground)]">
        {categoryName}
      </h1>
      {categoryDescription && (
        <p className="text-[var(--text-secondary)] mb-12">
          {categoryDescription}
        </p>
      )}

      <ArtworkList artworks={artworks} />
    </div>
  );
}
