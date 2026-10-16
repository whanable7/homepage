"use client";
import Image from "next/image";
import { cloudinaryLoader } from "@/lib/cloudinary-loader";
import type { Artwork, Category, Tag } from "@/types/artwork";
interface Props {
  artworks: Artwork[];
  categories: Category[];
  allTags?: Tag[];
  onEdit: (a: Artwork) => void;
  onDelete: (a: Artwork) => void;
  onTagsChange?: () => void;
  onFeaturedChange?: () => void;
}
export default function ArtworkTable({ artworks, onEdit, onDelete }: Props) {
  return (
    <div className="admin-art-grid">
      {artworks.map((w) => (
        <article key={w.id}>
          <div className="relative h-40">
            <Image
              src={w.image_url}
              alt={w.title}
              fill
              sizes="200px"
              className="object-contain"
              {...(w.image_url.includes("res.cloudinary.com")
                ? { loader: cloudinaryLoader }
                : {})}
            />
          </div>
          <p>
            {w.title} · {w.year}
          </p>
          <button onClick={() => onEdit(w)}>이미지·캡션 수정</button>
          <button onClick={() => onDelete(w)}>보관함으로 이동</button>
        </article>
      ))}
    </div>
  );
}
