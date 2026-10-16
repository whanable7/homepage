"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { ArchiveWork, WorkGroup } from "@/types/archive";
import { representativeColor, groupEdges } from "@/lib/layouts";
import { useLocale } from "@/i18n";
import { getLocalizedValue } from "@/lib/i18n-utils";
import { WorkImage } from "./WorksBrowser";
export default function WorksCosmos({
  works,
  groups,
  stars,
  onOpen,
}: {
  works: ArchiveWork[];
  groups: WorkGroup[];
  stars: Record<string, 1 | 2 | 3>;
  onOpen: (w: ArchiveWork) => void;
}) {
  const { locale } = useLocale(),
    host = useRef<HTMLDivElement>(null),
    playing = useRef(true),
    [running, setRunning] = useState(true),
    [hover, setHover] = useState<ArchiveWork | null>(null),
    [failed, setFailed] = useState(false),
    [explore, setExplore] = useState(false),
    controlsRef = useRef<OrbitControls | null>(null);
  const callbacks = useRef({ onOpen, setHover });
  useEffect(() => {
    callbacks.current = { onOpen, setHover };
  }, [onOpen]);
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enabled = explore;
      if (controlsRef.current.domElement instanceof HTMLElement)
        controlsRef.current.domElement.style.touchAction = explore
          ? "none"
          : "pan-y";
    }
  }, [explore]);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "low-power",
      });
    } catch {
      queueMicrotask(() => setFailed(true));
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1500);
    camera.position.set(0, 0, 340);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enabled = false;
    renderer.domElement.style.touchAction = "pan-y";
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 170;
    controls.maxDistance = 600;
    controlsRef.current = controls;
    const tilt = new THREE.Group();
    tilt.rotation.set(1.04, 0, 0.42);
    scene.add(tilt);
    const disk = new THREE.Group();
    tilt.add(disk);
    const positions = new Map<string, THREE.Vector3>();
    function hash(value: string) {
      let h = 2166136261;
      for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
      return (h >>> 0) / 4294967296;
    }
    works.forEach((work, i) => {
      const memberships = groups
          .map((g, j) => (g.artworkIds.includes(work.id) ? j : -1))
          .filter((j) => j >= 0),
        group = memberships[0];
      const a =
        group === undefined
          ? i * 2.399963
          : (group / Math.max(groups.length, 1)) * Math.PI * 2 +
            (hash(work.id + "angle") - 0.5) * 0.8;
      const r =
          25 +
          Math.sqrt(hash(work.id + "r")) *
            96 *
            (0.86 + hash(work.id + "edge") * 0.14),
        z = (hash(work.id + "z") - 0.5) * 13;
      positions.set(
        work.id,
        new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, z),
      );
    });
    const spriteCanvas = document.createElement("canvas");
    spriteCanvas.width = 32;
    spriteCanvas.height = 32;
    const ctx = spriteCanvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.18, "rgba(255,255,255,1)");
    gradient.addColorStop(0.45, "rgba(255,255,255,.35)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    const texture = new THREE.CanvasTexture(spriteCanvas),
      points: THREE.Points[] = [];
    for (const size of [1, 2, 3]) {
      const subset = works.filter((w) => (stars[w.id] || 1) === size),
        geometry = new THREE.BufferGeometry(),
        coords: number[] = [],
        colors: number[] = [];
      subset.forEach((w) => {
        const p = positions.get(w.id)!;
        coords.push(p.x, p.y, p.z);
        const color = new THREE.Color(representativeColor(w));
        const hsl = color.getHSL({ h: 0, s: 0, l: 0 });
        color.setHSL(hsl.h, hsl.s, Math.max(0.32, Math.min(0.72, hsl.l)));
        colors.push(color.r, color.g, color.b);
      });
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(coords, 3),
      );
      geometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(colors, 3),
      );
      const material = new THREE.PointsMaterial({
        map: texture,
        size: [0, 7, 11, 16][size],
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        alphaTest: 0.01,
        blending: THREE.AdditiveBlending,
      });
      const cloud = new THREE.Points(geometry, material);
      cloud.userData.works = subset;
      disk.add(cloud);
      points.push(cloud);
    }
    const edgePairs = groupEdges(groups),
      lineCoords: number[] = [];
    edgePairs.forEach(([a, b]) => {
      const p = positions.get(a),
        q = positions.get(b);
      if (p && q) lineCoords.push(p.x, p.y, p.z, q.x, q.y, q.z);
    });
    const lines = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.Float32BufferAttribute(lineCoords, 3),
      ),
      new THREE.LineBasicMaterial({
        color: "#DCE2EF",
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      }),
    );
    disk.add(lines);
    const active = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: "#DCE2EF",
        transparent: true,
        opacity: 0.76,
        depthWrite: false,
      }),
    );
    disk.add(active);
    const dustCoords: number[] = [];
    for (let i = 0; i < 130; i++) {
      const a = i * 2.399963,
        r = 40 + hash("dust" + i) * 240;
      dustCoords.push(
        Math.cos(a) * r,
        Math.sin(a) * r,
        (hash("depth" + i) - 0.5) * 160,
      );
    }
    const dust = new THREE.Points(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.Float32BufferAttribute(dustCoords, 3),
      ),
      new THREE.PointsMaterial({
        color: "#CAD0DC",
        size: 0.45,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      }),
    );
    scene.add(dust);
    let pointerInside = false,
      manualStop = false,
      lastId = "",
      down: { x: number; y: number } | null = null;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    playing.current = !reduced.matches;
    queueMicrotask(() => setRunning(playing.current));
    const ray = new THREE.Raycaster();
    ray.params.Points = { threshold: 3 };
    const mouse = new THREE.Vector2();
    function pick(e: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(mouse, camera);
      const hit = ray.intersectObjects(points, false)[0];
      return hit
        ? (hit.object.userData.works as ArchiveWork[])[hit.index!]
        : null;
    }
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const work = pick(e);
      if ((work?.id || "") === lastId) return;
      lastId = work?.id || "";
      callbacks.current.setHover(work);
      const coords: number[] = [];
      if (work)
        edgePairs.forEach(([a, b]) => {
          if (a !== work.id && b !== work.id) return;
          const p = positions.get(a),
            q = positions.get(b);
          if (p && q) coords.push(p.x, p.y, p.z, q.x, q.y, q.z);
        });
      active.geometry.dispose();
      active.geometry = new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.Float32BufferAttribute(coords, 3),
      );
    };
    const enter = () => {
        pointerInside = true;
      },
      leave = () => {
        pointerInside = false;
        lastId = "";
        callbacks.current.setHover(null);
        active.geometry.dispose();
        active.geometry = new THREE.BufferGeometry();
      };
    const press = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
      manualStop = true;
      playing.current = false;
      setRunning(false);
    };
    const release = (e: PointerEvent) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) {
        const work = pick(e);
        if (work) callbacks.current.onOpen(work);
      }
      down = null;
    };
    const resize = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    });
    resize.observe(el);
    const canvas = renderer.domElement;
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerenter", enter);
    canvas.addEventListener("pointerleave", leave);
    canvas.addEventListener("pointerdown", press);
    canvas.addEventListener("pointerup", release);
    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const delta = Math.min(0.05, clock.getDelta());
      if (document.hidden) return;
      if (playing.current && !pointerInside && !reduced.matches) {
        manualStop = false;
        disk.rotation.z -= (delta * Math.PI * 2) / 240;
      }
      void manualStop;
      controls.update();
      renderer.render(scene, camera);
    });
    return () => {
      resize.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      controlsRef.current = null;
      scene.traverse((obj) => {
        if (obj instanceof THREE.Points || obj instanceof THREE.LineSegments) {
          obj.geometry.dispose();
          const materials = Array.isArray(obj.material)
            ? obj.material
            : [obj.material];
          materials.forEach((m) => m.dispose());
        }
      });
      texture.dispose();
      renderer.dispose();
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerenter", enter);
      canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("pointerdown", press);
      canvas.removeEventListener("pointerup", release);
      canvas.remove();
    };
  }, [works, groups, stars]);
  return (
    <div className="cosmos-field">
      <div
        ref={host}
        className="cosmos-canvas"
        aria-label={
          locale === "ko"
            ? "작품을 별로 표현한 3차원 천체"
            : "Three-dimensional artwork cosmos"
        }
        role="img"
      />
      {failed && (
        <p className="works-empty">
          {locale === "ko"
            ? "이 기기에서 3D 화면을 열 수 없습니다. 연도 보기에서 작품을 감상해 주세요."
            : "3D is unavailable on this device. Please use Years."}
        </p>
      )}
      <div className="space-bottom">
        <button
          onClick={() => {
            playing.current = !playing.current;
            queueMicrotask(() => setRunning(playing.current));
          }}
          aria-pressed={running}
        >
          {locale === "ko"
            ? running
              ? "회전 멈추기"
              : "회전 재생"
            : running
              ? "Pause rotation"
              : "Play rotation"}
        </button>
        <button onClick={() => setExplore(!explore)} aria-pressed={explore}>
          {locale === "ko"
            ? explore
              ? "탐색 끝내기"
              : "공간 탐색"
            : "Explore"}
        </button>
      </div>
      {hover && (
        <div className="space-preview" aria-hidden="true">
          <div>
            <WorkImage work={hover} />
          </div>
          <p>{getLocalizedValue(locale, hover.title, hover.title_en)}</p>
        </div>
      )}
      <details className="cosmos-access">
        <summary>{locale === "ko" ? "작품 목록" : "Artwork list"}</summary>
        <div>
          {works.map((w) => (
            <button key={w.id} onClick={() => onOpen(w)}>
              {getLocalizedValue(locale, w.title, w.title_en)}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
