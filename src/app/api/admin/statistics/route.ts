import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getVisitorReport } from "@/lib/analytics-server";
import type { StatisticsPeriod } from "@/lib/analytics-report";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!(await isAuthenticated()))
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401, headers },
    );
  const period = request.nextUrl.searchParams.get("period") || "day";
  if (!["day", "month", "year"].includes(period))
    return NextResponse.json(
      { error: "기간을 확인해 주세요." },
      { status: 400, headers },
    );
  return NextResponse.json(await getVisitorReport(period as StatisticsPeriod), {
    headers,
  });
}
