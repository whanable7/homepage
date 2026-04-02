'use client';

import { useState } from 'react';
import { Artwork } from '@/types/artwork';
import ArtworkGrid from '@/components/artwork/ArtworkGrid';
import ArtworkModal from '@/components/artwork/ArtworkModal';
import { useLocale } from '@/i18n';

interface YearViewProps {
  artworksByYear: Record<number, Artwork[]>;
  years: number[];
}

export default function YearView({ artworksByYear, years }: YearViewProps) {
  const { t } = useLocale();
  const [selectedYear, setSelectedYear] = useState<number>(years[0] || new Date().getFullYear());
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const artworks = artworksByYear[selectedYear] || [];

  const handleArtworkClick = (artwork: Artwork, _index: number) => {
    setSelectedArtwork(artwork);
    setModalOpen(true);
  };

  const handlePrevious = () => {
    if (!selectedArtwork) return;
    const currentIndex = artworks.findIndex((a) => a.id === selectedArtwork.id);
    if (currentIndex > 0) {
      setSelectedArtwork(artworks[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (!selectedArtwork) return;
    const currentIndex = artworks.findIndex((a) => a.id === selectedArtwork.id);
    if (currentIndex < artworks.length - 1) {
      setSelectedArtwork(artworks[currentIndex + 1]);
    }
  };

  return (
    <div>
      {/* 연도 선택 탭 */}
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {years.map((year) => (
          <button
            key={year}
            onClick={() => setSelectedYear(year)}
            className={`px-4 py-2 text-sm font-medium transition-colors rounded ${
              selectedYear === year
                ? 'bg-[var(--foreground)] text-[var(--background)]'
                : 'text-[var(--foreground)] border border-[var(--foreground)]/20 hover:border-[var(--foreground)]/50'
            }`}
          >
            {year}
          </button>
        ))}
      </div>

      {/* 작품 수 표시 */}
      <p className="text-center text-sm text-[var(--foreground)]/60 mb-6">
        {t.years.artworkCount.replace('{count}', String(artworks.length))}
      </p>

      {/* 작품 그리드 */}
      {artworks.length > 0 ? (
        <ArtworkGrid artworks={artworks} onSelect={handleArtworkClick} />
      ) : (
        <p className="text-center text-[var(--foreground)]/50 py-12">
          이 연도에 등록된 작품이 없습니다.
        </p>
      )}

      {/* 모달 */}
      {modalOpen && selectedArtwork && (() => {
        const currentIndex = artworks.findIndex((a) => a.id === selectedArtwork.id);
        return (
          <ArtworkModal
            artwork={selectedArtwork}
            onClose={() => setModalOpen(false)}
            onPrev={handlePrevious}
            onNext={handleNext}
            hasPrev={currentIndex > 0}
            hasNext={currentIndex < artworks.length - 1}
            groupLabel={`__YEAR_BLOCK__${selectedYear}__${currentIndex + 1}/${artworks.length}`}
            onTagClick={() => {
              setModalOpen(false);
            }}
            preloadImages={[
              currentIndex > 0 ? artworks[currentIndex - 1]?.image_url || '' : '',
              currentIndex < artworks.length - 1 ? artworks[currentIndex + 1]?.image_url || '' : '',
            ].filter(u => u !== '')}
          />
        );
      })()}
    </div>
  );
}
