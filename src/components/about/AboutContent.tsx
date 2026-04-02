'use client';

import { AboutInfo, Exhibition } from '@/types/artwork';
import { useLocale } from '@/i18n';
import { getLocalizedValue } from '@/lib/i18n-utils';

interface AboutContentProps {
  aboutInfo: AboutInfo | null;
  exhibitions: Exhibition[];
}

export default function AboutContent({ aboutInfo, exhibitions }: AboutContentProps) {
  const { locale, t } = useLocale();

  const artistName = aboutInfo
    ? getLocalizedValue(locale, aboutInfo.artist_name, aboutInfo.artist_name_en)
    : 'Jungwhan';

  const education = aboutInfo?.education || [];
  const residencies = aboutInfo?.residencies || [];
  const fellowships = aboutInfo?.fellowships || [];
  const awards = aboutInfo?.awards || [];
  const publications = aboutInfo?.publications || [];
  const cvFileUrl = aboutInfo?.cv_file_url;

  // Born in / Live & Work in
  const birthPlace = aboutInfo
    ? getLocalizedValue(
        locale,
        [aboutInfo.birth_city, aboutInfo.birth_country].filter(Boolean).join(', '),
        [aboutInfo.birth_city_en, aboutInfo.birth_country_en].filter(Boolean).join(', ')
      )
    : null;

  const livePlace = aboutInfo
    ? getLocalizedValue(
        locale,
        [aboutInfo.live_city, aboutInfo.live_country].filter(Boolean).join(', '),
        [aboutInfo.live_city_en, aboutInfo.live_country_en].filter(Boolean).join(', ')
      )
    : null;

  // Group exhibitions by type
  const soloExhibitions = exhibitions.filter(e => e.type === 'solo');
  const groupExhibitions = exhibitions.filter(e => e.type === 'group');
  const popupExhibitions = exhibitions.filter(e => e.type === 'popup');

  // CV Section Component
  const CVSection = ({
    title,
    children
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <div className="mb-10">
      <h3 className="text-sm font-medium tracking-wider text-[var(--text-secondary)] uppercase mb-4">
        {title}
      </h3>
      {children}
    </div>
  );

  // Exhibition List Component
  const ExhibitionList = ({ items }: { items: Exhibition[] }) => (
    <ul className="space-y-1.5 text-[var(--text-secondary)]">
      {items.map((exhibition) => (
        <li key={exhibition.id} className="leading-relaxed">
          <span className="text-[var(--text-secondary)] mr-2">{exhibition.year}</span>
          {getLocalizedValue(locale, exhibition.title, exhibition.title_en)}
          {(exhibition.venue || exhibition.venue_en) && (
            <span className="text-[var(--text-secondary)]">
              , {getLocalizedValue(locale, exhibition.venue, exhibition.venue_en)}
            </span>
          )}
          {(exhibition.location || exhibition.location_en) && (
            <span className="text-[var(--text-secondary)]">
              , {getLocalizedValue(locale, exhibition.location, exhibition.location_en)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="max-w-2xl">
      {/* Artist Name */}
      <h1 className="text-4xl font-light tracking-wide mb-8 text-[var(--foreground)]">
        {artistName}
      </h1>

      {/* Born in / Live & Work in */}
      {(birthPlace || livePlace) && (
        <div className="mb-10 space-y-1 text-[var(--text-secondary)]">
          {birthPlace && (
            <p>
              <span className="text-[var(--text-secondary)]">{t.cv.bornIn}</span> {birthPlace}
            </p>
          )}
          {livePlace && (
            <p>
              <span className="text-[var(--text-secondary)]">{t.cv.liveAndWorkIn}</span> {livePlace}
            </p>
          )}
        </div>
      )}

      {/* Education */}
      {education.length > 0 && (
        <CVSection title={t.cv.education}>
          <ul className="space-y-1.5 text-[var(--text-secondary)]">
            {education.map((item, index) => (
              <li key={index} className="leading-relaxed">
                <span className="text-[var(--text-secondary)] mr-2">{item.year}</span>
                {getLocalizedValue(locale, item.description, item.description_en)}
              </li>
            ))}
          </ul>
        </CVSection>
      )}

      {/* Solo Exhibitions */}
      {soloExhibitions.length > 0 && (
        <CVSection title={t.cv.soloExhibitions}>
          <ExhibitionList items={soloExhibitions} />
        </CVSection>
      )}

      {/* Group Exhibitions */}
      {groupExhibitions.length > 0 && (
        <CVSection title={t.cv.groupExhibitions}>
          <ExhibitionList items={groupExhibitions} />
        </CVSection>
      )}

      {/* Pop-up Exhibitions */}
      {popupExhibitions.length > 0 && (
        <CVSection title={t.cv.popupExhibitions}>
          <ExhibitionList items={popupExhibitions} />
        </CVSection>
      )}

      {/* Publications */}
      {publications.length > 0 && (
        <CVSection title={t.cv.publications}>
          <ul className="space-y-1.5 text-[var(--text-secondary)]">
            {publications.map((item, index) => (
              <li key={index} className="leading-relaxed">
                <span className="text-[var(--text-secondary)] mr-2">{item.year}</span>
                {getLocalizedValue(locale, item.title, item.title_en)}
                {(item.publisher || item.publisher_en) && (
                  <span className="text-[var(--text-secondary)]">
                    , {getLocalizedValue(locale, item.publisher, item.publisher_en)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </CVSection>
      )}

      {/* Residencies */}
      {residencies.length > 0 && (
        <CVSection title={t.cv.residencies}>
          <ul className="space-y-1.5 text-[var(--text-secondary)]">
            {residencies.map((item, index) => (
              <li key={index} className="leading-relaxed">
                <span className="text-[var(--text-secondary)] mr-2">{item.year}</span>
                {getLocalizedValue(locale, item.program, item.program_en)}
                {(item.location || item.location_en) && (
                  <span className="text-[var(--text-secondary)]">
                    , {getLocalizedValue(locale, item.location, item.location_en)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </CVSection>
      )}

      {/* Fellowships */}
      {fellowships.length > 0 && (
        <CVSection title={t.cv.fellowships}>
          <ul className="space-y-1.5 text-[var(--text-secondary)]">
            {fellowships.map((item, index) => (
              <li key={index} className="leading-relaxed">
                <span className="text-[var(--text-secondary)] mr-2">{item.year}</span>
                {getLocalizedValue(locale, item.name, item.name_en)}
                {(item.organization || item.organization_en) && (
                  <span className="text-[var(--text-secondary)]">
                    , {getLocalizedValue(locale, item.organization, item.organization_en)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </CVSection>
      )}

      {/* Awards */}
      {awards.length > 0 && (
        <CVSection title={t.cv.awards}>
          <ul className="space-y-1.5 text-[var(--text-secondary)]">
            {awards.map((item, index) => (
              <li key={index} className="leading-relaxed">
                <span className="text-[var(--text-secondary)] mr-2">{item.year}</span>
                {getLocalizedValue(locale, item.name, item.name_en)}
                {(item.organization || item.organization_en) && (
                  <span className="text-[var(--text-secondary)]">
                    , {getLocalizedValue(locale, item.organization, item.organization_en)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </CVSection>
      )}

      {/* CV Download */}
      {cvFileUrl && (
        <div className="mt-12">
          <a
            href={cvFileUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 border border-white text-[var(--foreground)] text-sm tracking-wider hover:bg-white hover:text-black transition-colors"
          >
            {t.cv.downloadCv}
          </a>
        </div>
      )}
    </div>
  );
}
