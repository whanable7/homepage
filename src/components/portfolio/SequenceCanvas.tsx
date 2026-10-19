"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ArchiveWork, ArchiveLayout, Sequence } from "@/types/archive";
import {
  sequenceLayout,
  sequenceConnections,
  fitSequence,
} from "@/lib/sequence-layout";
import { useLocale } from "@/i18n";
import { getLocalizedValue } from "@/lib/i18n-utils";
import { WorkImage } from "./WorksBrowser";

export default function SequenceCanvas({
  sequence,
  works,
  layout,
  onOpen,
  onPosition,
}: {
  sequence: Sequence;
  works: ArchiveWork[];
  layout?: Pick<ArchiveLayout, "yearOrder">;
  onOpen?: (work: ArchiveWork) => void;
  onPosition?: (key: string, position: { x: number; y: number }) => void;
}) {
  const { locale } = useLocale();
  const model = useMemo(
    () => sequenceLayout(sequence, works, layout),
    [sequence, works, layout],
  );
  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1000, height: 500 });
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);
  const fit = fitSequence(model.width, model.height, size.width, size.height);
  const scale = fit * zoom;
  const fullView = () => {
    setZoom(1);
    viewport.current?.scrollTo({ left: 0, top: 0 });
  };
  const drag = useRef<{
    key: string;
    startX: number;
    startY: number;
    x: number;
    y: number;
    nextX: number;
    nextY: number;
    moved: boolean;
  } | null>(null);
  const [moving, setMoving] = useState<{
    key: string;
    x: number;
    y: number;
  } | null>(null);
  const suppressed = useRef(false);
  const getPosition = (n: (typeof model.nodes)[number]) =>
    moving?.key === n.key ? moving : n;
  const lines = sequenceConnections(
    model.nodes.map((n) => ({ ...n, ...getPosition(n) })),
    model.axisY,
  );
  return (
    <section className="sequence-viewer">
      <div className="sequence-view-controls">
        <button onClick={fullView}>
          {locale === "ko" ? "전체 보기" : "Fit all"}
        </button>
        <button
          aria-label={locale === "ko" ? "축소" : "Zoom out"}
          disabled={zoom <= 1}
          onClick={() => setZoom((z) => Math.max(1, z / 1.4))}
        >
          −
        </button>
        <span>{Math.round(scale * 100)}%</span>
        <button
          aria-label={locale === "ko" ? "확대" : "Zoom in"}
          disabled={zoom >= Math.max(8, 1 / fit)}
          onClick={() =>
            setZoom((z) => Math.min(Math.max(8, 1 / fit), z * 1.4))
          }
        >
          ＋
        </button>
        <small>
          {locale === "ko"
            ? onPosition
              ? "이미지를 끌어 배치 · 같은 세로선 가까이 놓으면 정렬"
              : "작품을 누르면 크게 볼 수 있습니다"
            : onPosition
              ? "Drag images to arrange; nearby columns snap together"
              : "Select an artwork to enlarge"}
        </small>
      </div>
      <div
        ref={viewport}
        className="sequence-scroll"
        role="region"
        aria-label={
          locale === "ko"
            ? "왼쪽에서 오른쪽으로 이어지는 작품의 흐름"
            : "Artwork sequence from left to right"
        }
      >
        <div
          className="sequence-scaled-area"
          style={{
            width: Math.max(size.width, model.width * scale + 24),
            height: Math.max(size.height, model.height * scale + 24),
          }}
        >
          <div
            className="sequence-canvas"
            style={{
              width: model.width,
              height: model.height,
              transform: `scale(${scale})`,
              left: Math.max(12, (size.width - model.width * scale) / 2),
              top: Math.max(12, (size.height - model.height * scale) / 2),
            }}
          >
            <svg
              className="sequence-lines"
              width={model.width}
              height={model.height}
              aria-hidden="true"
            >
              <path
                d={`M 30 ${model.axisY} H ${model.width - 25} l -12 -7 m 12 7 l -12 7`}
                fill="none"
                stroke="currentColor"
                strokeWidth="0.8"
                vectorEffect="non-scaling-stroke"
              />
              {lines.map((line, index) => (
                <line
                  key={index}
                  {...line}
                  stroke="currentColor"
                  strokeWidth="0.8"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
            {sequence.steps.map((step) => {
              const first = model.nodes.find((n) => n.step.id === step.id);
              if (!first) return null;
              return (
                <span
                  className="sequence-stage-label"
                  key={step.id}
                  style={{
                    left: first.x,
                    top: model.axisY + (first.y < 0 ? 14 : -32),
                  }}
                >
                  {getLocalizedValue(locale, step.title, step.title_en)}
                </span>
              );
            })}
            {model.nodes.map((n) => {
              const p = getPosition(n);
              return (
                <button
                  key={n.key}
                  type="button"
                  data-sequence-key={n.key}
                  className={`sequence-node ${onPosition ? "sequence-node-editable" : ""}`}
                  style={{
                    left: p.x - n.width / 2,
                    top: model.axisY + p.y - n.height / 2,
                    width: n.width,
                    height: n.height,
                  }}
                  aria-label={`${getLocalizedValue(locale, n.work.title, n.work.title_en)} · ${n.work.year}${onPosition ? " · 끌어서 이동, 방향키로 조정" : ""}`}
                  onDragStart={(e) => e.preventDefault()}
                  onPointerDown={
                    onPosition
                      ? (e) => {
                          if (e.button !== 0) return;
                          suppressed.current = false;
                          e.currentTarget.setPointerCapture(e.pointerId);
                          drag.current = {
                            key: n.key,
                            startX: e.clientX,
                            startY: e.clientY,
                            x: n.x,
                            y: n.y,
                            nextX: n.x,
                            nextY: n.y,
                            moved: false,
                          };
                        }
                      : undefined
                  }
                  onPointerMove={
                    onPosition
                      ? (e) => {
                          const d = drag.current;
                          if (!d || d.key !== n.key) return;
                          if (
                            !d.moved &&
                            Math.hypot(
                              e.clientX - d.startX,
                              e.clientY - d.startY,
                            ) < 4
                          )
                            return;
                          d.moved = true;
                          d.nextX = Math.max(
                            95,
                            Math.min(
                              50000,
                              d.x + (e.clientX - d.startX) / scale,
                            ),
                          );
                          d.nextY = Math.max(
                            -3000,
                            Math.min(
                              3000,
                              d.y + (e.clientY - d.startY) / scale,
                            ),
                          );
                          const column = model.nodes.find(
                            (other) =>
                              other.key !== n.key &&
                              other.step.id === n.step.id &&
                              Math.abs(other.x - d.nextX) <
                                Math.min(12, 8 / scale),
                          );
                          if (column) d.nextX = column.x;
                          // Leave room for the shared axis and its labels.
                          if (Math.abs(d.nextY) < 75 + n.height / 2)
                            d.nextY =
                              (d.nextY < 0 ? -1 : 1) * (75 + n.height / 2);
                          setMoving({ key: n.key, x: d.nextX, y: d.nextY });
                        }
                      : undefined
                  }
                  onPointerUp={
                    onPosition
                      ? () => {
                          const d = drag.current;
                          if (d?.moved) {
                            onPosition(n.key, { x: d.nextX, y: d.nextY });
                            suppressed.current = true;
                          }
                          drag.current = null;
                          setMoving(null);
                        }
                      : undefined
                  }
                  onPointerCancel={() => {
                    drag.current = null;
                    setMoving(null);
                  }}
                  onKeyDown={
                    onPosition
                      ? (e) => {
                          const delta: Record<string, [number, number]> = {
                            ArrowLeft: [-20, 0],
                            ArrowRight: [20, 0],
                            ArrowUp: [0, -20],
                            ArrowDown: [0, 20],
                          };
                          if (!delta[e.key]) return;
                          e.preventDefault();
                          const [dx, dy] = delta[e.key];
                          const nextY = Math.max(
                            -3000,
                            Math.min(3000, n.y + dy),
                          );
                          onPosition(n.key, {
                            x: Math.max(95, Math.min(50000, n.x + dx)),
                            y:
                              Math.abs(nextY) < 75 + n.height / 2
                                ? (n.y < 0 ? 1 : -1) * (75 + n.height / 2)
                                : nextY,
                          });
                        }
                      : undefined
                  }
                  onClick={() => {
                    if (!suppressed.current) onOpen?.(n.work);
                    suppressed.current = false;
                  }}
                >
                  <WorkImage work={n.work} sizes="190px" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
