import { cvAboutKeys } from "@/lib/cv-editor";
import { readPublicContent, mutateContent } from "@/lib/public-content";
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { readDocument, ConflictError } from "@/lib/archive-store";
export async function GET() {
  const admin = await isAuthenticated();
  if (!admin)
    return NextResponse.json(await readPublicContent("about"), {
      headers: { "Cache-Control": "no-store" },
    });
  const doc = await readDocument("about", {} as Record<string, unknown>),
    about = { ...doc.data };
  return NextResponse.json(
    admin ? { ...about, _revision: doc.revision } : about,
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function PUT(request: NextRequest) {
  if (!(await isAuthenticated()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json(),
      revision = body._revision;
    delete body._revision;
    if (cvAboutKeys.some((key) => key in body))
      return NextResponse.json(
        { error: "CV 기록은 새 CV 관리 화면에서 저장해 주세요." },
        { status: 409 },
      );
    if (typeof revision !== "string")
      return NextResponse.json(
        { error: "최신 작가소개 화면을 다시 불러와 주세요." },
        { status: 409 },
      );
    const updated = await mutateContent(
      "about",
      {},
      (current) => ({
        ...current,
        ...body,
        updated_at: new Date().toISOString(),
      }),
      typeof revision === "string" ? revision : undefined,
    );
    return NextResponse.json({ ...updated.data, _revision: updated.revision });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "저장 실패" },
      { status: error instanceof ConflictError ? 409 : 400 },
    );
  }
}
