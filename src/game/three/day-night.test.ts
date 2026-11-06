import assert from "node:assert/strict";
import test from "node:test";
import { lightingAt, smoothstep } from "./day-night.ts";
import {
  cellWorld,
  worldCell,
  lodFor,
  CAMERA_PITCH_DEGREES,
  CAMERA_YAW_DEGREES,
} from "./camera.ts";
import * as THREE from "three";
import { boubyanProfile, buildingModel, modelTriangles, modelVertices } from "./models.ts";
import { KINDS } from "../catalog.ts";

test("explicit day and night produce stable usable light", () => {
  assert.equal(CAMERA_PITCH_DEGREES, 32.5);
  assert.equal(CAMERA_YAW_DEGREES, 45);
  assert.equal(lightingAt("day", 0).night, 0);
  assert.equal(lightingAt("night", 0).night, 1);
  assert.ok(lightingAt("night", 0).emission === 1);
  assert.equal(lightingAt("night", 0.9).night, lightingAt("night", 0.1).night);
  assert.equal(lightingAt("day", 0.5).night, 0);
  assert.ok(lightingAt("auto", 0.25).night < 0.1);
  assert.ok(lightingAt("auto", 0.75).night > 0.9);
  assert.equal(smoothstep(2, 4, 3), 0.5);
});

test("real mesh models exist for all 17 catalog types and have 3 LODs", () => {
  for (const kind of KINDS) {
    const high = modelVertices(kind, 0),
      mid = modelVertices(kind, 1),
      low = modelVertices(kind, 2);
    assert.ok(low > 100, `${kind} should not be a flat sprite plane`);
    assert.ok(mid >= low);
    assert.ok(high >= mid);
    assert.ok(high > low, `${kind} high detail should carry more geometry`);
  }
});

test("camera and every building model are shared between generated lots", () => {
  for (let r = 18; r < 32; r++)
    for (let c = 0; c < 48; c++) {
      const at = cellWorld(c, r);
      assert.deepEqual(worldCell(at.x, at.z), { c, r }, `lot ${c},${r}`);
    }
  assert.equal(lodFor(20, 10), 0);
  assert.equal(lodFor(50, 10), 1);
  assert.equal(lodFor(80, 10), 2);
});

import { createGrid, createRoads } from "./scenery.ts";
import { FINE_ROW0, LAND, OLD_COL0 } from "../land.ts";
import { PALETTE } from "./palette.ts";
import { LAND_HEIGHT } from "./camera.ts";

test("empty roads and lanes merge into valid 3D geometry", () => {
  const roads = createRoads([]);
  for (const geometry of [roads.asphalt, roads.markings, roads.details, roads.lights]) {
    assert.ok(geometry.index);
    assert.ok(geometry.attributes.position);
    geometry.dispose();
  }
});

test("batched architectural shells have finite, indexed geometry", () => {
  for (const kind of KINDS)
    for (const detail of [0, 1, 2] as const) {
      const model = buildingModel(kind, 1, detail);
      for (const geometry of Object.values(model)) {
        assert.ok(geometry.index, `${kind}/${detail} must stay indexed`);
        const positions = geometry.attributes.position!.array;
        assert.ok([...positions].every(Number.isFinite), `${kind}/${detail} finite coordinates`);
        assert.equal(geometry.index!.count % 3, 0);
        for (const index of geometry.index!.array)
          assert.ok(index < positions.length / 3, "no out of bounds mesh index");
      }
    }
});

test("Boubyan is rounded and tapered with a curved crown", () => {
  const bottom = boubyanProfile(0),
    mid = boubyanProfile(0.5),
    top = boubyanProfile(1);
  assert.ok(mid.radius < bottom.radius && top.radius < mid.radius);
  assert.ok(mid.depth < bottom.depth && top.depth < mid.depth);
  assert.ok(top.radius / bottom.radius > 0.75 && top.radius / bottom.radius < 0.8);
  const broad = boubyanProfile(0.94, Math.PI * 0.5);
  assert.ok(Math.abs(broad.y - boubyanProfile(0.94, -Math.PI * 0.5).y) < 0.1);
  for (const detail of [0, 1, 2] as const) {
    assert.ok(modelTriangles("boubyan", detail) > 100);
    const model = buildingModel("boubyan", 1, detail);
    assert.ok(model.metal.attributes.position!.count > 0, "crown and fin geometry exists");
    assert.ok(model.glass.attributes.position!.count > 0, "curtain geometry exists");
    const positions = model.metal.getAttribute("position"),
      colors = model.metal.getAttribute("color");
    let silver = 0;
    for (let i = 0; i < positions.count; i++)
      if (
        new THREE.Color().fromBufferAttribute(colors, i).getHex() ===
        new THREE.Color(PALETTE.silver).getHex()
      )
        silver++;
    assert.ok(silver > 20);
  }
});

test("the villa's center is a real open courtyard", () => {
  for (const detail of [0, 1, 2] as const) {
    const model = buildingModel("villa", 1, detail);
    const highestAtTunnel = (pointX: number, pointZ: number) => {
      const meshes = Object.values(model).map(
        (geometry) =>
          new THREE.Mesh(
            geometry,
            new THREE.MeshBasicMaterial({
              side: THREE.DoubleSide,
              color: 0xffffff,
            }),
          ),
      );
      const ray = new THREE.Raycaster(
        new THREE.Vector3(pointX, 5, pointZ),
        new THREE.Vector3(0, -1, 0),
      );
      const hits = ray.intersectObjects(meshes, false);
      for (const mesh of meshes) (mesh.material as THREE.Material).dispose();
      return hits.length ? hits[0]!.point.y : 0;
    };
    assert.ok(highestAtTunnel(0, 0) < 0.4, "sunlight reaches the middle courtyard ground");
    assert.ok(highestAtTunnel(0, 0.7) > 0.5, "the front wing remains volumetric");
    assert.ok(modelVertices("villa", detail) > 1000);
  }
});

test("roads keep interior paint separate from charcoal asphalt, with no pale borders", () => {
  const r = 28 + FINE_ROW0,
    c = 21 + OLD_COL0; // keeps (c + r) % 4 === 0, so exactly one streetlamp
  const roads = createRoads([`${c},${r}`, `${c + 1},${r}`, `${c},${r + 1}`]);
  const positions = roads.asphalt.getAttribute("position");
  const colors = roads.asphalt.getAttribute("color");
  const expected = [new THREE.Color(PALETTE.asphalt), new THREE.Color(PALETTE.dark)];
  const asphaltHex = new Set(expected.map((color) => color.getHex()));
  for (let i = 0; i < colors.count; i++) {
    const color = new THREE.Color().fromBufferAttribute(colors, i);
    assert.ok(
      asphaltHex.has(color.getHex()),
      "only asphalt and dark lamp posts, never paving/white",
    );
  }
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    assert.ok(y >= LAND_HEIGHT - 0.006, "road foundation intersects land by at most 3mm");
  }
  assert.ok(roads.markings.getAttribute("position").count > 0, "real interior road paint is batched");
  assert.equal(positions.count, 120, "three complete asphalt cubes and one two-part streetlamp");
  assert.equal(roads.lights.getAttribute("position").count, 24);
  for (const geometry of [roads.asphalt, roads.markings, roads.details, roads.lights]) geometry.dispose();
  let lot = "0,0";
  for (let r = 0; r < LAND.length && lot === "0,0"; r += 1) {
    const row = LAND[r] ?? [];
    for (let c = 0; c < row.length; c += 1) {
      if (row[c] === 1) {
        lot = `${c},${r}`;
        break;
      }
    }
  }
  const open = createGrid(new Set([lot]));
  assert.equal(
    open.geometry.getAttribute("position").count,
    createGrid().geometry.getAttribute("position").count - 8,
  );
  open.geometry.dispose();
  open.material.dispose();
});

test("the traditional house includes carved wood, unlike a generic beige block", () => {
  const model = buildingModel("villa", 1, 0);
  const color = model.opaque.getAttribute("color");
  const wood = new THREE.Color(PALETTE.wood).getHex();
  let found = 0;
  for (let i = 0; i < color.count; i++)
    if (new THREE.Color().fromBufferAttribute(color, i).getHex() === wood) found++;
  assert.ok(found > 200);
});
