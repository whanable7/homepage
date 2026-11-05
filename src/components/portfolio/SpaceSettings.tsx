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
              <span>
                <span>{locale === "ko" ? c.ko : c.en}</span>
                <output aria-hidden="true">
                  {Math.round(
                    ((values[c.key] - c.min) / (c.max - c.min)) * 100,
                  )}
                  %
                </output>
              </span>
              <input
                type="range"
                aria-label={locale === "ko" ? c.ko : c.en}
                aria-valuetext={`${Math.round(((values[c.key] - c.min) / (c.max - c.min)) * 100)}%`}
                min={c.min}
                max={c.max}
                step={c.step}
                value={values[c.key]}
                onChange={(e) => onChange(c.key, Number(e.target.value))}
              />
            </label>
          ))}
          <p className="space-settings-note">
            {locale === "ko"
              ? "각 설정 범위 안의 상대 강도입니다."
              : "Relative intensity within each setting’s range."}
          </p>
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
