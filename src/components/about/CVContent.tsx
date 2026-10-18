"use client";
import { useLocale } from "@/i18n";
import { getLocalizedValue } from "@/lib/i18n-utils";
import { orderedSections, cvLabels } from "@/lib/cv";
import type { AboutInfo, Exhibition } from "@/types/artwork";
type Item = Record<string, string>;
export default function CVContent({
  aboutInfo,
  exhibitions,
}: {
  aboutInfo: AboutInfo | null;
  exhibitions: Exhibition[];
}) {
  const { locale, t } = useLocale(),
    about = aboutInfo as
      | (AboutInfo & {
          projects?: Item[];
          cv_section_order?: string[];
          cv_exhibition_order?: string[];
        })
      | null;
  const localized = (a: string | undefined, b: string | undefined) =>
    getLocalizedValue(locale, a || "", b || "");
  const birthplace = localized(
      [about?.birth_city, about?.birth_country].filter(Boolean).join(", "),
      [about?.birth_city_en, about?.birth_country_en]
        .filter(Boolean)
        .join(", "),
    ),
    liveplace = localized(
      [about?.live_city, about?.live_country].filter(Boolean).join(", "),
      [about?.live_city_en, about?.live_country_en].filter(Boolean).join(", "),
    );
  return (
    <article className="cv-content">
      <h1>
        {localized(
          about?.artist_name,
          about?.artist_name_en || "Jungwhan Park",
        )}
      </h1>
      {birthplace && (
        <p>
          {t.cv.bornIn} {birthplace}
        </p>
      )}
      {liveplace && (
        <p>
          {t.cv.liveAndWorkIn} {liveplace}
        </p>
      )}
      {orderedSections(about?.cv_section_order).map((key) => {
        const ids = about?.cv_exhibition_order || [],
          items: Item[] = ["solo", "group", "popup"].includes(key)
            ? exhibitions
                .filter((e) => e.type === key)
                .sort(
                  (a, b) =>
                    (ids.includes(a.id) ? ids.indexOf(a.id) : 9999) -
                      (ids.includes(b.id) ? ids.indexOf(b.id) : 9999) ||
                    b.year - a.year,
                )
                .map((e) => ({ ...e, year: String(e.year) }) as unknown as Item)
            : (about as unknown as Record<string, Item[]>)?.[key] || [];
        if (!items.length) return null;
        return (
          <section key={key}>
            <h2>{cvLabels[key][locale === "ko" ? 0 : 1]}</h2>
            <ul>
              {items.map((item, i) => (
                <li key={item.id || i}>
                  <span className="cv-year">{item.year}</span>
                  <div>
                    <p>
                      {localized(
                        item.title ||
                          item.description ||
                          item.name ||
                          item.program,
                        item.title_en ||
                          item.description_en ||
                          item.name_en ||
                          item.program_en,
                      )}
                      {(item.venue || item.venue_en) &&
                        `, ${localized(item.venue, item.venue_en)}`}
                    </p>
                    {[
                      localized(item.role, item.role_en),
                      localized(
                        item.organization || item.publisher,
                        item.organization_en || item.publisher_en,
                      ),
                      localized(item.location, item.location_en),
                    ]
                      .filter(Boolean)
                      .map((line, j) => (
                        <p key={j}>{line}</p>
                      ))}
                    {key === "projects" && item.description && (
                      <p>{localized(item.description, item.description_en)}</p>
                    )}
                    {/^https?:\/\//.test(item.url || "") && (
                      <a href={item.url} target="_blank" rel="noreferrer">
                        ↗
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {about?.cv_file_url && (
        <a href={about.cv_file_url} target="_blank" rel="noreferrer">
          {t.cv.downloadCv} ↗
        </a>
      )}
    </article>
  );
}
