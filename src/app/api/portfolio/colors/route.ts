import { NextResponse } from "next/server";
import { getPublicArchive } from "@/lib/public-content";

export async function GET() {
  const artworks = (await getPublicArchive()).works;
  const colored = artworks
    .filter((a) => a.dominant_color)
    .map((a) => ({
      id: a.id,
      title: a.title,
      title_en: a.title_en,
      image_url: a.image_url,
      thumbnail_url: a.thumbnail_url,
      dominant_color: a.dominant_color,
      year: a.year,
    }));

  return NextResponse.json(colored);
}
