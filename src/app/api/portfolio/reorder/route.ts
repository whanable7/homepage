import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { mutateRecords } from "@/lib/data";
export async function PUT(request: NextRequest) {
  if (!(await isAuthenticated()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { ids } = await request.json();
    if (
      !Array.isArray(ids) ||
      ids.some((id) => typeof id !== "string") ||
      new Set(ids).size !== ids.length
    )
      throw new Error("순서를 확인해 주세요.");
    await mutateRecords("portfolio", (records) => {
      if (ids.some((id) => !records.some((w) => w.id === id)))
        throw new Error("없는 작품이 포함되어 있습니다.");
      return records.map((w) =>
        ids.includes(w.id)
          ? {
              ...w,
              featured_order: ids.indexOf(w.id),
              updated_at: new Date().toISOString(),
            }
          : w,
      );
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "저장 실패" },
      { status: 400 },
    );
  }
}
