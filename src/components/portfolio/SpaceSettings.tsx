"use client";
import { useState } from "react";
import { useLocale } from "@/i18n";
export interface SpaceControl {
  key: string;
  ko: string;
  en: string;
  min: number;
  max: number;
  step: number;
}
export default function SpaceSettings({
  controls,
  values,
  onChange,
  onReset,
}: {
  controls: readonly SpaceControl[];
  values: Record<string, number>;
  onChange: (key: string, value: number) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false),
    { locale } = useLocale();
  return (
    <div
      className="space-controls"
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
        {locale === "ko" ? "배치 설정" : "physics settings"}
      </button>
      {open && (
        <div className="space-settings">
          {controls.map((c) => (
            <label key={c.key}>
              <span>{locale === "ko" ? c.ko : c.en}</span>
              <input
                type="range"
                aria-label={locale === "ko" ? c.ko : c.en}
                min={c.min}
                max={c.max}
                step={c.step}
                value={values[c.key]}
                onChange={(e) => onChange(c.key, Number(e.target.value))}
              />
            </label>
          ))}
          <div className="space-settings-actions">
            <button type="button" onClick={onReset}>
              {locale === "ko" ? "기본값으로" : "reset"}
            </button>
            <button type="button" onClick={() => setOpen(false)}>
              {locale === "ko" ? "닫기" : "close"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
