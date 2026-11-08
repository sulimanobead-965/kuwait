/** The 100 administrative regions' geometry (no game state, so the core can use it). */
import { COLS, LAND, ROWS } from "./land";
import { lonLatToCell, PLACES } from "./places";

const isLand = (c: number, r: number) => c >= 0 && r >= 0 && c < COLS && r < ROWS && LAND[r]?.[c] === 1;

export type Region = { id: number; name: string; c0: number; c1: number; r0: number; r1: number; land: number };

let built: { regions: Region[]; colStrip: Int16Array; stripRows: Int32Array[] } | null = null;

/** The 100 regions (worked out once from the land map). */
export function regions(): Region[] {
  return layout().regions;
}

function layout() {
  if (built) return built;
  // Land per column, then ten strips of equal land.
  const perCol = new Int32Array(COLS);
  let total = 0;
  for (let c = 0; c < COLS; c += 1)
    for (let r = 0; r < ROWS; r += 1)
      if (isLand(c, r)) {
        perCol[c] += 1;
        total += 1;
      }
  const strips: [number, number][] = [];
  let start = 0;
  let acc = 0;
  for (let c = 0; c < COLS; c += 1) {
    acc += perCol[c]!;
    const want = (total * (strips.length + 1)) / 10;
    if ((acc >= want && strips.length < 9) || c === COLS - 1) {
      strips.push([start, c]);
      start = c + 1;
    }
  }
  const colStrip = new Int16Array(COLS);
  const stripRows: Int32Array[] = [];
  const out: Region[] = [];
  strips.forEach(([c0, c1], si) => {
    for (let c = c0; c <= c1; c += 1) colStrip[c] = si;
    // Land per row inside the strip, then ten pieces of equal land.
    const perRow = new Int32Array(ROWS);
    let land = 0;
    for (let r = 0; r < ROWS; r += 1)
      for (let c = c0; c <= c1; c += 1)
        if (isLand(c, r)) {
          perRow[r] += 1;
          land += 1;
        }
    const cuts = new Int32Array(10);
    let from = 0;
    let sum = 0;
    let pieces = 0;
    for (let r = 0; r < ROWS; r += 1) {
      sum += perRow[r]!;
      const want = (land * (pieces + 1)) / 10;
      if ((sum >= want && pieces < 9) || r === ROWS - 1) {
        let here = 0;
        for (let y = from; y <= r; y += 1) here += perRow[y]!;
        out.push({ id: out.length + 1, name: "", c0, c1, r0: from, r1: r, land: here });
        cuts[pieces] = r;
        pieces += 1;
        from = r + 1;
      }
    }
    stripRows.push(cuts);
  });
  // Names: the nearest real place, "٢" etc. when a name is used twice.
  const anchors = PLACES.filter((p) => !p.major || p.name === "مدينة الكويت" || p.name === "جزيرة بوبيان").map((p) => ({ name: p.name, ...lonLatToCell(p.lon, p.lat) }));
  const used = new Map<string, number>();
  for (const g of out) {
    const mc = (g.c0 + g.c1) / 2;
    const mr = (g.r0 + g.r1) / 2;
    let best = anchors[0]!;
    let bd = Infinity;
    for (const a of anchors) {
      const inside = a.c >= g.c0 && a.c <= g.c1 && a.r >= g.r0 && a.r <= g.r1;
      const d = Math.hypot(a.c - mc, a.r - mr) - (inside ? 1e6 : 0);
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    const n = (used.get(best.name) ?? 0) + 1;
    used.set(best.name, n);
    g.name = n === 1 ? best.name : `${best.name} ${n}`;
  }
  built = { regions: out, colStrip, stripRows };
  return built;
}

/** The region (1–100) a cell belongs to. */
export function regionAt(c: number, r: number) {
  const L = layout();
  const cc = Math.max(0, Math.min(COLS - 1, Math.floor(c)));
  const si = L.colStrip[cc]!;
  const cuts = L.stripRows[si]!;
  let p = 0;
  while (p < 9 && r > cuts[p]!) p += 1;
  return si * 10 + p + 1;
}

