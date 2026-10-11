/** Longest side of a leaf photo sent to the vision route. */
export const PHOTO_MAX_EDGE = 1280;

export const PHOTO_JPEG_QUALITY = 0.82;

export function scaledSize(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  if (!(width > 0) || !(height > 0) || !(maxEdge > 0)) {
    return { width: 1, height: 1 };
  }
  const edge = Math.max(width, height);
  if (edge <= maxEdge) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const scale = maxEdge / edge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
