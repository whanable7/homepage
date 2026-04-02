'use client';

import { useEffect, useState } from 'react';
import { Artwork } from '@/types/artwork';
import YearView from '@/components/portfolio/YearView';
import { cachedFetch } from '@/lib/client-cache';

export default function YearViewWrapper() {
  const [artworksByYear, setArtworksByYear] = useState<Record<number, Artwork[]>>({});
  const [years, setYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await cachedFetch<Artwork[]>('/api/portfolio');
        const grouped: Record<number, Artwork[]> = {};
        data.forEach((artwork) => {
          if (!grouped[artwork.year]) grouped[artwork.year] = [];
          grouped[artwork.year].push(artwork);
        });
        const sortedYears = Object.keys(grouped).map(Number).sort((a, b) => b - a);
        setArtworksByYear(grouped);
        setYears(sortedYears);
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--foreground)] mx-auto mb-4" />
          <p className="text-[var(--foreground)]/60">Loading...</p>
        </div>
      </div>
    );
  }

  return <YearView artworksByYear={artworksByYear} years={years} />;
}
