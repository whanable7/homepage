"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useLocale } from "@/i18n";
import { getLocalizedValue } from "@/lib/i18n-utils";
import { cloudinaryLoader } from "@/lib/cloudinary-loader";
import { imageRatio } from "@/lib/layouts";
import type { ArchiveWork, PublishedArchive } from "@/types/archive";
import ArtworkModal from "@/components/artwork/ArtworkModal";
const Ecosystem = dynamic(() => import("./WorksEcosystem"), { ssr: false });
const Cosmos = dynamic(() => import("./WorksCosmos"), { ssr: false });
const views = ["cosmos", "ecosystem", "strata", "sequences", "years"] as const;
type View = (typeof views)[number];
export function WorkImage({
  work,
  sizes = "220px",
  priority = false,
}: {
  work: ArchiveWork;
  sizes?: string;
  priority?: boolean;
}) {
  const { locale } = useLocale();
  return (
    <Image
      src={work.image_url}
      alt={getLocalizedValue(locale, work.title, work.title_en)}
      fill
      sizes={sizes}
      priority={priority}
      className="object-contain"
      {...(work.image_url.includes("res.cloudinary.com")
        ? { loader: cloudinaryLoader }
        : {})}
    />
  );
}
export default function WorksBrowser({
  initial,
  preview = false,
}: {
  initial: PublishedArchive;
  preview?: boolean;
}) {
  const router = useRouter(),
    params = useSearchParams(),
    { locale } = useLocale();
  const raw = params.get("view");
  const requested =
    (
      { graph: "ecosystem", mindmap: "ecosystem", colors: "strata" } as Record<
        string,
        string
      >
    )[raw || ""] || raw;
  const [previewView, setPreviewView] = useState<View>(
    views.includes(requested as View) ? (requested as View) : "ecosystem",
  );
  const view: View = preview
    ? previewView
    : views.includes(requested as View)
      ? (requested as View)
      : "ecosystem";
  const [snapshot, setSnapshot] = useState(initial),
    [selected, setSelected] = useState<ArchiveWork | null>(null),
    [updated, setUpdated] = useState(false),
    [phone, setPhone] = useState(false),
    [error, setError] = useState("");
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const q = matchMedia("(max-width: 640px)");
    setPhone(q.matches);
    const change = () => setPhone(q.matches);
    q.addEventListener("change", change);
    return () => q.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (preview) return;
    const timer = setInterval(async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/works?version=1", { cache: "no-store" });
        if (res.ok && (await res.json()).revision !== snapshot.revision)
          setUpdated(true);
      } catch {}
    }, 30000);
    return () => clearInterval(timer);
  }, [snapshot.revision, preview]);
  const works = useMemo(
    () =>
      snapshot.works.filter(
        (w) => !snapshot.layout.excluded[view as "ecosystem"]?.includes(w.id),
      ),
    [snapshot, view],
  );
  const labels: Record<View, string> =
    locale === "ko"
      ? {
          cosmos: "천체",
          ecosystem: "생태계",
          strata: "지층",
          sequences: "흐름",
          years: "연도",
        }
      : {
          cosmos: "Cosmos",
          ecosystem: "Ecosystem",
          strata: "Strata",
          sequences: "Sequences",
          years: "Years",
        };
  const placements = phone ? snapshot.strata.phone : snapshot.strata.desktop,
    base = phone ? 360 : 1440;
  const maxY = Math.max(1, ...placements.map((b) => b.y + b.height));
  const workMap = new Map(works.map((w) => [w.id, w]));
  const button = (work: ArchiveWork) => (
    <button
      type="button"
      className="work-tile"
      onClick={() => setSelected(work)}
      style={{ aspectRatio: imageRatio(work) }}
      aria-label={getLocalizedValue(locale, work.title, work.title_en)}
    >
      <WorkImage work={work} />
    </button>
  );
  async function refresh() {
    try {
      const res = await fetch("/api/works", { cache: "no-store" });
      if (!res.ok) throw new Error();
      setSnapshot(await res.json());
      setUpdated(false);
    } catch {
      setError(
        locale === "ko"
          ? "새 내용을 불러오지 못했습니다. 다시 시도해 주세요."
          : "Could not load the update. Please try again.",
      );
    }
  }
  return (
    <div
      ref={root}
      className={`works-browser ${view === "cosmos" ? "works-cosmos" : ""}`}
    >
      <nav
        className="works-tabs"
        aria-label={locale === "ko" ? "작품 보기" : "Artwork views"}
      >
        {views.map((v) => (
          <button
            key={v}
            type="button"
            aria-current={view === v ? "page" : undefined}
            onClick={() =>
              preview
                ? setPreviewView(v)
                : router.replace(`/works?view=${v}`, { scroll: false })
            }
          >
            {labels[v]}
          </button>
        ))}
      </nav>
      {updated && (
        <button type="button" className="works-update" onClick={refresh}>
          {locale === "ko"
            ? "업데이트된 작품이 있습니다 · 불러오기"
            : "Updated works available · Load"}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
      {view === "ecosystem" && (
        <Ecosystem
          works={works}
          groups={snapshot.layout.ecosystem}
          onOpen={setSelected}
        />
      )}
      {view === "cosmos" && (
        <Cosmos
          works={works}
          groups={snapshot.layout.cosmos}
          stars={snapshot.layout.stars}
          onOpen={setSelected}
        />
      )}
      {view === "strata" && (
        <div
          className="strata-field"
          style={{ aspectRatio: `${base} / ${maxY}` }}
        >
          {placements.map((p) => {
            const w = workMap.get(p.id);
            return w ? (
              <button
                key={p.id}
                type="button"
                className="strata-work"
                style={{
                  left: `${(p.x / base) * 100}%`,
                  top: `${(p.y / maxY) * 100}%`,
                  width: `${(p.width / base) * 100}%`,
                  height: `${(p.height / maxY) * 100}%`,
                }}
                onClick={() => setSelected(w)}
                aria-label={getLocalizedValue(locale, w.title, w.title_en)}
              >
                <WorkImage work={w} sizes="(max-width:640px) 55vw, 30vw" />
              </button>
            ) : null;
          })}
        </div>
      )}
      {view === "years" &&
        [...new Set(works.map((w) => w.year))]
          .sort((a, b) => b - a)
          .map((year) => (
            <section className="works-year" key={year}>
              <h2>{year}</h2>
              <div className="works-grid">
                {works
                  .filter((w) => w.year === year)
                  .map((w) => (
                    <div key={w.id}>{button(w)}</div>
                  ))}
              </div>
            </section>
          ))}
      {view === "sequences" &&
        (snapshot.layout.sequences.length ? (
          snapshot.layout.sequences.map((seq) => (
            <section className="works-sequence" key={seq.id}>
              <h2>{getLocalizedValue(locale, seq.title, seq.title_en)}</h2>
              <ol>
                {seq.steps.map((step) => (
                  <li key={step.id}>
                    <h3>
                      {getLocalizedValue(locale, step.title, step.title_en)}
                    </h3>
                    <div className="works-grid">
                      {step.artworkIds.map((id) => {
                        const w = workMap.get(id);
                        return w ? <div key={id}>{button(w)}</div> : null;
                      })}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))
        ) : (
          <p className="works-empty">
            {locale === "ko" ? "준비 중입니다." : "Coming soon."}
          </p>
        ))}
      {selected && (
        <ArtworkModal
          artwork={selected}
          onClose={() => setSelected(null)}
          hasPrev={works.findIndex((w) => w.id === selected.id) > 0}
          hasNext={
            works.findIndex((w) => w.id === selected.id) < works.length - 1
          }
          onPrev={() =>
            setSelected(works[works.findIndex((w) => w.id === selected.id) - 1])
          }
          onNext={() =>
            setSelected(works[works.findIndex((w) => w.id === selected.id) + 1])
          }
        />
      )}
    </div>
  );
}
