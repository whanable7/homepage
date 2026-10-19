import type { CSSProperties } from "react";
export const fontOptions = [
  { name: "Noto Sans KR", ko: true, latin: "Site Noto Latin" },
  { name: "Nanum Myeongjo", ko: true, latin: "Site Nanum Latin" },
  { name: "Cormorant Garamond", ko: false, latin: "Cormorant Garamond" },
  { name: "Pretendard", ko: true, latin: "Site Pretendard Latin" },
  { name: "Noto Serif KR", ko: true, latin: "Site Noto Serif Latin" },
  { name: "Inter", ko: false, latin: "Inter" },
  { name: "Source Serif 4", ko: false, latin: "Source Serif 4" },
] as const;
export const defaultAppearance = {
  ko: "Noto Sans KR",
  en: "Noto Sans KR",
  name: 22,
  menu: 15,
  body: 16,
  spacing: 0.1,
  menuSpacing: 0.03,
  bodySpacing: 0,
  line: 1.6,
  weight: 500,
  textKo: "Nanum Myeongjo",
  textEn: "Noto Sans KR",
  textSize: 20,
};
export type Appearance = typeof defaultAppearance;
export type AppearanceState = {
  draft: Appearance;
  published: Appearance;
  previous: Appearance[];
};
export const appearanceSeed = (): AppearanceState => ({
  draft: { ...defaultAppearance },
  published: { ...defaultAppearance },
  previous: [],
});
export const latinFamily = (family: string) =>
  fontOptions.find((f) => f.name === family)?.latin || "Site Noto Latin";
export function fontStack(en: string, ko: string) {
  return `"${latinFamily(en)}", "${ko}", sans-serif`;
}
export function validateAppearance(value: unknown): Appearance {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("글꼴 설정을 확인해 주세요.");
  const v = value as Record<string, unknown>;
  for (const key of ["ko", "en", "textKo", "textEn"]) {
    if (
      !fontOptions.some(
        (f) => f.name === v[key] && (!key.toLowerCase().endsWith("ko") || f.ko),
      )
    )
      throw new Error("선택 가능한 글꼴을 골라 주세요.");
  }
  const ranges: Record<string, [number, number]> = {
    name: [18, 48],
    menu: [12, 26],
    body: [14, 26],
    spacing: [-0.04, 0.2],
    menuSpacing: [-0.04, 0.2],
    bodySpacing: [-0.04, 0.12],
    line: [1.2, 2.2],
    textSize: [16, 30],
    weight: [400, 500],
  };
  for (const [key, [min, max]] of Object.entries(ranges))
    if (
      typeof v[key] !== "number" ||
      !Number.isFinite(v[key]) ||
      v[key] < min ||
      v[key] > max
    )
      throw new Error("글자 크기와 간격의 범위를 확인해 주세요.");
  if (![400, 500].includes(v.weight as number))
    throw new Error("글자 굵기를 확인해 주세요.");
  return Object.fromEntries(
    Object.keys(defaultAppearance).map((k) => [k, v[k]]),
  ) as Appearance;
}
export function appearanceStyle(a: Appearance): CSSProperties {
  return {
    "--font-site": fontStack(a.en, a.ko),
    "--font-text": fontStack(a.textEn, a.textKo),
    "--site-name-size": `${a.name}px`,
    "--site-name-weight": a.weight,
    "--site-name-spacing": `${a.spacing}em`,
    "--site-menu-size": `${a.menu}px`,
    "--site-menu-spacing": `${a.menuSpacing}em`,
    "--site-body-size": `${a.body}px`,
    "--site-body-spacing": `${a.bodySpacing}em`,
    "--site-line-height": a.line,
    "--site-text-size": `${a.textSize}px`,
  } as CSSProperties;
}
