"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { ArchiveWork, WorkGroup } from "@/types/archive";
import { representativeColor, groupEdges } from "@/lib/layouts";
import { edgeKey, groupFocus } from "@/lib/group-relations";
import { useLocale } from "@/i18n";
import { getLocalizedValue } from "@/lib/i18n-utils";
import SpaceSettings from "./SpaceSettings";
import SpacePreview from "./SpacePreview";
import {
  cosmosDefaults,
  cosmosNodes,
  stepCosmos,
  cosmosHash,
} from "@/lib/cosmos-physics";
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
    [physics, setPhysics] = useState(cosmosDefaults),
    physicsRef = useRef(physics),
    needsSettle = useRef(true),
    [corner, setCorner] = useState<"left" | "right">("right"),
    [hover, setHover] = useState<ArchiveWork | null>(null),
    [failed, setFailed] = useState(false),
    controlsRef = useRef<OrbitControls | null>(null);
  const callbacks = useRef({ onOpen, setHover });
  const hoveredId = useRef("");
  useEffect(() => {
    hoveredId.current = hover?.id || "";
  }, [hover]);
  useEffect(() => {
    callbacks.current = { onOpen, setHover };
  }, [onOpen]);
  useEffect(() => {
    physicsRef.current = physics;
    needsSettle.current = true;
  }, [physics]);
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
      camera = new THREE.PerspectiveCamera(20, 1, 0.1, 10000);
    camera.position.set(0, 0, 340);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enabled = matchMedia("(pointer:fine)").matches;
    controls.enableZoom = false;
    renderer.domElement.style.touchAction = "pan-y";
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 10;
    controls.maxDistance = 3000;
    controlsRef.current = controls;
    const tilt = new THREE.Group();
    tilt.rotation.set(1.18, 0, 0.18, "ZXY");
    scene.add(tilt);
    const disk = new THREE.Group();
    tilt.add(disk);
    const nodes = cosmosNodes(
      works.map((w) => w.id),
      groups,
    );
    const positions = new Map(
      nodes.map((n) => [n.id, new THREE.Vector3(n.x, n.y, n.z)]),
    );
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const edgePairs = groupEdges(groups).filter(
      ([a, b]) => nodeMap.has(a) && nodeMap.has(b),
    );
    const physicsEdges = edgePairs.map(
      ([a, b]) =>
        [nodeMap.get(a)!, nodeMap.get(b)!] as [
          (typeof nodes)[number],
          (typeof nodes)[number],
        ],
    );
    for (let i = 0; i < 140; i++)
      stepCosmos(nodes, physicsEdges, physicsRef.current);
    nodes.forEach((n) => positions.get(n.id)!.set(n.x, n.y, n.z));
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
      cloud.userData.baseColors = colors;
      disk.add(cloud);
      points.push(cloud);
    }
    const lineCoords: number[] = [];
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
        r = 40 + cosmosHash("dust" + i) * 240;
      dustCoords.push(
        Math.cos(a) * r,
        Math.sin(a) * r,
        (cosmosHash("depth" + i) - 0.5) * 160,
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
      lastId = "",
      down: { x: number; y: number } | null = null;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    playing.current = !reduced.matches;

    const ray = new THREE.Raycaster();
    ray.params.Points = { threshold: 3 };
    const mouse = new THREE.Vector2();
    let highlightedId = "";
    let activePairs: [string, string][] = [];
    function highlight(id: string) {
      highlightedId = id;
      const focus = groupFocus(groups, id);
      activePairs = edgePairs.filter(([a, b]) =>
        focus.edges.has(edgeKey(a, b)),
      );
      const coords = activePairs.flatMap(([a, b]) => {
        const p = positions.get(a)!,
          q = positions.get(b)!;
        return [p.x, p.y, p.z, q.x, q.y, q.z];
      });
      active.geometry.dispose();
      active.geometry = new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.Float32BufferAttribute(coords, 3),
      );
      (lines.material as THREE.LineBasicMaterial).opacity = id ? 0.1 : 0.18;
      for (const cloud of points) {
        const colors = cloud.geometry.getAttribute("color");
        const base = cloud.userData.baseColors as number[];
        (cloud.userData.works as ArchiveWork[]).forEach((w, i) => {
          const factor = !id ? 1 : focus.ids.has(w.id) ? 1.28 : 0.35;
          colors.setXYZ(
            i,
            base[i * 3] * factor,
            base[i * 3 + 1] * factor,
            base[i * 3 + 2] * factor,
          );
        });
        colors.needsUpdate = true;
      }
    }
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
      hoveredId.current = lastId;
      callbacks.current.setHover(work);
      const rect = el.getBoundingClientRect();
      setCorner(e.clientX > rect.left + rect.width / 2 ? "left" : "right");
    };
    const enter = () => {
        pointerInside = true;
      },
      leave = () => {
        pointerInside = false;
        lastId = "";
        hoveredId.current = "";
        callbacks.current.setHover(null);
      };
    const press = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
      // A click previews a work; only dragging ends automatic rotation.
    };
    const release = (e: PointerEvent) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) {
        const work = pick(e);
        if (work) callbacks.current.onOpen(work);
      } else if (down) playing.current = false;
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
    const world = new THREE.Vector3(),
      inverse = new THREE.Quaternion();
    const rotationChanged = () => {
      playing.current = false;
    };
    controls.addEventListener("start", rotationChanged);
    let accumulator = 0;

    renderer.setAnimationLoop(() => {
      const delta = Math.min(0.05, clock.getDelta());
      if (document.hidden) return;
      const p = physicsRef.current;
      if (reduced.matches && needsSettle.current) {
        for (let i = 0; i < 180; i++) stepCosmos(nodes, physicsEdges, p);
        needsSettle.current = false;
      }
      if (!reduced.matches) {
        accumulator += delta;
        let steps = 0;
        while (accumulator >= 1 / 60 && steps++ < 3) {
          stepCosmos(nodes, physicsEdges, p);
          accumulator -= 1 / 60;
        }
      }
      nodes.forEach((n) => positions.get(n.id)!.set(n.x, n.y, n.z));
      for (const cloud of points) {
        const attr = cloud.geometry.getAttribute("position");
        (cloud.userData.works as ArchiveWork[]).forEach((w, i) => {
          const v = positions.get(w.id)!;
          attr.setXYZ(i, v.x, v.y, v.z);
        });
        attr.needsUpdate = true;
        cloud.geometry.computeBoundingSphere();
      }
      const linePositions = lines.geometry.getAttribute("position");
      edgePairs.forEach(([a, b], i) => {
        const v = positions.get(a)!,
          w = positions.get(b)!;
        linePositions.setXYZ(i * 2, v.x, v.y, v.z);
        linePositions.setXYZ(i * 2 + 1, w.x, w.y, w.z);
      });
      linePositions.needsUpdate = true;
      lines.geometry.computeBoundingSphere();
      if (highlightedId !== hoveredId.current) highlight(hoveredId.current);
      const activeAttr = active.geometry.getAttribute("position");
      if (activeAttr && activeAttr.count === activePairs.length * 2) {
        activePairs.forEach(([a, b], i) => {
          const v = positions.get(a)!,
            w = positions.get(b)!;
          activeAttr.setXYZ(i * 2, v.x, v.y, v.z);
          activeAttr.setXYZ(i * 2 + 1, w.x, w.y, w.z);
        });
        activeAttr.needsUpdate = true;
        active.geometry.computeBoundingSphere();
      }
      if (playing.current && !pointerInside && !reduced.matches)
        disk.rotation.z -= ((delta * Math.PI * 2) / 240) * p.rotation;
      controls.update();
      scene.updateMatrixWorld(true);
      inverse.copy(camera.quaternion).invert();
      let distance = 80;
      const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      for (const n of nodes) {
        world
          .set(n.x, n.y, n.z)
          .applyMatrix4(disk.matrixWorld)
          .sub(controls.target)
          .applyQuaternion(inverse);
        distance = Math.max(
          distance,
          world.z +
            Math.max(
              (Math.abs(world.x) + 6) / (tangent * camera.aspect * 0.94),
              (Math.abs(world.y) + 6) / (tangent * 0.9),
            ),
        );
      }
      camera.position
        .sub(controls.target)
        .normalize()
        .multiplyScalar(distance)
        .add(controls.target);
      camera.updateMatrixWorld();
      renderer.render(scene, camera);
    });
    return () => {
      resize.disconnect();
      renderer.setAnimationLoop(null);
      controls.removeEventListener("start", rotationChanged);
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
      <SpaceSettings
        controls={[
          {
            key: "repulsion",
            ko: "반발력",
            en: "repulsion",
            min: 5,
            max: 150,
            step: 1,
          },
          {
            key: "center",
            ko: "중심으로 당기는 힘",
            en: "center attraction",
            min: 0.005,
            max: 0.06,
            step: 0.001,
          },
          {
            key: "distance",
            ko: "연결 길이",
            en: "link distance",
            min: 15,
            max: 100,
            step: 1,
          },
          {
            key: "tension",
            ko: "연결 강도",
            en: "link tension",
            min: 0,
            max: 0.06,
            step: 0.002,
          },
          {
            key: "damping",
            ko: "움직임 유지",
            en: "motion persistence",
            min: 0.5,
            max: 0.94,
            step: 0.01,
          },
          {
            key: "rotation",
            ko: "회전 속도",
            en: "rotation speed",
            min: 0,
            max: 2,
            step: 0.1,
          },
        ]}
        values={physics}
        onChange={(key, value) => {
          setPhysics((p) => ({ ...p, [key]: value }));
          if (key === "rotation") playing.current = true;
        }}
        onReset={() => {
          setPhysics({ ...cosmosDefaults });
          playing.current = true;
        }}
      />
      {hover && <SpacePreview work={hover} corner={corner} />}
      <details className="cosmos-access">
        <summary>{locale === "ko" ? "작품 목록" : "Artwork list"}</summary>
        <div>
          {works.map((w) => (
            <button
              key={w.id}
              onFocus={() => setHover(w)}
              onBlur={() => setHover(null)}
              onClick={() => onOpen(w)}
            >
              {getLocalizedValue(locale, w.title, w.title_en)}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
