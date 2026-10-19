"use client";
import { useState } from "react";
import type { ArchiveLayout, ArchiveWork, Sequence } from "@/types/archive";
import SequenceCanvas from "@/components/portfolio/SequenceCanvas";
import { WorkImage } from "@/components/portfolio/WorksBrowser";
import { sequenceKey, sequenceLayout } from "@/lib/sequence-layout";

export default function SequenceEditor({
  layout,
  works,
  selected,
  onChange,
}: {
  layout: ArchiveLayout;
  works: ArchiveWork[];
  selected: string[];
  onChange: (layout: ArchiveLayout) => void;
}) {
  const [renaming, setRenaming] = useState<{
    id: string;
    title: string;
    title_en: string;
  } | null>(null);
  const [deleteId, setDeleteId] = useState("");
  function update(sequence: Sequence) {
    const keys = new Set(
      sequence.steps.flatMap((s) =>
        s.artworkIds.map((id) => sequenceKey(s.id, id)),
      ),
    );
    const positions = sequence.positions
      ? Object.fromEntries(
          Object.entries(sequence.positions).filter(([key]) => keys.has(key)),
        )
      : undefined;
    onChange({
      ...layout,
      sequences: layout.sequences.map((s) =>
        s.id === sequence.id ? { ...sequence, positions } : s,
      ),
    });
  }
  function freeze(sequence: Sequence) {
    return Object.fromEntries(
      sequenceLayout(sequence, works, layout).nodes.map((n) => [
        n.key,
        { x: n.x, y: n.y },
      ]),
    );
  }
  return (
    <section className="sequence-admin">
      <div className="admin-actions">
        <h2>흐름과 단계</h2>
        <button
          onClick={() =>
            onChange({
              ...layout,
              sequences: [
                ...layout.sequences,
                {
                  id: crypto.randomUUID(),
                  title: "새 흐름",
                  title_en: "",
                  steps: [],
                },
              ],
            })
          }
        >
          새 흐름 만들기
        </button>
      </div>
      <p>
        처음에는 제작연도순으로 놓습니다. 이미지를 끌어 위치를 바꾸거나, 선택 후
        방향키로 조정하세요. 배치를 바꾼 뒤 분류 임시 저장 · 공개 버튼을
        눌러주세요.
      </p>
      {layout.sequences.map((sequence) => (
        <section className="sequence-editor" key={sequence.id}>
          <div className="admin-actions">
            <h3>{sequence.title || "이름 없는 흐름"}</h3>
            <button
              onClick={() =>
                setRenaming({
                  id: sequence.id,
                  title: sequence.title,
                  title_en: sequence.title_en,
                })
              }
            >
              흐름 이름 변경
            </button>
            <button
              onClick={() =>
                update({
                  ...sequence,
                  steps: [
                    ...sequence.steps,
                    {
                      id: crypto.randomUUID(),
                      title: "새 단계",
                      title_en: "",
                      artworkIds: [...selected],
                    },
                  ],
                })
              }
            >
              새 단계 만들기
              {selected.length ? ` · 선택 ${selected.length}점 포함` : ""}
            </button>
            <button onClick={() => setDeleteId(sequence.id)}>흐름 삭제…</button>
          </div>
          {renaming?.id === sequence.id && (
            <div className="admin-actions">
              <label>
                한국어 이름
                <input
                  value={renaming.title}
                  onChange={(e) =>
                    setRenaming({ ...renaming, title: e.target.value })
                  }
                />
              </label>
              <label>
                English
                <input
                  value={renaming.title_en}
                  onChange={(e) =>
                    setRenaming({ ...renaming, title_en: e.target.value })
                  }
                />
              </label>
              <button
                onClick={() => {
                  update({
                    ...sequence,
                    title: renaming.title,
                    title_en: renaming.title_en,
                  });
                  setRenaming(null);
                }}
              >
                이름 적용
              </button>
              <button onClick={() => setRenaming(null)}>취소</button>
            </div>
          )}
          {deleteId === sequence.id && (
            <div className="admin-actions">
              <span>흐름만 삭제하며 작품은 유지합니다.</span>
              <button
                onClick={() => {
                  onChange({
                    ...layout,
                    sequences: layout.sequences.filter(
                      (s) => s.id !== sequence.id,
                    ),
                  });
                  setDeleteId("");
                }}
              >
                흐름 삭제 확인
              </button>
              <button onClick={() => setDeleteId("")}>취소</button>
            </div>
          )}
          <SequenceCanvas
            sequence={sequence}
            works={works}
            layout={layout}
            onPosition={(key, position) =>
              update({
                ...sequence,
                positions: { ...freeze(sequence), [key]: position },
              })
            }
          />
          <div className="sequence-step-list">
            {sequence.steps.map((step, i) => (
              <div className="sequence-step-editor" key={step.id}>
                <div className="admin-actions">
                  <strong>
                    {i + 1}. {step.title} · {step.artworkIds.length}점
                  </strong>
                  <button
                    onClick={() =>
                      setRenaming({
                        id: step.id,
                        title: step.title,
                        title_en: step.title_en,
                      })
                    }
                  >
                    단계 이름 변경
                  </button>
                </div>
                {renaming?.id === step.id && (
                  <div className="admin-actions">
                    <label>
                      한국어 이름
                      <input
                        value={renaming.title}
                        onChange={(e) =>
                          setRenaming({ ...renaming, title: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      English
                      <input
                        value={renaming.title_en}
                        onChange={(e) =>
                          setRenaming({ ...renaming, title_en: e.target.value })
                        }
                      />
                    </label>
                    <button
                      onClick={() => {
                        update({
                          ...sequence,
                          steps: sequence.steps.map((s) =>
                            s.id === step.id
                              ? {
                                  ...s,
                                  title: renaming.title,
                                  title_en: renaming.title_en,
                                }
                              : s,
                          ),
                        });
                        setRenaming(null);
                      }}
                    >
                      이름 적용
                    </button>
                    <button onClick={() => setRenaming(null)}>취소</button>
                  </div>
                )}
                <div className="admin-actions">
                  <button
                    disabled={!selected.length}
                    onClick={() =>
                      update({
                        ...sequence,
                        positions: freeze(sequence),
                        steps: sequence.steps.map((s) =>
                          s.id === step.id
                            ? {
                                ...s,
                                artworkIds: [
                                  ...new Set([...s.artworkIds, ...selected]),
                                ],
                              }
                            : s,
                        ),
                      })
                    }
                  >
                    선택 작품을 단계에 추가
                  </button>
                  <button
                    disabled={
                      !selected.some((id) => step.artworkIds.includes(id))
                    }
                    onClick={() =>
                      update({
                        ...sequence,
                        positions: freeze(sequence),
                        steps: sequence.steps.map((s) =>
                          s.id === step.id
                            ? {
                                ...s,
                                artworkIds: s.artworkIds.filter(
                                  (id) => !selected.includes(id),
                                ),
                              }
                            : s,
                        ),
                      })
                    }
                  >
                    선택 작품을 단계에서 빼기
                  </button>
                  <button onClick={() => setDeleteId(step.id)}>
                    단계 삭제…
                  </button>
                </div>
                {deleteId === step.id && (
                  <div className="admin-actions">
                    <span>단계만 삭제하며 작품은 유지합니다.</span>
                    <button
                      onClick={() => {
                        update({
                          ...sequence,
                          positions: freeze(sequence),
                          steps: sequence.steps.filter((s) => s.id !== step.id),
                        });
                        setDeleteId("");
                      }}
                    >
                      단계 삭제 확인
                    </button>
                    <button onClick={() => setDeleteId("")}>취소</button>
                  </div>
                )}
                <div className="sequence-step-thumbs">
                  {step.artworkIds.map((id) => {
                    const w = works.find((w) => w.id === id);
                    return w ? (
                      <span className="sequence-step-thumbnail" key={id}>
                        <WorkImage work={w} sizes="65px" />
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}
