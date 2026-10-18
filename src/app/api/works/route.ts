import { NextRequest, NextResponse } from "next/server";
import { getArchive, publicLayout } from "@/lib/archive";
export async function GET(request: NextRequest) {
  const { data } = await getArchive(),
    snapshot = data.published;
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
