"use client";
import { useRef, useState } from "react";
import type { ArchiveLayout, ArchiveWork } from "@/types/archive";
import { orderedYearWorks } from "@/lib/year-order";
import { workDimensions } from "@/lib/admin-work-list";

export default function YearOrderEditor({
  works,
  layout,
  onChange,
  onYearChange,
  busy,
}: {
  works: ArchiveWork[];
  layout: ArchiveLayout;
  onChange: (value: ArchiveLayout) => void;
  onYearChange: (work: ArchiveWork, year: number) => Promise<void>;
  busy: boolean;
}) {
  const years = [
    ...new Set(works.filter((w) => !w.deleted_at).map((w) => w.year)),
  ].sort((a, b) => b - a);
  const [chosen, setChosen] = useState<number | null>(null);
  const year = chosen !== null && years.includes(chosen) ? chosen : years[0];
  const ordered = orderedYearWorks(works, year, layout);
  const dragging = useRef<string | null>(null);
  function move(id: string, target: number) {
    const ids = ordered.map((w) => w.id),
      from = ids.indexOf(id);
    if (
      busy ||
      from < 0 ||
      target < 0 ||
      target >= ids.length ||
      from === target
    )
      return;
    ids.splice(from, 1);
    ids.splice(target, 0, id);
    onChange({
      ...layout,
      yearOrder: { ...layout.yearOrder, [String(year)]: ids },
    });
  }
  return (
    <section className="year-order-editor">
      <label>
        연도{" "}
        <select
          aria-label="순서를 정할 연도"
          value={year ?? ""}
          onChange={(e) => setChosen(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
      <p>
        작품을 끌거나 앞·뒤 버튼으로 순서를 정하세요. 임시 저장 후 ‘작품·분류
        공개’를 누르면 반영됩니다.
      </p>
      <div className="year-order-grid">
        {ordered.map((w, i) => (
          <article
            key={w.id}
            draggable={!busy}
            onDragStart={(e) => {
              if ((e.target as HTMLElement).closest("input,button")) {
                e.preventDefault();
                return;
              }
              dragging.current = w.id;
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", w.id);
            }}
            onDragOver={(e) => {
              if (dragging.current) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragging.current) move(dragging.current, i);
              dragging.current = null;
            }}
            onDragEnd={() => {
              dragging.current = null;
            }}
          >
            <span className="year-order-number">{i + 1}</span>
            <img
              src={w.thumbnail_url || w.image_url}
              alt={w.title}
              draggable={false}
              loading="lazy"
            />
            <strong>{w.title}</strong>
            <small>
              {w.year} · {w.medium || "재료 미입력"}
            </small>
            <small>{workDimensions(w)}</small>
            {w.status === "draft" && (
              <small>임시보관 · 아직 관람 화면에 표시하지 않음</small>
            )}
            <div className="year-order-actions">
              <button
                type="button"
                disabled={busy || !i}
                aria-label={`${w.title} 앞으로`}
                onClick={() => move(w.id, i - 1)}
              >
                ← 앞
              </button>
              <button
                type="button"
                disabled={busy || i === ordered.length - 1}
                aria-label={`${w.title} 뒤로`}
                onClick={() => move(w.id, i + 1)}
              >
                뒤 →
              </button>
            </div>
            <label>
              제작연도{" "}
              <input
                aria-label={`${w.title} 제작연도`}
                type="number"
                key={w.year}
                defaultValue={w.year}
                disabled={busy}
                onBlur={(e) => {
                  const y = Number(e.target.value);
                  if (y !== w.year) void onYearChange(w, y);
                }}
              />
            </label>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={layout.excluded.years?.includes(w.id) || false}
                disabled={busy}
                onChange={(e) =>
                  onChange({
                    ...layout,
                    excluded: {
                      ...layout.excluded,
                      years: e.target.checked
                        ? [...(layout.excluded.years || []), w.id]
                        : (layout.excluded.years || []).filter(
                            (id) => id !== w.id,
                          ),
                    },
                  })
                }
              />
              이 보기에서 제외
            </label>
          </article>
        ))}
      </div>
    </section>
  );
}
