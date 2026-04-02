import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAbout, updateAbout } from '@/lib/data';

const SESSION_COOKIE_NAME = 'admin_session';
async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return !!cookieStore.get(SESSION_COOKIE_NAME);
}

export async function GET() {
  return NextResponse.json(await getAbout());
}

export async function PUT(request: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const current = await getAbout();
  const updated = { ...current, ...body, updated_at: new Date().toISOString() };
  await updateAbout(updated);
  return NextResponse.json(updated);
}
