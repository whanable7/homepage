import { getPublishedTexts, mutateContent } from "@/lib/public-content";
import { NextRequest, NextResponse } from "next/server";
import { readDocument, ConflictError } from "@/lib/archive-store";
import { isAuthenticated } from "@/lib/auth";
import type { ArchiveText } from "@/types/archive";
export async function GET(request: NextRequest) {
  if (await isAuthenticated())
    return NextResponse.json(await readDocument("texts", [] as ArchiveText[]), {
      headers: { "Cache-Control": "no-store" },
    });
  const texts = await getPublishedTexts();
  const locale =
    request.nextUrl.searchParams.get("locale") === "en" ? "en" : "ko";
  return NextResponse.json(
    texts
      .filter((t) => !t.deleted_at && t[locale].published)
      .map((t) => ({
        id: t.id,
        category: t.category,
        date: t.date,
        ...t[locale],
      })),
  );
}
export async function PUT(request: NextRequest) {
  if (!(await isAuthenticated()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { text, revision } = await request.json();
    if (typeof revision !== "string" || !revision)
      throw new Error("저장 버전을 불러온 뒤 다시 시도해 주세요.");
    const t = text as ArchiveText;
    if (
      !t ||
      typeof t.id !== "string" ||
      !["notes", "studies"].includes(t.category) ||
      !t.ko ||
      !t.en
    )
      throw new Error("글 형식을 확인해 주세요.");
    for (const locale of ["ko", "en"] as const) {
      const version = t[locale];
      if (
        typeof version.title !== "string" ||
        version.title.length > 500 ||
        !Array.isArray(version.blocks) ||
        version.blocks.length > 1000 ||
        typeof version.published !== "boolean"
      )
        throw new Error("제목과 본문을 확인해 주세요.");
      if (version.published && !version.title.trim())
        throw new Error("공개할 글의 제목을 입력해 주세요.");
      for (const b of version.blocks)
        if (
          typeof b.text !== "string" ||
          b.text.length > 50000 ||
          !["left", "right", "center", "justify"].includes(b.align) ||
          !["paragraph", "heading", "quote"].includes(b.style) ||
          !Number.isFinite(b.size) ||
          b.size < 12 ||
          b.size > 64 ||
          (b.lineHeight !== undefined &&
            (!Number.isFinite(b.lineHeight) ||
              b.lineHeight < 1 ||
              b.lineHeight > 3)) ||
          (b.paragraphSpacing !== undefined &&
            (!Number.isFinite(b.paragraphSpacing) ||
              b.paragraphSpacing < 0 ||
              b.paragraphSpacing > 4)) ||
          !/^#[a-f0-9]{6}$/i.test(b.color)
        )
          throw new Error("본문 서식을 확인해 주세요.");
    }
    return NextResponse.json(
      await mutateContent(
        "texts",
        [] as ArchiveText[],
        (items) => {
          const updated = { ...t, updated_at: new Date().toISOString() },
            index = items.findIndex((i) => i.id === t.id);
          if (index < 0) return [updated, ...items];
          items[index] = updated;
          return items;
        },
        revision,
      ),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "저장 실패" },
      { status: error instanceof ConflictError ? 409 : 400 },
    );
  }
}
