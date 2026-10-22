import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  getArchive,
  saveArchiveDraft,
  publishArchive,
  publishFeatured,
  archiveSeed,
  emptyLayout,
} from "@/lib/archive";
import { ConflictError, mutateDocument } from "@/lib/archive-store";
import { getPortfolio } from "@/lib/data";
import { validateYearOrder, currentYearOrder } from "@/lib/year-order";
import type { ArchiveLayout } from "@/types/archive";
import { validateSequencePositions } from "@/lib/sequence-layout";
export async function GET() {
  if (!(await isAuthenticated()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getArchive());
}
export async function PUT(request: NextRequest) {
  if (!(await isAuthenticated()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { action, layout, revision, confirmEmptyRelations } =
      await request.json();
    if (
      !["save", "publish", "publish-featured", "reset", "restore"].includes(
        action,
      )
    )
      throw new Error("저장 작업을 확인해 주세요.");
    if (typeof revision !== "string" || !revision)
      throw new Error("저장 버전이 필요합니다.");
    if (action === "publish-featured")
      return NextResponse.json(await publishFeatured(revision));
    if (action === "publish")
      return NextResponse.json(
        await publishArchive(revision, confirmEmptyRelations === true),
      );
    if (action === "reset")
      return NextResponse.json(
        await mutateDocument(
          "archive",
          await archiveSeed(),
          (state) => ({
            ...state,
            backups: [
              ...state.backups,
              { savedAt: new Date().toISOString(), layout: state.draft },
            ].slice(-20),
            draft: emptyLayout(),
          }),
          revision,
        ),
      );
    if (action === "restore")
      return NextResponse.json(
        await mutateDocument(
          "archive",
          await archiveSeed(),
          (state) => {
            const last = state.backups.at(-1);
            if (!last) throw new Error("백업이 없습니다.");
            return { ...state, draft: structuredClone(last.layout) };
          },
          revision,
        ),
      );
    const portfolio = await getPortfolio();
    const ids = new Set(portfolio.map((w) => w.id));
    const value = layout as ArchiveLayout;
    if (
      !value ||
      !Array.isArray(value.ecosystem) ||
      !Array.isArray(value.cosmos) ||
      !Array.isArray(value.sequences) ||
      !value.stars ||
      !value.excluded
    )
      throw new Error("분류 형식을 확인해 주세요.");
    if (
      value.ecosystem.length + value.cosmos.length > 500 ||
      value.sequences.length > 100 ||
      !Number.isInteger(value.seed)
    )
      throw new Error("분류 수 또는 배치 값을 확인해 주세요.");
    for (const g of [...value.ecosystem, ...value.cosmos]) {
      if (
        typeof g.id !== "string" ||
        typeof g.name !== "string" ||
        g.name.length > 250 ||
        !Array.isArray(g.artworkIds) ||
        g.artworkIds.some((id) => !ids.has(id))
      )
        throw new Error("그룹의 작품 목록을 확인해 주세요.");
      if (
        g.edges?.some(
          (e) =>
            !Array.isArray(e) ||
            e.length !== 2 ||
            e.some((id) => !g.artworkIds.includes(id)),
        )
      )
        throw new Error("그룹 연결을 확인해 주세요.");
    }
    if (
      Object.entries(value.stars).some(
        ([id, size]) => !ids.has(id) || ![1, 2, 3].includes(size),
      )
    )
      throw new Error("별 크기를 확인해 주세요.");
    for (const [view, excluded] of Object.entries(value.excluded)) {
      if (
        !["ecosystem", "cosmos", "strata", "years"].includes(view) ||
        !Array.isArray(excluded) ||
        excluded.some((id) => !ids.has(id))
      )
        throw new Error("보기별 제외 작품을 확인해 주세요.");
    }
    const titlesValid = (entry: {
      id: string;
      title: string;
      title_en: string;
    }) =>
      typeof entry.id === "string" &&
      typeof entry.title === "string" &&
      typeof entry.title_en === "string" &&
      entry.title.length <= 500 &&
      entry.title_en.length <= 500;
    if (
      new Set(value.sequences.map((s) => s.id)).size !== value.sequences.length
    )
      throw new Error("흐름 이름을 확인해 주세요.");
    for (const sequence of value.sequences) {
      if (
        !titlesValid(sequence) ||
        !Array.isArray(sequence.steps) ||
        sequence.steps.length > 200 ||
        new Set(sequence.steps.map((s) => s.id)).size !== sequence.steps.length
      )
        throw new Error("흐름의 단계를 확인해 주세요.");
      for (const step of sequence.steps) {
        if (
          (step.anchorX !== undefined &&
            (!Number.isFinite(step.anchorX) ||
              step.anchorX < 70 ||
              step.anchorX > 50000)) ||
          !titlesValid(step) ||
          !Array.isArray(step.artworkIds) ||
          step.artworkIds.some((id) => !ids.has(id))
        )
          throw new Error("흐름의 작품을 확인해 주세요.");
      }
      validateSequencePositions(sequence);
    }
    for (const groups of [value.ecosystem, value.cosmos])
      if (new Set(groups.map((g) => g.id)).size !== groups.length)
        throw new Error("중복된 그룹을 확인해 주세요.");
    validateYearOrder(value.yearOrder, portfolio);
    value.yearOrder = currentYearOrder(value, portfolio);
    return NextResponse.json(await saveArchiveDraft(value, revision));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "저장 실패" },
      { status: error instanceof ConflictError ? 409 : 400 },
    );
  }
}
