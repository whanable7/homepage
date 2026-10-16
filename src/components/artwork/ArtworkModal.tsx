"use client";
import { useCallback, useEffect, useRef } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import type { Artwork } from "@/types/artwork";
import type { ArchiveWork } from "@/types/archive";
import { useLocale } from "@/i18n";
import { getLocalizedValue } from "@/lib/i18n-utils";
import ZoomableImage, { type ZoomableImageRef } from "./ZoomableImage";
interface Props {
  artwork: Artwork | ArchiveWork;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  groupLabel?: string;
  artworkTags?: string[];
  onTagClick?: (tag: string) => void;
  preloadImages?: string[];
}
export default function ArtworkModal({
  artwork,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: Props) {
  const { locale } = useLocale(),
    zoom = useRef<ZoomableImageRef>(null),
    closeRef = useRef(onClose),
    token = useRef("");
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    token.current = crypto.randomUUID();
    window.history.pushState(
      { ...window.history.state, artworkModal: token.current },
      "",
    );
    const pop = () => closeRef.current();
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  const close = useCallback(() => {
    if (window.history.state?.artworkModal === token.current)
      window.history.back();
    else closeRef.current();
  }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && hasPrev) onPrev?.();
      if (event.key === "ArrowRight" && hasNext) onNext?.();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [hasPrev, hasNext, onPrev, onNext]);
  const size = artwork.variable_size
    ? locale === "ko"
      ? "가변크기"
      : "Variable dimensions"
    : artwork.width && artwork.height
      ? `${artwork.height} × ${artwork.width} cm`
      : "";
  return (
    <Dialog open onClose={close} className="artwork-dialog">
      <div className="artwork-backdrop" aria-hidden="true" />
      <div className="artwork-dialog-wrap">
        <DialogPanel className="artwork-dialog-panel">
          <button
            className="artwork-close"
            onClick={close}
            aria-label={locale === "ko" ? "작품 닫기" : "Close artwork"}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            >
              <path d="m5 5 14 14M19 5 5 19" />
            </svg>
          </button>
          <div className="artwork-image-area" key={artwork.id}>
            <ZoomableImage
              ref={zoom}
              src={artwork.image_url}
              alt={getLocalizedValue(locale, artwork.title, artwork.title_en)}
            />
          </div>
          <div className="artwork-caption">
            <DialogTitle>
              {getLocalizedValue(locale, artwork.title, artwork.title_en)}
              <span>{artwork.year}</span>
            </DialogTitle>
            <p>
              {[
                getLocalizedValue(locale, artwork.medium, artwork.medium_en),
                size,
                getLocalizedValue(
                  locale,
                  artwork.collection,
                  artwork.collection_en,
                ),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {getLocalizedValue(
              locale,
              artwork.description,
              artwork.description_en,
            ) && (
              <p>
                {getLocalizedValue(
                  locale,
                  artwork.description,
                  artwork.description_en,
                )}
              </p>
            )}
          </div>
          <div className="artwork-controls">
            <button
              onClick={() => zoom.current?.zoomOut()}
              aria-label={locale === "ko" ? "축소" : "Zoom out"}
            >
              −
            </button>
            <button
              onClick={() => zoom.current?.zoomIn()}
              aria-label={locale === "ko" ? "확대" : "Zoom in"}
            >
              +
            </button>
            <button onClick={() => zoom.current?.resetTransform()}>
              {locale === "ko" ? "원래 크기" : "Reset"}
            </button>
            <span />
            {hasPrev && (
              <button
                onClick={onPrev}
                aria-label={locale === "ko" ? "이전 작품" : "Previous artwork"}
              >
                ←
              </button>
            )}
            {hasNext && (
              <button
                onClick={onNext}
                aria-label={locale === "ko" ? "다음 작품" : "Next artwork"}
              >
                →
              </button>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
