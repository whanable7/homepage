import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { ConflictError, mutateDocument } from "@/lib/archive-store";
import { appearanceSeed, validateAppearance } from "@/lib/appearance";
import { getAppearance } from "@/lib/appearance-store";
export async function GET() {
  if (!(await isAuthenticated()))
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );
  return NextResponse.json(await getAppearance(), {
    headers: { "Cache-Control": "no-store" },
  });
}
export async function PUT(request: NextRequest) {
  if (!(await isAuthenticated()))
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );
  try {
    const { action, revision, settings } = await request.json();
    if (
      !["save", "apply", "restore"].includes(action) ||
      typeof revision !== "string" ||
      !revision
    )
      throw new Error("저장 작업과 버전을 확인해 주세요.");
    const value = action === "restore" ? null : validateAppearance(settings);
    const doc = await mutateDocument(
      "appearance",
      appearanceSeed(),
      (state) => {
        if (action === "restore") {
          const previous = state.previous.at(-1);
          if (!previous) throw new Error("이전 설정이 없습니다.");
          return { ...state, draft: { ...previous } };
        }
        if (action === "save") return { ...state, draft: value! };
        return {
          draft: value!,
          published: value!,
          previous: [...state.previous, state.published].slice(-20),
        };
      },
      revision,
    );
    return NextResponse.json(doc);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "설정 저장 실패" },
      { status: error instanceof ConflictError ? 409 : 400 },
    );
  }
}
