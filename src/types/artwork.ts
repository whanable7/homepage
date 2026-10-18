export interface Category {
  id: string;
  name: string;
  name_en: string | null;
  slug: string;
  description: string | null;
  description_en: string | null;
  cover_image_url: string | null;
  order: number;
  created_at: string;
  updated_at: string;
}

// Tag system for mindmap connections
export interface Tag {
  id: string;
  name: string; // 관리자만 보는 언어적 태그
  created_at: string;
}

export interface ArtworkTag {
  artwork_id: string;
  tag_id: string;
  created_at: string;
}

// Connection info for mindmap view
export interface ArtworkConnection {
  connected_id: string;
  shared_tag_count: number;
  shared_tags: string[];
}

// CV 관련 타입
export interface ResidencyItem {
  year: string;
  program: string;
  program_en?: string;
  location: string;
  location_en?: string;
}

export interface FellowshipItem {
  year: string;
  name: string;
  name_en?: string;
  organization?: string;
  organization_en?: string;
}

export interface AwardItem {
  year: string;
  name: string;
  name_en?: string;
  organization?: string;
  organization_en?: string;
}

export interface PublicationItem {
  year: string;
  title: string;
  title_en?: string;
  publisher?: string;
  publisher_en?: string;
  type?: "book" | "catalog" | "article" | "other";
}

export interface Artwork {
  id: string;
  title: string;
  title_en: string | null;
  year: number;
  width: number | null;
  height: number | null;
  medium: string | null;
  medium_en: string | null;
  description: string | null;
  description_en: string | null;
  collection: string | null;
  collection_en: string | null;
  variable_size: boolean;
  image_url: string;
  thumbnail_url: string;
  is_featured: boolean;
  show_watermark: boolean;
  order: number;
  category_id: string | null;
  category?: Category;
  // New fields for views
  dominant_color: string | null; // HSL format for color wheel
  tags?: Tag[]; // Populated via join
  connections?: ArtworkConnection[]; // Populated for mindmap view
  created_at: string;
  updated_at: string;
}

export interface ArtworkFormData {
  title: string;
  title_en?: string;
  year: number;
  width?: number | null;
  height?: number | null;
  medium?: string;
  medium_en?: string;
  description?: string;
  description_en?: string;
  collection?: string;
  collection_en?: string;
  variable_size?: boolean;
  is_featured?: boolean;
  show_watermark?: boolean;
  category_id?: string;
  dominant_color?: string | null;
}

export interface CategoryFormData {
  name: string;
  name_en?: string;
  slug: string;
  description?: string;
  description_en?: string;
}

export interface EducationItem {
  year: string;
  description: string;
  description_en?: string;
}

export interface SocialLink {
  platform:
    "instagram" | "facebook" | "twitter" | "youtube" | "website" | "other";
  url: string;
  label?: string;
}

export interface AboutInfo {
  id: string;
  artist_name: string;
  artist_name_en: string | null;
  bio_paragraphs: string[];
  bio_paragraphs_en: string[];
  footer_bio: string | null;
  footer_bio_en: string | null;
  education: EducationItem[];
  // CV 출생지/거주지
  birth_city: string | null;
  birth_city_en: string | null;
  birth_country: string | null;
  birth_country_en: string | null;
  live_city: string | null;
  live_city_en: string | null;
  live_country: string | null;
  live_country_en: string | null;
  // CV 경력 섹션
  residencies: ResidencyItem[];
  fellowships: FellowshipItem[];
  awards: AwardItem[];
  publications: PublicationItem[];
  // 연락처
  contact_email: string | null;
  contact_phone: string | null;
  phone_visible: boolean;
  studio_address: string | null;
  studio_address_en: string | null;
  contact_note: string | null;
  contact_note_en: string | null;
  social_links: SocialLink[];
  profile_image_url: string | null;
  cv_file_url: string | null;
  updated_at: string;
}

export interface AboutFormData {
  artist_name: string;
  artist_name_en?: string;
  bio_paragraphs: string[];
  bio_paragraphs_en?: string[];
  footer_bio?: string;
  footer_bio_en?: string;
  education: EducationItem[];
  // CV 출생지/거주지
  birth_city?: string;
  birth_city_en?: string;
  birth_country?: string;
  birth_country_en?: string;
  live_city?: string;
  live_city_en?: string;
  live_country?: string;
  live_country_en?: string;
  // CV 경력 섹션
  residencies?: ResidencyItem[];
  fellowships?: FellowshipItem[];
  awards?: AwardItem[];
  publications?: PublicationItem[];
  // 연락처
  contact_email?: string;
  contact_phone?: string;
  phone_visible?: boolean;
  studio_address?: string;
  studio_address_en?: string;
  contact_note?: string;
  contact_note_en?: string;
  social_links?: SocialLink[];
  profile_image_url?: string;
  cv_file_url?: string;
}

// Exhibition page types
export interface Exhibition {
  id: string;
  title: string;
  title_en: string | null;
  venue: string;
  venue_en: string | null;
  location: string | null;
  location_en: string | null;
  year: number;
  type: "solo" | "group" | "popup";
  external_url: string | null;
  display_order: number;
  created_at: string;
}

export interface ExhibitionFormData {
  title: string;
  title_en?: string;
  venue: string;
  venue_en?: string;
  location?: string;
  location_en?: string;
  year: number;
  type: "solo" | "group" | "popup";
  external_url?: string;
  display_order?: number;
}

// News 타입
export interface News {
  id: string;
  title: string;
  title_en: string | null;
  content: string;
  content_en: string | null;
  thumbnail_url: string | null;
  link_url: string | null;
  pdf_url: string | null;
  type: "article" | "interview" | "artist_note" | "review";
  published_at: string;
  created_at: string;
  updated_at: string;
}

export interface NewsFormData {
  title: string;
  title_en?: string;
  content: string;
  content_en?: string;
  thumbnail_url?: string;
  link_url?: string;
  pdf_url?: string;
  type: "article" | "interview" | "artist_note" | "review";
  published_at?: string;
}

// Contact 타입
export interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}
