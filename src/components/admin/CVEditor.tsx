"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUnsavedGuard } from "./useUnsavedGuard";
import { cvLabels } from "@/lib/cv";
import {
  cvFields,
  exhibitionSections,
  type CVRow,
  type CVCommand,
} from "@/lib/cv-editor";
type Snapshot = {
  order: string[];
  sections: Record<string, CVRow[]>;
  deleted: { section: string; row: CVRow }[];
  revisions: { about: string; exhibitions: string };
};
type Edit = {
  section: string;
  id: string;
  fields: Record<string, string>;
  revision: string;
};
export default function CVEditor() {
  const [data, setData] = useState<Snapshot | null>(null),
    [order, setOrder] = useState<string[]>([]),
    [rowOrder, setRowOrder] = useState<Record<string, string[]>>({}),
    [edit, setEdit] = useState<Edit | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [conflict, setConflict] = useState(false),
    [deleting, setDeleting] = useState<{ section: string; row: CVRow } | null>(
      null,
    ),
    [refreshPending, setRefreshPending] = useState(false);
  const drag = useRef<string | null>(null);
  const dirty =
    !!edit ||
    !!deleting ||
    (!!data &&
      (JSON.stringify(order) !== JSON.stringify(data.order) ||
        Object.keys(rowOrder).length > 0));
  useUnsavedGuard(dirty);
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/cv", { cache: "no-store" });
    if (!response.ok) throw new Error("CV를 불러오지 못했습니다.");
    const next: Snapshot = await response.json();
    setData(next);
    setOrder(next.order);
    setRowOrder({});
    return next;
  }, []);
  useEffect(() => {
    load().catch(() =>
      setMessage("CV를 불러오지 못했습니다. 다시 불러오기를 눌러주세요."),
    );
  }, [load]);
  async function send(
    command: Omit<CVCommand, "revision"> & { revision?: string },
  ) {
    if (!data || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const doc =
        exhibitionSections.includes(command.section || "") &&
        ["save", "delete", "restore"].includes(command.action)
          ? "exhibitions"
          : "about";
      const r = await fetch("/api/admin/cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...command,
          revision: command.revision ?? data.revisions[doc],
        }),
      });
      const result = await r.json();
      if (!r.ok) {
        if (r.status === 409) setConflict(true);
        throw new Error(result.error || "저장하지 못했습니다.");
      }
      setEdit(null);
      setDeleting(null);
      setConflict(false);
      setRefreshPending(!!result.refreshPending);
      setMessage(result.message || "저장했습니다. 공개 CV에도 반영됩니다.");
      try {
        await load();
      } catch {
        setMessage("저장은 완료했습니다. 목록을 다시 불러와 확인해주세요.");
        setData(null);
      }
    } catch (e) {
      setMessage((e as Error).message + " 입력 내용은 유지했습니다.");
    } finally {
      setBusy(false);
    }
  }
  async function reload() {
    setBusy(true);
    try {
      await load();
      setEdit(null);
      setDeleting(null);
      setConflict(false);
      setMessage("최신 목록을 불러왔습니다.");
    } catch {
      setMessage("목록을 불러오지 못했습니다. 입력 내용은 유지했습니다.");
    } finally {
      setBusy(false);
    }
  }
  const idle = !edit && !deleting && !busy;
  const orderDirty =
    !!data && JSON.stringify(order) !== JSON.stringify(data.order);
  const canEdit = idle && !orderDirty && Object.keys(rowOrder).length === 0;
  function begin(section: string, row?: CVRow) {
    if (!canEdit || !data) return;
    setConflict(false);
    setMessage("");
    setEdit({
      section,
      id: row?.id || crypto.randomUUID(),
      fields: Object.fromEntries(
        Object.entries(row || {}).map(([k, v]) => [k, String(v ?? "")]),
      ),
      revision:
        data.revisions[
          exhibitionSections.includes(section) ? "exhibitions" : "about"
        ],
    });
  }
  function move(ids: string[], i: number, step: number) {
    const next = [...ids];
    [next[i], next[i + step]] = [next[i + step], next[i]];
    return next;
  }
  return (
    <section className="cv-editor">
      <h2>CV 기록 관리</h2>
      <p>
        각 항목에서 기록을 추가하거나 수정하세요. 저장한 내용은 공개 CV에도
        반영됩니다. 기간과 순서는 한글·영문에 함께 적용됩니다.
      </p>
      <p role="status" className="cv-message">
        {message}
      </p>
      {!data && (
        <button disabled={busy} onClick={reload}>
          다시 불러오기
        </button>
      )}
      {refreshPending && (
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await fetch("/api/admin/cv", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "refresh" }),
              });
              if (!r.ok) throw new Error();
              setRefreshPending(false);
              setMessage("공개 화면을 갱신했습니다.");
            } catch {
              setMessage("갱신하지 못했습니다. 기록은 이미 저장되어 있습니다.");
            } finally {
              setBusy(false);
            }
          }}
        >
          공개 화면 갱신 재시도
        </button>
      )}
      {conflict && (
        <div className="cv-warning">
          <p>
            다른 창에서 먼저 저장했습니다. 입력 내용을 복사해 보관한 뒤 최신
            목록을 불러와 다시 수정해주세요.
          </p>
          <button disabled={busy} onClick={reload}>
            현재 입력을 버리고 최신 목록 불러오기
          </button>
        </div>
      )}
      {data && (
        <>
          <div className="admin-actions">
            <h3>항목 순서</h3>
            <button
              disabled={!idle || !orderDirty}
              onClick={() => send({ action: "sections", ids: order })}
            >
              항목 순서 저장
            </button>
            <button
              disabled={!idle || !orderDirty}
              onClick={() => setOrder(data.order)}
            >
              순서 취소
            </button>
          </div>
          {order.map((section, index) => {
            const rows = data.sections[section] || [],
              ids = rowOrder[section] || rows.map((r) => r.id),
              labels = cvLabels[section],
              active = edit?.section === section;
            return (
              <section
                className="cv-admin-section"
                key={section}
                draggable={idle && Object.keys(rowOrder).length === 0}
                onDragStart={(e) => {
                  if ((e.target as Element).closest("input,textarea,button")) {
                    e.preventDefault();
                    return;
                  }
                  drag.current = section;
                }}
                onDragOver={(e) => {
                  if (idle) e.preventDefault();
                }}
                onDrop={() => {
                  if (!idle || !drag.current) return;
                  const next = order.filter((k) => k !== drag.current);
                  next.splice(next.indexOf(section), 0, drag.current);
                  setOrder(next);
                  drag.current = null;
                }}
              >
                <div className="admin-actions">
                  <h3>
                    {labels[0]} / {labels[1]}
                  </h3>
                  <button
                    aria-label={`${labels[0]} 항목 위로`}
                    disabled={
                      !idle || !!Object.keys(rowOrder).length || index === 0
                    }
                    onClick={() => setOrder(move(order, index, -1))}
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`${labels[0]} 항목 아래로`}
                    disabled={
                      !idle ||
                      !!Object.keys(rowOrder).length ||
                      index === order.length - 1
                    }
                    onClick={() => setOrder(move(order, index, 1))}
                  >
                    ↓
                  </button>
                  <button disabled={!canEdit} onClick={() => begin(section)}>
                    ＋ 기록 추가
                  </button>
                </div>
                {ids.length === 0 && <p>아직 등록한 기록이 없습니다.</p>}
                {ids.map((id, i) => {
                  const row = rows.find((r) => r.id === id)!;
                  return (
                    <div className="cv-record" key={id}>
                      <span>
                        {row.year} ·{" "}
                        {row[cvFields[section][0][0]] ||
                          row[cvFields[section][0][0] + "_en"] ||
                          "제목 없음"}
                      </span>
                      <div className="admin-actions">
                        <button
                          disabled={!canEdit}
                          onClick={() => begin(section, row)}
                        >
                          수정
                        </button>
                        <button
                          disabled={!canEdit}
                          onClick={() => setDeleting({ section, row })}
                        >
                          삭제
                        </button>
                        <button
                          aria-label={`${labels[0]} 기록 ${i + 1} 위로`}
                          disabled={
                            !idle ||
                            orderDirty ||
                            Object.keys(rowOrder).some((k) => k !== section) ||
                            !i
                          }
                          onClick={() =>
                            setRowOrder({ [section]: move(ids, i, -1) })
                          }
                        >
                          ↑
                        </button>
                        <button
                          aria-label={`${labels[0]} 기록 ${i + 1} 아래로`}
                          disabled={
                            !idle ||
                            orderDirty ||
                            Object.keys(rowOrder).some((k) => k !== section) ||
                            i === ids.length - 1
                          }
                          onClick={() =>
                            setRowOrder({ [section]: move(ids, i, 1) })
                          }
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  );
                })}
                {rowOrder[section] && (
                  <div className="admin-actions">
                    <button
                      disabled={!idle}
                      onClick={() => send({ action: "reorder", section, ids })}
                    >
                      기록 순서 저장
                    </button>
                    <button disabled={!idle} onClick={() => setRowOrder({})}>
                      순서 취소
                    </button>
                  </div>
                )}
                {deleting?.section === section && (
                  <div className="cv-warning">
                    <p>
                      ‘{deleting.row.year} ·{" "}
                      {deleting.row.title ||
                        deleting.row.description ||
                        deleting.row.name ||
                        deleting.row.program}
                      ’ 기록을 삭제할까요? 아래 삭제한 기록에서 복구할 수
                      있습니다.
                    </p>
                    <button
                      disabled={busy}
                      onClick={() =>
                        send({ action: "delete", section, id: deleting.row.id })
                      }
                    >
                      이 기록 삭제
                    </button>
                    <button disabled={busy} onClick={() => setDeleting(null)}>
                      취소
                    </button>
                  </div>
                )}
                {active && edit && (
                  <form
                    className="cv-record-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      send({
                        action: "save",
                        section,
                        id: edit.id,
                        fields: edit.fields,
                        revision: edit.revision,
                      });
                    }}
                  >
                    <fieldset disabled={busy}>
                      <h4>
                        {rows.some((r) => r.id === edit.id)
                          ? "기록 수정"
                          : "새 기록"}
                      </h4>
                      <label className="admin-field">
                        기간 · 예: 2026, 2024–2026, 2026~
                        <input
                          required
                          maxLength={80}
                          value={edit.fields.year || ""}
                          onChange={(e) =>
                            setEdit({
                              ...edit,
                              fields: { ...edit.fields, year: e.target.value },
                            })
                          }
                        />
                      </label>
                      {cvFields[section].map(([field, label]) => (
                        <div className="admin-form-grid" key={field}>
                          {["", "_en"].map((suffix) => (
                            <label className="admin-field" key={suffix}>
                              {label} · {suffix ? "English" : "한글"}
                              <textarea
                                rows={field === "description" ? 3 : 2}
                                maxLength={5000}
                                value={edit.fields[field + suffix] || ""}
                                onChange={(e) =>
                                  setEdit({
                                    ...edit,
                                    fields: {
                                      ...edit.fields,
                                      [field + suffix]: e.target.value,
                                    },
                                  })
                                }
                              />
                            </label>
                          ))}
                        </div>
                      ))}
                      {(exhibitionSections.includes(section) ||
                        section === "projects") && (
                        <label className="admin-field">
                          관련 링크
                          <input
                            type="url"
                            value={
                              edit.fields[
                                section === "projects" ? "url" : "external_url"
                              ] || ""
                            }
                            onChange={(e) =>
                              setEdit({
                                ...edit,
                                fields: {
                                  ...edit.fields,
                                  [section === "projects"
                                    ? "url"
                                    : "external_url"]: e.target.value,
                                },
                              })
                            }
                          />
                        </label>
                      )}
                      {section === "publications" && (
                        <label className="admin-field">
                          종류
                          <select
                            value={edit.fields.type || ""}
                            onChange={(e) =>
                              setEdit({
                                ...edit,
                                fields: {
                                  ...edit.fields,
                                  type: e.target.value,
                                },
                              })
                            }
                          >
                            <option value="">미지정</option>
                            <option value="book">책</option>
                            <option value="catalog">도록</option>
                            <option value="article">글</option>
                            <option value="other">기타</option>
                          </select>
                        </label>
                      )}
                      <p>
                        기간과 첫 번째 내용은 필요합니다. 내용은 한글·영문 중
                        한쪽만 먼저 입력해도 됩니다.
                      </p>
                      <div className="admin-actions">
                        <button type="submit" disabled={busy || conflict}>
                          {busy ? "저장 중…" : "기록 저장"}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setEdit(null);
                            setConflict(false);
                          }}
                        >
                          입력 취소
                        </button>
                      </div>
                    </fieldset>
                  </form>
                )}
              </section>
            );
          })}
          <details>
            <summary>삭제한 기록 · {data.deleted.length}개</summary>
            <p>
              복구한 기록은 해당 항목의 끝에 놓입니다. 복구 후 순서를 조정할 수
              있습니다.
            </p>
            {data.deleted.map(({ section, row }) => (
              <div className="cv-record" key={section + row.id}>
                <span>
                  {cvLabels[section]?.[0]} · {row.year} ·{" "}
                  {row.title || row.description || row.name || row.program}
                </span>
                <button
                  disabled={!canEdit}
                  onClick={() =>
                    send({ action: "restore", section, id: row.id })
                  }
                >
                  복구
                </button>
              </div>
            ))}
          </details>
        </>
      )}
    </section>
  );
}
