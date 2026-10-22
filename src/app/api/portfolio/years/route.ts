import { NextResponse } from "next/server";
import { getPublicArchive } from "@/lib/public-content";

export async function GET() {
  const artworks = (await getPublicArchive()).works;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const years = [...new Set(artworks.map((a) => a.year).filter(Boolean))].sort(
    (a, b) => b - a,
  );
  return NextResponse.json(years);
}
