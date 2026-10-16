import { NextRequest, NextResponse } from "next/server";
import { head, get } from "@vercel/blob";
import { isAuthenticated } from "@/lib/auth";
import { mutateDocument } from "@/lib/archive-store";
import type { ArchiveFile } from "@/types/archive";
export async function POST(request: NextRequest) {
  if (!(await isAuthenticated()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { pathname, filename } = await request.json();
    if (
      typeof pathname !== "string" ||
      !/^documents\/[a-f0-9-]{36}\.pdf$/.test(pathname)
    )
      throw new Error("파일 경로를 확인해 주세요.");
    const options = { token: process.env.ARCHIVE_BLOB_READ_WRITE_TOKEN };
    const metadata = await head(pathname, options);
    if (
      metadata.contentType !== "application/pdf" ||
      metadata.size > 30 * 1024 * 1024
    )
      throw new Error("PDF 파일을 확인해 주세요.");
    const file = await get(pathname, {
      access: "private",
      ...options,
      useCache: false,
    });
    const reader = file?.stream?.getReader();
    const prefix = await reader?.read();
    await reader?.cancel();
    if (
      !prefix?.value ||
      new TextDecoder().decode(prefix.value.slice(0, 5)) !== "%PDF-"
    )
      throw new Error("올바른 PDF 파일이 아닙니다.");
    const record: ArchiveFile = {
      id: crypto.randomUUID(),
      pathname,
      filename: String(filename || "document.pdf")
        .replace(/[\r\n"\\/]/g, "_")
        .slice(0, 200),
      size: metadata.size,
      contentType: "application/pdf",
      created_at: new Date().toISOString(),
    };
    await mutateDocument("files", [] as ArchiveFile[], (items) => [
      ...items,
      record,
    ]);
    return NextResponse.json({ id: record.id, url: `/files/${record.id}` });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "파일 등록 실패" },
      { status: 400 },
    );
  }
}
