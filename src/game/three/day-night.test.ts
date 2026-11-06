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
import { modelVertices } from "./models.ts";
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

import { createRoads } from "./scenery.ts";

test("empty roads and lanes merge into valid 3D geometry", () => {
  const roads = createRoads([]);
  for (const geometry of [roads.asphalt, roads.details, roads.lights]) {
    assert.ok(geometry.index);
    assert.ok(geometry.attributes.position);
    geometry.dispose();
  }
});
