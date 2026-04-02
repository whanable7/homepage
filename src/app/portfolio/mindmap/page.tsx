'use client';

import dynamic from 'next/dynamic';

// Sigma.js는 클라이언트 전용 (window, WebGL 사용)
const MindmapView = dynamic(
  () => import('@/components/portfolio/MindmapView'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--foreground)] mx-auto mb-4"></div>
          <p className="text-[var(--foreground)]/60">마인드맵 로딩 중...</p>
        </div>
      </div>
    ),
  }
);

export default function MindmapPage() {
  return <MindmapView />;
}
