import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { analyzeArtworkImage } from "@/lib/palette";
export async function POST(request: NextRequest) {
  if (!(await isAuthenticated()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { image_url } = await request.json();
    return NextResponse.json(
      await analyzeArtworkImage(
        image_url,
        process.env.CLOUDINARY_CLOUD_NAME || "",
      ),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "색 분석 실패" },
      { status: 400 },
    );
  }
}
