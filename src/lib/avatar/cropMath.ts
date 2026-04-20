/**
 * Shared math for the avatar crop editor.
 *
 * The same `computeCropTransform` function is used both for the live circular
 * preview (rendered into a small canvas) and for the final 512x512 PNG export,
 * guaranteeing that what the user sees is exactly what gets saved.
 *
 * Coordinate system:
 * - The crop frame is always a square of side `outputSize` (in target pixels).
 * - `zoom` is a multiplier on top of the base "cover" scale that ensures the
 *   image fully covers the crop frame at zoom = 1.
 * - `offsetX` / `offsetY` are the user-applied translations, in target pixels,
 *   relative to the centered position. Positive X moves the image right.
 */

export interface CropTransformInput {
  /** Natural pixel width of the source image. */
  imageWidth: number;
  /** Natural pixel height of the source image. */
  imageHeight: number;
  /** Side of the square crop frame, in target output pixels. */
  outputSize: number;
  /** Multiplier on top of the base cover scale. Clamped 1..maxZoom. */
  zoom: number;
  /** Horizontal offset in target pixels (positive = right). */
  offsetX: number;
  /** Vertical offset in target pixels (positive = down). */
  offsetY: number;
}

export interface CropTransform {
  /** Where to start drawing the image (top-left), in target pixels. */
  drawX: number;
  drawY: number;
  /** Final draw size of the image, in target pixels. */
  drawW: number;
  drawH: number;
  /** Effective scale = baseCover * zoom. */
  effectiveScale: number;
  /** Maximum |offsetX| / |offsetY| that keeps the image covering the frame. */
  maxOffsetX: number;
  maxOffsetY: number;
}

/**
 * Computes the final draw rectangle for the source image inside a square
 * crop frame, given user zoom and offsets.
 */
export function computeCropTransform(input: CropTransformInput): CropTransform {
  const { imageWidth, imageHeight, outputSize, zoom, offsetX, offsetY } = input;

  // Base "cover" scale: enlarge the image until its smallest side covers the frame.
  const baseCover = Math.max(outputSize / imageWidth, outputSize / imageHeight);
  const effectiveScale = baseCover * Math.max(1, zoom);

  const drawW = imageWidth * effectiveScale;
  const drawH = imageHeight * effectiveScale;

  // Maximum offsets so the image still covers the entire crop frame.
  const maxOffsetX = Math.max(0, (drawW - outputSize) / 2);
  const maxOffsetY = Math.max(0, (drawH - outputSize) / 2);

  const clampedX = clamp(offsetX, -maxOffsetX, maxOffsetX);
  const clampedY = clamp(offsetY, -maxOffsetY, maxOffsetY);

  // Centered image with user offsets applied.
  const drawX = (outputSize - drawW) / 2 + clampedX;
  const drawY = (outputSize - drawH) / 2 + clampedY;

  return {
    drawX,
    drawY,
    drawW,
    drawH,
    effectiveScale,
    maxOffsetX,
    maxOffsetY,
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Renders the cropped square avatar into a fresh canvas at the requested
 * output size and returns the canvas. Caller is responsible for `.toBlob`.
 */
export function renderCroppedAvatar(
  image: HTMLImageElement,
  outputSize: number,
  zoom: number,
  offsetX: number,
  offsetY: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, outputSize, outputSize);

  const t = computeCropTransform({
    imageWidth: image.naturalWidth,
    imageHeight: image.naturalHeight,
    outputSize,
    zoom,
    offsetX,
    offsetY,
  });

  ctx.drawImage(image, t.drawX, t.drawY, t.drawW, t.drawH);
  return canvas;
}
