import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { isAuthenticated } from "@/lib/auth";
export async function POST(request: NextRequest) {
  try {
    const result = await handleUpload({
      body: (await request.json()) as HandleUploadBody,
      request,
      token: process.env.ARCHIVE_BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async (pathname) => {
        if (!(await isAuthenticated())) throw new Error("로그인이 필요합니다.");
        if (!/^documents\/[a-f0-9-]{36}\.pdf$/.test(pathname))
          throw new Error("잘못된 파일 경로입니다.");
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: 30 * 1024 * 1024,
          addRandomSuffix: false,
          validUntil: Date.now() + 10 * 60 * 1000,
        };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PDF 업로드 실패" },
      { status: 400 },
    );
  }
}
