import test from "node:test";
import assert from "node:assert/strict";
import {
  DISTRICTS,
  districtById,
  districtOffset,
  districtRoads,
  isDistrictId,
  isDistrictLand,
  sectorAt,
  sectorsForZone,
  type DistrictId,
} from "./districts.ts";
import { cellsFromSource, LAND, sourceCell, SOURCE_LAND } from "./land.ts";
import {
  bulldoze,
  cellKey,
  createInitial,
  createInitialDistrict,
  isLand,
  loadSim,
  placeBuilding,
  nearestOpenLot,
  placeRoad,
  planZone,
  saveSim,
  type Sim,
} from "./sim.ts";

/** Real prices apply; these layout checks are about geometry, not budgets. */
function rich(s: Sim): Sim {
  s.coins = 1e9;
  return s;
}

function locate(id: DistrictId, number: number) {
  const sector = districtById(id)!.sectors.find((item) => item.number === number)!;
  assert.equal(sectorAt(id, cellKey(sector.x, sector.y)), number);
  return sector;
}

/** Source cell in template coordinates, i.e. with the real-map relocation undone. */
function srcOf(id: DistrictId, sector: { x: number; y: number }) {
  const at = sourceCell(sector.x, sector.y);
  const { dc, dr } = districtOffset(id);
  return { c: at.c - dc, r: at.r - dr };
}

/** Scaled cells of a Yarmouk template source cell, wherever Yarmouk sits on the map. */
function yarmoukCells(c: number, r: number) {
  const { dc, dr } = districtOffset("yarmouk");
  return cellsFromSource(c + dc, r + dr);
}

test("the playable land is five times the source mask", () => {
  const count = (rows: readonly (readonly number[])[]) =>
    rows.reduce((sum, row) => sum + row.reduce((n, bit) => n + bit, 0), 0);
  const ratio = count(LAND) / count(SOURCE_LAND);
  assert.ok(ratio > 4.6 && ratio < 5.4, String(ratio));
});

test("only the three verified sign layouts, with the exact sector ordering", () => {
  assert.equal(isDistrictId("jahra"), false);
  assert.deepEqual(
    DISTRICTS.filter((d) => d.id !== "free").map((d) => [d.id, d.name, d.sectors.length]),
    [
      ["yarmouk", "اليرموك", 4],
      ["adailiya", "العديلية", 4],
      ["surra", "السرة", 6],
    ],
  );
  assert.equal(districtById("free")?.name, "منطقة حرة");
  assert.equal(districtById("free")?.sectors.length, 0);
  assert.deepEqual(
    [2, 3, 1, 4].map((n) => srcOf("yarmouk", locate("yarmouk", n)).r < 27),
    [true, true, false, false],
  );
  assert.deepEqual(
    [3, 2, 4, 1].map((n) => srcOf("adailiya", locate("adailiya", n)).r < 27),
    [true, true, false, false],
  );
  for (const [left, right, row] of [
    [1, 2, 19],
    [6, 3, 24],
    [5, 4, 29],
  ] as const) {
    assert.equal(srcOf("surra", locate("surra", left)).r, row);
    assert.equal(srcOf("surra", locate("surra", right)).r, row);
    assert.ok(locate("surra", right).x > locate("surra", left).x);
  }
});

test("every protected asphalt network lies on land and remains connected", () => {
  for (const district of DISTRICTS) {
    if (district.id === "free") continue;
    const roads = new Set(districtRoads(district));
    for (const key of roads) {
      assert.equal(isDistrictLand(district.id, key), false);
      const [c, r] = key.split(",").map(Number);
      assert.equal(isLand(c!, r!), true);
    }
    const start = [...roads][0];
    assert.ok(start);
    const seen = new Set([start!]);
    const queue = [start!];
    while (queue.length) {
      const [c, r] = queue.shift()!.split(",").map(Number);
      for (const [dc, dr] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const key = cellKey(c! + dc!, r! + dr!);
        if (isLand(c! + dc!, r! + dr!) && roads.has(key) && !seen.has(key)) {
          seen.add(key);
          queue.push(key);
        }
      }
    }
    assert.equal(seen.size, roads.size);
  }
});

test("every one of the fourteen sectors is buildable and planning stays within one", () => {
  for (const district of DISTRICTS) {
    if (district.id === "free") continue;
    for (const sector of district.sectors) {
      const city = rich(createInitialDistrict(district.id, false));
      const lot = sector.cells[0]!;
      assert.equal(
        placeBuilding(city, "villa", lot.c, lot.r, 1).ok,
        true,
        `${district.id}: sector ${sector.number}`,
      );
    }
    const city = rich(createInitialDistrict(district.id, false));
    const sector = district.sectors[0]!;
    const start = sector.cells[0]!;
    const result = planZone(
      city,
      start.c,
      start.r,
      start.c + 2,
      start.r + 1,
      { streets: true, schools: true, fire: true, landmarks: true, parks: true },
      4,
    );
    assert.equal(result.ok, true, district.id);
    assert.equal(city.buildings.length, sector.cells.length, `${district.id} sector fill`);
    for (const b of city.buildings) {
      assert.equal(sectorAt(district.id, cellKey(b.c, b.r)), sector.number);
    }
  }
  const city = rich(createInitialDistrict("yarmouk", false));
  const schematic = districtRoads(districtById("yarmouk")!)[0]!.split(",").map(Number);
  assert.equal(bulldoze(city, schematic[0]!, schematic[1]!).ok, false);
  const outside = yarmoukCells(28, 21)[0]!;
  const besideRoad = yarmoukCells(27, 21)[0]!;
  assert.equal(placeBuilding(city, "villa", outside.c, outside.r, 0).ok, true);
  assert.equal(placeRoad(city, besideRoad.c, besideRoad.r).ok, true);
  const roadCells = yarmoukCells(29, 21);
  const road = roadCells[roadCells.length - 1]!;
  const beside = planZone(
    rich(createInitialDistrict("yarmouk", false)),
    road.c,
    road.r,
    road.c,
    road.r,
    { streets: true, schools: false, fire: false, landmarks: false, parks: false },
    3,
  );
  assert.equal(beside.ok, true);
  const only = sectorsForZone("yarmouk", road.c, road.r, road.c, road.r);
  assert.equal(only.length, 1);
  const filled = rich(createInitialDistrict("yarmouk", false));
  const crossed = planZone(
    filled,
    locate("yarmouk", 2).cells[0]!.c,
    locate("yarmouk", 2).cells[0]!.r,
    locate("yarmouk", 1).cells[0]!.c,
    locate("yarmouk", 1).cells[0]!.r,
    { streets: true, schools: false, fire: false, landmarks: false, parks: false },
    6,
  );
  assert.equal(crossed.ok, true);
  const wanted = new Set(
    [2, 1].flatMap((number) =>
      locate("yarmouk", number).cells.map((cell) => cellKey(cell.c, cell.r)),
    ),
  );
  for (const key of wanted) {
    assert.equal(
      filled.buildings.some((b) => cellKey(b.c, b.r) === key),
      true,
      key,
    );
  }
  // Open land east of Yarmouk on the real map.
  const far = cellsFromSource(48, 23)[0]!;
  const open = rich(createInitialDistrict("yarmouk", false));
  const outsideZone = planZone(
    open,
    far.c,
    far.r,
    far.c + 5,
    far.r + 4,
    { streets: true, schools: false, fire: false, landmarks: false, parks: false },
    8,
  );
  assert.equal(outsideZone.ok, true);
  if (outsideZone.ok) assert.ok(outsideZone.built > 5);
  const snapped = nearestOpenLot(rich(createInitialDistrict("yarmouk", false)), road.c, road.r, 2);
  assert.ok(snapped);
  assert.equal(isDistrictLand("yarmouk", cellKey(snapped.c, snapped.r)), true);
  const legacy = rich(createInitial());
  const legacyLot = cellsFromSource(50, 22)[0]!;
  const legacyRoad = cellsFromSource(49, 22)[0]!;
  assert.equal(placeRoad(legacy, legacyRoad.c, legacyRoad.r).ok, true);
  assert.equal(placeBuilding(legacy, "villa", legacyLot.c, legacyLot.r, 0).ok, true);
  const free = rich(createInitialDistrict("free", false));
  assert.ok(free.roads.length > 100, "free zone starts with the ring roads");
  const freeLot = nearestOpenLot(
    free,
    cellsFromSource(36, 25)[0]!.c,
    cellsFromSource(36, 25)[0]!.r,
    3,
  )!;
  assert.equal(placeBuilding(free, "villa", freeLot.c, freeLot.r, 1).ok, true);
  const freeZone = planZone(
    free,
    freeLot.c,
    freeLot.r,
    freeLot.c + 6,
    freeLot.r + 6,
    { streets: true, schools: false, fire: false, landmarks: false, parks: false },
    2,
  );
  assert.equal(freeZone.ok, true);
  if (freeZone.ok) assert.ok(freeZone.built > 8);
});

test("preview is read-only; separate v2 saves resume and preserve the legacy city", () => {
  const oldStorage = globalThis.localStorage;
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  };
  try {
    const legacy = rich(createInitial());
    const legacyRoad = cellsFromSource(33, 24)[0]!;
    const legacyHome = cellsFromSource(34, 24)[0]!;
    placeRoad(legacy, legacyRoad.c, legacyRoad.r);
    placeBuilding(legacy, "boubyan", legacyHome.c, legacyHome.r, 0);
    saveSim(legacy);
    const original = store.get("omdat-kuwait-v1")!;
    const originalPayload = JSON.parse(original);
    assert.equal(originalPayload.v, 2);
    assert.equal("district" in originalPayload, false);
    // An unchosen neighborhood loads as a fresh starter town without being saved.
    assert.ok(loadSim("yarmouk").buildings.length > 0);
    assert.equal(store.size, 1, "loading an unchosen neighborhood must not write it");

    const city = loadSim("yarmouk");
    const lot = locate("yarmouk", 2).cells.find(
      (cell) => !city.buildings.some((b) => b.c === cell.c && b.r === cell.r),
    )!;
    assert.equal(placeBuilding(city, "villa", lot.c, lot.r, 0).ok, true);
    saveSim(city);
    assert.equal(store.get("omdat-kuwait-v1"), original);
    assert.deepEqual(JSON.parse(store.get("omdat-kuwait-district-yarmouk")!).district, "yarmouk");
    assert.equal(loadSim("yarmouk").buildings[0]!.kind, "villa");
    assert.ok(loadSim("adailiya").buildings.every((b) => b.kind !== "villa" || b.level === 1));
    assert.equal(store.has("omdat-kuwait-district-adailiya"), false);
    assert.equal(loadSim().buildings[0]!.kind, "boubyan");
    originalPayload.district = "surra";
    store.set("omdat-kuwait-v1", JSON.stringify(originalPayload));
    assert.equal(loadSim().district, null, "legacy storage must never switch layouts");
    assert.equal(loadSim().buildings[0]!.kind, "boubyan");

    for (const id of ["yarmouk", "adailiya", "surra"] as const) {
      const neighbor = rich(createInitialDistrict(id, false));
      neighbor.started = true;
      saveSim(neighbor);
      assert.equal(loadSim(id).district, id);
    }
  } finally {
    if (oldStorage === undefined) Reflect.deleteProperty(globalThis, "localStorage");
    else globalThis.localStorage = oldStorage;
  }
});
