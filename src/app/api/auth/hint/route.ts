import { NextResponse } from "next/server";
import { getAdminSettings } from "@/lib/data";
export async function GET() {
  try {
    const settings = await getAdminSettings();
    return NextResponse.json(
      { password_hint: settings.password_hint || "" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { password_hint: "" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
