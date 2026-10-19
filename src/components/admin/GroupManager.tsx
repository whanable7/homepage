"use client";
import { useMemo, useState } from "react";
import type { ArchiveWork, WorkGroup } from "@/types/archive";
import { changeGroupMembers, edgeKey } from "@/lib/group-relations";
import { groupEdges } from "@/lib/layouts";
import Modal from "@/components/common/Modal";
import { DialogTitle } from "@headlessui/react";
import WorksEcosystem from "@/components/portfolio/WorksEcosystem";
import { WorkImage } from "@/components/portfolio/WorksBrowser";

export default function GroupManager({
  groups,
  works,
  selected,
  groupId,
  onSelectGroup,
  onChange,
  onSelectedChange,
}: {
  groups: WorkGroup[];
  works: ArchiveWork[];
  selected: string[];
  groupId: string;
  onSelectGroup: (id: string) => void;
  onChange: (groups: WorkGroup[]) => void;
  onSelectedChange: (ids: string[]) => void;
}) {
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState("");
  const [membersOnly, setMembersOnly] = useState(false);
  const [picking, setPicking] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [newName, setNewName] = useState("");
  const [rename, setRename] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [deleting, setDeleting] = useState("");
  const [onlyGroup, setOnlyGroup] = useState(false);
  const group = groups.find((g) => g.id === groupId);
  const visibleWorks = useMemo(
    () => works.filter((w) => !w.deleted_at),
    [works],
  );
  const addCount = group
    ? selected.filter((id) => !group.artworkIds.includes(id)).length
    : 0;
  const removeCount = group
    ? selected.filter((id) => group.artworkIds.includes(id)).length
    : 0;
  const openPicker = (members: boolean) => {
    setPicking([...selected]);
    setQuery("");
    setMembersOnly(members);
    setPicker(true);
  };
  const update = (next: WorkGroup) =>
    onChange(groups.map((g) => (g.id === next.id ? next : g)));
  const pairReady =
    !!group &&
    selected.length === 2 &&
    selected.every((id) => group.artworkIds.includes(id));
  return (
    <section className="classification-tools">
      <div className="group-manager">
        <aside className="group-list" aria-label="그룹 목록">
          <h2>그룹</h2>
          <label className="admin-field">
            새 그룹 이름
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </label>
          <button
            disabled={!newName.trim()}
            onClick={() => {
              const id = crypto.randomUUID();
              onChange([
                ...groups,
                { id, name: newName.trim(), artworkIds: [...selected] },
              ]);
              onSelectGroup(id);
              setNewName("");
            }}
          >
            새 그룹 만들기
            {selected.length ? ` · 선택 ${selected.length}점 포함` : ""}
          </button>
          <div className="group-list-items">
            {groups.map((g) => {
              const thumbnail = works.find((w) => g.artworkIds.includes(w.id));
              return (
                <button
                  key={g.id}
                  className="group-list-item"
                  aria-pressed={g.id === groupId}
                  onClick={() => {
                    onSelectGroup(g.id);
                    setRename(null);
                    setDeleting("");
                    setNotice("");
                    onSelectedChange([]);
                  }}
                >
                  {thumbnail && (
                    <span className="group-thumbnail">
                      <WorkImage work={thumbnail} sizes="48px" />
                    </span>
                  )}
                  <span>
                    {g.name || "이름 없는 그룹"}
                    <small>{g.artworkIds.length}점</small>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
        <div className="group-relation-preview">
          <div className="admin-actions">
            <h2>관계 미리보기</h2>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={onlyGroup}
                disabled={!group}
                onChange={(e) => setOnlyGroup(e.target.checked)}
              />
              선택 그룹만 보기
            </label>
          </div>
          <p className="group-selection-help">
            작품 이미지를 누르면 선택·해제됩니다. 오른쪽 ‘작품 선택’에서도 고를
            수 있습니다.
          </p>
          <WorksEcosystem
            works={visibleWorks}
            groups={groups}
            onOpen={(work) => {
              onSelectedChange(
                selected.includes(work.id)
                  ? selected.filter((id) => id !== work.id)
                  : [...selected, work.id],
              );
              setNotice("");
            }}
            focusedGroupId={group?.id}
            onlyFocused={onlyGroup && !!group}
          />
        </div>
        <aside className="group-detail" aria-label="선택 그룹 편집">
          {group ? (
            <>
              <h2>{group.name || "이름 없는 그룹"}</h2>
              <p>
                {group.artworkIds.length}점 · 선택한 작품 {selected.length}점
              </p>
              {rename?.id === group.id ? (
                <div className="admin-field">
                  <label htmlFor="group-rename">그룹 이름</label>
                  <input
                    id="group-rename"
                    value={rename.name}
                    onChange={(e) =>
                      setRename({ ...rename, name: e.target.value })
                    }
                  />
                  <div className="admin-actions">
                    <button
                      disabled={!rename.name.trim()}
                      onClick={() => {
                        update({ ...group, name: rename.name.trim() });
                        setRename(null);
                      }}
                    >
                      이름 적용
                    </button>
                    <button onClick={() => setRename(null)}>취소</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setRename({ id: group.id, name: group.name })}
                >
                  이름 변경
                </button>
              )}
              <h3>작품 묶음</h3>
              <div className="admin-actions">
                <button onClick={() => openPicker(false)}>작품 선택…</button>
                <button onClick={() => openPicker(true)}>
                  그룹 작품 보기…
                </button>
              </div>
              {selected.length > 0 ? (
                <>
                  <div
                    className="group-selected-thumbs"
                    aria-label="선택한 작품"
                  >
                    {visibleWorks
                      .filter((w) => selected.includes(w.id))
                      .map((w) => (
                        <button
                          key={w.id}
                          title={`${w.title} · 선택 해제`}
                          aria-label={`${w.title} 선택 해제`}
                          onClick={() =>
                            onSelectedChange(
                              selected.filter((id) => id !== w.id),
                            )
                          }
                        >
                          <WorkImage work={w} sizes="48px" />
                        </button>
                      ))}
                  </div>
                  <button onClick={() => onSelectedChange([])}>
                    선택 모두 해제
                  </button>
                </>
              ) : (
                <p>먼저 ‘작품 선택’에서 이미지를 고르세요.</p>
              )}
              <button
                disabled={!addCount}
                onClick={() => {
                  update(changeGroupMembers(group, selected));
                  setNotice(
                    `${addCount}점을 그룹에 추가했습니다. 분류 임시 저장으로 보관하세요.`,
                  );
                  onSelectedChange([]);
                }}
              >
                그룹에 작품 추가{addCount ? ` · ${addCount}점` : ""}
              </button>
              <button
                disabled={!removeCount}
                onClick={() => {
                  update(changeGroupMembers(group, selected, true));
                  setNotice(
                    `${removeCount}점을 그룹에서 뺐습니다. 작품 원본은 그대로 있습니다. 분류 임시 저장으로 보관하세요.`,
                  );
                  onSelectedChange([]);
                }}
              >
                그룹에서 작품 빼기{removeCount ? ` · ${removeCount}점` : ""}
              </button>
              {!!selected.length && !addCount && (
                <p>선택한 작품은 모두 이 그룹에 들어 있습니다.</p>
              )}
              {!!selected.length && !removeCount && (
                <p>선택한 작품 중 이 그룹에 들어 있는 작품이 없습니다.</p>
              )}
              <p role="status">{notice}</p>
              <h3>연결선</h3>
              <p>같은 그룹의 작품 2점을 선택하세요.</p>
              <button
                disabled={!pairReady}
                onClick={() => {
                  const edges = groupEdges([group]);
                  const [a, b] = selected;
                  if (!edges.some(([x, y]) => edgeKey(x, y) === edgeKey(a, b)))
                    edges.push([a, b]);
                  update({ ...group, edges });
                }}
              >
                두 작품 사이 선 잇기
              </button>
              <button
                disabled={!pairReady}
                onClick={() =>
                  update({
                    ...group,
                    edges: groupEdges([group]).filter(
                      ([a, b]) =>
                        edgeKey(a, b) !== edgeKey(selected[0], selected[1]),
                    ),
                  })
                }
              >
                두 작품 사이 선 지우기
              </button>
              <div className="group-delete">
                {deleting === group.id ? (
                  <>
                    <p>그룹만 삭제합니다. 작품은 보존합니다.</p>
                    <button
                      onClick={() => {
                        onChange(groups.filter((g) => g.id !== group.id));
                        onSelectGroup("");
                        setDeleting("");
                      }}
                    >
                      그룹 삭제 확인
                    </button>
                    <button onClick={() => setDeleting("")}>취소</button>
                  </>
                ) : (
                  <button onClick={() => setDeleting(group.id)}>
                    그룹 삭제…
                  </button>
                )}
              </div>
            </>
          ) : (
            <p>
              왼쪽에서 그룹을 선택하거나 새 그룹을 만드세요. 그룹 이름은
              관리자에게만 보입니다.
            </p>
          )}
        </aside>
      </div>
      <Modal
        isOpen={picker}
        onClose={() => setPicker(false)}
        className="group-picker"
      >
        <div className="group-picker-heading">
          <DialogTitle>작품 선택 · {group?.name || "새 그룹"}</DialogTitle>
          <button onClick={() => setPicker(false)}>취소</button>
        </div>
        <label className="admin-field">
          제목·연도·재료로 찾기
          <input value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label className="admin-check">
          <input
            type="checkbox"
            checked={membersOnly}
            onChange={(e) => setMembersOnly(e.target.checked)}
          />
          이 그룹 작품만 보기
        </label>
        <p>이미지를 눌러 선택하세요. 선택만으로 그룹 구성은 바뀌지 않습니다.</p>
        <div className="group-picker-grid">
          {visibleWorks
            .filter(
              (w) =>
                (!membersOnly || group?.artworkIds.includes(w.id)) &&
                `${w.title} ${w.title_en} ${w.year} ${w.medium} ${w.medium_en}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
            )
            .map((w) => (
              <label className="group-picker-work" key={w.id}>
                <span className="group-picker-image">
                  <WorkImage work={w} sizes="140px" />
                </span>
                <span>
                  <input
                    type="checkbox"
                    checked={picking.includes(w.id)}
                    onChange={(e) =>
                      setPicking((ids) =>
                        e.target.checked
                          ? [...ids, w.id]
                          : ids.filter((id) => id !== w.id),
                      )
                    }
                  />
                  {w.title || w.title_en || "제목 없음"}
                </span>
                <small>
                  {w.year} ·{" "}
                  {group?.artworkIds.includes(w.id)
                    ? "그룹에 포함"
                    : "그룹에 미포함"}
                </small>
              </label>
            ))}
        </div>
        <div className="group-picker-footer">
          <span>{picking.length}점 선택</span>
          <button onClick={() => setPicking([])}>모두 해제</button>
          <button
            onClick={() => {
              onSelectedChange(picking);
              setNotice("");
              setPicker(false);
            }}
          >
            선택 완료
          </button>
        </div>
      </Modal>
    </section>
  );
}
