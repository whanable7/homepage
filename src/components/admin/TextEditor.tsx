"use client";
import { useEffect, useState } from "react";
import { upload } from "@vercel/blob/client";
import type { ArchiveText, TextBlock, TextLanguage } from "@/types/archive";
import { useUnsavedGuard, confirmAdminNavigation } from "./useUnsavedGuard";
import { TextBody } from "@/components/texts/TextReader";
const emptyLanguage = (): TextLanguage => ({
  title: "",
  blocks: [],
  published: false,
});
const newBlock = (locale: "ko" | "en"): TextBlock => ({
  id: crypto.randomUUID(),
  text: "",
  align: "left",
  size: locale === "ko" ? 18 : 20,
  lineHeight: 1.6,
  paragraphSpacing: 1,
  color: "#1A1A1A",
  style: "paragraph",
});
export default function TextEditor() {
  const [items, setItems] = useState<ArchiveText[]>([]),
    [revision, setRevision] = useState(""),
    [text, setText] = useState<ArchiveText | null>(null),
    [preview, setPreview] = useState(false),
    [language, setLanguage] = useState<"ko" | "en">("ko"),
    [compare, setCompare] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useUnsavedGuard(
    !!text &&
      JSON.stringify(text) !==
        JSON.stringify(items.find((item) => item.id === text.id)),
  );
  useEffect(() => {
    fetch("/api/texts", { cache: "no-store" })
      .then((r) => r.json())
      .then((doc) => {
        setItems(doc.data);
        setRevision(doc.revision);
      })
      .catch(() => setMessage("글을 불러오지 못했습니다."));
  }, []);
  const update = (locale: "ko" | "en", values: Partial<TextLanguage>) =>
    setText((current) =>
      current
        ? { ...current, [locale]: { ...current[locale], ...values } }
        : null,
    );
  async function pdf(file: File, locale: "ko" | "en") {
    if (file.type !== "application/pdf" || file.size > 30 * 1024 * 1024) {
      setMessage("30MB 이하 PDF를 선택해 주세요.");
      return;
    }
    setBusy(true);
    try {
      const pathname = `documents/${crypto.randomUUID()}.pdf`,
        blob = await upload(pathname, file, {
          access: "private",
          handleUploadUrl: "/api/files/upload",
          multipart: file.size > 4 * 1024 * 1024,
        });
      const response = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathname: blob.pathname, filename: file.name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      update(locale, { pdfId: data.id });
      setMessage("PDF를 첨부했습니다. 글을 저장해 주세요.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "PDF 업로드 실패");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!text) return;
    setBusy(true);
    try {
      const res = await fetch("/api/texts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, revision }),
      });
      const doc = await res.json();
      if (!res.ok) throw new Error(doc.error);
      setItems(doc.data);
      setRevision(doc.revision);
      setText(doc.data.find((item: ArchiveText) => item.id === text.id));
      setMessage("저장했습니다. 공개로 선택한 언어에 반영됩니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장 실패");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="admin-actions">
        <h2>TEXTS</h2>
        {text && (
          <button
            disabled={busy}
            onClick={() => {
              setText(null);
              setPreview(false);
              setMessage("작성을 취소했습니다. 저장된 글은 유지합니다.");
            }}
          >
            작성 취소
          </button>
        )}
        <button
          onClick={() => {
            if (!confirmAdminNavigation()) return;
            setText({
              id: crypto.randomUUID(),
              category: "notes",
              date: new Date().toISOString().slice(0, 10),
              ko: emptyLanguage(),
              en: emptyLanguage(),
              updated_at: "",
            });
            setPreview(false);
          }}
        >
          새 글
        </button>
      </div>
      <p role="status">{message}</p>
      <div className="admin-text-list">
        {items
          .filter((t) => !t.deleted_at)
          .map((t) => (
            <button
              key={t.id}
              onClick={() => {
                if (t.id !== text?.id && !confirmAdminNavigation()) return;
                setText(structuredClone(t));
                setPreview(false);
              }}
            >
              {t.ko.title || t.en.title || "제목 없음"}{" "}
              <small>
                한국어 {t.ko.published ? "공개" : "임시"} · English{" "}
                {t.en.published ? "공개" : "임시"}
              </small>
            </button>
          ))}
      </div>
      {text && (
        <>
          <div className="admin-actions">
            <select
              aria-label="글 분류"
              value={text.category}
              onChange={(e) =>
                setText({
                  ...text,
                  category: e.target.value as "notes" | "studies",
                })
              }
            >
              <option value="notes">Artist’s Notes</option>
              <option value="studies">Studies</option>
            </select>
            <input
              aria-label="글 날짜"
              type="date"
              value={text.date}
              onChange={(e) => setText({ ...text, date: e.target.value })}
            />
            <button onClick={() => setPreview(!preview)}>
              {preview ? "편집" : "미리보기"}
            </button>
            <button onClick={save} disabled={busy}>
              {busy ? "처리 중…" : "저장"}
            </button>
          </div>
          <div
            className="admin-actions text-language-tabs"
            role="group"
            aria-label="작성 언어 선택"
          >
            {(["ko", "en"] as const).map((l) => (
              <button
                key={l}
                aria-pressed={language === l}
                onClick={() => {
                  setLanguage(l);
                  setCompare(false);
                }}
              >
                {l === "ko" ? "한국어" : "English"} ·{" "}
                {text[l].published
                  ? "공개"
                  : text[l].title || text[l].blocks.length
                    ? "작성 중"
                    : "미작성"}
              </button>
            ))}
            <button aria-pressed={compare} onClick={() => setCompare(!compare)}>
              나란히 비교
            </button>
          </div>
          <div
            className={`admin-language-grid ${compare ? "is-comparing" : "single-language"}`}
          >
            {(compare ? (["ko", "en"] as const) : [language]).map((locale) => (
              <section key={locale} className="admin-language">
                <h3>{locale === "ko" ? "한국어" : "English"}</h3>
                <label className="admin-field">
                  제목
                  <input
                    value={text[locale].title}
                    onChange={(e) => update(locale, { title: e.target.value })}
                  />
                </label>
                <label className="admin-check">
                  <input
                    type="checkbox"
                    checked={text[locale].published}
                    onChange={(e) =>
                      update(locale, { published: e.target.checked })
                    }
                  />
                  이 언어 공개
                </label>
                {preview ? (
                  <TextBody blocks={text[locale].blocks} language={locale} />
                ) : (
                  text[locale].blocks.map((b, index) => (
                    <div className="editor-block" key={b.id}>
                      <div className="editor-toolbar">
                        <select
                          aria-label="문단 종류"
                          value={b.style}
                          onChange={(e) =>
                            update(locale, {
                              blocks: text[locale].blocks.map((x) =>
                                x.id === b.id
                                  ? {
                                      ...x,
                                      style: e.target
                                        .value as TextBlock["style"],
                                    }
                                  : x,
                              ),
                            })
                          }
                        >
                          <option value="paragraph">본문</option>
                          <option value="heading">제목</option>
                          <option value="quote">인용</option>
                        </select>
                        <select
                          aria-label="정렬"
                          value={b.align}
                          onChange={(e) =>
                            update(locale, {
                              blocks: text[locale].blocks.map((x) =>
                                x.id === b.id
                                  ? {
                                      ...x,
                                      align: e.target
                                        .value as TextBlock["align"],
                                    }
                                  : x,
                              ),
                            })
                          }
                        >
                          <option value="left">왼쪽</option>
                          <option value="center">가운데</option>
                          <option value="right">오른쪽</option>
                          <option value="justify">양쪽</option>
                        </select>
                        <label>
                          크기 (pt)
                          <input
                            aria-label="글자 크기"
                            type="number"
                            min="9"
                            max="48"
                            step="0.5"
                            value={Math.round(b.size * 0.75 * 100) / 100}
                            onChange={(e) =>
                              update(locale, {
                                blocks: text[locale].blocks.map((x) =>
                                  x.id === b.id
                                    ? {
                                        ...x,
                                        size: Math.max(
                                          12,
                                          Math.min(64, +e.target.value / 0.75),
                                        ),
                                      }
                                    : x,
                                ),
                              })
                            }
                          />
                        </label>
                        <label>
                          줄간격 (%)
                          <input
                            aria-label="줄간격"
                            type="number"
                            min="100"
                            max="300"
                            step="10"
                            value={Math.round((b.lineHeight ?? 1.6) * 100)}
                            onChange={(e) =>
                              update(locale, {
                                blocks: text[locale].blocks.map((x) =>
                                  x.id === b.id
                                    ? {
                                        ...x,
                                        lineHeight: Math.max(
                                          1,
                                          Math.min(3, +e.target.value / 100),
                                        ),
                                      }
                                    : x,
                                ),
                              })
                            }
                          />
                        </label>
                        <label>
                          문단 간격 (em)
                          <input
                            aria-label="문단 간격"
                            type="number"
                            min="0"
                            max="4"
                            step="0.1"
                            value={b.paragraphSpacing ?? 1}
                            onChange={(e) =>
                              update(locale, {
                                blocks: text[locale].blocks.map((x) =>
                                  x.id === b.id
                                    ? {
                                        ...x,
                                        paragraphSpacing: Math.max(
                                          0,
                                          Math.min(4, +e.target.value),
                                        ),
                                      }
                                    : x,
                                ),
                              })
                            }
                          />
                        </label>
                        <input
                          aria-label="글자색"
                          type="color"
                          value={b.color}
                          onChange={(e) =>
                            update(locale, {
                              blocks: text[locale].blocks.map((x) =>
                                x.id === b.id
                                  ? { ...x, color: e.target.value }
                                  : x,
                              ),
                            })
                          }
                        />
                        <button
                          aria-label="문단 위로"
                          disabled={!index}
                          onClick={() => {
                            const blocks = [...text[locale].blocks];
                            [blocks[index - 1], blocks[index]] = [
                              blocks[index],
                              blocks[index - 1],
                            ];
                            update(locale, { blocks });
                          }}
                        >
                          ↑
                        </button>
                        <button
                          aria-label="문단 삭제"
                          onClick={() =>
                            update(locale, {
                              blocks: text[locale].blocks.filter(
                                (x) => x.id !== b.id,
                              ),
                            })
                          }
                        >
                          ×
                        </button>
                      </div>
                      <textarea
                        aria-label={`${locale === "ko" ? "한국어" : "영어"} 문단 ${index + 1}`}
                        value={b.text}
                        style={{
                          textAlign: b.align,
                          color: b.color,
                          fontSize: b.size,
                          lineHeight: b.lineHeight ?? 1.6,
                          fontFamily: "var(--font-text)",
                        }}
                        onChange={(e) =>
                          update(locale, {
                            blocks: text[locale].blocks.map((x) =>
                              x.id === b.id
                                ? { ...x, text: e.target.value }
                                : x,
                            ),
                          })
                        }
                      />
                    </div>
                  ))
                )}
                {!preview && (
                  <button
                    onClick={() =>
                      update(locale, {
                        blocks: [...text[locale].blocks, newBlock(locale)],
                      })
                    }
                  >
                    문단 추가
                  </button>
                )}
                <label className="admin-field">
                  PDF 첨부
                  <input
                    type="file"
                    accept="application/pdf"
                    disabled={busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void pdf(file, locale);
                      e.target.value = "";
                    }}
                  />
                </label>
                {text[locale].pdfId && (
                  <div className="admin-actions">
                    <a
                      href={`/files/${text[locale].pdfId}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      PDF 확인 ↗
                    </a>
                    <button
                      onClick={() => update(locale, { pdfId: undefined })}
                    >
                      첨부 해제
                    </button>
                  </div>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
