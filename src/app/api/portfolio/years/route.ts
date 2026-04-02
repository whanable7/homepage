import { NextResponse } from 'next/server';
import { getPortfolio } from '@/lib/data';

export async function GET() {
  const artworks = await getPortfolio();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const years = [...new Set(artworks.map((a: any) => a.year).filter(Boolean))].sort((a, b) => b - a);
  return NextResponse.json(years);
}
