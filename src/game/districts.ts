/** Playable interpretations of three supplied signs, not GIS or cadastral surveys. */
import { COLS, LAND, ROWS } from "./land";
const isLand = (c: number, r: number) =>
  c >= 0 && r >= 0 && c < COLS && r < ROWS && LAND[r]?.[c] === 1;

export type DistrictId = "yarmouk" | "adailiya" | "surra";
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
export const DISTRICTS: readonly District[] = definitions.map((d) => ({
  id: d.id,
  name: d.name,
  description: d.description,
  sectors: d.blocks.map(([number, side, r0, r1]) => {
    const cells: { c: number; r: number }[] = [];
    for (let r = r0; r <= r1; r++) {
      const [lo, hi] = d.main(r),
        left = side === "l" ? 30 : hi + 1,
        right = side === "l" ? lo - 1 : 42;
      for (let c = left; c <= right; c++) if (isLand(c, r)) cells.push({ c, r });
    }
    const sorted = [...cells].sort(
      (a, b) =>
        a.r - b.r || Number(side === "l") * (a.c - b.c) + Number(side === "r") * (b.c - a.c),
    );
    const extent = sorted[0]!;
    return { number, x: extent.c, y: extent.r, cells };
  }),
}));
const land = new Map<DistrictId, Set<string>>(),
  numbers = new Map<DistrictId, Map<string, number>>();
for (const district of DISTRICTS) {
  const cells = new Set<string>(),
    sectors = new Map<string, number>();
  for (const sector of district.sectors)
    for (const { c, r } of sector.cells) {
      const key = `${c},${r}`;
      if (cells.has(key)) throw new Error(`Overlapping schematic sectors: ${district.id}/${key}`);
      cells.add(key);
      sectors.set(key, sector.number);
    }
  land.set(district.id, cells);
  numbers.set(district.id, sectors);
}
export const isDistrictId = (value: unknown): value is DistrictId =>
  value === "yarmouk" || value === "adailiya" || value === "surra";
export const districtById = (id: DistrictId | null | undefined) =>
  DISTRICTS.find((d) => d.id === id) ?? null;
export const districtSaveKey = (id: DistrictId) => `omdat-kuwait-district-${id}`;
export const isDistrictLand = (id: DistrictId | null, key: string) =>
  id ? land.get(id)?.has(key) === true : true;
export const sectorAt = (id: DistrictId | null, key: string | null) =>
  key !== null && id ? numbers.get(id)?.get(key) : undefined;
/** Current straight centerline used by the schematic and its playable roads. */
export function districtArterial(id: DistrictId): readonly (readonly [number, number])[] {
  const definition = definitions.find((d) => d.id === id)!;
  return Array.from({ length: 13 }, (_, i) => definition.main(i + 18));
}
/** Shared source for actual asphalt, vehicle instances, free schema access and save imports. */
export function districtRoads(district: District): string[] {
  const roads = new Set<string>();
  for (let r = 18; r <= 30; r++)
    for (let c = 29; c <= 43; c++) {
      const key = `${c},${r}`;
      if ((c === 29 || c === 43 || r === 18 || !land.get(district.id)?.has(key)) && isLand(c, r))
        roads.add(key);
    }
  const definition = definitions.find((d) => d.id === district.id)!;
  for (let r = 18; r <= 30; r++)
    for (let c = definition.main(r)[0]; c <= definition.main(r)[1]; c++)
      if (isLand(c, r)) roads.add(`${c},${r}`);
  for (let r = 18; r < 30; r++) {
    const current = definition.main(r),
      next = definition.main(r + 1);
    for (const edge of [current[0], current[1], next[0], next[1]]) {
      for (const [c, row] of [
        [edge, r],
        [edge, r + 1],
      ] as const) {
        const key = `${c},${row}`;
        if (c >= 29 && c <= 43 && !land.get(district.id)?.has(key) && isLand(c, row))
          roads.add(key);
      }
    }
  }
  return [...roads];
}
