import { readDocument } from "./archive-store";
import type { ArchiveText } from "@/types/archive";
export async function publicTexts() {
  return (await readDocument("texts", [] as ArchiveText[])).data
    .filter((t) => !t.deleted_at && (t.ko.published || t.en.published))
    .map((t) => ({
      ...t,
      ko: t.ko.published ? t.ko : { title: "", blocks: [], published: false },
      en: t.en.published ? t.en : { title: "", blocks: [], published: false },
    }));
}
