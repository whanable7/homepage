"use client";
import { useMemo, useState } from "react";
import type { ArchiveWork, WorkGroup } from "@/types/archive";
import { changeGroupMembers, edgeKey } from "@/lib/group-relations";
import { groupEdges } from "@/lib/layouts";
import WorksEcosystem from "@/components/portfolio/WorksEcosystem";
import { WorkImage } from "@/components/portfolio/WorksBrowser";

export default function GroupManager({
  groups,
  works,
  selected,
  groupId,
  onSelectGroup,
  onChange,
  onOpen,
}: {
  groups: WorkGroup[];
  works: ArchiveWork[];
  selected: string[];
  groupId: string;
  onSelectGroup: (id: string) => void;
  onChange: (groups: WorkGroup[]) => void;
  onOpen: (work: ArchiveWork) => void;
}) {
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
          <WorksEcosystem
            works={visibleWorks}
            groups={groups}
            onOpen={onOpen}
            focusedGroupId={group?.id}
            onlyFocused={onlyGroup && !!group}
          />
        </div>
        <aside className="group-detail" aria-label="선택 그룹 편집">
          {group ? (
            <>
              <h2>{group.name || "이름 없는 그룹"}</h2>
              <p>
                {group.artworkIds.length}점 · 아래 목록에서 선택한 작품{" "}
                {selected.length}점
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
              <button
                disabled={!selected.length}
                onClick={() => update(changeGroupMembers(group, selected))}
              >
                그룹에 작품 추가
              </button>
              <button
                disabled={!selected.some((id) => group.artworkIds.includes(id))}
                onClick={() =>
                  update(changeGroupMembers(group, selected, true))
                }
              >
                그룹에서 작품 빼기
              </button>
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
    </section>
  );
}
