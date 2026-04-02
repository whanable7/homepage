'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import ArtworkModal from '@/components/artwork/ArtworkModal';
import { Artwork } from '@/types/artwork';
import { cachedFetch, getCached } from '@/lib/client-cache';

interface DominantColor {
  h: number;
  s: number;
  l: number;
  isAchromatic: boolean;
}

interface ColorArtwork {
  id: string;
  title: string;
  title_en: string | null;
  year: number;
  image_url: string;
  thumbnail_url: string;
  width: number | null;
  height: number | null;
  dominant_color: DominantColor | null;
}

// 6그룹: 빨(0) 주(1) 노(2) 청록(3: 초+파) 보라(4: 남+보) 흑백(5)
function getColorGroup(dc: DominantColor): number {
  if (dc.isAchromatic) return 5;
  const h = dc.h;
  if (h >= 345 || h < 15) return 0;   // 빨
  if (h < 45) return 1;               // 주
  if (h < 75) return 2;               // 노
  if (h < 210) return 3;              // 초+파 → 청록
  return 4;                            // 남+보 → 보라
}

const GROUP_COLORS = ['#e53e3e', '#ed8936', '#ecc94b', '#38b2ac', '#9f7aea', '#a0aec0'];

export default function ColorDistributionView() {
  // 캐시에 데이터가 있으면 즉시 파싱하여 초기 상태로 사용 (깜빡임 방지)
  const initialData = useMemo(() => {
    const cached = getCached<Record<string, unknown>[]>('/api/portfolio');
    if (!cached) return null;
    return cached.map((a: Record<string, unknown>) => {
      let dominantColor: DominantColor | null = null;
      if (a.dominant_color) {
        if (typeof a.dominant_color === 'string') {
          try { dominantColor = JSON.parse(a.dominant_color); } catch { dominantColor = null; }
        } else {
          dominantColor = a.dominant_color as DominantColor;
        }
      }
      return {
        id: a.id as string, title: a.title as string,
        title_en: a.title_en as string | null, year: a.year as number,
        image_url: a.image_url as string, thumbnail_url: a.thumbnail_url as string,
        width: a.width as number | null, height: a.height as number | null,
        dominant_color: dominantColor,
      };
    });
  }, []);

  const [artworks, setArtworks] = useState<ColorArtwork[]>(initialData || []);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [colorGroupArtworks, setColorGroupArtworks] = useState<ColorArtwork[]>([]);
  const [colorGroupColor, setColorGroupColor] = useState<string>('');
  const [colorGroupIndex, setColorGroupIndex] = useState<number>(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await cachedFetch<Record<string, unknown>[]>('/api/portfolio');
        const parsed = data.map((a: Record<string, unknown>) => {
          let dominantColor: DominantColor | null = null;
          if (a.dominant_color) {
            if (typeof a.dominant_color === 'string') {
              try { dominantColor = JSON.parse(a.dominant_color); } catch { dominantColor = null; }
            } else {
              dominantColor = a.dominant_color as DominantColor;
            }
          }
          return {
            id: a.id as string, title: a.title as string,
            title_en: a.title_en as string | null, year: a.year as number,
            image_url: a.image_url as string, thumbnail_url: a.thumbnail_url as string,
            width: a.width as number | null, height: a.height as number | null,
            dominant_color: dominantColor,
          };
        });
        setArtworks(parsed);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('데이터를 로드하는 데 실패했습니다.');
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 5그룹 분류 → 작품 수 비례 컬럼 할당 → 균등 높이
  const displayColumns = useMemo(() => {
    // 1단계: 5그룹으로 분류 + 명도순 정렬
    const groups: ColorArtwork[][] = Array.from({ length: 6 }, () => []);
    artworks.forEach(a => {
      if (!a.dominant_color) return;
      groups[getColorGroup(a.dominant_color)].push(a);
    });
    
    // 청록(그룹3), 보라(그룹4) 내에서는 hue순 → 명도순
    [3, 4].forEach(i => {
      groups[i].sort((a, b) => {
        const hDiff = (a.dominant_color?.h || 0) - (b.dominant_color?.h || 0);
        if (Math.abs(hDiff) > 30) return hDiff;
        return (b.dominant_color?.l || 0) - (a.dominant_color?.l || 0);
      });
    });
    // 나머지 그룹은 명도순만
    [0, 1, 2, 5].forEach(i => {
      groups[i].sort((a, b) => (b.dominant_color?.l || 0) - (a.dominant_color?.l || 0));
    });

    // 2단계: 총 컬럼 수 결정 (목표 ~10열)
    const totalArtworks = groups.reduce((sum, g) => sum + g.length, 0);
    const TARGET_COLS = 10;
    const targetPerCol = Math.ceil(totalArtworks / TARGET_COLS);

    // 3단계: 각 그룹에 컬럼 수 비례 할당 (최소 1열, 작품 없으면 0)
    const columns: { artworks: ColorArtwork[]; color: string }[] = [];
    
    groups.forEach((group, gIdx) => {
      if (group.length === 0) return;
      
      // 작품 수 / 목표 = 필요 컬럼 수 (반올림)
      const numCols = Math.max(1, Math.round(group.length / targetPerCol));
      const perCol = Math.ceil(group.length / numCols);
      
      for (let c = 0; c < numCols; c++) {
        const start = c * perCol;
        const end = Math.min(start + perCol, group.length);
        if (start < group.length) {
          columns.push({
            artworks: group.slice(start, end),
            color: GROUP_COLORS[gIdx],
          });
        }
      }
    });

    return columns;
  }, [artworks]);

  // 색상 그룹 내 작품 클릭 → 모달 열기 + 그룹 네비게이션 설정
  const openArtworkInGroup = useCallback(async (artworkId: string, groupColor: string) => {
    try {
      const artwork = await cachedFetch<Artwork>(`/api/portfolio/${artworkId}`);
      
      // 같은 색상의 모든 컬럼 작품을 합침
      const groupArtworks = displayColumns
        .filter(col => col.color === groupColor)
        .flatMap(col => col.artworks);
      
      const idx = groupArtworks.findIndex(a => a.id === artworkId);
      
      setColorGroupArtworks(groupArtworks);
      setColorGroupColor(groupColor);
      setColorGroupIndex(idx >= 0 ? idx : 0);
      setSelectedArtwork(artwork);
      setModalOpen(true);
    } catch (err) {
      console.error('Error fetching artwork:', err);
    }
  }, [displayColumns]);
  
  // 그룹 내 이전/다음 작품으로 이동 (동기적으로 즉시 전환)
  const navigateGroup = useCallback((newIndex: number) => {
    if (newIndex < 0 || newIndex >= colorGroupArtworks.length) return;
    const target = colorGroupArtworks[newIndex];
    setColorGroupIndex(newIndex);
    setSelectedArtwork({
      id: target.id,
      title: target.title,
      title_en: target.title_en,
      year: target.year,
      image_url: target.image_url,
      thumbnail_url: target.thumbnail_url,
      width: target.width,
      height: target.height,
      order: 0,
      is_featured: false,
      show_watermark: true,
    } as Artwork);
  }, [colorGroupArtworks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--foreground)] mx-auto mb-4"></div>
          <p className="text-[var(--foreground)]/60">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-[var(--foreground)]/60">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full px-2">
      <div 
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${displayColumns.length}, 1fr)` }}
      >
        {displayColumns.map((col, colIdx) => (
          <div key={colIdx} className="flex flex-col gap-1">
            
            {col.artworks.map((artwork) => {
              const rawRatio = (artwork.width && artwork.height) ? artwork.width / artwork.height : 1;
              const aspectRatio = Math.max(0.5, Math.min(rawRatio, 2.0));
              return (
                <div
                  key={artwork.id}
                  className="cursor-pointer group relative"
                  onClick={() => openArtworkInGroup(artwork.id, col.color)}
                >
                  <div
                    className="relative w-full transition-transform duration-200 group-hover:scale-[1.03]"
                    style={{ paddingBottom: `${(1 / aspectRatio) * 100}%` }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={artwork.image_url?.includes('res.cloudinary.com') 
                        ? artwork.image_url.replace('/upload/', '/upload/c_fit,w_300,q_auto,f_auto/') 
                        : (artwork.thumbnail_url || artwork.image_url)}
                      alt={artwork.title}
                      className="absolute inset-0 w-full h-full object-contain"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-end justify-center">
                      <span className="text-white text-[9px] leading-tight text-center px-1 pb-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-md">
                        {artwork.title}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {modalOpen && selectedArtwork && (
        <ArtworkModal
          artwork={selectedArtwork}
          onClose={() => {
            setModalOpen(false);
            setColorGroupArtworks([]);
            setColorGroupColor('');
            setColorGroupIndex(0);
          }}
          hasPrev={colorGroupIndex > 0}
          hasNext={colorGroupIndex < colorGroupArtworks.length - 1}
          onPrev={() => navigateGroup(colorGroupIndex - 1)}
          onNext={() => navigateGroup(colorGroupIndex + 1)}
          groupLabel={colorGroupArtworks.length > 0 ? `__COLOR_BLOCK__${colorGroupColor}__${colorGroupIndex + 1}/${colorGroupArtworks.length}` : undefined}
          preloadImages={[
            colorGroupIndex > 0 ? colorGroupArtworks[colorGroupIndex - 1]?.image_url : '',
            colorGroupIndex < colorGroupArtworks.length - 1 ? colorGroupArtworks[colorGroupIndex + 1]?.image_url : '',
          ].filter(Boolean)}
          onTagClick={() => {
            // 색상 블록 클릭 → 모달 닫기 → 색상 뷰로 복귀
            setModalOpen(false);
            setColorGroupArtworks([]);
            setColorGroupColor('');
            setColorGroupIndex(0);
          }}
        />
      )}
    </div>
  );
}
