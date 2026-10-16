import type { Artwork } from "./artwork";
export interface PaletteColor {
  hex: string;
  percentage: number;
}
export interface ArchiveWork extends Omit<Artwork, "dominant_color"> {
  dominant_color:
    | Artwork["dominant_color"]
    | { h: number; s: number; l: number; isAchromatic?: boolean };
  representative_color?: string;
  palette?: PaletteColor[];
  image_aspect_ratio?: number;
  image_width?: number;
  image_height?: number;
  status?: "draft" | "published";
  deleted_at?: string;
  featured_order?: number;
}
export interface WorkGroup {
  id: string;
  name: string;
  artworkIds: string[];
  edges?: [string, string][];
}
export interface Sequence {
  id: string;
  title: string;
  title_en: string;
  steps: {
    id: string;
    title: string;
    title_en: string;
    artworkIds: string[];
  }[];
}
export interface ArchiveLayout {
  ecosystem: WorkGroup[];
  cosmos: WorkGroup[];
  sequences: Sequence[];
  stars: Record<string, 1 | 2 | 3>;
  excluded: Partial<
    Record<"ecosystem" | "cosmos" | "strata" | "years", string[]>
  >;
  seed: number;
  yearOrder?: Record<string, string[]>;
}
export interface Placement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface PublishedArchive {
  works: ArchiveWork[];
  layout: ArchiveLayout;
  strata: { phone: Placement[]; desktop: Placement[] };
  revision: string;
  publishedAt: string;
}
export interface ArchiveState {
  published: PublishedArchive;
  draft: ArchiveLayout;
  backups: { savedAt: string; layout: ArchiveLayout }[];
}
export interface TextBlock {
  id: string;
  text: string;
  align: "left" | "center" | "right" | "justify";
  size: number;
  color: string;
  style: "paragraph" | "heading" | "quote";
}
export interface TextLanguage {
  title: string;
  blocks: TextBlock[];
  pdfId?: string;
  published: boolean;
}
export interface ArchiveText {
  id: string;
  category: "notes" | "studies";
  date: string;
  ko: TextLanguage;
  en: TextLanguage;
  updated_at: string;
  deleted_at?: string;
}
export interface ArchiveFile {
  id: string;
  pathname: string;
  filename: string;
  contentType: string;
  size: number;
  created_at: string;
}
