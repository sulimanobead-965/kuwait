import { COLS, LAND, ROWS } from "../land.ts";

export type RoadMarking =
  | { type: "dash"; axis: "x" | "z" }
  | { type: "stop"; axis: "x" | "z"; dc: number; dr: number };

const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
const within = (c: number, r: number) =>
  c >= 0 && c < COLS && r >= 0 && r < ROWS && LAND[r]?.[c] === 1;
const has = (roads: ReadonlySet<string>, c: number, r: number) =>
  within(c, r) && roads.has(`${c},${r}`);
const hasOff = (roads: ReadonlySet<string>, c: number, r: number, dc: number, dr: number) =>
  has(roads, c + dc, r + dr);

/** Flat, fully batched paint only: there are deliberately no tile borders/curbs here. */
export function roadMarkingsAt(roads: ReadonlySet<string>, c: number, r: number): RoadMarking[] {
  if (!has(roads, c, r)) return [];
  const neighbors = directions.filter(([dc, dr]) => hasOff(roads, c, r, dc, dr));
  if (neighbors.length >= 3) return []; // Junction interiors stay entirely clear.
  const horizontal = hasOff(roads, c, r, 1, 0) && hasOff(roads, c, r, -1, 0);
  const vertical = hasOff(roads, c, r, 0, 1) && hasOff(roads, c, r, 0, -1);
  const marks: RoadMarking[] = [];
  if (horizontal !== vertical && (c + r) % 2 === 0)
    marks.push({ type: "dash", axis: horizontal ? "x" : "z" });
  // A stop bar occupies only its approach tile, not its neighboring junction.
  // Its geometric dimensions leave a gap to a collinear dash on the same tile.
  for (const [dc, dr] of neighbors) {
    const neighborDegree = directions.filter(([dx, dy]) => hasOff(roads, c + dc, r + dr, dx, dy)).length;
    if (neighborDegree < 3) continue;
    const markerAxis: "x" | "z" = dc ? "x" : "z";
    // Each approach stops at the junction edge; the dash and stop intervals
    // are evaluated separately to keep their geometry clear of one another.
    marks.push({ type: "stop", axis: markerAxis, dc, dr });
  }
  return marks;
}
