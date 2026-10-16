import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json(
    { error: "Strata 관리 화면에서 작품을 선택해 색 분석을 실행해 주세요." },
    { status: 410 },
  );
}
