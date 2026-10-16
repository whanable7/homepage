import { NextResponse } from "next/server";
import { getArchive } from "@/lib/archive";

export async function GET() {
  const artworks = (await getArchive()).data.published.works;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const years = [...new Set(artworks.map((a) => a.year).filter(Boolean))].sort(
    (a, b) => b - a,
  );
  return NextResponse.json(years);
}
