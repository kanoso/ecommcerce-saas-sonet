/** Pure zoom/pan math of the image lightbox, kept free of DOM so it is unit-testable. */

export const MIN_SCALE = 1;
export const MAX_SCALE = 4;
/** Scale change of the zoom in / zoom out buttons. */
export const ZOOM_STEP = 0.5;
/** Scale change of one mouse wheel notch. */
export const WHEEL_STEP = 0.25;
/** Scale a double-click or double-tap jumps to from 1x. */
export const DOUBLE_TAP_SCALE = 2.5;

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return MIN_SCALE;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/**
 * Limits a pan offset (transform-origin at the centre) so the scaled image
 * always covers the viewport on the axes where it overflows, and stays
 * centred on the axes where it fits. The image can never leave the screen.
 */
export function clampPan(pan: Point, scale: number, viewport: Size, image: Size): Point {
  const maxX = Math.max(0, (image.width * scale - viewport.width) / 2);
  const maxY = Math.max(0, (image.height * scale - viewport.height) / 2);
  return { x: clampAxis(pan.x, maxX), y: clampAxis(pan.y, maxY) };
}

function clampAxis(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  // `+ 0` turns -0 into 0 so results compare cleanly.
  return Math.min(max, Math.max(-max, value)) + 0;
}

/** Wheel delta (px) worth one full WHEEL_STEP: a mouse notch is about 100. */
const WHEEL_DELTA_PER_STEP = 100;

/**
 * Wheel up (negative delta) zooms in, down zooms out, in proportion to the
 * delta so a trackpad pinch (many small deltas) is smooth; one event never
 * moves more than one step.
 */
export function wheelScale(scale: number, deltaY: number): number {
  if (!Number.isFinite(deltaY) || deltaY === 0) return clampScale(scale);
  const steps = Math.min(1, Math.abs(deltaY) / WHEEL_DELTA_PER_STEP);
  return clampScale(scale - Math.sign(deltaY) * steps * WHEEL_STEP);
}

/** Scale while pinching: proportional to how far the fingers moved apart. */
export function pinchScale(startScale: number, startDistance: number, distance: number): number {
  if (startDistance <= 0) return clampScale(startScale);
  return clampScale((startScale * distance) / startDistance);
}

/** Double-click/double-tap: from 1x to DOUBLE_TAP_SCALE, from any zoom back to 1x. */
export function toggleScale(scale: number): number {
  return scale > MIN_SCALE ? MIN_SCALE : DOUBLE_TAP_SCALE;
}
