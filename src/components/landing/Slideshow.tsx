"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useLocale } from "@/i18n";
import { getLocalizedValue } from "@/lib/i18n-utils";
import { cloudinaryLoader } from "@/lib/cloudinary-loader";
import type { Artwork } from "@/types/artwork";
export default function Slideshow({ artworks }: { artworks: Artwork[] }) {
  const count = artworks.length,
    multiple = count > 1,
    { locale } = useLocale();
  const [position, setPosition] = useState(multiple ? 1 : 0),
    [animate, setAnimate] = useState(true),
    [paused, setPaused] = useState(false),
    [captionIndex, setCaptionIndex] = useState(0);
  const busy = useRef(false),
    pointer = useRef<{ x: number; y: number } | null>(null),
    frames = useRef<number[]>([]);
  const index = multiple ? (position - 1 + count) % count : 0;
  const move = useCallback(
    (direction: number) => {
      if (!multiple || busy.current) return;
      busy.current = true;
      setAnimate(true);
      setPosition((p) => p + direction);
    },
    [multiple],
  );
  const settle = useCallback(() => {
    if (!busy.current) return;
    setCaptionIndex(multiple ? (position - 1 + count) % count : 0);
    if (multiple && (position === 0 || position === count + 1)) {
      setAnimate(false);
      setPosition(position === 0 ? count : 1);
      frames.current.push(
        requestAnimationFrame(() => {
          frames.current.push(
            requestAnimationFrame(() => {
              busy.current = false;
              setAnimate(true);
            }),
          );
        }),
      );
    } else busy.current = false;
  }, [position, count, multiple]);
  useEffect(() => {
    if (!busy.current) return;
    const timer = setTimeout(settle, 1150);
    return () => clearTimeout(timer);
  }, [position, settle]);
  useEffect(() => {
    if (
      paused ||
      !multiple ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const timer = setInterval(() => {
      if (!document.hidden) move(1);
    }, 6000);
    return () => clearInterval(timer);
  }, [paused, multiple, move]);
  useEffect(() => () => frames.current.forEach(cancelAnimationFrame), []);
  if (!count)
    return (
      <div className="works-empty">
        {locale === "ko"
          ? "대표 작품을 준비 중입니다."
          : "Selected works coming soon."}
      </div>
    );
  const slides = multiple
      ? [artworks[count - 1], ...artworks, artworks[0]]
      : artworks,
    current = artworks[captionIndex] || artworks[index];
  return (
    <section
      className="landing-slideshow"
      aria-roledescription="carousel"
      aria-label={locale === "ko" ? "대표 작품" : "Selected works"}
    >
      <div
        className="slideshow-window"
        onPointerDown={(e) => {
          setPaused(true);
          pointer.current = { x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerUp={(e) => {
          const p = pointer.current;
          pointer.current = null;
          if (!p) return;
          const dx = e.clientX - p.x,
            dy = e.clientY - p.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy))
            move(dx < 0 ? 1 : -1);
        }}
        onPointerCancel={() => {
          pointer.current = null;
        }}
      >
        <div
          className="slideshow-track"
          style={{
            transform: `translateX(${-position * 100}%)`,
            transition: animate
              ? "transform 1000ms cubic-bezier(.4,0,.2,1)"
              : "none",
          }}
          onTransitionEnd={(e) => {
            if (e.target === e.currentTarget) settle();
          }}
        >
          {slides.map((w, i) => (
            <div
              key={`${w.id}-${i}`}
              className="slideshow-slide"
              aria-hidden={i !== position}
            >
              <div>
                <Image
                  src={w.image_url}
                  alt={getLocalizedValue(locale, w.title, w.title_en)}
                  fill
                  sizes="(max-width:640px) 90vw, 80vw"
                  priority={i === 1 || !multiple}
                  loading={
                    i === 1 || !multiple
                      ? undefined
                      : Math.abs(i - position) <= 1
                        ? "eager"
                        : "lazy"
                  }
                  draggable={false}
                  className="object-contain"
                  {...(w.image_url.includes("res.cloudinary.com")
                    ? { loader: cloudinaryLoader }
                    : {})}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      {multiple && (
        <>
          <button
            className="slideshow-prev"
            aria-label={locale === "ko" ? "이전 작품" : "Previous artwork"}
            onClick={() => {
              setPaused(true);
              move(-1);
            }}
          >
            ‹
          </button>
          <button
            className="slideshow-next"
            aria-label={locale === "ko" ? "다음 작품" : "Next artwork"}
            onClick={() => {
              setPaused(true);
              move(1);
            }}
          >
            ›
          </button>
        </>
      )}
      <div className="slideshow-caption">
        <p>
          {getLocalizedValue(locale, current.title, current.title_en)}{" "}
          <span>{current.year}</span>
        </p>
      </div>
    </section>
  );
}
