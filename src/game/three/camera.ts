import { COLS, ROWS } from "../../game/land.ts";

export const CELL_SIZE = 2.2;
export const CAMERA_PITCH_DEGREES = 32.5;
export const CAMERA_YAW_DEGREES = 45;
export const LAND_HEIGHT = 0.3;

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

export function lodFor(viewHeight: number, distance: number): 0 | 1 | 2 {
  if (viewHeight <= 32 && distance <= 55) return 0;
  if (viewHeight <= 66 && distance <= 105) return 1;
  return 2;
}
