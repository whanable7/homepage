import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { readDocument } from "@/lib/archive-store";
import { getPublishedTexts, getPublicFiles } from "@/lib/public-content";
import { isAuthenticated } from "@/lib/auth";
import type { ArchiveText, ArchiveFile } from "@/types/archive";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params,
    admin = await isAuthenticated();
  const texts = admin
    ? (await readDocument("texts", [] as ArchiveText[])).data
    : await getPublishedTexts();
  if (
    !admin &&
    !texts.some(
      (t) =>
        !t.deleted_at &&
        (["ko", "en"] as const).some(
          (locale) => t[locale].published && t[locale].pdfId === id,
        ),
    )
  )
    return new NextResponse(null, { status: 404 });
  const files = admin
    ? (await readDocument("files", [] as ArchiveFile[])).data
    : await getPublicFiles();
  const record = files.find((f) => f.id === id);
  if (!record) return new NextResponse(null, { status: 404 });
  const result = await get(record.pathname, {
    access: "private",
    token: process.env.ARCHIVE_BLOB_READ_WRITE_TOKEN,
    useCache: true,
  });
  if (!result?.stream) return new NextResponse(null, { status: 404 });
  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${request.nextUrl.searchParams.has("download") ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(record.filename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
    },
  });
}
