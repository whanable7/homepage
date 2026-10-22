import { createHash } from "node:crypto";
import { appearanceSeed, validateAppearance } from "./appearance";
import type {
  ArchiveState,
  ArchiveText,
  PublishedArchive,
} from "@/types/archive";

export const publicNames = [
  "archive",
  "about",
  "texts",
  "news",
  "exhibitions",
  "appearance",
  "categories",
  "files",
] as const;
export type PublicName = (typeof publicNames)[number];
export const isPublicName = (name: string): name is PublicName =>
  publicNames.includes(name as PublicName);
type Row = Record<string, unknown>;
const pick = (row: Row, keys: readonly string[]) =>
  Object.fromEntries(
    keys.filter((key) => row[key] !== undefined).map((key) => [key, row[key]]),
  );
const records = (value: unknown) =>
  (Array.isArray(value) ? value : []) as Row[];
const live = (value: unknown) =>
  records(value).filter((row) => !row.deleted_at);
const workKeys = [
  "id",
  "title",
  "title_en",
  "year",
  "width",
  "height",
  "medium",
  "medium_en",
  "description",
  "description_en",
  "collection",
  "collection_en",
  "variable_size",
  "image_url",
  "thumbnail_url",
  "is_featured",
  "featured_order",
  "order",
  "category_id",
  "dominant_color",
  "representative_color",
  "palette",
  "image_aspect_ratio",
  "image_width",
  "image_height",
  "created_at",
  "updated_at",
];
const aboutKeys = [
  "id",
  "artist_name",
  "artist_name_en",
  "bio_paragraphs",
  "bio_paragraphs_en",
  "footer_bio",
  "footer_bio_en",
  "education",
  "birth_city",
  "birth_city_en",
  "birth_country",
  "birth_country_en",
  "live_city",
  "live_city_en",
  "live_country",
  "live_country_en",
  "residencies",
  "fellowships",
  "awards",
  "publications",
  "projects",
  "cv_section_order",
  "cv_exhibition_order",
  "contact_email",
  "phone_visible",
  "studio_address",
  "studio_address_en",
  "contact_note",
  "contact_note_en",
  "social_links",
  "profile_image_url",
  "cv_file_url",
];

/** Only visitor fields enter the persistent cache. Drafts, backups and ETags never do. */
export function publicProjection(name: PublicName, value: unknown): unknown {
  if (name === "archive") {
    const source = (value as ArchiveState).published;
    const works = source.works.filter(
      (w) => !w.deleted_at && w.status !== "draft",
    );
    const ids = new Set(works.map((w) => w.id));
    const groups = (list: typeof source.layout.ecosystem) =>
      list.map((g) => ({
        id: g.id,
        name: "",
        artworkIds: g.artworkIds.filter((id) => ids.has(id)),
        ...(g.edges
          ? { edges: g.edges.filter((e) => e.every((id) => ids.has(id))) }
          : {}),
      }));
    return {
      works: works.map((w) => ({
        ...pick(w as unknown as Row, workKeys),
        show_watermark: false,
      })),
      layout: {
        ecosystem: groups(source.layout.ecosystem),
        cosmos: groups(source.layout.cosmos),
        sequences: source.layout.sequences.map((s) => ({
          id: s.id,
          title: s.title,
          title_en: s.title_en,
          steps: s.steps.map((step) => ({
            id: step.id,
            title: step.title,
            title_en: step.title_en,
            ...(step.anchorX === undefined ? {} : { anchorX: step.anchorX }),
            artworkIds: step.artworkIds.filter((id) => ids.has(id)),
          })),
          ...(s.positions
            ? {
                positions: Object.fromEntries(
                  Object.entries(s.positions).filter(([key]) =>
                    s.steps.some((step) =>
                      step.artworkIds.some(
                        (id) => ids.has(id) && key === `${step.id}:${id}`,
                      ),
                    ),
                  ),
                ),
              }
            : {}),
        })),
        stars: Object.fromEntries(
          Object.entries(source.layout.stars).filter(([id]) => ids.has(id)),
        ),
        excluded: source.layout.excluded,
        seed: source.layout.seed,
        ...(source.layout.yearOrder
          ? { yearOrder: source.layout.yearOrder }
          : {}),
      },
      strata: source.strata,
      revision: source.revision,
      publishedAt: source.publishedAt,
    } as PublishedArchive;
  }
  if (name === "appearance")
    return validateAppearance(
      (value as ReturnType<typeof appearanceSeed>).published,
    );
  if (name === "about") {
    const row = value as Row;
    return {
      ...pick(row, aboutKeys),
      ...(row.phone_visible ? pick(row, ["contact_phone"]) : {}),
    };
  }
  if (name === "texts")
    return (value as ArchiveText[])
      .filter((t) => !t.deleted_at && (t.ko.published || t.en.published))
      .map((t) => ({
        id: t.id,
        category: t.category,
        date: t.date,
        ...Object.fromEntries(
          (["ko", "en"] as const).map((locale) => {
            const l = t[locale];
            return [
              locale,
              l.published
                ? {
                    title: l.title,
                    published: true,
                    ...(l.pdfId ? { pdfId: l.pdfId } : {}),
                    blocks: l.blocks.map((b) =>
                      pick(b as unknown as Row, [
                        "id",
                        "text",
                        "align",
                        "size",
                        "lineHeight",
                        "paragraphSpacing",
                        "color",
                        "style",
                      ]),
                    ),
                  }
                : { title: "", blocks: [], published: false },
            ];
          }),
        ),
      }));
  const keys =
    name === "news"
      ? [
          "id",
          "title",
          "title_en",
          "content",
          "content_en",
          "thumbnail_url",
          "link_url",
          "pdf_url",
          "type",
          "published_at",
          "created_at",
        ]
      : name === "exhibitions"
        ? [
            "id",
            "title",
            "title_en",
            "venue",
            "venue_en",
            "location",
            "location_en",
            "year",
            "type",
            "external_url",
            "display_order",
            "created_at",
          ]
        : name === "categories"
          ? [
              "id",
              "name",
              "name_en",
              "slug",
              "description",
              "description_en",
              "cover_image_url",
              "order",
              "created_at",
              "updated_at",
            ]
          : ["id", "pathname", "filename", "contentType", "size", "created_at"];
  return live(value).map((row) => pick(row, keys));
}

export const contentHash = (data: unknown) =>
  createHash("sha256").update(JSON.stringify(data)).digest("hex");
export function publicChanged(name: string, before: unknown, after: unknown) {
  return (
    isPublicName(name) &&
    contentHash(publicProjection(name, before)) !==
      contentHash(publicProjection(name, after))
  );
}
