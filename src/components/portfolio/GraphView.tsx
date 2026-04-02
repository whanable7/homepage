'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import * as d3 from 'd3-force';
import ArtworkModal from '@/components/artwork/ArtworkModal';
import { Artwork } from '@/types/artwork';
import { useLocale } from '@/i18n';
import { cachedFetch, getCached } from '@/lib/client-cache';
import { optimizeCloudinaryUrl } from '@/lib/cloudinary-loader';

// 2D 그래프 컴포넌트 동적 로딩 (SSR 비활성화)
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => <GraphLoading />,
}) as React.ComponentType<Record<string, unknown>>;


function GraphLoading({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center h-full bg-[var(--background)]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--foreground)] mx-auto mb-4" />
        <p className="text-[var(--foreground)]/60">{text}</p>
      </div>
    </div>
  );
}

// ===== 타입 =====
// 3D 모드 제거됨 — 2D만 사용

interface GraphNode {
  id: string;
  type: 'artwork' | 'tag';
  title?: string;
  title_en?: string | null;
  year?: number;
  image_url?: string;
  thumb_sm?: string;  // 100px 썸네일 (hover 미리보기용)
  thumb_md?: string;  // 200px 썸네일 (태그 연결 작품 리스트용)
  width?: number | null;
  height?: number | null;
  connection_count?: number;
  name?: string;
  artwork_count?: number;
  val?: number;
  color?: string;
  x?: number;
  y?: number;
  z?: number;
  linkCount?: number;
}

interface GraphLink {
  source: string;
  target: string;
}

interface ApiResponse {
  nodes: GraphNode[];
  edges: GraphLink[];
  stats: {
    artworks: number;
    tags: number;
    edges: number;
  };
}

interface ProcessedGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface PhysicsSettings {
  chargeStrength: number;    // 노드 간 반발력 (음수)
  centerStrength: number;    // 중심으로 당기는 힘
  linkDistance: number;      // 링크 거리
  linkStrength: number;      // 링크 강도
  collisionRadius: number;   // 충돌 반경 배율
  nodeSize: number;          // 노드 크기 배율
}

const DEFAULT_PHYSICS: PhysicsSettings = {
  chargeStrength: 120,      // 약간 강함
  centerStrength: 0.05,     // 약함
  linkDistance: 130,         // 길게
  linkStrength: 0.8,        // 강함
  collisionRadius: 1.5,
  nodeSize: 1.2,            // 약간 크게
};

// ===== 색상 설정 =====
const COLORS = {
  artwork: 'rgb(128, 128, 0)',      // olive
  artworkDimmed: 'rgba(128, 128, 0, 0.65)',
  tag: 'rgb(178, 34, 34)',          // firebrick
  tagDimmed: 'rgba(178, 34, 34, 0.65)',
  link: 'rgba(100, 100, 100, 0.3)',
  linkHighlight: 'rgba(80, 80, 80, 0.8)',
  linkDimmed: 'rgba(100, 100, 100, 0.3)',
  background: 'rgb(245, 245, 245)', // whitesmoke
};

// ===== 슬라이더 컴포넌트 =====
function Slider({ 
  label, 
  value, 
  onChange, 
  min, 
  max, 
  step = 1,
  leftLabel,
  rightLabel,
  slightly,
  quite,
  normal,
}: { 
  label: string; 
  value: number; 
  onChange: (v: number) => void; 
  min: number; 
  max: number; 
  step?: number;
  leftLabel: string;
  rightLabel: string;
  slightly: string;
  quite: string;
  normal: string;
}) {
  // 0~100% 위치 기준 자연어 표시
  const percent = ((value - min) / (max - min)) * 100;
  const getStrengthLabel = () => {
    if (percent <= 20) return leftLabel;
    if (percent <= 40) return `${slightly} ${rightLabel}`;
    if (percent <= 60) return normal;
    if (percent <= 80) return `${quite} ${rightLabel}`;
    return rightLabel;
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-[var(--foreground)]/70">{label}</span>
        <span className="text-[var(--foreground)]/50">{getStrengthLabel()}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-[var(--foreground)]/20 rounded-lg appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-3
          [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:bg-[var(--foreground)]
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:cursor-pointer"
      />
      <div className="flex justify-between text-[10px] text-[var(--foreground)]/30">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

// ===== 메인 컴포넌트 =====
export default function GraphView() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<unknown>(null);
  
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [stats, setStats] = useState({ artworks: 0, tags: 0, edges: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // viewMode/render3D 제거됨 — 2D 전용
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [pinnedArtworks, setPinnedArtworks] = useState<GraphNode[]>([]);
  const [pinnedTagName, setPinnedTagName] = useState<string>('');
  const [isOverArtworkPanel, setIsOverArtworkPanel] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<string>>(new Set());
  // imageCache 제거됨 - canvas에서 이미지 사용하지 않음
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [tagGroupArtworks, setTagGroupArtworks] = useState<GraphNode[]>([]);
  const [tagGroupName, setTagGroupName] = useState<string>('');
  const [tagGroupIndex, setTagGroupIndex] = useState<number>(0);
  const [clickedArtworkTags, setClickedArtworkTags] = useState<string[]>([]);
  // 고정 크기 (4:3 비율)
  const FIXED_WIDTH = 900;
  const FIXED_HEIGHT = 675; // 900 * 3/4
  const [physics, setPhysics] = useState<PhysicsSettings>(DEFAULT_PHYSICS);
  const [isMounted, setIsMounted] = useState(false);
  const [hasInitialCentered, setHasInitialCentered] = useState(false);
  // showPhysicsPanel 토글 제거 — 항상 표시

  // 마운트 상태만 관리
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 데이터 로딩
  useEffect(() => {
    const fetchData = async () => {
      try {
        const apiData = await cachedFetch<ApiResponse>('/api/portfolio/graph');
        
        // d3-force는 links의 source/target을 문자열→객체로 in-place mutate하므로
        // 캐시 데이터 오염 방지를 위해 deep copy 필수
        const edgesCopy = apiData.edges.map(e => ({ source: String(e.source), target: String(e.target) }));
        
        const linkCount = new Map<string, number>();
        edgesCopy.forEach((edge) => {
          linkCount.set(edge.source, (linkCount.get(edge.source) || 0) + 1);
          linkCount.set(edge.target, (linkCount.get(edge.target) || 0) + 1);
        });

        const maxLinks = Math.max(...Array.from(linkCount.values()), 1);
        
        const processedNodes = apiData.nodes.map((node) => {
          const nodeLinks = linkCount.get(node.id) || 0;
          const normalizedSize = nodeLinks / maxLinks;
          
          let val: number;
          if (node.type === 'artwork') {
            val = 10 + normalizedSize * 40;
          } else {
            val = 8 + normalizedSize * 52;
          }
          
          // Cloudinary 썸네일 URL 미리 생성 (hover 시 즉시 사용)
          const thumb_sm = node.image_url 
            ? optimizeCloudinaryUrl(node.image_url, { width: 100, crop: 'fill', quality: 'auto', format: 'auto' })
            : undefined;
          const thumb_md = node.image_url 
            ? optimizeCloudinaryUrl(node.image_url, { width: 200, crop: 'fill', quality: 'auto', format: 'auto' })
            : undefined;
          
          return {
            ...node,
            thumb_sm,
            thumb_md,
            val,
            color: node.type === 'artwork' ? COLORS.artwork : COLORS.tag,
            linkCount: nodeLinks,
          };
        });

        // 모든 아트워크 썸네일을 백그라운드에서 프리로드 (hover 시 즉시 표시)
        const artworkNodes = processedNodes.filter(n => n.type === 'artwork' && n.thumb_sm);
        // 브라우저가 부담 없이 처리하도록 5개씩 배치 로드
        const batchSize = 5;
        for (let i = 0; i < artworkNodes.length; i += batchSize) {
          const batch = artworkNodes.slice(i, i + batchSize);
          // 다음 프레임에서 로드하여 메인 스레드 차단 방지
          setTimeout(() => {
            batch.forEach(node => {
              if (node.thumb_sm) {
                const img = new window.Image();
                img.src = node.thumb_sm;
              }
              if (node.thumb_md) {
                const img2 = new window.Image();
                img2.src = node.thumb_md;
              }
            });
          }, 100 + (i / batchSize) * 50); // 50ms 간격으로 배치
        }

        setNodes(processedNodes);
        setLinks(edgesCopy);
        setStats(apiData.stats);
      } catch (err) {
        console.error('Error fetching graph data:', err);
        setError('그래프 데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 참고: canvas 노드는 원(arc)으로 렌더링하므로 이미지 프리로드 불필요
  // 삭제됨: 100개 원본 이미지를 crossOrigin='anonymous'로 로드하던 코드
  // → 불필요한 메모리 사용 + 브라우저 이미지 캐시 오염 (CORS vs non-CORS) 유발

  // 그래프 초기화 - forceX, forceY 추가 및 화면 맞춤
  const [graphInitialized, setGraphInitialized] = useState(false);
  
  useEffect(() => {
    if (!graphRef.current || graphInitialized) return;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fg = graphRef.current as any;
    
    // 약간 딜레이 후 force 추가 (그래프 완전 초기화 대기)
    const timer = setTimeout(() => {
      try {
        // 중심(0,0)으로 당기는 forceX, forceY 추가
        fg.d3Force('x', d3.forceX(0).strength(physics.centerStrength));
        fg.d3Force('y', d3.forceY(0).strength(physics.centerStrength));
        
        // 기본 설정 적용
        fg.d3Force('charge')?.strength(-physics.chargeStrength);
        fg.d3Force('link')?.distance(physics.linkDistance);
        fg.d3Force('link')?.strength(physics.linkStrength);
        
        fg.d3ReheatSimulation?.();
        setGraphInitialized(true);
        
        // 시뮬레이션 안정화 후 화면 중앙에 맞춤
        setTimeout(() => {
          // graphRef.current를 직접 참조 (클로저 stale 방지)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const currentFg = graphRef.current as any;
          if (currentFg?.zoomToFit) {
            currentFg.zoomToFit(400, 80);
            console.log('zoomToFit called');
          }
        }, 1000);
      } catch (err) {
        console.log('Force init error:', err);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [graphRef.current, graphInitialized]);
  
  // 물리 설정 변경 시 그래프 업데이트 (2D 모드에서만)
  useEffect(() => {
    if (!graphRef.current || !graphInitialized) return;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fg = graphRef.current as any;
    
    try {
      // charge force (반발력) - 양수 입력을 음수로 변환 (d3는 음수가 반발)
      fg.d3Force('charge')?.strength(-physics.chargeStrength);
      
      // 중심 인력 (forceX, forceY)
      fg.d3Force('x')?.strength(physics.centerStrength);
      fg.d3Force('y')?.strength(physics.centerStrength);
      
      // link force
      fg.d3Force('link')?.distance(physics.linkDistance);
      fg.d3Force('link')?.strength(physics.linkStrength);
      
      // 시뮬레이션 재가열
      fg.d3ReheatSimulation?.();
    } catch (err) {
      console.log('Force update error:', err);
    }
  }, [physics, graphInitialized]);

  const graphData: ProcessedGraphData = useMemo(() => ({
    nodes,
    links,
  }), [nodes, links]);

  const handleNodeClick = useCallback(async (node: GraphNode) => {
    if (!node || !node.id) return;
    
    if (node.type === 'artwork') {
      const artworkId = node.id.replace('artwork:', '');
      
      // 연결된 태그 이름 추출
      const connectedTags = (links as Array<{ source: string | GraphNode; target: string | GraphNode }>)
        .filter(l => {
          const srcId = typeof l.source === 'object' ? l.source.id : l.source;
          const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
          return srcId === node.id || tgtId === node.id;
        })
        .map(l => {
          const srcId = typeof l.source === 'object' ? l.source.id : l.source;
          const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
          const tagId = srcId === node.id ? tgtId : srcId;
          const tagNode = nodes.find(n => n.id === tagId && n.type === 'tag');
          return tagNode?.name || '';
        })
        .filter(Boolean);
      
      try {
        const artwork = await cachedFetch(`/api/portfolio/${artworkId}`);
        setClickedArtworkTags(connectedTags);
        setTagGroupArtworks([]); // 단일 작품 클릭이므로 그룹 네비 없음
        setSelectedArtwork(artwork as Artwork);
        setModalOpen(true);
      } catch (err) {
        console.error('Error fetching artwork:', err);
      }
    }
  }, [links, nodes]);

  // 노드 커스텀 렌더링 (기본 노드 + 태그 이름)
  const nodeCanvasObject = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D) => {
    const nodeSize = Math.sqrt(node.val || 10) * 2 * physics.nodeSize;
    const x = node.x || 0;
    const y = node.y || 0;
    
    // 노드 색상 계산
    let nodeColor: string;
    if (highlightNodes.size > 0 && !highlightNodes.has(node.id)) {
      nodeColor = node.type === 'artwork' ? COLORS.artworkDimmed : COLORS.tagDimmed;
    } else {
      nodeColor = node.type === 'artwork' ? COLORS.artwork : COLORS.tag;
    }
    
    // 기본 노드 원 그리기
    ctx.beginPath();
    ctx.arc(x, y, nodeSize, 0, 2 * Math.PI);
    ctx.fillStyle = nodeColor;
    ctx.fill();
    
    // 작품 호버 시 → 연결된 태그 이름은 좌하단 HTML 오버레이로 표시 (canvas 텍스트 제거)
  }, [highlightNodes, hoveredNode, physics.nodeSize]);
  
  // 연결된 작품들 가져오기 (태그 호버 시)
  const liveConnectedArtworks = useMemo(() => {
    if (!hoveredNode || hoveredNode.type !== 'tag') return [];
    
    return nodes.filter(n => 
      n.type === 'artwork' && highlightNodes.has(n.id) && n.id !== hoveredNode.id
    );
  }, [hoveredNode, nodes, highlightNodes]);

  // 태그 호버 시 pinnedArtworks + 태그 이름 업데이트
  useEffect(() => {
    if (liveConnectedArtworks.length > 0) {
      setPinnedArtworks(liveConnectedArtworks);
      if (hoveredNode?.type === 'tag') {
        setPinnedTagName(hoveredNode.name || '');
      }
    }
  }, [liveConnectedArtworks, hoveredNode]);

  // 태그에서 마우스가 나갈 때 300ms 딜레이 후 사라지게
  useEffect(() => {
    if (liveConnectedArtworks.length > 0 || isOverArtworkPanel) {
      // 태그 위에 있거나 패널 위에 있으면 타이머 취소
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    } else if (pinnedArtworks.length > 0 && !hideTimerRef.current) {
      // 둘 다 아닌데 핀된 게 있으면 300ms 후 제거
      hideTimerRef.current = setTimeout(() => {
        setPinnedArtworks([]);
        setPinnedTagName('');
        hideTimerRef.current = null;
      }, 500);
    }
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [liveConnectedArtworks, isOverArtworkPanel, pinnedArtworks.length]);

  // 실제 표시할 작품: 라이브 또는 핀된 것 (딜레이 중에도 유지)
  const connectedArtworks = liveConnectedArtworks.length > 0
    ? liveConnectedArtworks
    : pinnedArtworks.length > 0 ? pinnedArtworks : [];
  
  // 현재 호버된 태그 이름 + 연결 작품 연도 범위 (태그 호버 시)
  const hoveredTagInfo = useMemo(() => {
    if (connectedArtworks.length === 0) return null;
    // hoveredNode가 태그이면 그 이름, 아니면 pinnedArtworks의 원래 태그
    const tagName = (hoveredNode?.type === 'tag' ? hoveredNode.name : null) 
      || pinnedTagName || '';
    
    // 연도 범위 계산
    const years = connectedArtworks
      .map(a => a.year)
      .filter((y): y is number => !!y);
    
    if (years.length === 0) return { tagName, yearRange: '' };
    
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    const yearRange = minYear === maxYear ? `${minYear}` : `${minYear}–${maxYear}`;
    
    return { tagName, yearRange };
  }, [connectedArtworks, hoveredNode, pinnedArtworks]);

  // 현재 호버된 작품 정보 (작품 호버 시)
  const hoveredArtwork = useMemo(() => {
    if (!hoveredNode || hoveredNode.type !== 'artwork') return null;
    return hoveredNode;
  }, [hoveredNode]);

  // 작품 호버 시 연관 태그 목록
  const hoveredArtworkTags = useMemo(() => {
    if (!hoveredNode || hoveredNode.type !== 'artwork') return [];
    return nodes.filter(n => 
      n.type === 'tag' && highlightNodes.has(n.id) && n.id !== hoveredNode.id
    ).map(n => n.name || '');
  }, [hoveredNode, nodes, highlightNodes]);

  // 노드 호버 시 연결된 노드/링크 하이라이트
  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoveredNode(node);
    
    if (node) {
      const connectedNodes = new Set<string>();
      const connectedLinks = new Set<string>();
      
      connectedNodes.add(node.id);
      
      links.forEach(link => {
        const sourceId = typeof link.source === 'object' ? (link.source as GraphNode).id : link.source;
        const targetId = typeof link.target === 'object' ? (link.target as GraphNode).id : link.target;
        
        if (sourceId === node.id) {
          connectedNodes.add(targetId);
          connectedLinks.add(`${sourceId}-${targetId}`);
        } else if (targetId === node.id) {
          connectedNodes.add(sourceId);
          connectedLinks.add(`${sourceId}-${targetId}`);
        }
      });
      
      setHighlightNodes(connectedNodes);
      setHighlightLinks(connectedLinks);
    } else {
      setHighlightNodes(new Set());
      setHighlightLinks(new Set());
      setMousePos(null);
    }
  }, [links]);
  
  // 모달에서 태그 클릭 → 해당 태그 그룹 활성화
  const handleTagClickFromModal = useCallback((tagName: string) => {
    const tagNode = nodes.find(n => n.type === 'tag' && n.name === tagName);
    if (!tagNode) return;
    
    // 모달 닫기
    setModalOpen(false);
    setClickedArtworkTags([]);
    
    // 해당 태그 노드를 호버 상태로 만들기
    handleNodeHover(tagNode);
    
    // 연결된 작품을 핀
    const connected = nodes.filter(n => {
      if (n.type !== 'artwork') return false;
      return (links as Array<{ source: string | GraphNode; target: string | GraphNode }>).some(l => {
        const srcId = typeof l.source === 'object' ? l.source.id : l.source;
        const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
        return (srcId === tagNode.id && tgtId === n.id) || (tgtId === tagNode.id && srcId === n.id);
      });
    });
    
    setPinnedArtworks(connected);
    setPinnedTagName(tagName);
  }, [nodes, links, handleNodeHover]);

  // 마우스 위치 추적 (컨테이너 기준)
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  // getNodeColor, getNodeLabel 제거됨 (3D용이었음)

  const getLinkColor = useCallback((link: { source: GraphNode | string; target: GraphNode | string }) => {
    if (highlightLinks.size === 0) return COLORS.link;
    
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    const linkId = `${sourceId}-${targetId}`;
    const linkIdReverse = `${targetId}-${sourceId}`;
    
    if (highlightLinks.has(linkId) || highlightLinks.has(linkIdReverse)) {
      return COLORS.linkHighlight;
    }
    return COLORS.linkDimmed;
  }, [highlightLinks]);

  const getLinkWidth = useCallback((link: { source: GraphNode | string; target: GraphNode | string }) => {
    if (highlightLinks.size === 0) return 1.5;
    
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    const linkId = `${sourceId}-${targetId}`;
    const linkIdReverse = `${targetId}-${sourceId}`;
    
    if (highlightLinks.has(linkId) || highlightLinks.has(linkIdReverse)) {
      return 1.8;  // 살짝만 굵게
    }
    return 1.2;    // 기본보다 살짝만 얇게
  }, [highlightLinks]);

  const updatePhysics = (key: keyof PhysicsSettings, value: number) => {
    setPhysics(prev => ({ ...prev, [key]: value }));
  };

  const resetPhysics = () => {
    setPhysics(DEFAULT_PHYSICS);
    // 그래프를 화면 중심으로 되돌리기
    const currentFg = graphRef.current as Record<string, unknown> | null;
    if (currentFg && typeof currentFg.zoomToFit === 'function') {
      const fg = currentFg;
      setTimeout(() => (fg.zoomToFit as (d: number, p: number) => void)(400, 80), 100);
    }
  };

  if (loading || !isMounted) {
    return <GraphLoading text={t.graph.loading} />;
  }

  // 그래프 영역 크기 (고정, 4:3 비율)
  const PANEL_WIDTH = 200;
  const GRAPH_WIDTH = FIXED_WIDTH;
  const GRAPH_HEIGHT = FIXED_HEIGHT;

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-[var(--foreground)]/60">{t.graph.error}</p>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-[var(--foreground)]/60">{t.graph.noData}</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* 헤더 - 작품 숫자 제거 */}

      <div className="flex flex-col md:flex-row gap-4">
        {/* 그래프 + 오버레이 래퍼 */}
        <div className="relative w-full md:w-auto overflow-x-auto" style={{ minWidth: GRAPH_WIDTH, height: GRAPH_HEIGHT }}>
          {/* 그래프 컨테이너 - 고정 영역 */}
          <div
            ref={containerRef}
            className="rounded-lg border border-[var(--foreground)]/10 overflow-hidden absolute inset-0"
            style={{ backgroundColor: COLORS.background }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setMousePos(null)}
          >
          <ForceGraph2D
              key="graph-2d"
              ref={graphRef}
              graphData={graphData}
              width={GRAPH_WIDTH}
              height={GRAPH_HEIGHT}
              backgroundColor={COLORS.background}
              nodeCanvasObject={nodeCanvasObject}
              nodePointerAreaPaint={(node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
                const nodeSize = Math.sqrt(node.val || 10) * 2 * physics.nodeSize;
                ctx.beginPath();
                ctx.arc(node.x || 0, node.y || 0, nodeSize, 0, 2 * Math.PI);
                ctx.fillStyle = color;
                ctx.fill();
              }}
              linkCanvasObject={(link: { source: GraphNode | string; target: GraphNode | string }, ctx: CanvasRenderingContext2D) => {
                // source/target이 아직 문자열(미resolve)이면 그리지 않음
                if (typeof link.source !== 'object' || typeof link.target !== 'object') return;
                const src = link.source as GraphNode;
                const tgt = link.target as GraphNode;
                if (src.x == null || src.y == null || tgt.x == null || tgt.y == null) return;
                
                const linkId = `${src.id}-${tgt.id}`;
                const linkIdReverse = `${tgt.id}-${src.id}`;
                const isHighlighted = highlightLinks.size > 0 && (highlightLinks.has(linkId) || highlightLinks.has(linkIdReverse));
                const isDimmed = highlightLinks.size > 0 && !isHighlighted;
                
                ctx.beginPath();
                ctx.moveTo(src.x, src.y);
                ctx.lineTo(tgt.x, tgt.y);
                ctx.strokeStyle = isHighlighted ? COLORS.linkHighlight : isDimmed ? COLORS.linkDimmed : COLORS.link;
                ctx.lineWidth = isHighlighted ? 2.5 : 0.8;
                ctx.stroke();
              }}
              linkCanvasObjectMode={() => 'replace'}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
              cooldownTicks={300}
              d3AlphaDecay={0.025}
              d3VelocityDecay={0.4}
              d3AlphaMin={0.001}
              enableZoomInteraction={true}
              enablePanInteraction={true}
              enableNodeDrag={true}
              onEngineStop={() => {
                // 최초 시뮬레이션 멈추면 화면에 맞춤 (한 번만)
                if (!hasInitialCentered) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const currentFg = graphRef.current as any;
                  if (currentFg?.zoomToFit) {
                    currentFg.zoomToFit(400, 80);
                    console.log('onEngineStop: zoomToFit called');
                  }
                  setHasInitialCentered(true);
                }
              }}
            />
          </div>
          {/* 그래프 컨테이너 닫힘 - 아래 오버레이는 overflow-hidden 영향 안 받음 */}
          
          {/* 작품 호버 시 - 좌하단 태그 표시 제거 (2026-03-19 조카 요청) */}

          {/* 태그 호버 시 - 좌하단 태그명 + 연도 범위 제거 (2026-03-19 조카 요청) */}
          
          {/* 태그 호버 시 - 연결된 작품들 이미지 표시 (핀터레스트 스타일) */}
          {connectedArtworks.length > 0 && (
            <div 
              className="absolute top-2 left-2 z-10"
              style={{
                width: connectedArtworks.length <= 3 
                  ? `${connectedArtworks.length * 120}px`
                  : 'calc(100% - 16px)',
                maxWidth: 'calc(100% - 16px)',
                columnCount: Math.min(connectedArtworks.length, 8),
                columnGap: '2px',
                pointerEvents: 'auto',
              }}
              onMouseEnter={() => setIsOverArtworkPanel(true)}
              onMouseLeave={() => {
                setIsOverArtworkPanel(false);
                setPinnedArtworks([]);
                setPinnedTagName('');
              }}
            >
              {connectedArtworks.map((artwork, index) => {
                // 극단적 비율 보정: 최소 0.5, 최대 2.0으로 clamp
                const rawRatio = (artwork.width && artwork.height) ? artwork.width / artwork.height : 1;
                const aspectRatio = Math.max(0.5, Math.min(rawRatio, 2.0));
                // artwork ID에서 "artwork:" prefix 제거
                const artworkId = artwork.id.replace('artwork:', '');
                return (
                  <div
                    key={artwork.id}
                    className="mb-0.5 cursor-pointer group relative"
                    style={{
                      animation: `fadeIn 150ms ease-out ${index * 30}ms both`,
                      breakInside: 'avoid',
                      maxWidth: '200px',
                      maxHeight: '200px',
                    }}
                    onClick={() => {
                      const artworkData: Artwork = {
                        id: artworkId,
                        title: artwork.title || '',
                        year: artwork.year || 0,
                        image_url: artwork.image_url || '',
                        thumbnail_url: artwork.image_url || '',
                        order: 0,
                        is_featured: false,
                        show_watermark: true,
                        width: artwork.width || null,
                        height: artwork.height || null,
                        title_en: artwork.title_en || null,
                      } as Artwork;
                      // 태그 그룹 정보 저장
                      setTagGroupArtworks(connectedArtworks);
                      setTagGroupName(pinnedTagName || (hoveredNode?.type === 'tag' ? hoveredNode.name || '' : ''));
                      setTagGroupIndex(index);
                      setSelectedArtwork(artworkData);
                      setModalOpen(true);
                    }}
                  >
                    {artwork.image_url && (
                      <div 
                        className="relative w-full transition-transform duration-200 group-hover:scale-105"
                        style={{ paddingBottom: `${(1 / aspectRatio) * 100}%` }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={artwork.thumb_md || artwork.image_url || ''}
                          alt={artwork.title || ''}
                          className="absolute inset-0 w-full h-full object-contain"
                        />
                        {/* 호버 시 제목 오버레이 */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-end justify-center">
                          <span className="text-white text-[10px] leading-tight text-center px-1 pb-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-md">
                            {locale === 'en' ? (artwork.title_en || artwork.title) : artwork.title}
                            {artwork.year ? `, ${artwork.year}` : ''}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          
          {/* 작품 호버 시 - 마우스 근처에 해당 작품 이미지 표시 */}
          {hoveredArtwork && mousePos && hoveredArtwork.image_url && (() => {
            const rawRatio = (hoveredArtwork.width && hoveredArtwork.height) ? hoveredArtwork.width / hoveredArtwork.height : 1;
            const aspectRatio = Math.max(0.5, Math.min(rawRatio, 2.0));
            const itemWidth = 100;
            return (
              <div
                className="absolute pointer-events-none z-20 bg-[var(--background)] p-1 shadow-lg"
                style={{
                  left: Math.min(mousePos.x + 15, GRAPH_WIDTH - itemWidth - 20),
                  top: Math.min(mousePos.y + 15, GRAPH_HEIGHT - itemWidth / aspectRatio - 40),
                  width: itemWidth,
                }}
              >
                <div 
                  className="relative w-full"
                  style={{ paddingBottom: `${(1 / aspectRatio) * 100}%` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={hoveredArtwork.thumb_sm || hoveredArtwork.image_url || ''}
                    alt={hoveredArtwork.title || ''}
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                </div>
                <div className="text-xs text-center mt-1 text-[var(--foreground)]/70 truncate">
                  {hoveredArtwork.title}
                </div>
              </div>
            );
          })()}
        </div>

        {/* 물리 설정 패널 */}
        <div className="shrink-0 rounded-lg border border-[var(--foreground)]/10 bg-[var(--background)]" style={{ width: PANEL_WIDTH }}>
          <div className="w-full p-4 flex items-center justify-between">
            <h3 className="text-sm font-medium">{t.graph.physicsSettings}</h3>
            <button
              onClick={() => resetPhysics()}
              className="text-xs text-[var(--foreground)]/50 hover:text-[var(--foreground)]"
            >
              {t.graph.reset}
            </button>
          </div>
          
          <div className="px-4 pb-4 space-y-4">

            <Slider
              label={t.graph.repulsion}
              value={physics.chargeStrength}
              onChange={(v) => updatePhysics('chargeStrength', v)}
              min={10}
              max={300}
              step={10}
              leftLabel={t.graph.weak}
              rightLabel={t.graph.strong}
              slightly={t.graph.slightly}
              quite={t.graph.quite}
              normal={t.graph.normal}
            />

            <Slider
              label={t.graph.centerForce}
              value={physics.centerStrength}
              onChange={(v) => updatePhysics('centerStrength', v)}
              min={0}
              max={0.5}
              step={0.02}
              leftLabel={t.graph.weak}
              rightLabel={t.graph.strong}
              slightly={t.graph.slightly}
              quite={t.graph.quite}
              normal={t.graph.normal}
            />

            <Slider
              label={t.graph.linkDistance}
              value={physics.linkDistance}
              onChange={(v) => updatePhysics('linkDistance', v)}
              min={20}
              max={150}
              step={5}
              leftLabel={t.graph.short}
              rightLabel={t.graph.long}
              slightly={t.graph.slightly}
              quite={t.graph.quite}
              normal={t.graph.normal}
            />

            <Slider
              label={t.graph.linkStrength}
              value={physics.linkStrength}
              onChange={(v) => updatePhysics('linkStrength', v)}
              min={0}
              max={1}
              step={0.05}
              leftLabel={t.graph.weak}
              rightLabel={t.graph.strong}
              slightly={t.graph.slightly}
              quite={t.graph.quite}
              normal={t.graph.normal}
            />

            <Slider
              label={t.graph.nodeSize}
              value={physics.nodeSize}
              onChange={(v) => updatePhysics('nodeSize', v)}
              min={0.5}
              max={2}
              step={0.1}
              leftLabel={t.graph.small}
              rightLabel={t.graph.large}
              slightly={t.graph.slightly}
              quite={t.graph.quite}
              normal={t.graph.normal}
            />

          <div className="pt-2 border-t border-[var(--foreground)]/10">
            <p className="text-xs text-[var(--foreground)]/40 leading-relaxed">
              {t.graph.physicsHelp.repulsion}<br/>
              {t.graph.physicsHelp.center}<br/>
              {t.graph.physicsHelp.distance}<br/>
              {t.graph.physicsHelp.strength}
            </p>
          </div>
          </div>
        </div>
      </div>

      {/* 범례 + 조작 안내 */}
      <div className="flex items-center justify-between mt-4 text-xs text-[var(--foreground)]/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.artwork }} />
            <span>{t.graph.artwork}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.tag }} />
            <span>{t.graph.tag}</span>
          </div>
        </div>
        <div>
          {t.graph.help2d}
        </div>
      </div>

      {/* 작품 모달 */}
      {modalOpen && selectedArtwork && (
        <ArtworkModal
          artwork={selectedArtwork}
          onClose={() => {
            setModalOpen(false);
            setTagGroupArtworks([]);
            setTagGroupName('');
            setTagGroupIndex(0);
          }}
          hasPrev={tagGroupArtworks.length > 0 && tagGroupIndex > 0}
          hasNext={tagGroupArtworks.length > 0 && tagGroupIndex < tagGroupArtworks.length - 1}
          onPrev={() => {
            if (tagGroupIndex > 0) {
              const prevIdx = tagGroupIndex - 1;
              const prev = tagGroupArtworks[prevIdx];
              const prevId = prev.id.replace('artwork:', '');
              setTagGroupIndex(prevIdx);
              setSelectedArtwork({
                id: prevId,
                title: prev.title || '',
                year: prev.year || 0,
                image_url: prev.image_url || '',
                thumbnail_url: prev.image_url || '',
                order: 0,
                is_featured: false,
                show_watermark: true,
                width: prev.width || null,
                height: prev.height || null,
                title_en: prev.title_en || null,
              } as Artwork);
            }
          }}
          onNext={() => {
            if (tagGroupIndex < tagGroupArtworks.length - 1) {
              const nextIdx = tagGroupIndex + 1;
              const next = tagGroupArtworks[nextIdx];
              const nextId = next.id.replace('artwork:', '');
              setTagGroupIndex(nextIdx);
              setSelectedArtwork({
                id: nextId,
                title: next.title || '',
                year: next.year || 0,
                image_url: next.image_url || '',
                thumbnail_url: next.image_url || '',
                order: 0,
                is_featured: false,
                show_watermark: true,
                width: next.width || null,
                height: next.height || null,
                title_en: next.title_en || null,
              } as Artwork);
            }
          }}
          groupLabel={tagGroupArtworks.length > 0 ? `#${tagGroupName} ${tagGroupIndex + 1}/${tagGroupArtworks.length}` : undefined}
          artworkTags={tagGroupArtworks.length === 0 ? clickedArtworkTags : undefined}
          onTagClick={handleTagClickFromModal}
          preloadImages={[
            tagGroupIndex > 0 ? tagGroupArtworks[tagGroupIndex - 1]?.image_url || '' : '',
            tagGroupIndex < tagGroupArtworks.length - 1 ? tagGroupArtworks[tagGroupIndex + 1]?.image_url || '' : '',
          ].filter(u => u !== '') as string[]}
        />
      )}
      
      {/* fadeIn 애니메이션 */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
