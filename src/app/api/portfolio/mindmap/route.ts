import { NextResponse } from 'next/server';
import { getPortfolio, getTags } from '@/lib/data';

// 이분 그래프 구조: artwork ↔ tag 연결
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

// GET /api/portfolio/mindmap - 이분 그래프 데이터 (artwork ↔ tag)
export async function GET() {
  try {
    const artworks = await getPortfolio();
    const tags = await getTags();

    const totalArtworks = artworks.length;

    // artwork.tags 배열에서 관계 추출
    const artworkTags: { artwork_id: string; tag_id: string }[] = [];
    artworks.forEach((artwork: { id: string; tags?: string[] }) => {
      (artwork.tags || []).forEach((tagId: string) => {
        artworkTags.push({ artwork_id: artwork.id, tag_id: tagId });
      });
    });

    // 태그별 작품 수
    const tagArtworkCount = new Map<string, number>();
    artworkTags.forEach(at => {
      tagArtworkCount.set(at.tag_id, (tagArtworkCount.get(at.tag_id) || 0) + 1);
    });

    // 유니버설 태그 필터링
    const universalTags = new Set<string>();
    tagArtworkCount.forEach((count, tagId) => {
      if (count === totalArtworks && totalArtworks > 0) {
        universalTags.add(tagId);
      }
    });

    // 작품별 연결 수
    const artworkConnectionCount = new Map<string, number>();
    artworkTags.forEach(at => {
      if (universalTags.has(at.tag_id)) return;
      artworkConnectionCount.set(
        at.artwork_id,
        (artworkConnectionCount.get(at.artwork_id) || 0) + 1
      );
    });

    const nodes: MindmapNode[] = [];

    // artwork 노드
    artworks.forEach((artwork: { id: string; title: string; title_en?: string | null; year?: number; thumbnail_url?: string; width?: number | null; height?: number | null }) => {
      nodes.push({
        id: `artwork:${artwork.id}`,
        type: 'artwork',
        title: artwork.title,
        title_en: artwork.title_en,
        year: artwork.year,
        thumbnail_url: artwork.thumbnail_url,
        width: artwork.width,
        height: artwork.height,
        connection_count: artworkConnectionCount.get(artwork.id) || 0,
      });
    });

    // tag 노드
    tags.forEach((tag: { id: string; name: string }) => {
      if (universalTags.has(tag.id)) return;
      const count = tagArtworkCount.get(tag.id) || 0;
      if (count === 0) return;

      nodes.push({
        id: `tag:${tag.id}`,
        type: 'tag',
        name: tag.name,
        artwork_count: count,
      });
    });

    // 엣지
    const edges: MindmapEdge[] = [];
    artworkTags.forEach(at => {
      if (universalTags.has(at.tag_id)) return;
      edges.push({
        source: `artwork:${at.artwork_id}`,
        target: `tag:${at.tag_id}`,
      });
    });

    return NextResponse.json({
      nodes,
      edges,
      stats: {
        artworks: artworks.length,
        tags: nodes.filter(n => n.type === 'tag').length,
        edges: edges.length,
        universal_tags_excluded: universalTags.size,
      },
    });
  } catch (error) {
    console.error('Error fetching mindmap data:', error);
    return NextResponse.json({ error: 'Failed to fetch mindmap data' }, { status: 500 });
  }
}
