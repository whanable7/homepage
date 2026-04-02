import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminSettings, updateAdminSettings } from '@/lib/data';

const SESSION_COOKIE_NAME = 'admin_session';
async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return !!cookieStore.get(SESSION_COOKIE_NAME);
}

export async function GET() {
  return NextResponse.json(await getAdminSettings());
}

export async function PUT(request: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  await updateAdminSettings(body);
  return NextResponse.json(body);
}
