import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceDays,
  advanceQuest,
  cloneSim,
  collectAll,
  createInitial,
  incomePerSec,
  loadSim,
  placeBuilding,
  placeRoad,
  planZone,
  saveSim,
  stats,
  tick,
  upgrade,
  bulldoze,
} from "./sim.ts";
import { CATALOG, KINDS } from "./catalog.ts";

function city() {
  const s = createInitial();
  s.started = true;
  placeRoad(s, 17, 23);
  placeRoad(s, 19, 23);
  placeRoad(s, 21, 23);
  return s;
}

test("placement occupancy upgrades and income remain playable", () => {
  const s = city();
  assert.equal(placeBuilding(s, "villa", 18, 23, 0).ok, true);
  assert.equal(placeBuilding(s, "villa", 20, 23, 0).ok, true);
  assert.equal(placeBuilding(s, "apartments", 18, 23, 0).ok, false);
  assert.equal(placeBuilding(s, "villa", 0, 0, 0).ok, false);
  assert.equal(stats(s).pop, 48);
  assert.ok(incomePerSec(s.buildings[0], s) > 0);
  const b = s.buildings[0];
  assert.equal(upgrade(s, b.id, 1).ok, true);
  assert.equal(upgrade(s, b.id, 2).ok, true);
  assert.equal(upgrade(s, b.id, 3).ok, false);
  assert.equal(b.level, 3);
  tick(s, 30);
  assert.ok(b.stored > 0);
  assert.ok(collectAll(s) > 0);
  assert.ok(b.stored < 1);
  assert.ok(s.coins >= 3200);
  assert.equal(bulldoze(s, 18, 23).ok, true);
  assert.equal(s.buildings.length, 1);
});

test("all 17 catalog types are placeable on the same 3D grid", () => {
  const s = city();
  KINDS.forEach((kind, i) => {
    const c = 12 + (i % 10),
      r = 26 + Math.floor(i / 10);
    assert.equal(placeBuilding(s, kind, c, r, i).ok, true, kind);
    assert.ok(CATALOG[kind].name.length > 0);
  });
  assert.equal(s.buildings.length, 17);
  assert.ok(stats(s).waterGive > 0);
});

test("zone planning generates streets and housing on land", () => {
  const s = createInitial();
  s.started = true;
  const result = planZone(
    s,
    18,
    23,
    29,
    28,
    { streets: true, schools: true, fire: true, landmarks: true, parks: true },
    0,
  );
  assert.equal(result.ok, true);
  assert.ok(s.roads.length > 16);
  assert.ok(s.buildings.length > 6);
  assert.ok(s.buildings.some((b) => b.kind === "school"));
  assert.ok(s.buildings.some((b) => CATALOG[b.kind].cat === "landmarks"));
  assert.ok(s.buildings.some((b) => b.kind === "park"));
  advanceQuest(s);
  assert.ok(s.quest > 0);
});

test("v2 save serializes all playable fields without mutating during clones", () => {
  const original = globalThis.localStorage;
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? (store.get(k) ?? null) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  };
  try {
    const s = city();
    placeBuilding(s, "villa", 18, 23, 0);
    placeBuilding(s, "kuwait", 27, 18, 0);
    upgrade(s, s.buildings[0].id, 1);
    advanceDays(s, 90);
    s.ordinances.recycling = true;
    saveSim(s);
    const saved = JSON.parse(store.get("omdat-kuwait-v1") ?? "{}");
    assert.equal(saved.v, 2);
    assert.equal(saved.grid, 1);
    assert.equal(saved.buildings[0].kind, "villa");
    const loaded = loadSim();
    assert.equal(loaded.buildings.length, s.buildings.length);
    assert.equal(loaded.roads.length, s.roads.length);
    assert.equal(loaded.ordinances.recycling, true);
    const clone = cloneSim(loaded);
    clone.roads.push("33,28");
    clone.buildings[0].level++;
    assert.notEqual(clone.roads.length, loaded.roads.length);
    assert.notEqual(clone.buildings[0].level, loaded.buildings[0].level);
  } finally {
    if (original === undefined) Reflect.deleteProperty(globalThis, "localStorage");
    else globalThis.localStorage = original;
  }
});
