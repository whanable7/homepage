"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DialogTitle } from "@headlessui/react";
import { compareWorks, workDimensions } from "@/lib/admin-work-list";
import type { WorkSort } from "@/lib/admin-work-list";
import { removesAllRelations } from "@/lib/archive-publication";
import type {
  ArchiveLayout,
  ArchiveState,
  ArchiveWork,
  Sequence,
  WorkGroup,
} from "@/types/archive";
import type { Document } from "@/lib/archive-store";
import { representativeColor, groupEdges } from "@/lib/layouts";
import { uploadImage } from "@/lib/upload-image";
import Modal from "@/components/common/Modal";
import ArtworkForm from "./ArtworkForm";
import TextEditor from "./TextEditor";
import { confirmAdminNavigation } from "./useUnsavedGuard";
import CVEditor from "./CVEditor";
import WorksEcosystem from "@/components/portfolio/WorksEcosystem";
type Tab =
  | "artworks"
  | "ecosystem"
  | "cosmos"
  | "strata"
  | "sequences"
  | "years"
  | "slideshow"
  | "texts"
  | "cv";
const tabs: Record<Tab, string> = {
  artworks: "작품",
  ecosystem: "Ecosystem",
  cosmos: "천체 · Cosmos",
  strata: "지층 · Strata",
  sequences: "Sequences",
  years: "Years",
  slideshow: "첫 화면",
  texts: "TEXTS",
  cv: "CV",
};
type Queue = {
  id: string;
  file: File;
  preview: string;
  title: string;
  status: "waiting" | "uploading" | "done" | "error";
  error?: string;
  uploaded?: Awaited<ReturnType<typeof uploadImage>>;
};
export default function ArchiveAdmin() {
  const router = useRouter(),
    [tab, setTab] = useState<Tab>("artworks"),
    [works, setWorks] = useState<ArchiveWork[]>([]),
    [doc, setDoc] = useState<Document<ArchiveState> | null>(null),
    [layout, setLayout] = useState<ArchiveLayout | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [editing, setEditing] = useState<ArchiveWork | null | undefined>(undefined),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState(""),
    [sort, setSort] = useState<WorkSort>("recent"),
    [confirmEmptyPublication, setConfirmEmptyPublication] = useState(false),
    [missing, setMissing] = useState(true),
    [queue, setQueue] = useState<Queue[]>([]),
    [groupId, setGroupId] = useState(""),
    [groupName, setGroupName] = useState(""),
    [year, setYear] = useState(new Date().getFullYear()),
    [medium, setMedium] = useState("");
  const dragging = useRef<string | null>(null),
    unsaved = useRef(false),
    queueRef = useRef(queue);
  useEffect(() => {
    const warn = () =>
      setMessage(
        "저장하지 않은 내용이 있습니다. 저장하거나 작성 취소를 선택한 뒤 이동해 주세요.",
      );
    window.addEventListener("archive:unsaved", warn);
    return () => window.removeEventListener("archive:unsaved", warn);
  }, []);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  const load = useCallback(async () => {
    const auth = await fetch("/api/auth");
    if (!auth.ok) {
      router.replace("/admin/login");
      return;
    }
    const [a, b] = await Promise.all([
      fetch("/api/portfolio", { cache: "no-store" }),
      fetch("/api/archive", { cache: "no-store" }),
    ]);
    if (!a.ok || !b.ok) throw new Error("관리자 자료를 불러오지 못했습니다.");
    const data = await b.json();
    setWorks(await a.json());
    setDoc(data);
    setLayout(data.data.draft);
  }, [router]);
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, [load]);
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (unsaved.current || queueRef.current.some((q) => q.status !== "done"))
        e.preventDefault();
    };
    window.addEventListener("beforeunload", leave);
    return () => {
      window.removeEventListener("beforeunload", leave);
      queueRef.current.forEach((q) => URL.revokeObjectURL(q.preview));
    };
  }, []);
  const change = (next: ArchiveLayout) => {
    setLayout(next);
    unsaved.current = true;
  };
  async function act(action: string, confirmEmptyRelations = false) {
    if (!doc || !layout || busy) return false;
    if (
      action === "publish" &&
      removesAllRelations(doc.data.published.layout, layout) &&
      !confirmEmptyRelations
    ) {
      setConfirmEmptyPublication(true);
      return false;
    }
    setBusy(true);
    setMessage("");
    try {
      let revision = doc.revision;
      if (unsaved.current && action !== "reset" && action !== "restore") {
        const saved = await fetch("/api/archive", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "save", layout, revision }),
        });
        const body = await saved.json();
        if (!saved.ok) throw new Error(body.error);
        revision = body.revision;
        setDoc(body);
        unsaved.current = false;
      }
      if (action !== "save") {
        const response = await fetch("/api/archive", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, revision, confirmEmptyRelations }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setDoc(data);
        setLayout(data.data.draft);
        unsaved.current = false;
      }
      setMessage(
        action === "publish"
          ? "작품과 분류를 공개했습니다. 새로 방문한 화면에 반영됩니다."
          : "작업 내용을 저장했습니다.",
      );
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장 실패");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function patch(work: ArchiveWork, values: Partial<ArchiveWork>) {
    const res = await fetch(`/api/portfolio/${work.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          _expected_updated_at: work.updated_at,
        }),
      }),
      body = await res.json();
    if (!res.ok) throw new Error(body.error || "저장 실패");
    setWorks((current) => current.map((w) => (w.id === work.id ? body : w)));
    return body;
  }
  async function uploadQueue() {
    if (busy) return;
    setBusy(true);
    for (const item of queueRef.current.filter((q) => q.status !== "done")) {
      setQueue((current) =>
        current.map((q) =>
          q.id === item.id
            ? { ...q, status: "uploading", error: undefined }
            : q,
        ),
      );
      try {
        const uploaded = item.uploaded || (await uploadImage(item.file));
        setQueue((current) =>
          current.map((q) => (q.id === item.id ? { ...q, uploaded } : q)),
        );
        const response = await fetch("/api/portfolio", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: item.id,
              title: item.title,
              year,
              medium,
              ...uploaded,
              status: "draft",
              is_featured: false,
            }),
          }),
          data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setWorks((current) =>
          current.some((w) => w.id === data.id) ? current : [data, ...current],
        );
        setQueue((current) =>
          current.map((q) => (q.id === item.id ? { ...q, status: "done" } : q)),
        );
      } catch (error) {
        setQueue((current) =>
          current.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: "error",
                  error: error instanceof Error ? error.message : "업로드 실패",
                }
              : q,
          ),
        );
      }
    }
    setBusy(false);
  }
  if (!layout || !doc)
    return (
      <main className="archive-admin">
        <p role="status">{message || "작업 공간을 불러오는 중입니다…"}</p>
      </main>
    );
  const groups = tab === "cosmos" ? layout.cosmos : layout.ecosystem;
  const unset = (w: ArchiveWork) =>
    tab === "ecosystem" || tab === "cosmos"
      ? !groups.some((g) => g.artworkIds.includes(w.id)) &&
        !layout.excluded[tab]?.includes(w.id)
      : tab === "strata"
        ? !w.representative_color && !w.palette?.length
        : tab === "sequences"
          ? !layout.sequences.some((s) =>
              s.steps.some((step) => step.artworkIds.includes(w.id)),
            )
          : false;
  const sorted = [...works]
    .filter(
      (w) =>
        !w.deleted_at &&
        `${w.title} ${w.title_en || ""} ${w.year}`
          .toLowerCase()
          .includes(filter.toLowerCase()),
    )
    .filter(
      (w) =>
        !missing ||
        !["ecosystem", "cosmos", "strata", "sequences"].includes(tab) ||
        unset(w),
    )
    .sort(
      (a, b) =>
        (sort === "recent" ? Number(unset(b)) - Number(unset(a)) : 0) ||
        compareWorks(a, b, sort),
    );
  const selectedGroup = groups.find((g) => g.id === groupId);
  function updateGroups(next: WorkGroup[]) {
    change({ ...layout!, [tab === "cosmos" ? "cosmos" : "ecosystem"]: next });
  }
  const ordered = works
    .filter((w) => w.is_featured && !w.deleted_at)
    .sort(
      (a, b) => (a.featured_order ?? a.order) - (b.featured_order ?? b.order),
    );
  async function reorder(ids: string[]) {
    setBusy(true);
    try {
      const response = await fetch("/api/portfolio/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!response.ok) throw new Error("순서를 저장하지 못했습니다.");
      setWorks((current) =>
        current.map((w) => ({
          ...w,
          featured_order: ids.includes(w.id)
            ? ids.indexOf(w.id)
            : w.featured_order,
        })),
      );
      setMessage("순서를 저장했습니다. 공개 버튼을 누르면 적용됩니다.");
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="archive-admin">
      <header className="admin-heading">
        <Link
          href="/"
          onClick={(e) => {
            if (!confirmAdminNavigation()) e.preventDefault();
          }}
        >
          JUNGWHAN PARK
        </Link>
        <div>
          <Link href="/works" target="_blank">
            사이트 보기 ↗
          </Link>
          <Link
            href="/admin/details"
            onClick={(e) => {
              if (!confirmAdminNavigation()) e.preventDefault();
            }}
          >
            작가정보 · 전시 · 뉴스
          </Link>
          <button
            onClick={async () => {
              if (!confirmAdminNavigation()) return;
              await fetch("/api/auth", { method: "DELETE" });
              router.replace("/admin/login");
            }}
          >
            로그아웃
          </button>
        </div>
      </header>
      <nav className="admin-tabs">
        {(Object.keys(tabs) as Tab[]).map((key) => (
          <button
            key={key}
            aria-current={key === tab ? "page" : undefined}
            onClick={() => {
              if (key === tab || !confirmAdminNavigation()) return;
              setTab(key);
              setMessage("");
              setSelected([]);
              setGroupId("");
            }}
          >
            {tabs[key]}
          </button>
        ))}
      </nav>
      {tab !== "texts" && tab !== "cv" && (
        <div className="admin-publish">
          <span>저장한 작업은 미리보기에서 확인한 뒤 공개합니다.</span>
          <button disabled={busy} onClick={() => act("save")}>
            분류 임시 저장
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              if (!(await act("save"))) return;
              window.open(
                `/admin/preview?view=${["ecosystem", "cosmos", "strata", "sequences", "years"].includes(tab) ? tab : "ecosystem"}`,
                "_blank",
              );
            }}
          >
            미리보기 ↗
          </button>
          <button disabled={busy} onClick={() => act("publish")}>
            작품·분류 공개
          </button>
        </div>
      )}
      <p role="status" className="admin-message">
        {message}
      </p>
      {tab === "texts" ? (
        <TextEditor />
      ) : tab === "cv" ? (
        <CVEditor />
      ) : (
        <>
          {tab === "artworks" && (
            <>
              <div className="admin-actions">
                <h1>작품</h1>
                <button onClick={() => setEditing(null)}>작품 추가</button>
              </div>
              <details className="batch-upload">
                <summary>여러 이미지 추가</summary>
                <div className="admin-actions">
                  <label>
                    공통 연도
                    <input
                      type="number"
                      value={year}
                      onChange={(e) => setYear(+e.target.value)}
                    />
                  </label>
                  <label>
                    공통 재료
                    <input
                      value={medium}
                      onChange={(e) => setMedium(e.target.value)}
                    />
                  </label>
                  <input
                    aria-label="여러 이미지 선택"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    disabled={busy}
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setQueue((current) => [
                        ...current,
                        ...files.map((file) => ({
                          id: crypto.randomUUID(),
                          file,
                          preview: URL.createObjectURL(file),
                          title: file.name.replace(/\.[^.]+$/, ""),
                          status: "waiting" as const,
                        })),
                      ]);
                      e.target.value = "";
                    }}
                  />
                  <button
                    disabled={busy || !queue.some((q) => q.status !== "done")}
                    onClick={uploadQueue}
                  >
                    업로드 · 실패한 파일 재시도
                  </button>
                </div>
                {queue.map((q) => (
                  <div className="upload-row" key={q.id}>
                    <img src={q.preview} alt={q.file.name} />
                    <input
                      aria-label="작품 제목"
                      disabled={q.status !== "waiting" && q.status !== "error"}
                      value={q.title}
                      onChange={(e) =>
                        setQueue((current) =>
                          current.map((x) =>
                            x.id === q.id ? { ...x, title: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <span>
                      {
                        {
                          waiting: "대기",
                          uploading: "처리 중",
                          done: "임시보관 완료",
                          error: "실패",
                        }[q.status]
                      }
                    </span>
                    {q.error && <small role="alert">{q.error}</small>}
                  </div>
                ))}
              </details>
            </>
          )}
          {(tab === "ecosystem" || tab === "cosmos") && (
            <section className="classification-tools">
              <div className="admin-actions">
                <select
                  aria-label="그룹 선택"
                  value={groupId}
                  onChange={(e) => {
                    setGroupId(e.target.value);
                    setMissing(false);
                  }}
                >
                  <option value="">그룹 선택</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name || "이름 없는 그룹"} · {g.artworkIds.length}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="새 그룹 이름 · 관리자에게만 표시"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
                <button
                  onClick={() => {
                    const id = crypto.randomUUID();
                    updateGroups([
                      ...groups,
                      { id, name: groupName.trim(), artworkIds: selected },
                    ]);
                    setGroupId(id);
                    setGroupName("");
                  }}
                >
                  선택 작품으로 그룹 만들기
                </button>
                {selectedGroup && (
                  <>
                    <input
                      aria-label="현재 그룹 이름"
                      value={selectedGroup.name}
                      onChange={(e) =>
                        updateGroups(
                          groups.map((g) =>
                            g.id === groupId
                              ? { ...g, name: e.target.value }
                              : g,
                          ),
                        )
                      }
                    />
                    <button
                      disabled={
                        selected.length !== 2 ||
                        selected.some(
                          (id) => !selectedGroup.artworkIds.includes(id),
                        )
                      }
                      onClick={() =>
                        updateGroups(
                          groups.map((g) =>
                            g.id === groupId
                              ? {
                                  ...g,
                                  edges: [
                                    ...groupEdges([g]),
                                    [selected[0], selected[1]],
                                  ],
                                }
                              : g,
                          ),
                        )
                      }
                    >
                      선택한 두 작품 사이 선 추가
                    </button>
                    <button
                      disabled={selected.length !== 2}
                      onClick={() =>
                        updateGroups(
                          groups.map((g) =>
                            g.id === groupId
                              ? {
                                  ...g,
                                  edges: groupEdges([g]).filter(
                                    ([a, b]) =>
                                      !selected.includes(a) ||
                                      !selected.includes(b),
                                  ),
                                }
                              : g,
                          ),
                        )
                      }
                    >
                      선택한 두 작품 사이 선 해제
                    </button>
                    <button
                      onClick={() =>
                        updateGroups(
                          groups.map((g) =>
                            g.id === groupId
                              ? {
                                  ...g,
                                  artworkIds: [
                                    ...new Set([...g.artworkIds, ...selected]),
                                  ],
                                  edges: undefined,
                                }
                              : g,
                          ),
                        )
                      }
                    >
                      선택 작품 연결
                    </button>
                    <button
                      onClick={() =>
                        updateGroups(
                          groups.map((g) =>
                            g.id === groupId
                              ? {
                                  ...g,
                                  artworkIds: g.artworkIds.filter(
                                    (id) => !selected.includes(id),
                                  ),
                                  edges: undefined,
                                }
                              : g,
                          ),
                        )
                      }
                    >
                      선택 작품 연결 해제
                    </button>
                    <button
                      onClick={() => {
                        updateGroups(groups.filter((g) => g.id !== groupId));
                        setGroupId("");
                      }}
                    >
                      그룹 제거
                    </button>
                  </>
                )}
              </div>
              <details>
                <summary>관계 미리보기</summary>
                <WorksEcosystem
                  works={works.filter((w) => !w.deleted_at)}
                  groups={groups}
                  onOpen={setEditing}
                />
              </details>
              <details>
                <summary>기존 관계 다시 설정</summary>
                <p>
                  현재 작업 분류를 백업한 뒤 빈 작업 분류로 돌아갑니다. 공개
                  중인 화면은 공개 버튼을 누르기 전까지 유지합니다.
                </p>
                <button disabled={busy} onClick={() => act("reset")}>
                  백업하고 작업 분류 초기화
                </button>
                <button disabled={busy} onClick={() => act("restore")}>
                  최근 분류 백업 불러오기
                </button>
              </details>
            </section>
          )}
          {tab === "sequences" && (
            <section>
              <button
                onClick={() => {
                  const seq: Sequence = {
                    id: crypto.randomUUID(),
                    title: "새 흐름",
                    title_en: "",
                    steps: [],
                  };
                  change({ ...layout, sequences: [...layout.sequences, seq] });
                }}
              >
                흐름 추가
              </button>
              {layout.sequences.map((seq) => (
                <div className="sequence-editor" key={seq.id}>
                  <div className="admin-actions">
                    <input
                      aria-label="흐름 이름"
                      value={seq.title}
                      onChange={(e) =>
                        change({
                          ...layout,
                          sequences: layout.sequences.map((s) =>
                            s.id === seq.id
                              ? { ...s, title: e.target.value }
                              : s,
                          ),
                        })
                      }
                    />
                    <input
                      aria-label="흐름 영문 이름"
                      value={seq.title_en}
                      onChange={(e) =>
                        change({
                          ...layout,
                          sequences: layout.sequences.map((s) =>
                            s.id === seq.id
                              ? { ...s, title_en: e.target.value }
                              : s,
                          ),
                        })
                      }
                    />
                    <button
                      onClick={() =>
                        change({
                          ...layout,
                          sequences: layout.sequences.map((s) =>
                            s.id === seq.id
                              ? {
                                  ...s,
                                  steps: [
                                    ...s.steps,
                                    {
                                      id: crypto.randomUUID(),
                                      title: "새 단계",
                                      title_en: "",
                                      artworkIds: selected,
                                    },
                                  ],
                                }
                              : s,
                          ),
                        })
                      }
                    >
                      선택 작품으로 단계 추가
                    </button>
                    <button
                      onClick={() =>
                        change({
                          ...layout,
                          sequences: layout.sequences.filter(
                            (s) => s.id !== seq.id,
                          ),
                        })
                      }
                    >
                      흐름 제거
                    </button>
                  </div>
                  {seq.steps.map((step, i) => (
                    <div className="admin-actions" key={step.id}>
                      <input
                        aria-label="단계 이름"
                        value={step.title}
                        onChange={(e) =>
                          change({
                            ...layout,
                            sequences: layout.sequences.map((s) =>
                              s.id === seq.id
                                ? {
                                    ...s,
                                    steps: s.steps.map((t) =>
                                      t.id === step.id
                                        ? { ...t, title: e.target.value }
                                        : t,
                                    ),
                                  }
                                : s,
                            ),
                          })
                        }
                      />
                      <input
                        aria-label="단계 영문 이름"
                        value={step.title_en}
                        onChange={(e) =>
                          change({
                            ...layout,
                            sequences: layout.sequences.map((s) =>
                              s.id === seq.id
                                ? {
                                    ...s,
                                    steps: s.steps.map((t) =>
                                      t.id === step.id
                                        ? { ...t, title_en: e.target.value }
                                        : t,
                                    ),
                                  }
                                : s,
                            ),
                          })
                        }
                      />
                      <span>{step.artworkIds.length}점</span>
                      <button
                        onClick={() =>
                          change({
                            ...layout,
                            sequences: layout.sequences.map((s) =>
                              s.id === seq.id
                                ? {
                                    ...s,
                                    steps: s.steps.map((t) =>
                                      t.id === step.id
                                        ? { ...t, artworkIds: selected }
                                        : t,
                                    ),
                                  }
                                : s,
                            ),
                          })
                        }
                      >
                        선택 작품 지정
                      </button>
                      <button
                        disabled={!i}
                        onClick={() => {
                          const steps = [...seq.steps];
                          [steps[i - 1], steps[i]] = [steps[i], steps[i - 1]];
                          change({
                            ...layout,
                            sequences: layout.sequences.map((s) =>
                              s.id === seq.id ? { ...s, steps } : s,
                            ),
                          });
                        }}
                      >
                        ↑
                      </button>
                      <button
                        onClick={() =>
                          change({
                            ...layout,
                            sequences: layout.sequences.map((s) =>
                              s.id === seq.id
                                ? {
                                    ...s,
                                    steps: s.steps.filter(
                                      (t) => t.id !== step.id,
                                    ),
                                  }
                                : s,
                            ),
                          })
                        }
                      >
                        단계 제거
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </section>
          )}
          {tab === "strata" && (
            <div className="admin-actions">
              <button
                onClick={async () => {
                  setBusy(true);
                  for (const w of works.filter((w) =>
                    selected.includes(w.id),
                  )) {
                    try {
                      const response = await fetch(
                          "/api/portfolio/analyze-color",
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ image_url: w.image_url }),
                          },
                        ),
                        body = await response.json();
                      if (!response.ok) throw new Error(body.error);
                      await patch(w, body);
                    } catch (error) {
                      setMessage(`${w.title}: ${String(error)}`);
                    }
                  }
                  setBusy(false);
                }}
              >
                선택 작품 색 분석
              </button>
              <button
                onClick={() => change({ ...layout, seed: layout.seed + 1 })}
              >
                다른 배치 준비
              </button>
              <span>
                작품의 대표색을 직접 고르거나 추출색 중 선택할 수 있습니다.
              </span>
            </div>
          )}
          {tab === "slideshow" && (
            <div className="slideshow-admin">
              {ordered.map((w, i) => (
                <div
                  key={w.id}
                  draggable
                  onDragStart={() => {
                    dragging.current = w.id;
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    const ids = ordered.map((w) => w.id),
                      from = ids.indexOf(dragging.current || "");
                    if (from < 0) return;
                    ids.splice(from, 1);
                    ids.splice(i, 0, dragging.current!);
                    void reorder(ids);
                  }}
                >
                  <img src={w.thumbnail_url || w.image_url} alt={w.title} />
                  <span>
                    {i + 1}. {w.title}
                  </span>
                  <button
                    aria-label="대표 이미지 앞으로"
                    disabled={!i || busy}
                    onClick={() => {
                      const ids = ordered.map((w) => w.id);
                      [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                      void reorder(ids);
                    }}
                  >
                    ↑
                  </button>
                  <button
                    onClick={() =>
                      patch(w, { is_featured: false }).catch((e) =>
                        setMessage(e.message),
                      )
                    }
                  >
                    대표 해제
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="admin-actions">
            <label className="admin-sort">
              <span>정렬</span>
              <select
                aria-label="작품 정렬"
                value={sort}
                onChange={(e) => setSort(e.target.value as WorkSort)}
              >
                <option value="recent">최근 등록순 · 미설정 우선</option>
                <option value="title-asc">제목 오름차순</option>
                <option value="title-desc">제목 내림차순</option>
                <option value="year-asc">연도 오름차순</option>
                <option value="year-desc">연도 내림차순</option>
              </select>
            </label>
            <input
              placeholder="작품명 · 연도 검색"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            {["ecosystem", "cosmos", "strata", "sequences"].includes(tab) && (
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={missing}
                  onChange={(e) => setMissing(e.target.checked)}
                />
                미설정 작품만
              </label>
            )}
            <span>{selected.length}점 선택</span>
            <button onClick={() => setSelected(sorted.map((w) => w.id))}>
              전체 선택
            </button>
            <button onClick={() => setSelected([])}>선택 해제</button>
          </div>
          <div className="admin-art-grid">
            {sorted.map((w) => (
              <article key={w.id} className={unset(w) ? "admin-unset" : ""}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.includes(w.id)}
                    onChange={(e) =>
                      setSelected((current) =>
                        e.target.checked
                          ? [...current, w.id]
                          : current.filter((id) => id !== w.id),
                      )
                    }
                  />
                  <img
                    src={w.thumbnail_url || w.image_url}
                    alt={w.title}
                    loading="lazy"
                  />
                  <span>{w.title}</span>
                  <small>
                    {w.year} · {w.medium || "재료 미입력"}
                  </small>
                  <small>{workDimensions(w)}</small>
                  <small>
                    {w.status === "draft" ? "임시보관" : "공개 대상"}
                    {unset(w) ? " · 미설정" : ""}
                  </small>
                </label>
                {tab === "artworks" && (
                  <>
                    <button onClick={() => setEditing(w)}>
                      이미지·캡션 수정
                    </button>
                    <button
                      onClick={() =>
                        patch(w, {
                          status: w.status === "draft" ? "published" : "draft",
                        }).catch((e) => setMessage(e.message))
                      }
                    >
                      {w.status === "draft"
                        ? "공개 대상에 포함"
                        : "공개 대상에서 제외"}
                    </button>
                  </>
                )}
                {tab === "cosmos" && (
                  <label>
                    별 크기
                    <select
                      value={layout.stars[w.id] || 1}
                      onChange={(e) =>
                        change({
                          ...layout,
                          stars: {
                            ...layout.stars,
                            [w.id]: +e.target.value as 1 | 2 | 3,
                          },
                        })
                      }
                    >
                      <option value="1">작게</option>
                      <option value="2">중간</option>
                      <option value="3">크게</option>
                    </select>
                  </label>
                )}
                {tab === "strata" && (
                  <>
                    <input
                      aria-label={`${w.title} 대표색`}
                      type="color"
                      value={representativeColor(w)}
                      onChange={(e) => {
                        const color = e.target.value;
                        setWorks((current) =>
                          current.map((a) =>
                            a.id === w.id
                              ? { ...a, representative_color: color }
                              : a,
                          ),
                        );
                      }}
                      onBlur={(e) =>
                        patch(w, {
                          representative_color: e.target.value,
                        }).catch((err) => setMessage(err.message))
                      }
                    />
                    <div className="palette-swatches">
                      {w.palette?.map((c) => (
                        <button
                          key={c.hex}
                          style={{ background: c.hex }}
                          aria-label={`${c.hex} ${c.percentage}% 대표색으로 선택`}
                          onClick={() =>
                            patch(w, { representative_color: c.hex }).catch(
                              (e) => setMessage(e.message),
                            )
                          }
                        />
                      ))}
                    </div>
                  </>
                )}
                {tab === "years" && (
                  <input
                    aria-label={`${w.title} 제작연도`}
                    type="number"
                    defaultValue={w.year}
                    onBlur={(e) => {
                      const y = +e.target.value;
                      if (
                        Number.isInteger(y) &&
                        y >= 1900 &&
                        y <= new Date().getFullYear() + 1
                      )
                        void patch(w, { year: y }).catch((err) =>
                          setMessage(err.message),
                        );
                      else setMessage("제작연도를 확인해 주세요.");
                    }}
                  />
                )}
                {["ecosystem", "cosmos", "strata", "years"].includes(tab) && (
                  <label className="admin-check">
                    <input
                      type="checkbox"
                      checked={
                        layout.excluded[tab as "ecosystem"]?.includes(w.id) ||
                        false
                      }
                      onChange={(e) => {
                        const key = tab as "ecosystem",
                          current = layout.excluded[key] || [];
                        change({
                          ...layout,
                          excluded: {
                            ...layout.excluded,
                            [key]: e.target.checked
                              ? [...current, w.id]
                              : current.filter((id) => id !== w.id),
                          },
                        });
                      }}
                    />
                    이 보기에서 제외
                  </label>
                )}
                {tab === "slideshow" && (
                  <button
                    onClick={() =>
                      patch(w, { is_featured: !w.is_featured }).catch((e) =>
                        setMessage(e.message),
                      )
                    }
                  >
                    {w.is_featured ? "대표 해제" : "대표 이미지로 선택"}
                  </button>
                )}
              </article>
            ))}
          </div>
        </>
      )}
      <Modal
        isOpen={confirmEmptyPublication}
        onClose={() => setConfirmEmptyPublication(false)}
        className="w-full max-w-lg"
      >
        <div className="p-6">
          <DialogTitle className="text-lg mb-4">
            연결을 비운 상태로 공개할까요?
          </DialogTitle>
          <p>
            생태계 또는 천체의 기존 연결이 모두 사라집니다. 작품과 이전 연결
            백업은 보관합니다.
          </p>
          <div className="admin-actions">
            <button onClick={() => setConfirmEmptyPublication(false)}>
              취소 · 편집 계속
            </button>
            <button
              onClick={() => {
                setConfirmEmptyPublication(false);
                void act("publish", true);
              }}
            >
              연결 없이 공개
            </button>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={editing !== undefined}
        onClose={() => setEditing(undefined)}
        className="w-full max-w-3xl max-h-[90svh] overflow-auto"
      >
        <div className="p-6">
          {editing !== undefined && (
            <ArtworkForm
              artwork={editing || undefined}
              categories={[]}
              onCancel={() => setEditing(undefined)}
              onSubmit={async (values) => {
                const res = await fetch(
                    editing ? `/api/portfolio/${editing.id}` : "/api/portfolio",
                    {
                      method: editing ? "PUT" : "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        ...values,
                        _expected_updated_at: editing?.updated_at,
                      }),
                    },
                  ),
                  body = await res.json();
                if (!res.ok) throw new Error(body.error);
                setWorks((current) =>
                  editing
                    ? current.map((w) => (w.id === body.id ? body : w))
                    : [body, ...current],
                );
                setEditing(undefined);
                setMessage(
                  "임시 저장했습니다. 작품·분류 공개 버튼으로 반영해 주세요.",
                );
              }}
            />
          )}
        </div>
      </Modal>
    </main>
  );
}
