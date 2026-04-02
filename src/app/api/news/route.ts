import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getNews, updateNews } from '@/lib/data';

const SESSION_COOKIE_NAME = 'admin_session';
async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return !!cookieStore.get(SESSION_COOKIE_NAME);
}

export async function GET() {
  return NextResponse.json(await getNews());
}

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const news = await getNews();
  const newItem = { ...body, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  news.push(newItem);
  await updateNews(news);
  return NextResponse.json(newItem, { status: 201 });
}
