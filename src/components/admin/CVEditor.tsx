"use client";
import { useEffect, useRef, useState } from "react";
import { useUnsavedGuard } from "./useUnsavedGuard";
import { cvLabels, orderedSections } from "@/lib/cv";
type Item = Record<string, string>;
type CVData = {
  cv_section_order?: string[];
  cv_exhibition_order?: string[];
  projects?: Item[];
  [key: string]: unknown;
};
export default function CVEditor() {
  const [about, setAbout] = useState<CVData | null>(null),
    [exhibitions, setExhibitions] = useState<Item[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    drag = useRef<string | null>(null),
    baseline = useRef("");
  useUnsavedGuard(!!about && JSON.stringify(about) !== baseline.current);
  useEffect(() => {
    Promise.all([
      fetch("/api/about").then((r) => r.json()),
      fetch("/api/exhibitions").then((r) => r.json()),
    ])
      .then(([a, b]) => {
        baseline.current = JSON.stringify(a);
        setAbout(a);
        setExhibitions(b);
      })
      .catch(() => setMessage("CV 정보를 불러오지 못했습니다."));
  }, []);
  if (!about) return <p>{message || "불러오는 중…"}</p>;
  const order = orderedSections(about.cv_section_order);
  function moveSection(from: string, to: string) {
    if (!about) return;
    const next = [...order],
      a = next.indexOf(from),
      b = next.indexOf(to);
    if (a < 0 || b < 0) return;
    next.splice(a, 1);
    next.splice(b, 0, from);
    setAbout({ ...about, cv_section_order: next });
  }
  async function save() {
    setBusy(true);
    try {
      const response = await fetch("/api/about", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(about),
      });
      if (!response.ok) throw new Error();
      const saved = await response.json();
      baseline.current = JSON.stringify(saved);
      setAbout(saved);
      setMessage("CV를 저장했습니다.");
    } catch {
      setMessage("CV 저장에 실패했습니다. 입력 내용은 그대로 남아 있습니다.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="admin-actions">
        <h2>CV 순서와 프로젝트</h2>
        <button
          disabled={busy}
          onClick={() => {
            setAbout(JSON.parse(baseline.current));
            setMessage("작성 중인 변경을 취소했습니다.");
          }}
        >
          작성 취소
        </button>
        <button onClick={save} disabled={busy}>
          CV 저장
        </button>
      </div>
      <p role="status">{message}</p>
      <p>
        항목을 끌어서 옮기거나 화살표를 누르세요. 순서는 한국어와 영어에 함께
        적용됩니다.
      </p>
      {order.map((key, index) => {
        const isExhibition = ["solo", "group", "popup"].includes(key),
          items = isExhibition
            ? exhibitions
                .filter((e) => e.type === key)
                .sort((a, b) => {
                  const ids = about.cv_exhibition_order || [];
                  return (
                    (ids.includes(a.id) ? ids.indexOf(a.id) : 9999) -
                    (ids.includes(b.id) ? ids.indexOf(b.id) : 9999)
                  );
                })
            : ((about[key] || []) as Item[]);
        const reorder = (from: number, to: number) => {
          const next = [...items];
          [next[from], next[to]] = [next[to], next[from]];
          if (isExhibition) {
            const other = [
              ...new Set([
                ...(about.cv_exhibition_order || []),
                ...exhibitions.map((e) => e.id),
              ]),
            ].filter((id) => !items.some((item) => item.id === id));
            setAbout({
              ...about,
              cv_exhibition_order: [...next.map((e) => e.id), ...other],
            });
          } else setAbout({ ...about, [key]: next });
        };
        return (
          <section
            className="cv-admin-section"
            key={key}
            draggable
            onDragStart={(e) => {
              if ((e.target as Element).closest("input,textarea,button"))
                return;
              drag.current = key;
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (drag.current) moveSection(drag.current, key);
              drag.current = null;
            }}
          >
            <div className="admin-actions">
              <h3>
                {cvLabels[key][0]} / {cvLabels[key][1]}
              </h3>
              <button
                aria-label="항목 위로"
                disabled={!index}
                onClick={() => moveSection(key, order[index - 1])}
              >
                ↑
              </button>
              <button
                aria-label="항목 아래로"
                disabled={index === order.length - 1}
                onClick={() => moveSection(key, order[index + 1])}
              >
                ↓
              </button>
              {key === "projects" && (
                <button
                  onClick={() =>
                    setAbout({
                      ...about,
                      projects: [
                        ...(about.projects || []),
                        {
                          id: crypto.randomUUID(),
                          year: "",
                          title: "",
                          title_en: "",
                          role: "",
                          role_en: "",
                          organization: "",
                          organization_en: "",
                          location: "",
                          location_en: "",
                          description: "",
                          description_en: "",
                          url: "",
                        },
                      ],
                    })
                  }
                >
                  프로젝트 추가
                </button>
              )}
            </div>
            {items.map((item, i) => (
              <div className="cv-admin-item" key={item.id || i}>
                <div className="admin-actions">
                  <span>
                    {item.year} ·{" "}
                    {item.title ||
                      item.description ||
                      item.name ||
                      item.program ||
                      "새 기록"}
                  </span>
                  <button
                    aria-label="기록 위로"
                    disabled={!i}
                    onClick={() => reorder(i, i - 1)}
                  >
                    ↑
                  </button>
                  <button
                    aria-label="기록 아래로"
                    disabled={i === items.length - 1}
                    onClick={() => reorder(i, i + 1)}
                  >
                    ↓
                  </button>
                </div>
                {key === "projects" && (
                  <>
                    <div className="admin-form-grid">
                      {[
                        ["year", "기간 · 진행 중이면 현재까지 표기"],
                        ["title", "프로젝트명"],
                        ["title_en", "프로젝트명 · English"],
                        ["role", "역할"],
                        ["role_en", "역할 · English"],
                        ["organization", "기관 · 협업자"],
                        ["organization_en", "기관 · 협업자 · English"],
                        ["location", "장소"],
                        ["location_en", "장소 · English"],
                        ["description", "설명"],
                        ["description_en", "설명 · English"],
                        ["url", "관련 링크"],
                      ].map(([field, label]) => (
                        <label className="admin-field" key={field}>
                          {label}
                          <input
                            value={item[field] || ""}
                            onChange={(e) =>
                              setAbout({
                                ...about,
                                projects: items.map((v, j) =>
                                  j === i
                                    ? { ...v, [field]: e.target.value }
                                    : v,
                                ),
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <button
                      onClick={() =>
                        setAbout({
                          ...about,
                          projects: items.filter((_, j) => j !== i),
                        })
                      }
                    >
                      이 프로젝트 기록 제거
                    </button>
                  </>
                )}
              </div>
            ))}
          </section>
        );
      })}
    </section>
  );
}
