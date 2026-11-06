import { COLS, MAP_BOUNDS, ROWS } from "./land.ts";

/** An Arabic place name floating over the map at a rough real-world position. */
export interface Place {
  name: string;
  lon: number;
  lat: number;
  /** Larger type for the bay and the capital. */
  major?: boolean;
}

/**
 * Approximate label anchors (degrees, WGS84), on land except for the bay. Listed by
 * priority: when zoomed far out, a label that would overlap an earlier one is hidden.
 */
export const PLACES: readonly Place[] = [
  { name: "جون الكويت", lon: 47.86, lat: 29.42, major: true },
  { name: "مدينة الكويت", lon: 47.985, lat: 29.375, major: true },
  { name: "جزيرة بوبيان", lon: 48.2, lat: 29.8, major: true },
  { name: "جزيرة فيلكا", lon: 48.36, lat: 29.445 },
  { name: "جزيرة وربة", lon: 48.06, lat: 29.985 },
  { name: "الصبية", lon: 47.92, lat: 29.6 },
  { name: "الشويخ", lon: 47.94, lat: 29.345 },
  { name: "الدوحة", lon: 47.81, lat: 29.36 },
  { name: "الجهراء", lon: 47.66, lat: 29.34 },
  { name: "الصليبية", lon: 47.8, lat: 29.29 },
  { name: "كبد", lon: 47.78, lat: 29.18 },
  { name: "السالمية", lon: 48.075, lat: 29.335 },
  { name: "حولي", lon: 48.03, lat: 29.338 },
  { name: "الرميثية", lon: 48.075, lat: 29.31 },
  { name: "مشرف", lon: 48.065, lat: 29.272 },
  { name: "الخالدية", lon: 47.97, lat: 29.322 },
  { name: "الفروانية", lon: 47.955, lat: 29.278 },
  { name: "المطار", lon: 47.975, lat: 29.24 },
  { name: "الظهر", lon: 48.045, lat: 29.155 },
  { name: "الأحمدي", lon: 48.08, lat: 29.08 },
  { name: "الفحيحيل", lon: 48.13, lat: 29.08 },
  { name: "المنقف", lon: 48.13, lat: 29.1 },
];

/** Fractional fine-grid cell (column, row) of a longitude/latitude inside MAP_BOUNDS. */
export function lonLatToCell(lon: number, lat: number) {
  return {
    c: ((lon - MAP_BOUNDS.west) / (MAP_BOUNDS.east - MAP_BOUNDS.west)) * COLS - 0.5,
    r: ((MAP_BOUNDS.north - lat) / (MAP_BOUNDS.north - MAP_BOUNDS.south)) * ROWS - 0.5,
  };
}
