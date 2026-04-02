import { NextResponse } from 'next/server';
import { getPortfolio, getTags } from '@/lib/data';

interface MindmapNode {
  id: string;
  type: 'artwork' | 'tag';
  title?: string;
  title_en?: string | null;
  year?: number;
  image_url?: string;
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

export async function GET() {
  try {
    const artworks = await getPortfolio();
    const tags = await getTags();
    const totalArtworks = artworks.length;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const artworkTags: { artwork_id: string; tag_id: string }[] = [];
    artworks.forEach((a: any) => {
      (a.tags || []).forEach((t: any) => {
        artworkTags.push({ artwork_id: a.id, tag_id: t.id });
      });
    });

    const tagArtworkCount = new Map<string, number>();
    artworkTags.forEach(at => {
      tagArtworkCount.set(at.tag_id, (tagArtworkCount.get(at.tag_id) || 0) + 1);
    });

    const universalTags = new Set<string>();
    tagArtworkCount.forEach((count, tagId) => {
      if (count === totalArtworks && totalArtworks > 0) universalTags.add(tagId);
    });

    const artworkConnectionCount = new Map<string, number>();
    artworkTags.forEach(at => {
      if (universalTags.has(at.tag_id)) return;
      artworkConnectionCount.set(at.artwork_id, (artworkConnectionCount.get(at.artwork_id) || 0) + 1);
    });

    const nodes: MindmapNode[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    artworks.forEach((artwork: any) => {
      nodes.push({
        id: `artwork:${artwork.id}`, type: 'artwork',
        title: artwork.title, title_en: artwork.title_en, year: artwork.year,
        image_url: artwork.image_url, width: artwork.width, height: artwork.height,
        connection_count: artworkConnectionCount.get(artwork.id) || 0,
      });
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tags.forEach((tag: any) => {
      if (universalTags.has(tag.id)) return;
      const count = tagArtworkCount.get(tag.id) || 0;
      if (count === 0) return;
      nodes.push({ id: `tag:${tag.id}`, type: 'tag', name: tag.name, artwork_count: count });
    });

    const edges: MindmapEdge[] = [];
    artworkTags.forEach(at => {
      if (universalTags.has(at.tag_id)) return;
      edges.push({ source: `artwork:${at.artwork_id}`, target: `tag:${at.tag_id}` });
    });

    return NextResponse.json({
      nodes, edges,
      stats: { artworks: artworks.length, tags: nodes.filter(n => n.type === 'tag').length, edges: edges.length, universal_tags_excluded: universalTags.size },
    });
  } catch (error) {
    console.error('Error fetching mindmap data:', error);
    return NextResponse.json({ error: 'Failed to fetch mindmap data' }, { status: 500 });
  }
}
