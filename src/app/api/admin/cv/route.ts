import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { readDocument, ConflictError } from "@/lib/archive-store";
import {
  mutateContent,
  refreshPublicContent,
  PublicationRefreshError,
} from "@/lib/public-content";
import {
  applyCVCommand,
  cvSnapshot,
  exhibitionSections,
  type CVAbout,
  type CVRow,
  type CVCommand,
} from "@/lib/cv-editor";
async function snapshot() {
  const [a, e] = await Promise.all([
    readDocument("about", {} as CVAbout),
    readDocument("exhibitions", [] as CVRow[]),
  ]);
  return {
    ...cvSnapshot(a.data, e.data),
    revisions: { about: a.revision, exhibitions: e.revision },
  };
}
const reply = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function GET() {
  if (!(await isAuthenticated())) return reply({ error: "Unauthorized" }, 401);
  try {
    return reply(await snapshot());
  } catch {
    return reply({ error: "CV를 불러오지 못했습니다." }, 503);
  }
}
export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) return reply({ error: "Unauthorized" }, 401);
  try {
    const c = (await request.json()) as CVCommand;
    if (c.action === ("refresh" as string)) {
      await Promise.all([
        refreshPublicContent("about"),
        refreshPublicContent("exhibitions"),
      ]);
      return reply({ saved: true });
    }
    if (typeof c.revision !== "string")
      return reply({ error: "저장 버전을 확인해 주세요." }, 400);
    const now = new Date().toISOString();
    if (
      exhibitionSections.includes(c.section || "") &&
      ["save", "delete", "restore"].includes(c.action)
    ) {
      await mutateContent(
        "exhibitions",
        [] as CVRow[],
        (rows) => applyCVCommand({}, rows, c, now) as CVRow[],
        c.revision,
      );
    } else {
      const ex = exhibitionSections.includes(c.section || "")
        ? (await readDocument("exhibitions", [] as CVRow[])).data
        : [];
      await mutateContent(
        "about",
        {} as CVAbout,
        (a) => applyCVCommand(a, ex, c, now) as CVAbout,
        c.revision,
      );
    }
    return reply({ saved: true });
  } catch (error) {
    if (error instanceof PublicationRefreshError)
      return reply({
        saved: true,
        refreshPending: true,
        message: "저장은 완료했습니다. 공개 화면 갱신을 다시 시도해 주세요.",
      });
    return reply(
      {
        error: error instanceof Error ? error.message : "저장하지 못했습니다.",
      },
      error instanceof ConflictError ? 409 : 400,
    );
  }
}
