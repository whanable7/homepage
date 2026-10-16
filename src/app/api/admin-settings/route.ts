import { NextRequest, NextResponse } from "next/server";
import { getAdminSettings, updateAdminSettings } from "@/lib/data";
import { isAuthenticated, checkPassword } from "@/lib/auth";
export async function GET() {
  if (!(await isAuthenticated()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await getAdminSettings();
  return NextResponse.json(
    { password_hint: settings.password_hint || "" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function PUT(request: NextRequest) {
  if (!(await isAuthenticated()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  if (!(await checkPassword(body.current_password)))
    return NextResponse.json(
      { error: "현재 비밀번호를 확인해 주세요." },
      { status: 403 },
    );
  if (body.new_password)
    return NextResponse.json(
      { error: "이번 개편에서는 기존 비밀번호를 유지합니다." },
      { status: 400 },
    );
  const password_hint = String(body.password_hint || "").slice(0, 200);
  await updateAdminSettings({ password_hint });
  return NextResponse.json({ password_hint });
}
