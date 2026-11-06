import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  CAMERA_PITCH_DEGREES,
  CAMERA_YAW_DEGREES,
  CELL_SIZE,
  LAND_HEIGHT,
  cellWorld,
  framedView,
  worldCell,
} from "./camera.ts";
import { createRoads } from "./scenery.ts";
import { roadMarkingsAt } from "./road-markings.ts";
import { COLS, LAND, ROWS } from "../land.ts";

function findCross() {
  for (let r = 2; r < ROWS - 2; r += 1) {
    for (let c = 4; c < COLS - 4; c += 1) {
      const horizontal = [-4, -3, -2, -1, 0, 1, 2, 3, 4].every((dc) => LAND[r]?.[c + dc] === 1);
      const vertical = [-2, -1, 1, 2].every((dr) => LAND[r + dr]?.[c] === 1);
      if (horizontal && vertical) return { c, r };
    }
  }
  throw new Error("no land cross");
}

const hub = findCross();
const crossRoads = new Set<string>();
for (let dc = -4; dc <= 4; dc += 1) crossRoads.add(`${hub.c + dc},${hub.r}`);
for (let dr = -2; dr <= 2; dr += 1) if (dr) crossRoads.add(`${hub.c},${hub.r + dr}`);

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

test("portrait framing keeps neighborhood lots large enough to tap", () => {
  const phone = framedView(13, 12, 440, 956, 0.48);
  const desktop = framedView(13, 12, 1280, 720, 0.4);
  const step = CELL_SIZE * Math.SQRT1_2;
  const phonePx = (step / (phone.viewHeight * (440 / 956))) * 440;
  assert.ok(phonePx >= 38, `phone cell ${phonePx.toFixed(1)}px`);
  assert.ok(phone.viewHeight < 50, `phone zoomed out to ${phone.viewHeight}`);
  assert.ok(desktop.viewHeight > 22 && desktop.viewHeight < 50);
});

test("road paint has correctly oriented dashed approaches, stops, and empty junction interiors", () => {
  assert.deepEqual(roadMarkingsAt(crossRoads, hub.c, hub.r), []);
  const dashC = (hub.c + 2 + hub.r) % 2 === 0 ? hub.c + 2 : hub.c + 3;
  assert.deepEqual(roadMarkingsAt(crossRoads, dashC, hub.r), [{ type: "dash", axis: "x" }]);
  const stopC = hub.c + 1;
  const stopX: { type: "dash" | "stop"; axis: "x" | "z"; dc?: number; dr?: number }[] = [];
  if ((stopC + hub.r) % 2 === 0) stopX.push({ type: "dash", axis: "x" });
  stopX.push({ type: "stop", axis: "x", dc: -1, dr: 0 });
  assert.deepEqual(roadMarkingsAt(crossRoads, stopC, hub.r), stopX);
  let vc = 0;
  let vr = 0;
  for (let c = 0; c < COLS && !vr; c += 1) {
    for (let r = 2; r < ROWS - 2; r += 1) {
      if (
        [r - 2, r - 1, r, r + 1, r + 2].every((row) => LAND[row]?.[c] === 1) &&
        (c + r) % 2 === 0
      ) {
        vc = c;
        vr = r;
        break;
      }
    }
  }
  const vertical = new Set([vr - 2, vr - 1, vr, vr + 1, vr + 2].map((r) => `${vc},${r}`));
  assert.deepEqual(roadMarkingsAt(vertical, vc, vr), [{ type: "dash", axis: "z" }]);
  const stopR = hub.r + 1;
  const stopZ: { type: "dash" | "stop"; axis: "x" | "z"; dc?: number; dr?: number }[] = [];
  if ((hub.c + stopR) % 2 === 0) stopZ.push({ type: "dash", axis: "z" });
  stopZ.push({ type: "stop", axis: "z", dc: 0, dr: -1 });
  assert.deepEqual(roadMarkingsAt(crossRoads, hub.c, stopR), stopZ);
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
