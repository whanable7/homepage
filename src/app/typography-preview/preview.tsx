"use client";
import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import styles from "./preview.module.css";

import { useAppearance } from "@/contexts/AppearanceContext";
import { useRouter } from "next/navigation";
import { useUnsavedGuard } from "@/components/admin/useUnsavedGuard";
import {
  fontOptions,
  fontStack,
  latinFamily,
  type Appearance,
  type AppearanceState,
} from "@/lib/appearance";
import type { Document } from "@/lib/archive-store";
const families = fontOptions.map((f) => f.name);
type Settings = Appearance;
export default function TypographyPreview({
  adminMode = false,
}: {
  adminMode?: boolean;
}) {
  const router = useRouter();
  const defaults = useAppearance();
  const [settings, setSettings] = useState<Settings>(defaults);
  const [doc, setDoc] = useState<Document<AppearanceState> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [language, setLanguage] = useState<"ko" | "en">("ko");
  const [current, setCurrent] = useState(false);
  const [loaded, setLoaded] = useState("글꼴 파일 확인 중…");
  const [copied, setCopied] = useState("");
  const [sample, setSample] = useState(
    "풍경을 바라보는 일은 시간의 층을 읽는 일과 닮아 있다.\n작품과 작품 사이를 지나며 익숙했던 세계의 다른 표면을 발견한다.",
  );
  useUnsavedGuard(
    adminMode &&
      !!doc &&
      JSON.stringify(settings) !== JSON.stringify(doc.data.draft),
  );
  useEffect(() => {
    if (!adminMode) return;
    let active = true;
    fetch("/api/appearance", { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        if (active) {
          setDoc(data);
          setSettings(data.data.draft);
        }
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      });
    return () => {
      active = false;
    };
  }, [adminMode]);
  useEffect(() => {
    let active = true;
    const chosen = [settings.ko, settings.en, settings.textKo, settings.textEn];
    Promise.all(
      [...new Set(chosen)].map((f) =>
        document.fonts.load(
          `400 20px "${f}"`,
          fontOptions.find((x) => x.name === f)?.ko
            ? "정환 작품 abc"
            : "Jungwhan Works",
        ),
      ),
    )
      .then((results) => {
        if (active)
          setLoaded(
            results.every((x) => x.length)
              ? "선택한 실제 글꼴 파일 로드 완료"
              : "일부 글꼴을 불러오지 못했습니다.",
          );
      })
      .catch(() => {
        if (active)
          setLoaded("글꼴을 불러오지 못했습니다. 연결 상태를 확인해 주세요.");
      });
    return () => {
      active = false;
    };
  }, [settings.ko, settings.en, settings.textKo, settings.textEn]);
  async function act(action: "save" | "apply" | "restore") {
    if (!doc || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/appearance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, revision: doc.revision, settings }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setDoc(data);
      setSettings(data.data.draft);
      setCurrent(false);
      setMessage(
        action === "apply"
          ? "글꼴 설정을 사이트에 적용했습니다. 작품 분류와 글의 공개 상태는 그대로입니다."
          : action === "restore"
            ? "이전 설정을 불러왔습니다. 사이트 적용 전 상태입니다."
            : "글꼴 설정을 임시 저장했습니다.",
      );
      if (action === "apply") router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "설정 저장 실패");
    } finally {
      setBusy(false);
    }
  }
  const change = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    setCopied("");
    try {
      localStorage.setItem(
        "jungwhan-typography-preview-v2",
        JSON.stringify(next),
      );
    } catch {}
  };
  const s = current ? doc?.data.published || defaults : settings;
  const latin = latinFamily;
  const siteFamily = fontStack(s.en, s.ko);
  const range = (
    label: string,
    key:
      | "name"
      | "menu"
      | "body"
      | "spacing"
      | "menuSpacing"
      | "bodySpacing"
      | "line"
      | "textSize",
    min: number,
    max: number,
    step: number,
    unit: string,
  ) => (
    <label>
      {label}
      <span>
        {settings[key]}
        {unit}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={settings[key]}
        onChange={(e) => change({ [key]: Number(e.target.value) })}
      />
    </label>
  );
  const familySelect = (
    label: string,
    key: "ko" | "en" | "textKo" | "textEn",
    korean: boolean,
  ) => (
    <label>
      {label}
      <select
        value={settings[key]}
        onChange={(e) => change({ [key]: e.target.value })}
      >
        {families
          .filter((f) => !korean || fontOptions.find((x) => x.name === f)?.ko)
          .map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
      </select>
    </label>
  );
  const summary = `사이트 한글: ${settings.ko}\n사이트 영문: ${settings.en}\n작가 이름: ${settings.name}px / 굵기 ${settings.weight} / 자간 ${settings.spacing}em\n메뉴: ${settings.menu}px / 자간 ${settings.menuSpacing}em\n일반 본문: ${settings.body}px / 자간 ${settings.bodySpacing}em / 줄간격 ${settings.line * 100}%\nTEXTS 한글: ${settings.textKo}\nTEXTS 영문: ${settings.textEn}\nTEXTS: ${settings.textSize}px`;
  const Container = adminMode ? "section" : "main";
  return (
    <Container className={styles.page}>
      <div className={styles.heading}>
        <div>
          <h1>{adminMode ? "설정 · 글꼴과 문자" : "글꼴 조정실"}</h1>
          <p>
            {adminMode
              ? "조절한 모습 확인 → 임시 저장 → 사이트 적용. 작품 분류는 함께 공개되지 않습니다."
              : "이 화면에서만 바뀝니다. 공식 사이트에는 적용하지 않습니다."}
          </p>
        </div>
        <Link href="/works">작품 미리보기 ↗</Link>
      </div>
      <div className={styles.layout}>
        <aside className={styles.controls}>
          <p className={styles.status} role="status" data-font-status={loaded}>
            {loaded}
          </p>
          <h2>사이트 글꼴</h2>
          {familySelect("한글", "ko", true)}
          {familySelect("영문", "en", false)}
          <p>
            영문은 앞에서 선택한 영문 글꼴, 한글은 한글 글꼴로 표시합니다. 선택
            가능한 모든 글꼴을 이 사이트에서 직접 제공합니다.
          </p>
          <h2>작가 이름</h2>
          {range("크기", "name", 18, 48, 1, "px")}
          {range("자간", "spacing", -0.04, 0.2, 0.01, "em")}
          <label>
            굵기
            <select
              value={settings.weight}
              onChange={(e) => change({ weight: Number(e.target.value) })}
            >
              <option value={400}>보통 · 400</option>
              <option value={500}>중간 · 500</option>
            </select>
          </label>
          <small>나눔명조는 실제 파일이 있는 보통 굵기를 사용합니다.</small>
          <h2>메뉴</h2>
          {range("크기", "menu", 12, 26, 1, "px")}
          {range("자간", "menuSpacing", -0.04, 0.2, 0.01, "em")}
          <h2>일반 본문·저작권</h2>
          {range("크기", "body", 14, 26, 1, "px")}
          {range("자간", "bodySpacing", -0.04, 0.12, 0.01, "em")}
          {range("줄간격", "line", 1.2, 2.2, 0.1, "배")}
          <h2>TEXTS 본문</h2>
          {familySelect("한글", "textKo", true)}
          {familySelect("영문", "textEn", false)}
          {range("본문 크기", "textSize", 16, 30, 1, "px")}
          <button
            onClick={() => {
              change(doc?.data.published || defaults);
              setCurrent(false);
            }}
          >
            현재 사이트 기준으로 초기화
          </button>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(summary);
                setCopied("복사했습니다. 채팅에 붙여넣어 주세요.");
              } catch {
                setCopied("아래 설정 내용을 직접 복사해 주세요.");
              }
            }}
          >
            선택한 설정 복사
          </button>
          <p role="status">{copied}</p>
          {adminMode && (
            <div className="appearance-actions">
              <button disabled={busy || !doc} onClick={() => act("save")}>
                글꼴 임시 저장
              </button>
              <button disabled={busy || !doc} onClick={() => act("apply")}>
                글꼴 사이트 적용
              </button>
              <button
                disabled={busy || !doc?.data.previous.length}
                onClick={() => act("restore")}
              >
                이전 설정 불러오기
              </button>
              <button
                disabled={busy || !doc}
                onClick={() => {
                  if (doc) {
                    setSettings(doc.data.draft);
                    setMessage("저장한 설정으로 돌아왔습니다.");
                  }
                }}
              >
                조절 취소
              </button>
            </div>
          )}
          <p role="status">{message}</p>
          <details>
            <summary>설정 내용</summary>
            <pre>{summary}</pre>
          </details>
        </aside>
        <section className={styles.display}>
          <div className={styles.switches}>
            <button aria-pressed={!current} onClick={() => setCurrent(false)}>
              조정한 모습
            </button>
            <button aria-pressed={current} onClick={() => setCurrent(true)}>
              현재 사이트 기준
            </button>
            <button
              aria-pressed={language === "ko"}
              onClick={() => setLanguage("ko")}
            >
              한글
            </button>
            <button
              aria-pressed={language === "en"}
              onClick={() => setLanguage("en")}
            >
              영문
            </button>
          </div>
          <div
            className={styles.site}
            style={
              { fontFamily: siteFamily, fontSynthesis: "none" } as CSSProperties
            }
            data-preview-family={siteFamily}
          >
            <header>
              <span aria-hidden="true">☰</span>
              <span
                className={styles.name}
                style={{
                  fontSize: s.name,
                  letterSpacing: `${s.spacing}em`,
                  fontWeight: s.en === "Nanum Myeongjo" ? 400 : s.weight,
                }}
              >
                {language === "ko" ? "박정환" : "Jungwhan"}
              </span>
              <span>한글 / EN</span>
            </header>
            <nav
              style={{
                fontSize: s.menu,
                letterSpacing: `${s.menuSpacing}em`,
                fontWeight: s.en === "Nanum Myeongjo" ? 400 : 500,
              }}
            >
              <span>works</span>
              <span>texts</span>
              <span>cv</span>
              <span>contact</span>
            </nav>
            <div
              className={styles.tabs}
              style={{ fontSize: s.menu, letterSpacing: `${s.menuSpacing}em` }}
            >
              {(language === "ko"
                ? ["천체", "생태계", "지층", "흐름", "연도"]
                : ["cosmos", "ecosystem", "strata", "sequences", "years"]
              ).map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
            <article
              style={{
                fontSize: s.body,
                letterSpacing: `${s.bodySpacing}em`,
                lineHeight: s.line,
              }}
            >
              <h2>
                {language === "ko" ? "작품과 기록" : "Works and writings"}
              </h2>
              <p>
                {language === "ko"
                  ? "서로 다른 풍경들이 연결되고, 하나의 표면 위에 시간의 층이 쌓인다. 작품의 색과 형태가 만드는 관계를 살펴본다."
                  : "Different landscapes connect, and layers of time gather on a surface. The archive follows relationships between colour, form and changing perspectives."}
              </p>
              <p>2024 — 2026 · Jungwhan Park / 박정환</p>
            </article>
            <footer
              style={{
                fontSize: Math.max(11, s.body - 5),
                letterSpacing: `${s.bodySpacing}em`,
                lineHeight: s.line,
              }}
            >
              © 2026{" "}
              {language === "ko"
                ? "박정환. 모든 작품 이미지의 저작권은 작가에게 있습니다."
                : "Jungwhan Park. All rights reserved."}
            </footer>
            <div className={styles.textSample}>
              <h2>texts · 본문</h2>
              <div
                style={{
                  fontFamily: `"${latin(s.textEn)}", "${s.textKo}", serif`,
                  fontSize: s.textSize,
                  lineHeight: s.line,
                  letterSpacing: `${s.bodySpacing}em`,
                  whiteSpace: "pre-wrap",
                }}
              >
                {language === "ko"
                  ? sample
                  : "To look at a landscape is to read the layers of time.\nMoving between paintings, we encounter another surface of a familiar world."}
              </div>
            </div>
          </div>
          <label className={styles.sampleInput}>
            한글 본문 예문 바꾸기
            <textarea
              value={sample}
              onChange={(e) => setSample(e.target.value)}
            />
          </label>
          <p className={styles.note}>
            저장한 글에 별도로 지정한 크기·서식은 이 비교 화면과 다를 수
            있습니다. 여기서는 새 기본값을 고릅니다.
          </p>
        </section>
      </div>
    </Container>
  );
}
