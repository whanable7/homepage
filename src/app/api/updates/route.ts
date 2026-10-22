import { NextResponse } from "next/server";
import { publicVersions } from "@/lib/public-content";
export async function GET() {
  try {
    return NextResponse.json(await publicVersions(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Updates temporarily unavailable" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store", "Retry-After": "30" },
      },
    );
  }
}
