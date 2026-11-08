/**
 * Playable interpretations of three supplied signs, not cadastral surveys. Each plan is
 * drawn on a 15×13 template and then moved (dc, dr source cells) onto the real spot of
 * the neighborhood on the Kuwait City map in `land.ts`.
 */
import { cellsFromSource, LAND, MAP_BOUNDS, SOURCE_COLS, SOURCE_LAND, SOURCE_ROWS } from "./land";
const srcIsLand = (c: number, r: number) =>
  c >= 0 && r >= 0 && c < SOURCE_COLS && r < SOURCE_ROWS && SOURCE_LAND[r]?.[c] === 1;

export type DistrictId = "yarmouk" | "adailiya" | "surra" | "free";
export interface SectorParcel {
  number: number;
  x: number;
  y: number;
  cells: readonly { c: number; r: number }[];
}
export interface District {
  id: DistrictId;
  name: string;
  description: string;
  sectors: readonly SectorParcel[];
}
type Side = "l" | "r";
interface Definition {
  id: DistrictId;
  name: string;
  description: string;
  main: (r: number) => [number, number];
  /** Source-cell offset from the template to the real neighborhood location. */
  dc: number;
  dr: number;
  blocks: readonly (readonly [number, Side, number, number])[];
}
const definitions: readonly Definition[] = [
  {
    id: "yarmouk",
    name: "اليرموك",
    description: "شارع رئيسي مستقيم وتقاطع أفقي يفصل قطعتَي ٢/٣ عن ١/٤.",
    main: () => [36, 37],
    // 47.966° E, 29.311° N
    dc: 24,
    dr: 7,
    blocks: [
      [2, "l", 19, 26],
      [3, "r", 19, 26],
      [1, "l", 28, 30],
      [4, "r", 28, 30],
    ],
  },
  {
    id: "adailiya",
    name: "العديلية",
    description: "شارع رئيسي طولي وتقاطع أفقي: ٣/٢ أعلى المخطط، و٤/١ أسفله.",
    main: () => [36, 37],
    // 47.987° E, 29.329° N (shifted ~1 km south-west of the exact spot, so the
    // template's northern edge stays clear of the Shuwaikh/Sharq shoreline)
    dc: 26,
    dr: 6,
    blocks: [
      [3, "l", 19, 26],
      [2, "r", 19, 26],
      [4, "l", 28, 30],
      [1, "r", 28, 30],
    ],
  },
  {
    id: "surra",
    name: "السرة",
    description: "شارع رئيسي مستقيم بين عمودين، وتقاطعان أفقيان يفصلان القطع الست.",
    main: () => [36, 37],
    // 48.003° E, 29.307° N
    dc: 30,
    dr: 8,
    blocks: [
      [1, "l", 19, 22],
      [2, "r", 19, 22],
      [6, "l", 24, 27],
      [3, "r", 24, 27],
      [5, "l", 29, 31],
      [4, "r", 29, 31],
    ],
  },
];
const sourceDistricts: readonly District[] = definitions.map((d) => ({
  id: d.id,
  name: d.name,
  description: d.description,
  sectors: d.blocks.map(([number, side, r0, r1]) => {
    const cells: { c: number; r: number }[] = [];
    for (let r = r0; r <= r1; r++) {
      const [lo, hi] = d.main(r),
        left = side === "l" ? 30 : hi + 1,
        right = side === "l" ? lo - 1 : 42;
      for (let c = left; c <= right; c++)
        if (srcIsLand(c + d.dc, r + d.dr)) cells.push({ c: c + d.dc, r: r + d.dr });
    }
    const sorted = [...cells].sort(
      (a, b) =>
        a.r - b.r || Number(side === "l") * (a.c - b.c) + Number(side === "r") * (b.c - a.c),
    );
    const extent = sorted[0]!;
    return { number, x: extent.c, y: extent.r, cells };
  }),
}));
function expandCells(cells: readonly { c: number; r: number }[]) {
  const out: { c: number; r: number }[] = [];
  const seen = new Set<string>();
  for (const cell of cells) {
    for (const scaled of cellsFromSource(cell.c, cell.r)) {
      const key = `${scaled.c},${scaled.r}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(scaled);
    }
  }
  return out;
}

const planned: District[] = sourceDistricts.map((district) => ({
  ...district,
  sectors: district.sectors.map((sector) => {
    const cells = expandCells(sector.cells).sort((a, b) => a.r - b.r || a.c - b.c);
    const extent = cells[0]!;
    return { number: sector.number, x: extent.c, y: extent.r, cells };
  }),
}));

const freeDistrict: District = {
  id: "free",
  name: "منطقة حرة",
  description: "كل اليابسة مع الطرق الدائرية والسريعة بشكل تقريبي. ابنِ حيث شئت وارصف شوارعك.",
  sectors: [],
};

export const DISTRICTS: readonly District[] = [...planned, freeDistrict];

const land = new Map<DistrictId, Set<string>>(),
  numbers = new Map<DistrictId, Map<string, number>>(),
  roadList = new Map<DistrictId, string[]>(),
  roadSet = new Map<DistrictId, Set<string>>();

function sourceRoads(district: District): string[] {
  const d = definitions.find((item) => item.id === district.id)!;
  // Template coordinates in, real map coordinates out.
  const key = (c: number, r: number) => `${c + d.dc},${r + d.dr}`;
  const land = (c: number, r: number) => srcIsLand(c + d.dc, r + d.dr);
  const parcels = new Set<string>();
  for (const sector of district.sectors) {
    for (const cell of sector.cells) parcels.add(`${cell.c},${cell.r}`);
  }
  const roads = new Set<string>();
  for (let r = 18; r <= 30; r += 1) {
    for (let c = 29; c <= 43; c += 1) {
      if ((c === 29 || c === 43 || r === 18 || !parcels.has(key(c, r))) && land(c, r))
        roads.add(key(c, r));
    }
  }
  for (let r = 18; r <= 30; r += 1)
    for (let c = d.main(r)[0]; c <= d.main(r)[1]; c += 1) if (land(c, r)) roads.add(key(c, r));
  for (let r = 18; r < 30; r += 1) {
    const current = d.main(r),
      next = d.main(r + 1);
    for (const edge of [current[0], current[1], next[0], next[1]]) {
      for (const [c, row] of [
        [edge, r],
        [edge, r + 1],
      ] as const) {
        if (c >= 29 && c <= 43 && !parcels.has(key(c, row)) && land(c, row)) roads.add(key(c, row));
      }
    }
  }
  return [...roads];
}

for (const district of sourceDistricts) {
  const scaled = planned.find((item) => item.id === district.id)!;
  const cells = new Set<string>(),
    sectors = new Map<string, number>();
  for (const sector of scaled.sectors) {
    for (const { c, r } of sector.cells) {
      const key = `${c},${r}`;
      if (cells.has(key)) throw new Error(`Overlapping schematic sectors: ${district.id}/${key}`);
      cells.add(key);
      sectors.set(key, sector.number);
    }
  }
  land.set(district.id, cells);
  numbers.set(district.id, sectors);
  const roads = new Set<string>();
  for (const key of sourceRoads(district)) {
    const [c, r] = key.split(",").map(Number);
    for (const cell of cellsFromSource(c!, r!)) {
      const scaledKey = `${cell.c},${cell.r}`;
      if (!cells.has(scaledKey)) roads.add(scaledKey);
    }
  }
  roadSet.set(district.id, roads);
  roadList.set(district.id, [...roads]);
}
{
  const highways = highwayCells();
  roadSet.set("free", new Set(highways));
  roadList.set("free", highways);
}
land.set("free", new Set());

/**
 * Approximate Kuwait highways, drawn on the real-coastline grid (land.ts: ≈300 m
 * cells, MAP_BOUNDS lon 47.55°–48.20° E, lat 28.95°–29.50° N). Ring roads 1st–7th
 * are circular arcs around Sharq (≈47.975° E, 29.385° N) sized to cross ~47.98° E
 * at 29.362°, 29.350°, 29.335°, 29.318°, 29.300°, 29.275° and 29.240° N. Radials are
 * polylines through rough lon/lat waypoints: Road 80 (Jahra Road) west along the
 * south shore of the Sulaibikhat inlet to Jahra, Road 30 (King Fahd / Fahaheel
 * expressway) south-east and on down the coast, Road 40 inland parallel to it and
 * Airport Road 55 south. Everything is clipped to land and kept 4-connected. A
 * playable sketch, not survey geometry.
 */
export function highwayCells(): string[] {
  const rows = LAND.length;
  const cols = LAND[0]?.length ?? 0;
  const out = new Set<string>();
  const put = (c: number, r: number) => {
    if (r >= 0 && c >= 0 && r < rows && c < cols && LAND[r]?.[c] === 1) out.add(`${c},${r}`);
  };
  const toCell = (lon: number, lat: number) => ({
    c: ((lon - MAP_BOUNDS.west) / (MAP_BOUNDS.east - MAP_BOUNDS.west)) * cols - 0.5,
    r: ((MAP_BOUNDS.north - lat) / (MAP_BOUNDS.north - MAP_BOUNDS.south)) * rows - 0.5,
  });
  const center = toCell(47.975, 29.385);
  const crossing = toCell(47.98, 29.385).c;
  for (const lat of [29.362, 29.35, 29.335, 29.318, 29.3, 29.275, 29.24]) {
    const radius = Math.hypot(crossing - center.c, toCell(47.98, lat).r - center.r);
    // 4-connected arc on the southern side of the centre. The 7th ring stops at the
    // Sulaibiya side instead of curling north up the Doha spit.
    const end = lat < 29.26 ? Math.PI * 0.75 : Math.PI;
    let last: { c: number; r: number } | null = null;
    for (let a = 0; a <= end; a += 0.5 / radius) {
      const c = Math.round(center.c + Math.cos(a) * radius);
      const r = Math.round(center.r + Math.sin(a) * radius);
      if (last && last.c !== c && last.r !== r) put(c, last.r);
      put(c, r);
      last = { c, r };
    }
  }
  const line = (c0: number, r0: number, c1: number, r1: number) => {
    const n = Math.max(1, Math.abs(c1 - c0), Math.abs(r1 - r0));
    let last: { c: number; r: number } | null = null;
    for (let i = 0; i <= n; i += 1) {
      const c = Math.round(c0 + ((c1 - c0) * i) / n);
      const r = Math.round(r0 + ((r1 - r0) * i) / n);
      if (last && last.c !== c && last.r !== r) put(c, last.r);
      put(c, r);
      last = { c, r };
    }
  };
  const road = (points: readonly (readonly [number, number])[]) => {
    for (let i = 1; i < points.length; i += 1) {
      const a = toCell(...points[i - 1]!),
        b = toCell(...points[i]!);
      line(
        Math.round(a.c),
        Math.min(rows - 1, Math.round(a.r)),
        Math.round(b.c),
        Math.min(rows - 1, Math.round(b.r)),
      );
    }
  };
  // Road 80, Jahra Road: skirts the south shore of the Sulaibikhat inlet to Jahra.
  road([
    [47.95, 29.36],
    [47.905, 29.32],
    [47.85, 29.318],
    [47.78, 29.33],
    [47.68, 29.34],
  ]);
  // Road 30, King Fahd bin Abdulaziz / Fahaheel expressway.
  road([
    [47.99, 29.36],
    [48.05, 29.25],
    [48.1, 29.1],
    [48.13, 28.95],
  ]);
  // Road 40, inland and roughly parallel to Road 30.
  road([
    [47.98, 29.33],
    [48.02, 29.2],
    [48.06, 29.1],
    [48.08, 28.95],
  ]);
  // Road 55, Airport Road.
  road([
    [47.98, 29.35],
    [47.97, 29.2],
  ]);
  // Drop arc ends the coastline cut into tiny islands.
  const kept: string[] = [];
  const seen = new Set<string>();
  for (const start of out) {
    if (seen.has(start)) continue;
    const part = [start];
    seen.add(start);
    for (let i = 0; i < part.length; i += 1) {
      const [c, r] = part[i]!.split(",").map(Number);
      for (const key of [`${c! + 1},${r}`, `${c! - 1},${r}`, `${c},${r! + 1}`, `${c},${r! - 1}`]) {
        if (out.has(key) && !seen.has(key)) {
          seen.add(key);
          part.push(key);
        }
      }
    }
    if (part.length >= 6) kept.push(...part);
  }
  return kept;
}

export const isDistrictId = (value: unknown): value is DistrictId =>
  value === "yarmouk" || value === "adailiya" || value === "surra" || value === "free";
export const districtById = (id: DistrictId | null | undefined) =>
  DISTRICTS.find((d) => d.id === id) ?? null;
export const districtSaveKey = (id: DistrictId) => `omdat-kuwait-district-${id}`;
export const isDistrictLand = (id: DistrictId | null, key: string) =>
  !id || id === "free" ? id !== "free" : land.get(id)?.has(key) === true;
export const sectorAt = (id: DistrictId | null, key: string | null) =>
  key !== null && id ? numbers.get(id)?.get(key) : undefined;
/** Straight source centerline columns (map position, before the five-times land scale). */
export function districtArterial(id: DistrictId): readonly (readonly [number, number])[] {
  const definition = definitions.find((d) => d.id === id);
  if (!definition) return [];
  return Array.from({ length: 13 }, (_, i) => {
    const [lo, hi] = definition.main(i + 18);
    return [lo + definition.dc, hi + definition.dc] as const;
  });
}
/** Source-cell shift that moved a neighborhood template onto its real map location. */
export function districtOffset(id: DistrictId) {
  const definition = definitions.find((d) => d.id === id);
  return { dc: definition?.dc ?? 0, dr: definition?.dr ?? 0 };
}
export const isSchematicRoad = (id: DistrictId | null | undefined, key: string) =>
  id ? roadSet.get(id)?.has(key) === true : false;

export function districtBounds(id: DistrictId) {
  if (id === "free") {
    let c0 = LAND[0]?.length ?? 1,
      c1 = 0,
      r0 = LAND.length,
      r1 = 0;
    for (let r = 0; r < LAND.length; r += 1) {
      const row = LAND[r]!;
      for (let c = 0; c < row.length; c += 1) {
        if (!row[c]) continue;
        c0 = Math.min(c0, c);
        c1 = Math.max(c1, c);
        r0 = Math.min(r0, r);
        r1 = Math.max(r1, r);
      }
    }
    return {
      c0,
      c1,
      r0,
      r1,
      c: (c0 + c1) / 2,
      r: (r0 + r1) / 2,
      cols: c1 - c0 + 1,
      rows: r1 - r0 + 1,
    };
  }
  let c0 = 999,
    c1 = 0,
    r0 = 999,
    r1 = 0;
  for (const sector of districtById(id)?.sectors ?? []) {
    for (const cell of sector.cells) {
      c0 = Math.min(c0, cell.c);
      c1 = Math.max(c1, cell.c);
      r0 = Math.min(r0, cell.r);
      r1 = Math.max(r1, cell.r);
    }
  }
  return { c0, c1, r0, r1, c: (c0 + c1) / 2, r: (r0 + r1) / 2, cols: c1 - c0 + 1, rows: r1 - r0 + 1 };
}

export function sectorBounds(id: DistrictId, c: number, r: number) {
  const number = sectorAt(id, `${c},${r}`);
  const sector = districtById(id)?.sectors.find((item) => item.number === number);
  if (!sector) return null;
  let c0 = 99,
    c1 = 0,
    r0 = 99,
    r1 = 0;
  for (const cell of sector.cells) {
    c0 = Math.min(c0, cell.c);
    c1 = Math.max(c1, cell.c);
    r0 = Math.min(r0, cell.r);
    r1 = Math.max(r1, cell.r);
  }
  return { c0, c1, r0, r1 };
}

export function sectorsTouching(id: DistrictId, c0: number, r0: number, c1: number, r1: number) {
  const district = districtById(id);
  if (!district) return [];
  const loC = Math.min(c0, c1),
    hiC = Math.max(c0, c1),
    loR = Math.min(r0, r1),
    hiR = Math.max(r0, r1);
  return district.sectors.filter((sector) =>
    sector.cells.some((cell) => cell.c >= loC && cell.c <= hiC && cell.r >= loR && cell.r <= hiR),
  );
}

/** Parcels inside the drag, or the nearest parcel when the finger stayed on a road. */
export function sectorsForZone(id: DistrictId, c0: number, r0: number, c1: number, r1: number) {
  if (id === "free") return [];
  const direct = sectorsTouching(id, c0, r0, c1, r1);
  if (direct.length) return direct;
  if (rectHasOpenLand(id, c0, r0, c1, r1)) return [];
  const district = districtById(id);
  if (!district) return [];
  const loC = Math.min(c0, c1) - 2,
    hiC = Math.max(c0, c1) + 2,
    loR = Math.min(r0, r1) - 2,
    hiR = Math.max(r0, r1) + 2;
  const midC = (Math.min(c0, c1) + Math.max(c0, c1)) / 2;
  const midR = (Math.min(r0, r1) + Math.max(r0, r1)) / 2;
  let best: { sector: SectorParcel; dist: number } | null = null;
  for (const sector of district.sectors) {
    for (const cell of sector.cells) {
      if (cell.c < loC || cell.c > hiC || cell.r < loR || cell.r > hiR) continue;
      const dist = Math.abs(cell.c - midC) + Math.abs(cell.r - midR);
      if (!best || dist < best.dist) best = { sector, dist };
    }
  }
  return best ? [best.sector] : [];
}

function rectHasOpenLand(id: DistrictId, c0: number, r0: number, c1: number, r1: number) {
  const parcels = land.get(id);
  const roads = roadSet.get(id);
  const loC = Math.min(c0, c1),
    hiC = Math.max(c0, c1),
    loR = Math.min(r0, r1),
    hiR = Math.max(r0, r1);
  for (let r = loR; r <= hiR; r += 1) {
    for (let c = loC; c <= hiC; c += 1) {
      if (LAND[r]?.[c] !== 1) continue;
      const key = `${c},${r}`;
      if (!parcels?.has(key) && !roads?.has(key)) return true;
    }
  }
  return false;
}

/** Shared source for actual asphalt, vehicle instances, free schema access and save imports. */
export function districtRoads(district: District): string[] {
  return roadList.get(district.id) ?? [];
}
