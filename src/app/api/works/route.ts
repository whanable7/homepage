import { NextRequest, NextResponse } from "next/server";
import { publicLayout } from "@/lib/archive";
import { getPublicArchive } from "@/lib/public-content";
export async function GET(request: NextRequest) {
  const snapshot = await getPublicArchive();
  if (request.nextUrl.searchParams.get("version"))
    return NextResponse.json(
      { revision: snapshot.revision },
      { headers: { "Cache-Control": "no-store" } },
    );
  return NextResponse.json(
    { ...snapshot, layout: publicLayout(snapshot.layout) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
