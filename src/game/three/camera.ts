import { COLS, ROWS } from "../../game/land.ts";

export const CELL_SIZE = 2.2;
export const CAMERA_PITCH_DEGREES = 32.5;
export const CAMERA_YAW_DEGREES = 45;
export const LAND_HEIGHT = 0.3;
/**
 * Distance from the orthographic camera to its target. Only the near/far clipping
 * depends on it: it must exceed the ground depth visible at the farthest zoom-out over
 * the whole 616×590 map, or the near corner of the view would be clipped.
 */
export const CAMERA_DISTANCE = 1500;

export type Cell = { c: number; r: number };

export function cellWorld(c: number, r: number) {
  return {
    x: (c - COLS / 2 + 0.5) * CELL_SIZE,
    z: (r - ROWS / 2 + 0.5) * CELL_SIZE,
  };
}

export function worldCell(x: number, z: number): Cell {
  return {
    c: Math.floor(x / CELL_SIZE + COLS / 2),
    r: Math.floor(z / CELL_SIZE + ROWS / 2),
  };
}

export function clampCameraTarget(target: { x: number; z: number }, viewHeight: number) {
  const halfWidth = (COLS * CELL_SIZE) / 2;
  const halfDepth = (ROWS * CELL_SIZE) / 2;
  const padding = Math.min(13, viewHeight * 0.24);
  target.x = Math.max(-halfWidth - padding, Math.min(halfWidth + padding, target.x));
  target.z = Math.max(-halfDepth - padding, Math.min(halfDepth + padding, target.z));
  return target;
}

export function framedView(
  cols: number,
  rows: number,
  width: number,
  height: number,
  occludedBottom = 0.4,
) {
  const sinPitch = Math.sin((CAMERA_PITCH_DEGREES * Math.PI) / 180);
  const span = (cols + rows) * CELL_SIZE * Math.SQRT1_2;
  const depth = span * sinPitch;
  const aspect = width / Math.max(1, height);
  const visible = Math.max(0.42, 1 - occludedBottom);
  const fit = Math.max(span / (aspect * 0.86), depth / (visible * 0.88));
  // Portrait phones cannot show a whole isometric block without shrinking lots
  // under a fingertip. Prefer readable lots and let the player pan sideways.
  const minCellPx = width < 700 ? 16 : 26;
  const finger = (CELL_SIZE * Math.SQRT1_2 * height) / minCellPx;
  const viewHeight = Math.min(92, Math.max(16, Math.min(fit, finger)));
  return { viewHeight, shift: ((occludedBottom / 2) * viewHeight) / sinPitch };
}

export function lodFor(viewHeight: number, distance: number): 0 | 1 | 2 | 3 {
  if (viewHeight <= 32 && distance <= 55) return 0;
  if (viewHeight <= 66 && distance <= 105) return 1;
  // Zoomed far out (whole regions in view) buildings are a few pixels: plain blocks.
  if (viewHeight > 110 || distance > 190) return 3;
  return 2;
}
