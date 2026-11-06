import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  CAMERA_PITCH_DEGREES,
  CAMERA_YAW_DEGREES,
  LAND_HEIGHT,
  cellWorld,
  worldCell,
} from "./camera.ts";
import { createRoads } from "./scenery.ts";
import { roadMarkingsAt } from "./road-markings.ts";

test("isometric orthographic ray returns original land lot", () => {
  const camera = new THREE.OrthographicCamera(-30, 30, 20, -20, 0.1, 260);
  const pitch = THREE.MathUtils.degToRad(CAMERA_PITCH_DEGREES),
    yaw = THREE.MathUtils.degToRad(CAMERA_YAW_DEGREES);
  camera.position
    .set(9, LAND_HEIGHT, 8)
    .add(
      new THREE.Vector3(
        Math.sin(yaw) * Math.cos(pitch) * 100,
        Math.sin(pitch) * 100,
        Math.cos(yaw) * Math.cos(pitch) * 100,
      ),
    );
  camera.lookAt(9, LAND_HEIGHT, 8);
  camera.updateMatrixWorld();
  const raycaster = new THREE.Raycaster(),
    plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -LAND_HEIGHT);
  for (const [c, r] of [
    [18, 23],
    [25, 22],
    [35, 27],
    [14, 28],
  ] as const) {
    const at = cellWorld(c, r);
    const pixel = new THREE.Vector3(at.x, LAND_HEIGHT, at.z).project(camera);
    raycaster.setFromCamera(new THREE.Vector2(pixel.x, pixel.y), camera);
    const hit = new THREE.Vector3();
    assert.ok(raycaster.ray.intersectPlane(plane, hit));
    assert.deepEqual(worldCell(hit.x, hit.z), { c, r });
  }
});

const crossRoads = new Set(["22,21", "23,21", "24,21", "25,21", "26,21", "27,21", "25,18", "25,20", "25,22", "25,23"]);

test("road paint has correctly oriented dashed approaches, stops, and empty junction interiors", () => {
  assert.deepEqual(roadMarkingsAt(crossRoads, 25, 21), []);
  assert.deepEqual(roadMarkingsAt(crossRoads, 23, 21), [{ type: "dash", axis: "x" }]);
  assert.deepEqual(roadMarkingsAt(crossRoads, 26, 21), [
    { type: "stop", axis: "x", dc: -1, dr: 0 },
  ]);
  const straight = new Set(["20,20", "21,20", "22,20", "23,20", "24,20"]);
  assert.deepEqual(roadMarkingsAt(straight, 22, 20), [{ type: "dash", axis: "x" }]);
  const vertical = new Set(["32,18", "32,19", "32,20", "32,21"]);
  assert.deepEqual(roadMarkingsAt(vertical, 32, 20), [{ type: "dash", axis: "z" }]);
  assert.deepEqual(roadMarkingsAt(crossRoads, 25, 22), [{ type: "stop", axis: "z", dc: 0, dr: -1 }]);
});

test("real district paint is merged geometry, with finite vertices and no per-tile curb mesh", () => {
  const roads = createRoads([...crossRoads]);
  assert.ok(roads.markings.attributes.position!.count > 0);
  assert.ok([...roads.markings.attributes.position!.array].every(Number.isFinite));
  assert.ok(roads.markings.index!.count % 3 === 0);
  assert.ok(roads.details.attributes.position!.count > 0); // Empty compatibility geometry only.
  assert.equal(roads.details.boundingBox, null);
  // Zero-length bounds are corrected by Three; this box has no per-tile fill/border UVs.
  for (const geometry of [roads.asphalt, roads.markings, roads.details, roads.lights]) geometry.dispose();
});
