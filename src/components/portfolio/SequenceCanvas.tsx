"use client";
import { useRef, useState } from "react";
import type { ArchiveWork, ArchiveLayout, Sequence } from "@/types/archive";
import { sequenceLayout } from "@/lib/sequence-layout";
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
  const model = sequenceLayout(sequence, works, layout);
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
  return (
    <div
      className="sequence-scroll"
      role="region"
      aria-label={
        locale === "ko"
          ? "왼쪽에서 오른쪽으로 이어지는 작품의 흐름"
          : "Artwork sequence from left to right"
      }
    >
      <div
        className="sequence-canvas"
        style={{ width: model.width, height: model.height }}
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
            strokeWidth="1"
          />
          {sequence.steps.map((step) => {
            const nodes = model.nodes.filter((n) => n.step.id === step.id);
            if (!nodes.length) return null;
            const first = getPosition(nodes[0]);
            const above = first.y < 0;
            const joint = model.axisY + (above ? -45 : 45);
            const xs = nodes.map((n) => getPosition(n).x);
            return (
              <g key={step.id}>
                <path
                  d={`M ${first.x} ${model.axisY} V ${joint} M ${Math.min(...xs)} ${joint} H ${Math.max(...xs)}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                />
                {nodes.map((n) => {
                  const p = getPosition(n);
                  return (
                    <line
                      key={n.key}
                      x1={p.x}
                      x2={p.x}
                      y1={joint}
                      y2={
                        model.axisY +
                        p.y +
                        (p.y < 0 ? n.height / 2 : -n.height / 2)
                      }
                      stroke="currentColor"
                      strokeWidth="1"
                    />
                  );
                })}
              </g>
            );
          })}
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
                        Math.hypot(e.clientX - d.startX, e.clientY - d.startY) <
                          4
                      )
                        return;
                      d.moved = true;
                      d.nextX = Math.max(
                        95,
                        Math.min(50000, d.x + e.clientX - d.startX),
                      );
                      d.nextY = Math.max(
                        -3000,
                        Math.min(3000, d.y + e.clientY - d.startY),
                      );
                      // Leave room for the shared axis and its labels.
                      if (Math.abs(d.nextY) < 75 + n.height / 2)
                        d.nextY = (d.nextY < 0 ? -1 : 1) * (75 + n.height / 2);
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
                      const nextY = Math.max(-3000, Math.min(3000, n.y + dy));
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
  );
}
