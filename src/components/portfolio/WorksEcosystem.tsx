"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceX,
  forceY,
} from "d3-force";
import type { Simulation, SimulationLinkDatum } from "d3-force";
import { groupEdges } from "@/lib/layouts";
import { ecosystemNodes, separateEcosystemNodes } from "@/lib/ecosystem-layout";
import type { EcosystemNode } from "@/lib/ecosystem-layout";
import { useLocale } from "@/i18n";
import { getLocalizedValue } from "@/lib/i18n-utils";
import type { ArchiveWork, WorkGroup } from "@/types/archive";
import { WorkImage } from "./WorksBrowser";
type Edge = SimulationLinkDatum<EcosystemNode>;
const defaults = { repulsion: 120, center: 0.05, distance: 130, tension: 0.8 };
export default function WorksEcosystem({
  works,
  groups,
  onOpen,
}: {
  works: ArchiveWork[];
  groups: WorkGroup[];
  onOpen: (work: ArchiveWork) => void;
}) {
  const { locale } = useLocale();
  const container = useRef<HTMLDivElement>(null);
  const nodesRef = useRef(new Map<string, HTMLButtonElement>());
  const linesRef = useRef(new Map<string, SVGLineElement>());
  const simulation = useRef<Simulation<EcosystemNode, Edge> | null>(null);
  const paint = useRef<() => void>(() => {});
  const suppressedClick = useRef(false);
  const nodeDrag = useRef<{
    node: EcosystemNode;
    x: number;
    y: number;
    startX: number;
    startY: number;
  } | null>(null);
  const fieldDrag = useRef<{
    x: number;
    y: number;
    px: number;
    py: number;
  } | null>(null);
  const [hover, setHover] = useState<ArchiveWork | null>(null);
  const [settings, setSettings] = useState(false);
  const [physics, setPhysics] = useState(defaults);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [explore, setExplore] = useState(false);
  const [size, setSize] = useState({ width: 1000, height: 600 });
  const physicsRef = useRef(physics);
  useEffect(() => {
    physicsRef.current = physics;
  }, [physics]);
  const model = useMemo(() => {
    const width = Math.max(900, Math.sqrt(works.length) * 115);
    const height = Math.max(650, width * 0.72);
    const nodes = ecosystemNodes(works, width, height);
    const map = new Map(nodes.map((n) => [n.id, n]));
    return {
      width,
      height,
      nodes,
      map,
      edges: groupEdges(groups).filter(([a, b]) => map.has(a) && map.has(b)),
    };
  }, [works, groups]);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const p = physicsRef.current;
    const sim = forceSimulation<EcosystemNode>(model.nodes)
      .force(
        "links",
        forceLink<EcosystemNode, Edge>(
          model.edges.map(([source, target]) => ({ source, target })),
        )
          .id((n) => n.id)
          .distance(p.distance)
          .strength(p.tension),
      )
      .force("charge", forceManyBody().strength(-p.repulsion))
      .force("x", forceX(model.width / 2).strength(p.center))
      .force("y", forceY(model.height / 2).strength(p.center))
      .force(
        "collision",
        forceCollide<EcosystemNode>()
          .radius((n) => Math.hypot(n.width, n.height) / 2 + 7)
          .iterations(2),
      )
      .velocityDecay(0.4)
      .alphaDecay(0.025)
      .alphaMin(0.005)
      .stop();
    simulation.current = sim;
    let frame = 0;
    const draw = () => {
      model.nodes.forEach((n) => {
        const button = nodesRef.current.get(n.id);
        if (button)
          button.style.transform = `translate(${n.x - n.width / 2}px,${n.y - n.height / 2}px)`;
      });
      model.edges.forEach(([a, b]) => {
        const line = linesRef.current.get([a, b].sort().join("|"));
        const source = model.map.get(a)!,
          target = model.map.get(b)!;
        if (line) {
          line.setAttribute("x1", String(source.x));
          line.setAttribute("y1", String(source.y));
          line.setAttribute("x2", String(target.x));
          line.setAttribute("y2", String(target.y));
        }
      });
    };
    paint.current = draw;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const settle = () => {
      sim.stop().tick(240);
      separateEcosystemNodes(model.nodes, model.width, model.height, 80);
      draw();
    };
    sim.tick(80);
    separateEcosystemNodes(model.nodes, model.width, model.height, 80);
    draw();
    sim
      .on("tick", () => {
        separateEcosystemNodes(model.nodes, model.width, model.height, 5);
        if (!frame)
          frame = requestAnimationFrame(() => {
            frame = 0;
            draw();
          });
      })
      .on("end", () => {
        separateEcosystemNodes(model.nodes, model.width, model.height, 80);
        draw();
      });
    if (reduced.matches) settle();
    else sim.restart();
    const visibility = () => {
      if (document.hidden) sim.stop();
      else if (!reduced.matches && sim.alpha() > sim.alphaMin()) sim.restart();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      sim.stop();
      cancelAnimationFrame(frame);
      simulation.current = null;
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [model]);
  useEffect(() => {
    const sim = simulation.current;
    if (!sim) return;
    (sim.force("charge") as ReturnType<typeof forceManyBody>).strength(
      -physics.repulsion,
    );
    (sim.force("x") as ReturnType<typeof forceX>).strength(physics.center);
    (sim.force("y") as ReturnType<typeof forceY>).strength(physics.center);
    (sim.force("links") as ReturnType<typeof forceLink<EcosystemNode, Edge>>)
      .distance(physics.distance)
      .strength(physics.tension);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sim.alpha(0.7).stop().tick(240);
      separateEcosystemNodes(model.nodes, model.width, model.height, 80);
      paint.current();
    } else sim.alpha(0.7).restart();
  }, [physics, model]);
  // Leave the right edge free for a preview instead of covering other works.
  const scale =
    Math.min(
      size.width / (model.width + 210),
      size.height / (model.height + 40),
      1,
    ) * zoom;
  const offsetX = (size.width - (model.width + 210) * scale) / 2;
  const offsetY = (size.height - model.height * scale) / 2;
  function releaseNode() {
    const drag = nodeDrag.current;
    if (!drag) return;
    drag.node.fx = null;
    drag.node.fy = null;
    nodeDrag.current = null;
    simulation.current?.alphaTarget(0).restart();
  }
  const controls = [
    {
      key: "repulsion",
      ko: "반발력",
      en: "Repulsion",
      min: 20,
      max: 300,
      step: 1,
    },
    {
      key: "center",
      ko: "중심으로 당기는 힘",
      en: "Center attraction",
      min: 0.005,
      max: 0.15,
      step: 0.005,
    },
    {
      key: "distance",
      ko: "연결 길이",
      en: "Link distance",
      min: 50,
      max: 220,
      step: 1,
    },
    {
      key: "tension",
      ko: "연결 강도",
      en: "Link tension",
      min: 0.05,
      max: 1,
      step: 0.05,
    },
  ] as const;
  return (
    <div
      className="ecosystem-field"
      ref={container}
      style={{ touchAction: explore ? "none" : "pan-y" }}
      onPointerDown={(e) => {
        if (
          (!explore && e.pointerType !== "mouse") ||
          (e.target instanceof Element &&
            e.target.closest("button,input,label"))
        )
          return;
        fieldDrag.current = {
          x: e.clientX,
          y: e.clientY,
          px: pan.x,
          py: pan.y,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = fieldDrag.current;
        if (d) setPan({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y });
      }}
      onPointerUp={() => {
        fieldDrag.current = null;
      }}
      onPointerCancel={() => {
        fieldDrag.current = null;
      }}
    >
      <div
        className="ecosystem-map"
        style={{
          width: model.width + 210,
          height: model.height,
          transform: `translate(${offsetX + pan.x}px,${offsetY + pan.y}px) scale(${scale})`,
        }}
      >
        <svg width={model.width + 210} height={model.height} aria-hidden="true">
          {model.edges.map(([a, b]) => {
            const key = [a, b].sort().join("|"),
              active = hover?.id === a || hover?.id === b;
            return (
              <line
                key={key}
                ref={(el) => {
                  if (el) linesRef.current.set(key, el);
                  else linesRef.current.delete(key);
                }}
                x1={model.map.get(a)!.x}
                y1={model.map.get(a)!.y}
                x2={model.map.get(b)!.x}
                y2={model.map.get(b)!.y}
                stroke={active ? "#505050" : "#646464"}
                strokeOpacity={active ? 0.92 : 0.6}
                strokeWidth={active ? 1.5 : 1.05}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
        {model.nodes.map((n) => {
          const w = works.find((work) => work.id === n.id)!;
          return (
            <button
              key={n.id}
              type="button"
              className="ecosystem-work"
              ref={(el) => {
                if (el) nodesRef.current.set(n.id, el);
                else nodesRef.current.delete(n.id);
              }}
              style={{
                left: 0,
                top: 0,
                width: n.width,
                height: n.height,
                transform: `translate(${n.x - n.width / 2}px,${n.y - n.height / 2}px)`,
              }}
              onPointerEnter={(e) => {
                if (e.pointerType === "mouse") setHover(w);
              }}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(w)}
              onBlur={() => setHover(null)}
              onPointerDown={(e) => {
                suppressedClick.current = false;
                if (e.pointerType !== "mouse" && !explore) return;
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
                nodeDrag.current = {
                  node: n,
                  x: n.x,
                  y: n.y,
                  startX: e.clientX,
                  startY: e.clientY,
                };
              }}
              onPointerMove={(e) => {
                const d = nodeDrag.current;
                if (!d || d.node.id !== n.id) return;
                const dx = e.clientX - d.startX,
                  dy = e.clientY - d.startY;
                if (!suppressedClick.current && Math.hypot(dx, dy) < 6) return;
                suppressedClick.current = true;
                setHover(null);
                n.fx = Math.max(
                  20 + n.width / 2,
                  Math.min(model.width - 20 - n.width / 2, d.x + dx / scale),
                );
                n.fy = Math.max(
                  20 + n.height / 2,
                  Math.min(model.height - 20 - n.height / 2, d.y + dy / scale),
                );
                n.x = n.fx;
                n.y = n.fy;
                simulation.current?.alphaTarget(0.15).restart();
                paint.current();
              }}
              onPointerUp={releaseNode}
              onPointerCancel={releaseNode}
              onClick={(e) => {
                if (!suppressedClick.current || e.detail === 0) onOpen(w);
              }}
              aria-label={getLocalizedValue(locale, w.title, w.title_en)}
            >
              <WorkImage work={w} sizes="100px" />
            </button>
          );
        })}
      </div>
      <div className="space-controls">
        <button onClick={() => setSettings(!settings)} aria-expanded={settings}>
          {locale === "ko" ? "배치 설정" : "Physics settings"}
        </button>
        {settings && (
          <div className="space-settings">
            {controls.map((c) => (
              <label key={c.key}>
                <span>{locale === "ko" ? c.ko : c.en}</span>
                <input
                  aria-label={locale === "ko" ? c.ko : c.en}
                  type="range"
                  min={c.min}
                  max={c.max}
                  step={c.step}
                  value={physics[c.key]}
                  onChange={(e) =>
                    setPhysics((p) => ({
                      ...p,
                      [c.key]: Number(e.target.value),
                    }))
                  }
                />
              </label>
            ))}
            <button onClick={() => setPhysics({ ...defaults })}>
              {locale === "ko" ? "기본값으로" : "Reset"}
            </button>
          </div>
        )}
      </div>
      <div className="space-bottom">
        <button onClick={() => setExplore(!explore)} aria-pressed={explore}>
          {locale === "ko"
            ? explore
              ? "탐색 끝내기"
              : "공간 탐색"
            : "Explore"}
        </button>
        <div>
          <button
            onClick={() => setZoom((z) => Math.max(0.7, z / 1.3))}
            aria-label="축소"
          >
            −
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(5, z * 1.3))}
            aria-label="확대"
          >
            +
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            {locale === "ko" ? "전체" : "Fit"}
          </button>
        </div>
      </div>
      {hover && (
        <div className="space-preview" aria-hidden="true">
          <div>
            <WorkImage work={hover} />
          </div>
          <p>{getLocalizedValue(locale, hover.title, hover.title_en)}</p>
        </div>
      )}
    </div>
  );
}
