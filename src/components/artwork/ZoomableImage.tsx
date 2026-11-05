"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { createPortal } from "react-dom";
import {
  TransformWrapper,
  TransformComponent,
  ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import Image from "next/image";
import { cloudinaryLoader } from "@/lib/cloudinary-loader";
import {
  containedImageRect,
  magnifierGeometry,
} from "@/lib/magnifier-geometry";

export interface ZoomableImageRef {
  zoomIn: () => void;
  zoomOut: () => void;
  resetTransform: () => void;
}
interface ZoomableImageProps {
  src: string;
  alt: string;
  onScaleChange?: (scale: number) => void;
  onLongPress?: () => void;
}
const ZoomableImage = forwardRef<ZoomableImageRef, ZoomableImageProps>(
  ({ src, alt, onScaleChange, onLongPress }, ref) => {
    const [lens, setLens] =
      useState<ReturnType<typeof magnifierGeometry>>(null);
    const [currentScale, setCurrentScale] = useState(1);
    const isZoomed = currentScale > 1.05;
    const container = useRef<HTMLDivElement>(null);
    const image = useRef<HTMLImageElement>(null);
    const transform = useRef<ReactZoomPanPinchRef>(null);
    const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
    const press = useRef<{ x: number; y: number; touch: boolean } | null>(null);
    const clearTimers = useCallback(() => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    }, []);
    const end = useCallback(() => {
      clearTimers();
      press.current = null;
      setLens(null);
    }, [clearTimers]);
    useImperativeHandle(
      ref,
      () => ({
        zoomIn: () => {
          end();
          transform.current?.zoomIn();
        },
        zoomOut: () => {
          end();
          transform.current?.zoomOut();
        },
        resetTransform: () => {
          end();
          transform.current?.resetTransform();
        },
      }),
      [end],
    );
    useEffect(() => {
      const resize = () => {
        end();
      };
      const observer = new ResizeObserver(resize);
      if (container.current) observer.observe(container.current);
      window.addEventListener("pointerup", end);
      window.addEventListener("blur", end);
      window.addEventListener("resize", resize);
      window.addEventListener("scroll", end, true);
      return () => {
        observer.disconnect();
        clearTimers();
        window.removeEventListener("pointerup", end);
        window.removeEventListener("blur", end);
        window.removeEventListener("resize", resize);
        window.removeEventListener("scroll", end, true);
      };
    }, [end, clearTimers]);
    useEffect(() => {
      clearTimers();
      queueMicrotask(() => {
        end();
        setCurrentScale(1);
      });
    }, [src, end, clearTimers]);
    function imageRect() {
      const img = image.current;
      return img
        ? containedImageRect(
            img.getBoundingClientRect(),
            img.naturalWidth,
            img.naturalHeight,
          )
        : null;
    }
    function validPoint(x: number, y: number) {
      const r = imageRect();
      return (
        r &&
        x >= r.left &&
        x <= r.left + r.width &&
        y >= r.top &&
        y <= r.top + r.height
      );
    }
    function showAtPoint(x: number, y: number) {
      const r = imageRect(),
        area = container.current?.getBoundingClientRect();
      if (!r || !area) {
        setLens(null);
        return;
      }
      // Measure after transforms in the event, never during React's render.
      const visible = {
        left: Math.max(0, area.left),
        top: Math.max(0, area.top),
        width: Math.min(window.innerWidth, area.right) - Math.max(0, area.left),
        height:
          Math.min(window.innerHeight, area.bottom) - Math.max(0, area.top),
      };
      setLens(magnifierGeometry(r, { x, y }, visible));
    }
    return (
      <div ref={container} className="w-full h-full overflow-hidden">
        <TransformWrapper
          key={src}
          ref={transform}
          initialScale={1}
          minScale={1}
          maxScale={4}
          centerOnInit
          limitToBounds
          alignmentAnimation={{ sizeX: 0, sizeY: 0 }}
          wheel={{ smoothStep: 0.001, activationKeys: [] }}
          doubleClick={{ mode: "toggle" }}
          panning={{ disabled: !isZoomed || !!lens }}
          onTransformed={(_ref, state) => {
            setCurrentScale(state.scale);
            if (state.scale > 1.05) end();
            onScaleChange?.(state.scale);
          }}
        >
          <TransformComponent
            wrapperStyle={{ width: "100%", height: "100%" }}
            contentStyle={{ width: "100%", height: "100%" }}
          >
            <div
              className={`relative w-full h-full ${isZoomed ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair"}`}
              onPointerDown={(e) => {
                clearTimers();
                if (
                  isZoomed ||
                  e.button !== 0 ||
                  !e.isPrimary ||
                  !validPoint(e.clientX, e.clientY)
                ) {
                  end();
                  return;
                }
                const start = {
                  x: e.clientX,
                  y: e.clientY,
                  touch: e.pointerType !== "mouse",
                };
                press.current = start;
                if (!start.touch) showAtPoint(start.x, start.y);
                else {
                  timers.current.push(
                    setTimeout(() => {
                      if (press.current === start)
                        showAtPoint(start.x, start.y);
                    }, 500),
                  );
                  if (onLongPress)
                    timers.current.push(
                      setTimeout(() => {
                        if (press.current === start) {
                          end();
                          onLongPress();
                        }
                      }, 3000),
                    );
                }
              }}
              onPointerMove={(e) => {
                const start = press.current;
                if (!start) return;
                if (
                  start.touch &&
                  Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8
                ) {
                  end();
                  return;
                }
                if (!validPoint(e.clientX, e.clientY)) {
                  end();
                  return;
                }
                if (!start.touch) showAtPoint(e.clientX, e.clientY);
              }}
              onPointerLeave={end}
              onPointerCancel={end}
              onPointerUp={end}
              onTouchStart={(e) => {
                if (e.touches.length > 1) end();
              }}
            >
              <Image
                ref={image}
                src={src}
                alt={alt}
                fill
                sizes="100vw"
                className="object-contain"
                style={{ WebkitTouchCallout: "none", userSelect: "none" }}
                priority
                onLoad={end}
                {...(src.includes("res.cloudinary.com")
                  ? { loader: cloudinaryLoader }
                  : {})}
              />
            </div>
          </TransformComponent>
        </TransformWrapper>
        {lens &&
          createPortal(
            <div
              aria-hidden="true"
              className="artwork-magnifier"
              style={{
                position: "fixed",
                pointerEvents: "none",
                zIndex: 10000,
                left: lens.left,
                top: lens.top,
                width: lens.size,
                height: lens.size,
                backgroundImage: `url(${JSON.stringify(src)})`,
                backgroundColor: "var(--background)",
                backgroundSize: `${lens.backgroundWidth}px ${lens.backgroundHeight}px`,
                backgroundPosition: `${lens.backgroundX}px ${lens.backgroundY}px`,
                backgroundRepeat: "no-repeat",
                boxShadow: "0 0 0 1px #ffffff80, 0 4px 24px #0003",
              }}
            />,
            document.body,
          )}
      </div>
    );
  },
);
ZoomableImage.displayName = "ZoomableImage";
export default ZoomableImage;
