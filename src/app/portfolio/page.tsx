'use client';

import { Suspense, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/common/Header';
import { useLocale } from '@/i18n';
import YearViewWrapper from '@/components/portfolio/YearViewWrapper';

const GraphView = dynamic(() => import('@/components/portfolio/GraphView'), {
  ssr: false,
  loading: () => <LoadingSpinner />,
});

const ColorDistributionView = dynamic(() => import('@/components/portfolio/ColorDistributionView'), {
  ssr: false,
  loading: () => <LoadingSpinner />,
});

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--foreground)] mx-auto mb-4" />
        <p className="text-[var(--foreground)]/60">Loading...</p>
      </div>
    </div>
  );
}

type TabKey = 'graph' | 'colors' | 'years';

const TABS: TabKey[] = ['graph', 'colors', 'years'];

// Suspense wrapper for useSearchParams
export default function PortfolioPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <PortfolioContent />
    </Suspense>
  );
}

function PortfolioContent() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const paramTab = searchParams.get('view') as TabKey | null;
  const [activeTab, setActiveTab] = useState<TabKey>(
    paramTab && TABS.includes(paramTab) ? paramTab : 'graph'
  );
  
  // 한번이라도 활성화된 탭만 렌더링 (lazy mount)
  const [mounted, setMounted] = useState<Set<TabKey>>(new Set([activeTab]));

  useEffect(() => {
    if (!mounted.has(activeTab)) {
      setMounted(prev => new Set(prev).add(activeTab));
    }
  }, [activeTab, mounted]);

  // URL 동기화
  const switchTab = (tab: TabKey) => {
    setActiveTab(tab);
    router.replace(`/portfolio?view=${tab}`, { scroll: false });
  };

  const tabLabels: Record<TabKey, string> = {
    graph: t.portfolioViews.graph,
    colors: t.portfolioViews.colors,
    years: t.portfolioViews.years,
  };

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <Header />
      <div className="max-w-6xl mx-auto pt-24 pb-16 px-6">
        <h1 className="text-3xl font-light tracking-wide text-center mb-8 text-[var(--foreground)]">
          {t.portfolio.title}
        </h1>

        {/* 탭 버튼 */}
        <div className="flex justify-center gap-1 mb-8">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => switchTab(tab)}
              className={`px-6 py-2 text-sm font-medium transition-colors rounded-full ${
                activeTab === tab
                  ? 'bg-[var(--foreground)] text-[var(--background)]'
                  : 'text-[var(--foreground)] hover:bg-[var(--foreground)]/10'
              }`}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        {/* 그래프: canvas 기반이라 display:none에서 크기가 0 → 활성 탭일 때만 렌더 */}
        {activeTab === 'graph' && <GraphView />}
        
        {/* 색상/연도: DOM 기반이라 display:none으로 숨겨도 OK (unmount 안 함) */}
        <div style={{ display: activeTab === 'colors' ? 'block' : 'none' }}>
          {mounted.has('colors') && <ColorDistributionView />}
        </div>
        <div style={{ display: activeTab === 'years' ? 'block' : 'none' }}>
          {mounted.has('years') && <YearViewWrapper />}
        </div>
      </div>
    </main>
  );
}
