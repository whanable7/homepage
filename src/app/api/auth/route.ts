import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { checkPassword, isAuthenticated } from "@/lib/auth";
import { createSession, SESSION_COOKIE, SESSION_SECONDS } from "@/lib/session";
export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    if (!(await checkPassword(password))) {
      await new Promise((r) => setTimeout(r, 400));
      return NextResponse.json(
        { error: "비밀번호를 확인해 주세요." },
        { status: 401 },
      );
    }
    (await cookies()).set(SESSION_COOKIE, await createSession(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_SECONDS,
    });
    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "로그인 설정 또는 저장 공간을 확인해 주세요." },
      { status: 503 },
    );
  }
}
export async function DELETE() {
  (await cookies()).delete(SESSION_COOKIE);
  return NextResponse.json({ success: true });
}
export async function GET() {
  const authenticated = await isAuthenticated();
  return NextResponse.json(
    { authenticated },
    {
      status: authenticated ? 200 : 401,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
