'use client';

import Link from 'next/link';
import Image from 'next/image';
import { cloudinaryLoader } from '@/lib/cloudinary-loader';
import { Category } from '@/types/artwork';
import { useState, useEffect } from 'react';
import { useLocale } from '@/i18n';
import { getLocalizedValue } from '@/lib/i18n-utils';

interface CategoryGridProps {
  categories: Category[];
}

// 원형 도형의 위치와 크기를 생성하는 함수
function generateCircleStyles(index: number, total: number) {
  // 각 원의 고유한 특성
  const sizes = [180, 160, 200, 140, 170, 190, 150, 210, 165, 185];
  const colors = [
    'rgba(139, 92, 246, 0.15)', // purple
    'rgba(59, 130, 246, 0.15)', // blue
    'rgba(236, 72, 153, 0.15)', // pink
    'rgba(34, 197, 94, 0.15)',  // green
    'rgba(249, 115, 22, 0.15)', // orange
    'rgba(234, 179, 8, 0.15)',  // yellow
    'rgba(99, 102, 241, 0.15)', // indigo
    'rgba(168, 85, 247, 0.15)', // violet
    'rgba(14, 165, 233, 0.15)', // sky
    'rgba(244, 63, 94, 0.15)',  // rose
  ];

  const size = sizes[index % sizes.length];
  const color = colors[index % colors.length];

  // 위치 계산 (중앙에 가깝게 분산)
  const cols = Math.ceil(Math.sqrt(total));
  const row = Math.floor(index / cols);
  const col = index % cols;

  // 기본 위치를 중앙에 가깝게 조정 (30~70% 범위)
  const baseX = (col / Math.max(cols - 1, 1)) * 40 + 30;
  const baseY = (row / Math.max(Math.ceil(total / cols) - 1, 1)) * 40 + 30;
  const offsetX = (Math.sin(index * 2.5) * 8);
  const offsetY = (Math.cos(index * 3) * 6);

  return {
    size,
    color,
    left: `${Math.min(Math.max(baseX + offsetX, 25), 75)}%`,
    top: `${Math.min(Math.max(baseY + offsetY, 25), 70)}%`,
    animationDelay: `${index * 0.1}s`,
  };
}

export default function CategoryGrid({ categories }: CategoryGridProps) {
  const [mounted, setMounted] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { locale } = useLocale();

  useEffect(() => {
    // 탭 전환 시 애니메이션 트리거
    setMounted(false);
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  if (categories.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--text-secondary)]">No categories yet</p>
      </div>
    );
  }

  return (
    <div className="relative w-full min-h-[70vh] overflow-hidden">
      {/* 배경 그라데이션 */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#111] to-[#0a0a0a]" />

      {/* 원형 카테고리들 */}
      {categories.map((category, index) => {
        const styles = generateCircleStyles(index, categories.length);
        const isHovered = hoveredId === category.id;

        return (
          <Link
            key={category.id}
            href={`/portfolio/${category.slug}`}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-out
              ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}
            `}
            style={{
              left: styles.left,
              top: styles.top,
              transitionDelay: styles.animationDelay,
              zIndex: isHovered ? 50 : 10,
            }}
            onMouseEnter={() => setHoveredId(category.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div
              className={`relative rounded-full overflow-hidden cursor-pointer
                transition-all duration-500 ease-out
                ${isHovered ? 'scale-125 shadow-2xl' : 'scale-100'}
                ${mounted ? 'animate-float' : ''}
              `}
              style={{
                width: styles.size,
                height: styles.size,
                backgroundColor: styles.color,
                animationDelay: styles.animationDelay,
                boxShadow: isHovered
                  ? `0 0 60px ${styles.color.replace('0.15', '0.5')}`
                  : `0 0 30px ${styles.color.replace('0.15', '0.3')}`,
              }}
            >
              {/* 이미지 */}
              {category.cover_image_url && (
                <Image
                  src={category.cover_image_url}
                  alt={getLocalizedValue(locale, category.name, category.name_en)}
                  fill
                  loading="lazy"
                  className={`object-cover transition-all duration-500
                    ${isHovered ? 'scale-110 brightness-75' : 'scale-100 brightness-50'}
                  `}
                  sizes="250px"
                  {...(category.cover_image_url?.includes('res.cloudinary.com') ? { loader: cloudinaryLoader } : {})}
                />
              )}


              {/* 호버 시 테두리 효과 */}
              <div className={`absolute inset-0 rounded-full border-2 transition-all duration-300
                ${isHovered ? 'border-white/40 scale-105' : 'border-transparent'}
              `} />
            </div>
          </Link>
        );
      })}

    </div>
  );
}
