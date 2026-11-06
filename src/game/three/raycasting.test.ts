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
