export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function containedImageRect(
  box: Rect,
  naturalWidth: number,
  naturalHeight: number,
): Rect | null {
  if (
    ![box.width, box.height, naturalWidth, naturalHeight].every(
      (n) => Number.isFinite(n) && n > 0,
    )
  )
    return null;
  const scale = Math.min(box.width / naturalWidth, box.height / naturalHeight);
  const width = naturalWidth * scale,
    height = naturalHeight * scale;
  return {
    left: box.left + (box.width - width) / 2,
    top: box.top + (box.height - height) / 2,
    width,
    height,
  };
}

export function magnifierGeometry(
  image: Rect,
  point: { x: number; y: number },
  viewport: Rect,
  zoom = 2.5,
) {
  const x = point.x - image.left,
    y = point.y - image.top;
  if (x < 0 || y < 0 || x > image.width || y > image.height) return null;
  const size = Math.min(400, viewport.width - 16, viewport.height - 16);
  if (size < 40) return null;
  const left = Math.max(
    viewport.left + 8,
    Math.min(viewport.left + viewport.width - size - 8, point.x - size / 2),
  );
  const top = Math.max(
    viewport.top + 8,
    Math.min(viewport.top + viewport.height - size - 8, point.y - size / 2),
  );
  return {
    left,
    top,
    size,
    backgroundWidth: image.width * zoom,
    backgroundHeight: image.height * zoom,
    // Keep the sampled point at the lens center even when the lens itself moves.
    backgroundX: size / 2 - x * zoom,
    backgroundY: size / 2 - y * zoom,
  };
}
