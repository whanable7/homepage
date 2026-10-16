import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { readDocument } from "@/lib/archive-store";
export async function GET() {
  const names = ["archive", "about", "texts", "news", "exhibitions"],
    documents = await Promise.all(names.map((name) => readDocument(name, {})));
  return NextResponse.json(
    {
      version: createHash("sha256")
        .update(documents.map((d) => d.revision).join("|"))
        .digest("hex"),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
