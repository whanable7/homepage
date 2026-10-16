"use client";
import { useState } from "react";
import type { Artwork, ArtworkFormData, Category } from "@/types/artwork";
import type { ArchiveWork } from "@/types/archive";
import { uploadImage } from "@/lib/upload-image";
type Form = ArtworkFormData & {
  id?: string;
  image_url: string;
  thumbnail_url: string;
  image_width?: number;
  image_height?: number;
  status?: "draft" | "published";
};
export default function ArtworkForm({
  artwork,
  onSubmit,
  onCancel,
}: {
  artwork?: Artwork | ArchiveWork;
  categories: Category[];
  onSubmit: (data: Form) => Promise<void>;
  onCancel: () => void;
}) {
  const w = artwork as ArchiveWork | undefined;
  const [data, setData] = useState<Form>({
    id: w?.id || crypto.randomUUID(),
    title: w?.title || "",
    title_en: w?.title_en || "",
    year: w?.year || new Date().getFullYear(),
    width: w?.width || undefined,
    height: w?.height || undefined,
    medium: w?.medium || "",
    medium_en: w?.medium_en || "",
    description: w?.description || "",
    description_en: w?.description_en || "",
    collection: w?.collection || "",
    collection_en: w?.collection_en || "",
    variable_size: w?.variable_size || false,
    image_url: w?.image_url || "",
    thumbnail_url: w?.thumbnail_url || "",
    image_width: w?.image_width,
    image_height: w?.image_height,
    status: w?.status || (w ? "published" : "draft"),
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const field = (name: keyof Form, label: string, type = "text") => (
    <label className="admin-field">
      {label}
      <input
        type={type}
        step={type === "number" ? "any" : undefined}
        value={String(data[name] ?? "")}
        onChange={(e) =>
          setData({
            ...data,
            [name]:
              type === "number"
                ? e.target.value === ""
                  ? undefined
                  : Number(e.target.value)
                : e.target.value,
          })
        }
      />
    </label>
  );
  return (
    <form
      className="archive-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        if (
          !data.title.trim() ||
          !data.image_url ||
          !Number.isInteger(data.year) ||
          data.year < 1900 ||
          data.year > new Date().getFullYear() + 1
        ) {
          setError("이미지, 제목, 제작연도를 확인해 주세요.");
          return;
        }
        if (
          [data.width, data.height].some(
            (n) => n != null && (!Number.isFinite(n) || n <= 0),
          )
        ) {
          setError("치수는 0보다 큰 숫자로 입력해 주세요.");
          return;
        }
        setBusy(true);
        setError("");
        try {
          await onSubmit({
            ...data,
            width: data.width ?? null,
            height: data.height ?? null,
            title: data.title.trim(),
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : "저장 실패");
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && <p role="alert">{error}</p>}
      {data.image_url && (
        <img
          className="admin-form-preview"
          src={data.thumbnail_url || data.image_url}
          alt="작품 미리보기"
        />
      )}
      <label className="admin-field">
        작품 이미지
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setError("");
            try {
              const uploaded = await uploadImage(file);
              setData((current) => ({ ...current, ...uploaded }));
            } catch (err) {
              setError(err instanceof Error ? err.message : "업로드 실패");
            } finally {
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
      </label>
      <div className="admin-form-grid">
        {field("title", "제목")}
        {field("title_en", "제목 · English")}
        {field("year", "제작연도", "number")}
        {field("height", "세로 · cm", "number")}
        {field("width", "가로 · cm", "number")}
        {field("medium", "재료")}
        {field("medium_en", "재료 · English")}
        {field("collection", "소장처")}
        {field("collection_en", "소장처 · English")}
      </div>
      <label className="admin-check">
        <input
          type="checkbox"
          checked={data.variable_size || false}
          onChange={(e) =>
            setData({ ...data, variable_size: e.target.checked })
          }
        />
        가변크기
      </label>
      <div className="admin-form-grid">
        <label className="admin-field">
          설명
          <textarea
            value={data.description || ""}
            onChange={(e) => setData({ ...data, description: e.target.value })}
          />
        </label>
        <label className="admin-field">
          설명 · English
          <textarea
            value={data.description_en || ""}
            onChange={(e) =>
              setData({ ...data, description_en: e.target.value })
            }
          />
        </label>
      </div>
      <label className="admin-check">
        <input
          type="checkbox"
          checked={data.status === "published"}
          onChange={(e) =>
            setData({
              ...data,
              status: e.target.checked ? "published" : "draft",
            })
          }
        />
        다음 공개에 포함
      </label>
      <div className="admin-actions">
        <button type="button" onClick={onCancel} disabled={busy}>
          취소
        </button>
        <button type="submit" disabled={busy}>
          {busy ? "처리 중…" : "임시 저장"}
        </button>
      </div>
    </form>
  );
}
