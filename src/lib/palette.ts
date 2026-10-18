import sharp from "sharp";
export async function analyzeArtworkImage(
  image_url: string,
  cloudName: string,
) {
  const url = new URL(image_url);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "res.cloudinary.com" ||
    !url.pathname.includes("/image/upload/") ||
    !cloudName ||
    !url.pathname.startsWith(`/${cloudName}/`)
  )
    throw new Error("등록한 Cloudinary 이미지를 선택해 주세요.");
  url.pathname = url.pathname.replace(
    "/upload/",
    "/upload/c_limit,w_256,h_256,f_png/",
  );
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (!response.ok) throw new Error("이미지를 불러오지 못했습니다.");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > 5 * 1024 * 1024)
    throw new Error("분석 이미지가 너무 큽니다.");
  const dimensions = await sharp(buffer).metadata();
  const { data, info } = await sharp(buffer)
    .resize(100, 100, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const histogram = new Map<string, { rgb: number[]; count: number }>();
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] < 128) continue;
    const rgb = [data[i], data[i + 1], data[i + 2]],
      key = rgb.map((v) => Math.round(v / 24)).join(",");
    const bin = histogram.get(key);
    if (bin) {
      bin.count++;
      bin.rgb = bin.rgb.map((v, j) => v + (rgb[j] - v) / bin.count);
    } else histogram.set(key, { rgb, count: 1 });
  }
  const bins = [...histogram.values()].sort((a, b) => b.count - a.count);
  if (!bins.length) throw new Error("분석할 색이 없습니다.");
  const centers: number[][] = [bins[0].rgb.slice()];
  while (centers.length < Math.min(5, bins.length)) {
    const next = [...bins].sort(
      (a, b) =>
        b.count *
          Math.min(
            ...centers.map((c) =>
              c.reduce((n, v, j) => n + (v - b.rgb[j]) ** 2, 0),
            ),
          ) -
        a.count *
          Math.min(
            ...centers.map((c) =>
              c.reduce((n, v, j) => n + (v - a.rgb[j]) ** 2, 0),
            ),
          ),
    )[0];
    centers.push(next.rgb.slice());
  }
  let weights: number[] = [];
  for (let pass = 0; pass < 12; pass++) {
    const sums = centers.map(() => [0, 0, 0]);
    weights = centers.map(() => 0);
    bins.forEach((bin) => {
      const distances = centers.map((c) =>
          c.reduce((n, v, j) => n + (v - bin.rgb[j]) ** 2, 0),
        ),
        index = distances.indexOf(Math.min(...distances));
      weights[index] += bin.count;
      sums[index] = sums[index].map((v, j) => v + bin.rgb[j] * bin.count);
    });
    centers.forEach((c, i) => {
      if (weights[i]) centers[i] = sums[i].map((v) => v / weights[i]);
    });
  }
  const total = weights.reduce((a, b) => a + b, 0),
    palette = centers
      .map((c, i) => ({
        hex:
          "#" +
          c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join(""),
        percentage: Math.round((weights[i] / total) * 1000) / 10,
      }))
      .filter((c) => c.percentage > 0)
      .sort((a, b) => b.percentage - a.percentage);
  return {
    image_aspect_ratio: (dimensions.width || 1) / (dimensions.height || 1),
    palette,
    dominant_color: palette[0].hex,
    representative_color: palette[0].hex,
  };
}
