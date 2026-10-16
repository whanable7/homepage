import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getTags, updateTags } from "@/lib/data";

export async function GET() {
  return NextResponse.json(await getTags());
}

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const tags = await getTags();
  const newTag = {
    ...body,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  };
  tags.push(newTag);
  await updateTags(tags);
  return NextResponse.json(newTag, { status: 201 });
}
