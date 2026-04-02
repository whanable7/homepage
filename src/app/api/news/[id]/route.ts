import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getNewsById, getNews, updateNews } from '@/lib/data';

const SESSION_COOKIE_NAME = 'admin_session';
async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return !!cookieStore.get(SESSION_COOKIE_NAME);
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const news = await getNewsById(id);
  if (!news) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(news);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const allNews = await getNews();
  const idx = allNews.findIndex((n: { id: string }) => n.id === id);
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  allNews[idx] = { ...allNews[idx], ...body, updated_at: new Date().toISOString() };
  await updateNews(allNews);
  return NextResponse.json(allNews[idx]);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const allNews = await getNews();
  const filtered = allNews.filter((n: { id: string }) => n.id !== id);
  if (filtered.length === allNews.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await updateNews(filtered);
  return NextResponse.json({ success: true });
}
