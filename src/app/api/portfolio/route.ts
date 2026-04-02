import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getPortfolio, addArtwork } from '@/lib/data';

const SESSION_COOKIE_NAME = 'admin_session';

async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  return !!session;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const minimal = searchParams.get('minimal') === 'true';

  let artworks = await getPortfolio();

  if (minimal) {
    artworks = artworks.map((a: Record<string, unknown>) => ({
      id: a.id, title: a.title, title_en: a.title_en, year: a.year,
      image_url: a.image_url, thumbnail_url: a.thumbnail_url,
      dominant_color: a.dominant_color, is_featured: a.is_featured,
      order: a.order, category_id: a.category_id,
    }));
  }

  const headers = new Headers();
  headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

  return NextResponse.json(artworks, { headers });
}

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const artwork = await addArtwork(body);
    return NextResponse.json(artwork, { status: 201 });
  } catch (err) {
    console.error('Artwork POST error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Invalid request: ${message}` }, { status: 400 });
  }
}
