import type { ArchiveWork } from "@/types/archive";
import { WorkImage } from "./WorksBrowser";
import { useLocale } from "@/i18n";
import { getLocalizedValue } from "@/lib/i18n-utils";
export default function SpacePreview({
  work,
  corner,
}: {
  work: ArchiveWork;
  corner: "left" | "right";
}) {
  const { locale } = useLocale();
  return (
    <div className={`space-preview space-preview-${corner}`} aria-hidden="true">
      <div>
        <WorkImage work={work} sizes="320px" />
      </div>
      <p>{getLocalizedValue(locale, work.title, work.title_en)}</p>
    </div>
  );
}
