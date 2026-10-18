import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getPortfolio, addArtwork } from "@/lib/data";
import { getArchive } from "@/lib/archive";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const minimal = searchParams.get("minimal") === "true";

  let artworks = (await isAuthenticated())
    ? (await getPortfolio()).filter((a) => !a.deleted_at)
    : (await getArchive()).data.published.works;

  if (minimal) {
    artworks = artworks.map((a: Record<string, unknown>) => ({
      id: a.id,
      title: a.title,
      title_en: a.title_en,
      year: a.year,
      image_url: a.image_url,
      thumbnail_url: a.thumbnail_url,
      dominant_color: a.dominant_color,
      is_featured: a.is_featured,
      order: a.order,
      category_id: a.category_id,
    }));
  }

  const headers = new Headers();
  headers.set("Cache-Control", "no-store");

  return NextResponse.json(artworks, { headers });
}

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (
      !body.title?.trim() ||
      !Number.isInteger(body.year) ||
      !/^https:\/\//.test(body.image_url || "")
    )
      return NextResponse.json(
        { error: "이미지, 제목, 제작연도를 확인해 주세요." },
        { status: 400 },
      );
    const artwork = await addArtwork({
      ...body,
      status: body.status === "published" ? "published" : "draft",
    });
    return NextResponse.json(artwork, { status: 201 });
  } catch (err) {
    console.error("Artwork POST error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Invalid request: ${message}` },
      { status: 400 },
    );
  }
}
