"use client";
import { useEffect, useRef } from "react";

export default function ViewButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  const text = useRef<HTMLSpanElement>(null);
  const baseline = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = text.current,
      marker = baseline.current;
    if (!el || !marker) return;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      el.style.transform = "none";
      const style = getComputedStyle(el);
      const context = document.createElement("canvas").getContext("2d");
      if (!context) return;
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const m = context.measureText(label);
      const rect = el.getBoundingClientRect();
      const inkCenter =
        marker.getBoundingClientRect().top -
        (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
      const shift = rect.top + rect.height / 2 - inkCenter;
      if (Number.isFinite(shift)) el.style.transform = `translateY(${shift}px)`;
    };
    measure();
    void document.fonts.ready.then(measure);
    document.fonts.addEventListener("loadingdone", measure);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      disposed = true;
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", measure);
    };
  }, [label]);
  return (
    <button
      type="button"
      aria-current={selected ? "page" : undefined}
      onClick={onClick}
    >
      <span className="works-tab-capsule" aria-hidden="true" />
      <span className="works-tab-label" ref={text}>
        {label}
        <span ref={baseline} className="works-tab-baseline" />
      </span>
    </button>
  );
}
