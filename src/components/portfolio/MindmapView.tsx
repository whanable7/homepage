'use client';

import { useEffect, useRef, useState } from 'react';
import Graph from 'graphology';
import Sigma from 'sigma';
import FA2Layout from 'graphology-layout-forceatlas2/worker';
import ArtworkModal from '@/components/artwork/ArtworkModal';
import { Artwork } from '@/types/artwork';

interface MindmapNode {
  id: string;
  type: 'artwork' | 'tag';
  title?: string;
  title_en?: string | null;
  year?: number;
  thumbnail_url?: string;
  width?: number | null;
  height?: number | null;
  connection_count?: number;
  name?: string;
  artwork_count?: number;
}

interface MindmapEdge {
  source: string;
  target: string;
}

interface MindmapData {
  nodes: MindmapNode[];
  edges: MindmapEdge[];
  stats: {
    artworks: number;
    tags: number;
    edges: number;
  };
}

export default function MindmapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const layoutRef = useRef<FA2Layout | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [stats, setStats] = useState<{ artworks: number; tags: number; edges: number } | null>(null);

  useEffect(() => {
    const initGraph = async () => {
      if (!containerRef.current) return;

      try {
        // 1. 데이터 가져오기
        const res = await fetch('/api/portfolio/mindmap');
        if (!res.ok) throw new Error('Failed to fetch mindmap data');
        
        const data: MindmapData = await res.json();
        setStats(data.stats);

        if (data.nodes.length === 0) {
          setError('표시할 작품이 없습니다.');
          setLoading(false);
          return;
        }

        // 2. 그래프 생성
        const graph = new Graph();

        // 노드 추가
        data.nodes.forEach((node) => {
          const isArtwork = node.type === 'artwork';
          const connectionCount = node.connection_count || node.artwork_count || 0;
          
          graph.addNode(node.id, {
            x: Math.random() * 1000,
            y: Math.random() * 1000,
            size: isArtwork ? 15 * (1 + connectionCount * 0.1) : 5,
            color: isArtwork ? '#2563eb' : 'rgba(150, 150, 150, 0.4)',
            label: isArtwork ? (node.title || '') : '',
            type: node.type,
            // 추가 데이터
            artworkData: isArtwork ? {
              id: node.id.replace('artwork:', ''),
              title: node.title,
              title_en: node.title_en,
              year: node.year,
              thumbnail_url: node.thumbnail_url,
              width: node.width,
              height: node.height,
            } : null,
          });
        });

        // 엣지 추가 (중복 방지)
        const addedEdges = new Set<string>();
        data.edges.forEach((edge) => {
          const edgeKey = `${edge.source}-${edge.target}`;
          if (!addedEdges.has(edgeKey)) {
            addedEdges.add(edgeKey);
            graph.addEdgeWithKey(edgeKey, edge.source, edge.target, {
              color: 'rgba(180, 180, 180, 0.3)',
              size: 1,
            });
          }
        });

        // 3. ForceAtlas2 레이아웃 (Web Worker)
        layoutRef.current = new FA2Layout(graph, {
          settings: {
            barnesHutOptimize: graph.order > 100,
            gravity: 0.5,
            scalingRatio: 5,
            slowDown: 5,
          },
        });

        layoutRef.current.start();

        // 레이아웃 안정화 후 정지
        setTimeout(() => {
          layoutRef.current?.stop();
        }, 3000);

        // 4. Sigma 렌더러 생성
        sigmaRef.current = new Sigma(graph, containerRef.current, {
          renderEdgeLabels: false,
          enableEdgeEvents: false,
          labelRenderedSizeThreshold: 10,
          defaultNodeColor: '#2563eb',
          defaultEdgeColor: 'rgba(180, 180, 180, 0.3)',
        });

        // 5. 이벤트 핸들러
        sigmaRef.current.on('clickNode', ({ node }) => {
          const nodeAttrs = graph.getNodeAttributes(node);
          if (nodeAttrs.type === 'artwork' && nodeAttrs.artworkData) {
            // 작품 상세 데이터 가져오기
            fetchArtworkDetail(nodeAttrs.artworkData.id);
          }
        });

        // 호버 효과
        sigmaRef.current.on('enterNode', ({ node }) => {
          const nodeAttrs = graph.getNodeAttributes(node);
          if (nodeAttrs.type === 'artwork') {
            containerRef.current!.style.cursor = 'pointer';
          }
        });

        sigmaRef.current.on('leaveNode', () => {
          containerRef.current!.style.cursor = 'default';
        });

        setLoading(false);
      } catch (err) {
        console.error('Error initializing mindmap:', err);
        setError('마인드맵을 로드하는 데 실패했습니다.');
        setLoading(false);
      }
    };

    initGraph();

    // 클린업
    return () => {
      layoutRef.current?.kill();
      sigmaRef.current?.kill();
    };
  }, []);

  const fetchArtworkDetail = async (artworkId: string) => {
    try {
      const res = await fetch(`/api/portfolio/${artworkId}`);
      if (res.ok) {
        const artwork = await res.json();
        setSelectedArtwork(artwork);
        setModalOpen(true);
      }
    } catch (err) {
      console.error('Error fetching artwork:', err);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-[var(--foreground)]/60">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* 로딩 오버레이 */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--background)]/80 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--foreground)] mx-auto mb-4"></div>
            <p className="text-[var(--foreground)]/60">그래프 생성 중...</p>
          </div>
        </div>
      )}

      {/* 통계 */}
      {stats && (
        <div className="text-center text-sm text-[var(--foreground)]/60 mb-4">
          작품 {stats.artworks}개 · 태그 {stats.tags}개 · 연결 {stats.edges}개
        </div>
      )}

      {/* 그래프 컨테이너 */}
      <div 
        ref={containerRef} 
        className="w-full h-[70vh] rounded-lg border border-[var(--foreground)]/10"
      />

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
