import { NextResponse } from 'next/server';
import { getPortfolio } from '@/lib/data';

export async function GET() {
  const artworks = await getPortfolio();
  const colored = artworks
    .filter((a: Record<string, unknown>) => a.dominant_color)
    .map((a: Record<string, unknown>) => ({
      id: a.id, title: a.title, title_en: a.title_en,
      image_url: a.image_url, thumbnail_url: a.thumbnail_url,
      dominant_color: a.dominant_color, year: a.year,
    }));

  return NextResponse.json(colored);
}
