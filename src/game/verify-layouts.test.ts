import test from "node:test";
import assert from "node:assert/strict";
import {
  DISTRICTS,
  districtById,
  districtRoads,
  isDistrictId,
  isDistrictLand,
  sectorAt,
  type DistrictId,
} from "./districts.ts";
import { isLand } from "./sim.ts";
import {
  bulldoze,
  cellKey,
  createInitial,
  createInitialDistrict,
  loadSim,
  placeBuilding,
  placeRoad,
  planZone,
  saveSim,
} from "./sim.ts";

function locate(id: DistrictId, number: number) {
  const sector = districtById(id)!.sectors.find((item) => item.number === number)!;
  assert.equal(sectorAt(id, cellKey(sector.x, sector.y)), number);
  return sector;
}

test("only the three verified sign layouts, with the exact sector ordering", () => {
  assert.equal(isDistrictId("jahra"), false);
  assert.deepEqual(
    DISTRICTS.map((d) => [d.id, d.name, d.sectors.length]),
    [
      ["yarmouk", "اليرموك", 4],
      ["adailiya", "العديلية", 4],
      ["surra", "السرة", 6],
    ],
  );
  assert.deepEqual(
    [2, 3, 1, 4].map((n) => locate("yarmouk", n).y < 27),
    [true, true, false, false],
  );
  assert.deepEqual(
    [3, 2, 4, 1].map((n) => locate("adailiya", n).y < 27),
    [true, true, false, false],
  );
  for (const [left, right, row] of [
    [1, 2, 19],
    [6, 3, 24],
    [5, 4, 29],
  ] as const) {
    assert.equal(locate("surra", left).y, row);
    assert.equal(locate("surra", right).y, row);
    assert.ok(locate("surra", right).x > locate("surra", left).x);
  }
});

test("every protected asphalt network lies on land and remains connected", () => {
  for (const district of DISTRICTS) {
    const roads = new Set(districtRoads(district));
    for (const key of roads) {
      assert.equal(isDistrictLand(district.id, key), false);
      const [c, r] = key.split(",").map(Number);
      assert.equal(isLand(c!, r!), true);
    }
    const seen = new Set(["29,18"]);
    const queue = ["29,18"];
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
    for (const sector of district.sectors) {
      const city = createInitialDistrict(district.id);
      const lot = sector.cells[0]!;
      assert.equal(
        placeBuilding(city, "villa", lot.c, lot.r, 1).ok,
        true,
        `${district.id}: sector ${sector.number}`,
      );
    }
    const city = createInitialDistrict(district.id);
    const sector = district.sectors[0]!;
    const start = sector.cells[0]!;
    const shape = {
      left: Math.min(...sector.cells.map((at) => at.c)),
      right: Math.max(...sector.cells.map((at) => at.c)),
      top: Math.min(...sector.cells.map((at) => at.r)),
      bottom: Math.max(...sector.cells.map((at) => at.r)),
    };
    const result = planZone(
      city,
      start.c,
      start.r,
      start.c + 14,
      start.r + 11,
      { streets: true, schools: true, fire: true, landmarks: true, parks: true },
      4,
    );
    assert.equal(
      result.ok,
      shape.right - shape.left >= 3 && shape.bottom - shape.top >= 3,
      district.id,
    );
    for (const b of city.buildings) {
      assert.equal(sectorAt(district.id, cellKey(b.c, b.r)), sector.number);
    }
  }
  const city = createInitialDistrict("yarmouk");
  assert.equal(placeRoad(city, 28, 21).ok, true);
  assert.equal(bulldoze(city, 35, 21).ok, false);
  assert.equal(placeBuilding(city, "villa", 28, 21, 0).ok, false);
  const legacy = createInitial();
  assert.equal(placeRoad(legacy, 33, 21).ok, true);
  assert.equal(placeBuilding(legacy, "villa", 34, 21, 0).ok, true);
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
    const legacy = createInitial();
    placeRoad(legacy, 17, 23);
    placeBuilding(legacy, "boubyan", 18, 23, 0);
    saveSim(legacy);
    const original = store.get("omdat-kuwait-v1")!;
    const originalPayload = JSON.parse(original);
    assert.equal(originalPayload.v, 2);
    assert.equal("district" in originalPayload, false);
    assert.equal(loadSim("yarmouk").buildings.length, 0);
    assert.equal(store.size, 1, "loading an unchosen neighborhood must not write it");

    const city = loadSim("yarmouk");
    assert.equal(placeBuilding(city, "villa", 33, 21, 0).ok, true);
    saveSim(city);
    assert.equal(store.get("omdat-kuwait-v1"), original);
    assert.deepEqual(JSON.parse(store.get("omdat-kuwait-district-yarmouk")!).district, "yarmouk");
    assert.equal(loadSim("yarmouk").buildings[0]!.kind, "villa");
    assert.equal(loadSim("adailiya").buildings.length, 0);
    assert.equal(store.has("omdat-kuwait-district-adailiya"), false);
    assert.equal(loadSim().buildings[0]!.kind, "boubyan");
    originalPayload.district = "surra";
    store.set("omdat-kuwait-v1", JSON.stringify(originalPayload));
    assert.equal(loadSim().district, null, "legacy storage must never switch layouts");
    assert.equal(loadSim().buildings[0]!.kind, "boubyan");

    for (const id of ["yarmouk", "adailiya", "surra"] as const) {
      const neighbor = createInitialDistrict(id);
      neighbor.started = true;
      saveSim(neighbor);
      assert.equal(loadSim(id).district, id);
    }
  } finally {
    if (oldStorage === undefined) Reflect.deleteProperty(globalThis, "localStorage");
    else globalThis.localStorage = oldStorage;
  }
});
