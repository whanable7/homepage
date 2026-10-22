import { readPublicContent, mutateContent } from "./public-content";
import { NextRequest, NextResponse } from "next/server";
import { readDocument } from "./archive-store";
import { isAuthenticated } from "./auth";
import { isPublicName } from "./public-content-shape";
type Row = Record<string, unknown> & { id: string; deleted_at?: string };
export function recordApi(name: string) {
  const read = async () => {
    if (isPublicName(name) && !(await isAuthenticated()))
      return readPublicContent<Row[]>(name);
    return (await readDocument(name, [] as Row[])).data.filter(
      (r) => !r.deleted_at,
    );
  };
  return {
    list: async () => NextResponse.json(await read()),
    get: async (
      _request: NextRequest,
      { params }: { params: Promise<{ id: string }> },
    ) => {
      const { id } = await params,
        item = (await read()).find((r) => r.id === id);
      return NextResponse.json(item || { error: "Not found" }, {
        status: item ? 200 : 404,
      });
    },
    create: async (request: NextRequest) => {
      if (!(await isAuthenticated()))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      try {
        const body = await request.json();
        if (!body || typeof body !== "object" || !(body.title || body.name))
          throw new Error("제목 또는 이름을 입력해 주세요.");
        const item = {
          ...body,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await mutateContent(name, [] as Row[], (rows) => [...rows, item]);
        return NextResponse.json(item, { status: 201 });
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "저장 실패" },
          { status: 400 },
        );
      }
    },
    patch: async (
      request: NextRequest,
      { params }: { params: Promise<{ id: string }> },
    ) => {
      if (!(await isAuthenticated()))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const { id } = await params,
        body = await request.json();
      let result: Row | null = null;
      await mutateContent(name, [] as Row[], (rows) =>
        rows.map((row) => {
          if (row.id !== id || row.deleted_at) return row;
          const updated: Row = {
            ...row,
            ...body,
            id,
            created_at: row.created_at,
            updated_at: new Date().toISOString(),
          };
          result = updated;
          return updated;
        }),
      );
      return NextResponse.json(result || { error: "Not found" }, {
        status: result ? 200 : 404,
      });
    },
    remove: async (
      _request: NextRequest,
      { params }: { params: Promise<{ id: string }> },
    ) => {
      if (!(await isAuthenticated()))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const { id } = await params;
      let found = false;
      await mutateContent(name, [] as Row[], (rows) =>
        rows.map((row) => {
          if (row.id !== id || row.deleted_at) return row;
          found = true;
          return { ...row, deleted_at: new Date().toISOString() };
        }),
      );
      return NextResponse.json(
        found ? { success: true } : { error: "Not found" },
        { status: found ? 200 : 404 },
      );
    },
  };
}
