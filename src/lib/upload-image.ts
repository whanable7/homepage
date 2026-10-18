export async function uploadImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("JPG, PNG, WebP 파일을 선택해 주세요.");
  if (file.size > 30 * 1024 * 1024)
    throw new Error("이미지는 30MB 이하여야 합니다.");
  const signature = await fetch(
    `/api/portfolio/upload?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`,
    { cache: "no-store" },
  );
  const info = await signature.json();
  if (!signature.ok) throw new Error(info.error || "업로드 준비 실패");
  const data = new FormData();
  data.append("file", file);
  for (const [key, value] of Object.entries({
    api_key: info.apiKey,
    timestamp: info.timestamp,
    signature: info.signature,
    folder: info.folder,
    public_id: info.publicId,
  }))
    data.append(key, String(value));
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${info.cloudName}/image/upload`,
    { method: "POST", body: data },
  );
  const result = await response.json();
  if (!response.ok || !result.secure_url)
    throw new Error(
      "이미지 업로드에 실패했습니다. 이 파일만 다시 시도할 수 있습니다.",
    );
  return {
    image_url: result.secure_url as string,
    thumbnail_url: (result.secure_url as string).replace(
      "/upload/",
      "/upload/c_limit,w_500,h_500,q_auto,f_auto/",
    ),
    image_width: result.width as number,
    image_height: result.height as number,
  };
}
