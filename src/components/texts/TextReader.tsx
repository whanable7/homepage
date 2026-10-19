"use client";
import { useLocale } from "@/i18n";
import type { ArchiveText, TextBlock } from "@/types/archive";
export function TextBody({
  blocks,
  protectedCopy = false,
  language,
}: {
  blocks: TextBlock[];
  protectedCopy?: boolean;
  language?: "ko" | "en";
}) {
  const { locale } = useLocale();
  return (
    <div
      className={protectedCopy ? "text-body protected-copy" : "text-body"}
      lang={language || locale}
      onCopy={protectedCopy ? (e) => e.preventDefault() : undefined}
      onCut={protectedCopy ? (e) => e.preventDefault() : undefined}
    >
      {blocks.map((b) => {
        const style = {
          textAlign: b.align,
          fontSize: `${b.size}px`,
          lineHeight: b.lineHeight ?? 1.6,
          marginBlock: `${b.paragraphSpacing ?? 1}em`,
          color: b.color,
        };
        return b.style === "heading" ? (
          <h2 key={b.id} style={style}>
            {b.text}
          </h2>
        ) : b.style === "quote" ? (
          <blockquote key={b.id} style={style}>
            {b.text}
          </blockquote>
        ) : (
          <p key={b.id} style={style}>
            {b.text}
          </p>
        );
      })}
    </div>
  );
}
export default function TextReader({ text }: { text: ArchiveText }) {
  const { locale } = useLocale(),
    version = text[locale];
  if (!version.published)
    return (
      <p className="works-empty">
        {locale === "ko"
          ? "한국어 글을 준비 중입니다."
          : "The English text is not yet available."}
      </p>
    );
  return (
    <article className="text-reader">
      <header>
        <p>
          {text.category === "notes"
            ? locale === "ko"
              ? "작가노트"
              : "Artist’s Notes"
            : "Studies"}
        </p>
        <h1>{version.title}</h1>
        <time>{text.date}</time>
      </header>
      <TextBody blocks={version.blocks} protectedCopy />
      {version.pdfId && (
        <a
          className="text-pdf"
          href={`/files/${version.pdfId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          PDF ↗
        </a>
      )}
    </article>
  );
}
