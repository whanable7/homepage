'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Artwork } from '@/types/artwork';
import { useLocale } from '@/i18n';
import { getLocalizedValue } from '@/lib/i18n-utils';
import { cloudinaryLoader } from '@/lib/cloudinary-loader';

interface SlideshowProps {
  artworks: Artwork[];
}

export default function Slideshow({ artworks }: SlideshowProps) {
  const { locale, t } = useLocale();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const autoPlayTimer = useRef<NodeJS.Timeout | null>(null);
  const resetTimer = useRef<NodeJS.Timeout | null>(null);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // 마우스 드래그 상태
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  // 특정 인덱스로 스크롤
  const scrollToIndex = useCallback((index: number, smooth = true) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const targetScroll = index * container.offsetWidth;
    container.scrollTo({
      left: targetScroll,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, []);

  const goToNext = useCallback(() => {
    if (artworks.length <= 1) return;
    setCurrentIndex(prev => {
      const nextIndex = (prev + 1) % artworks.length;
      // 비동기로 스크롤 (state 업데이트 후)
      setTimeout(() => scrollToIndex(nextIndex), 0);
      return nextIndex;
    });
  }, [artworks.length, scrollToIndex]);

  const goToPrev = useCallback(() => {
    if (artworks.length <= 1) return;
    setCurrentIndex(prev => {
      const prevIndex = (prev - 1 + artworks.length) % artworks.length;
      setTimeout(() => scrollToIndex(prevIndex), 0);
      return prevIndex;
    });
  }, [artworks.length, scrollToIndex]);

  // 자동 재생
  const startAutoPlay = useCallback(() => {
    if (artworks.length <= 1) return;
    if (autoPlayTimer.current) clearInterval(autoPlayTimer.current);
    autoPlayTimer.current = setInterval(goToNext, 5000);
  }, [artworks.length, goToNext]);

  const stopAutoPlay = useCallback(() => {
    if (autoPlayTimer.current) {
      clearInterval(autoPlayTimer.current);
      autoPlayTimer.current = null;
    }
  }, []);

  const resetAutoPlay = useCallback(() => {
    stopAutoPlay();
    // 기존 reset 타이머 취소
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
    }
    // 3초 후 다음 슬라이드로 이동 + 자동재생 재시작
    resetTimer.current = setTimeout(() => {
      goToNext();
      startAutoPlay();
    }, 3000);
  }, [stopAutoPlay, startAutoPlay, goToNext]);

  useEffect(() => {
    startAutoPlay();
    return () => {
      stopAutoPlay();
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }
    };
  }, [startAutoPlay, stopAutoPlay]);

  // 스크롤 이벤트 - 현재 인덱스 업데이트
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || isDragging.current) return;

    // 스크롤 끝 감지 (debounce)
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      const scrollPos = container.scrollLeft;
      const slideWidth = container.offsetWidth;
      const newIndex = Math.round(scrollPos / slideWidth);
      
      if (newIndex !== currentIndex && newIndex >= 0 && newIndex < artworks.length) {
        setCurrentIndex(newIndex);
      }
    }, 100);
  }, [currentIndex, artworks.length]);

  // 마우스 드래그 시작
  const handleMouseDown = (e: React.MouseEvent) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    isDragging.current = true;
    startX.current = e.pageX - container.offsetLeft;
    scrollLeft.current = container.scrollLeft;
    stopAutoPlay();
    
    container.style.cursor = 'grabbing';
    container.style.scrollSnapType = 'none'; // 드래그 중 스냅 비활성화
  };

  // 마우스 드래그 중
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    e.preventDefault();
    
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const x = e.pageX - container.offsetLeft;
    const walk = (x - startX.current) * 1.5; // 드래그 속도 배율
    container.scrollLeft = scrollLeft.current - walk;
  };

  // 마우스 드래그 종료
  const handleMouseUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    
    const container = scrollContainerRef.current;
    if (!container) return;
    
    container.style.cursor = 'grab';
    container.style.scrollSnapType = 'x mandatory'; // 스냅 다시 활성화
    
    // 가장 가까운 슬라이드로 스냅
    const scrollPos = container.scrollLeft;
    const slideWidth = container.offsetWidth;
    const newIndex = Math.round(scrollPos / slideWidth);
    
    if (newIndex >= 0 && newIndex < artworks.length) {
      setCurrentIndex(newIndex);
      scrollToIndex(newIndex);
    }
    
    resetAutoPlay();
  };

  const handleMouseLeave = () => {
    if (isDragging.current) {
      handleMouseUp();
    }
  };

  // 화살표 클릭
  const handleArrowClick = (direction: 'prev' | 'next') => {
    stopAutoPlay();
    if (direction === 'prev') goToPrev();
    else goToNext();
    resetAutoPlay();
  };

  // 도트 클릭
  const handleDotClick = (index: number) => {
    stopAutoPlay();
    setCurrentIndex(index);
    scrollToIndex(index);
    resetAutoPlay();
  };

  if (artworks.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center pt-16">
        <p className="text-[var(--text-secondary)] text-lg">No artworks to display</p>
      </div>
    );
  }

  const currentArtwork = artworks[currentIndex];
  const title = getLocalizedValue(locale, currentArtwork.title, currentArtwork.title_en);

  return (
    <div className="h-screen pt-16 flex flex-col">
      {/* 스크롤 컨테이너 */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 relative overflow-x-auto overflow-y-hidden select-none"
        style={{ 
          scrollbarWidth: 'none', 
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          scrollSnapType: 'x mandatory',
          cursor: 'grab',
        }}
        onScroll={handleScroll}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* 모든 슬라이드 */}
        <div className="flex h-full">
          {artworks.map((artwork, index) => (
            <div 
              key={artwork.id}
              className="flex-shrink-0 w-full h-full snap-center flex items-center justify-center p-8"
            >
              <div className="relative w-full h-full max-w-5xl mx-auto">
                <Image
                  src={artwork.image_url}
                  alt={artwork.title}
                  fill
                  className="object-contain pointer-events-none"
                  sizes="(max-width: 768px) 100vw, 80vw"
                  draggable={false}
                  priority={index <= 2}
                  {...(artwork.image_url?.includes('res.cloudinary.com') ? { loader: cloudinaryLoader } : {})}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Arrows */}
      {artworks.length > 1 && (
        <>
          <button
            onClick={() => handleArrowClick('prev')}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors z-10"
            aria-label={t.aria.prevArtwork}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1}
              stroke="currentColor"
              className="w-8 h-8"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button
            onClick={() => handleArrowClick('next')}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors z-10"
            aria-label={t.aria.nextArtwork}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1}
              stroke="currentColor"
              className="w-8 h-8"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </>
      )}

      {/* Artwork Info */}
      <div className="py-6 px-8 text-center">
        <h2 className="text-lg font-light tracking-wide text-[var(--foreground)]">
          {title}
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {currentArtwork.year}
        </p>
      </div>

      {/* Dots Indicator */}
      {artworks.length > 1 && (
        <div className="pb-8 flex justify-center gap-2">
          {artworks.map((_, index) => (
            <button
              key={index}
              onClick={() => handleDotClick(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex ? 'bg-white' : 'bg-gray-600'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* 스크롤바 숨기기 */}
      <style jsx>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
