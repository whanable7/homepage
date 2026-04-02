'use client';

import { useEffect, useState } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import ArtworkModal from '@/components/artwork/ArtworkModal';
import { Artwork } from '@/types/artwork';
import { cachedFetch } from '@/lib/client-cache';

interface ColorNode {
  id: string;
  title: string;
  title_en: string | null;
  year: number;
  thumbnail_url: string;
  width: number | null;
  height: number | null;
  dominant_color: string | null;
  hue: number | null;
}

interface ColorData {
  nodes: ColorNode[];
  segments: Array<{
    hueStart: number;
    hueEnd: number;
    artworks: ColorNode[];
  }>;
  unclassified: ColorNode[];
  total: number;
  classified: number;
}

export default function ColorWheelView() {
  const [data, setData] = useState<ColorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const colorData = await cachedFetch<ColorData>('/api/portfolio/colors');
        setData(colorData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching color data:', err);
        setError('색상 데이터를 로드하는 데 실패했습니다.');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const fetchArtworkDetail = async (artworkId: string) => {
    try {
      const artwork = await cachedFetch<Artwork>(`/api/portfolio/${artworkId}`);
      setSelectedArtwork(artwork);
      setModalOpen(true);
    } catch (err) {
      console.error('Error fetching artwork:', err);
    }
  };

  // 색상환 위치 계산
  const getPosition = (hue: number, index: number, totalInSegment: number) => {
    // 12시 = 빨강(0°), 시계방향
    const angle = ((hue - 90) / 360) * 2 * Math.PI;
    
    // 같은 색상대에서 여러 작품이 있으면 반경 분산
    const baseRadius = 250;
    const radiusOffset = (index % 3) * 40;
    const radius = baseRadius + radiusOffset;
    
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  };

  // HSL을 CSS 색상으로 변환
  const getHslColor = (hue: number) => `hsl(${hue}, 70%, 50%)`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--foreground)] mx-auto mb-4"></div>
          <p className="text-[var(--foreground)]/60">색상 휠 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-[var(--foreground)]/60">{error || '데이터가 없습니다.'}</p>
      </div>
    );
  }

  const classifiedArtworks = data.nodes.filter(n => n.hue !== null);

  return (
    <div className="relative">
      {/* 통계 */}
      <div className="text-center text-sm text-[var(--foreground)]/60 mb-4">
        분류됨 {data.classified}개 · 미분류 {data.unclassified.length}개
      </div>

      {/* 색상 휠 */}
      <div className="w-full h-[70vh] rounded-lg border border-[var(--foreground)]/10 overflow-hidden">
        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={3}
          centerOnInit
        >
          <TransformComponent
            wrapperStyle={{ width: '100%', height: '100%' }}
            contentStyle={{ width: '100%', height: '100%' }}
          >
            <svg 
              viewBox="-400 -400 800 800" 
              className="w-full h-full"
              style={{ background: 'var(--background)' }}
            >
              {/* 배경 색상환 (그라디언트) */}
              <defs>
                <radialGradient id="centerFade" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="var(--background)" />
                  <stop offset="70%" stopColor="var(--background)" stopOpacity="0" />
                </radialGradient>
              </defs>
              
              {/* 색상 스펙트럼 원 */}
              {Array.from({ length: 360 }, (_, i) => (
                <line
                  key={i}
                  x1={0}
                  y1={0}
                  x2={Math.cos(((i - 90) / 360) * 2 * Math.PI) * 350}
                  y2={Math.sin(((i - 90) / 360) * 2 * Math.PI) * 350}
                  stroke={`hsl(${i}, 50%, 70%)`}
                  strokeWidth={3}
                  opacity={0.2}
                />
              ))}

              {/* 작품 노드 */}
              {classifiedArtworks.map((artwork, index) => {
                if (artwork.hue === null) return null;
                
                const sameHueArtworks = classifiedArtworks.filter(
                  a => a.hue !== null && Math.abs(a.hue - artwork.hue!) < 15
                );
                const indexInSegment = sameHueArtworks.findIndex(a => a.id === artwork.id);
                const pos = getPosition(artwork.hue, indexInSegment, sameHueArtworks.length);
                
                const aspectRatio = (artwork.height && artwork.width) 
                  ? artwork.width / artwork.height 
                  : 1;
                const nodeWidth = 40;
                const nodeHeight = nodeWidth / aspectRatio;

                return (
                  <g
                    key={artwork.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    onClick={() => fetchArtworkDetail(artwork.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* 작품 썸네일 */}
                    <image
                      href={artwork.thumbnail_url}
                      x={-nodeWidth / 2}
                      y={-nodeHeight / 2}
                      width={nodeWidth}
                      height={nodeHeight}
                      clipPath="inset(0)"
                    />
                    {/* 테두리 (대표색) */}
                    <rect
                      x={-nodeWidth / 2 - 2}
                      y={-nodeHeight / 2 - 2}
                      width={nodeWidth + 4}
                      height={nodeHeight + 4}
                      fill="none"
                      stroke={getHslColor(artwork.hue)}
                      strokeWidth={2}
                      rx={2}
                    />
                  </g>
                );
              })}

              {/* 중앙 페이드 */}
              <circle cx={0} cy={0} r={150} fill="url(#centerFade)" />
            </svg>
          </TransformComponent>
        </TransformWrapper>
      </div>

      {/* 미분류 작품 */}
      {data.unclassified.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-medium text-center mb-4 text-[var(--foreground)]">
            미분류 작품 ({data.unclassified.length}개)
          </h3>
          <div className="flex flex-wrap justify-center gap-2">
            {data.unclassified.map((artwork) => (
              <div
                key={artwork.id}
                onClick={() => fetchArtworkDetail(artwork.id)}
                className="w-16 h-16 cursor-pointer hover:opacity-80 transition-opacity"
              >
                <img
                  src={artwork.thumbnail_url}
                  alt={artwork.title}
                  className="w-full h-full object-cover rounded"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 안내 */}
      <p className="text-center text-sm text-[var(--foreground)]/40 mt-4">
        마우스 휠로 확대/축소 · 드래그로 이동 · 작품 클릭 시 상세 보기
      </p>

      {/* 모달 */}
      {modalOpen && selectedArtwork && (
        <ArtworkModal
          artwork={selectedArtwork}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
