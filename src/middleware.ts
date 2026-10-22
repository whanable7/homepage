import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { adminReturnTo } from "@/lib/admin-return-to";
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (
    pathname.startsWith("/api/") &&
    !["GET", "HEAD", "OPTIONS"].includes(request.method)
  ) {
    const origin = request.headers.get("origin");
    if (
      request.headers.get("sec-fetch-site") === "cross-site" ||
      (origin &&
        new URL(origin).host !==
          (request.headers.get("host") || request.nextUrl.host))
    )
      return NextResponse.json(
        { error: "잘못된 요청 출처입니다." },
        { status: 403 },
      );
  }
  const adminPage =
    pathname.startsWith("/admin") && pathname !== "/admin/login";
  const privateRead =
    pathname.startsWith("/api/tags") ||
    pathname === "/api/admin-settings" ||
    /\/api\/portfolio\/[^/]+\/tags/.test(pathname);
  const mutation =
    pathname.startsWith("/api/") &&
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    !["/api/auth", "/api/contact", "/api/files/upload"].includes(pathname);
  if (adminPage || privateRead || mutation) {
    if (!(await verifySession(request.cookies.get(SESSION_COOKIE)?.value))) {
      if (adminPage) {
        const login = new URL("/admin/login", request.url);
        login.searchParams.set(
          "next",
          adminReturnTo(pathname + request.nextUrl.search),
        );
        return NextResponse.redirect(login);
      }
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );
    }
  }
  const response = NextResponse.next();
  if (pathname.startsWith("/api/"))
    response.headers.set("Cache-Control", "no-store");
  return response;
}
export const config = { matcher: ["/admin/:path*", "/api/:path*"] };
