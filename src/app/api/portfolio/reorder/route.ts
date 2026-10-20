import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { reorderFeaturedArtworks } from "@/lib/data";
export async function PUT(request: NextRequest) {
  if (!(await isAuthenticated()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { ids } = await request.json();
    const works = await reorderFeaturedArtworks(ids);
    return NextResponse.json({ success: true, works });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "저장 실패" },
      { status: 400 },
    );
  }
}
