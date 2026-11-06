/** Playable interpretations of three supplied signs, not GIS or cadastral surveys. */
import { cellsFromSource, LAND, SOURCE_COLS, SOURCE_LAND, SOURCE_ROWS } from "./land";
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
  blocks: readonly (readonly [number, Side, number, number])[];
}
const definitions: readonly Definition[] = [
  {
    id: "yarmouk",
    name: "اليرموك",
    description: "شارع رئيسي مستقيم وتقاطع أفقي يفصل قطعتَي ٢/٣ عن ١/٤.",
    main: () => [36, 37],
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
      for (let c = left; c <= right; c++) if (srcIsLand(c, r)) cells.push({ c, r });
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
  description: "كل اليابسة بالحجم الجديد، بلا قطع مرقّمة. ابنِ حيث شئت وارصف شوارعك.",
  sectors: [],
};

export const DISTRICTS: readonly District[] = [...planned, freeDistrict];

const land = new Map<DistrictId, Set<string>>(),
  numbers = new Map<DistrictId, Map<string, number>>(),
  roadList = new Map<DistrictId, string[]>(),
  roadSet = new Map<DistrictId, Set<string>>();

function sourceRoads(district: District): string[] {
  const parcels = new Set<string>();
  for (const sector of district.sectors) {
    for (const cell of sector.cells) parcels.add(`${cell.c},${cell.r}`);
  }
  const roads = new Set<string>();
  for (let r = 18; r <= 30; r += 1) {
    for (let c = 29; c <= 43; c += 1) {
      const key = `${c},${r}`;
      if ((c === 29 || c === 43 || r === 18 || !parcels.has(key)) && srcIsLand(c, r)) roads.add(key);
    }
  }
  const definition = definitions.find((d) => d.id === district.id)!;
  for (let r = 18; r <= 30; r += 1)
    for (let c = definition.main(r)[0]; c <= definition.main(r)[1]; c += 1)
      if (srcIsLand(c, r)) roads.add(`${c},${r}`);
  for (let r = 18; r < 30; r += 1) {
    const current = definition.main(r),
      next = definition.main(r + 1);
    for (const edge of [current[0], current[1], next[0], next[1]]) {
      for (const [c, row] of [
        [edge, r],
        [edge, r + 1],
      ] as const) {
        const key = `${c},${row}`;
        if (c >= 29 && c <= 43 && !parcels.has(key) && srcIsLand(c, row)) roads.add(key);
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
roadSet.set("free", new Set());
roadList.set("free", []);
land.set("free", new Set());

export const isDistrictId = (value: unknown): value is DistrictId =>
  value === "yarmouk" || value === "adailiya" || value === "surra" || value === "free";
export const districtById = (id: DistrictId | null | undefined) =>
  DISTRICTS.find((d) => d.id === id) ?? null;
export const districtSaveKey = (id: DistrictId) => `omdat-kuwait-district-${id}`;
export const isDistrictLand = (id: DistrictId | null, key: string) =>
  !id || id === "free" ? id !== "free" : land.get(id)?.has(key) === true;
export const sectorAt = (id: DistrictId | null, key: string | null) =>
  key !== null && id ? numbers.get(id)?.get(key) : undefined;
/** Straight source centerline, before the five-times land scale. */
export function districtArterial(id: DistrictId): readonly (readonly [number, number])[] {
  const definition = definitions.find((d) => d.id === id);
  if (!definition) return [];
  return Array.from({ length: 13 }, (_, i) => definition.main(i + 18));
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
