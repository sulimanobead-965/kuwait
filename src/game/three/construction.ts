import * as THREE from "three";
import { DEVELOPMENTS, type Site } from "../developments.ts";
import { CELL_SIZE, cellWorld, LAND_HEIGHT } from "./camera.ts";

/**
 * A fenced construction site for a developer project: dusty ground, a striped
 * safety fence, a sign, tower cranes, and skeleton frames that rise with progress
 * toward each planned building's final height.
 */
const mats = {
  ground: new THREE.MeshLambertMaterial({ color: "#b89a6a" }),
  fence: new THREE.MeshLambertMaterial({ color: "#f2f0e8" }),
  stripe: new THREE.MeshLambertMaterial({ color: "#e06a1f" }),
  frame: new THREE.MeshLambertMaterial({ color: "#8d949a" }),
  slab: new THREE.MeshLambertMaterial({ color: "#c9c4b8" }),
  crane: new THREE.MeshLambertMaterial({ color: "#f2b705" }),
  sign: new THREE.MeshLambertMaterial({ color: "#0e6e78" }),
};

const box = new THREE.BoxGeometry(1, 1, 1);

function mesh(
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
) {
  const m = new THREE.Mesh(box, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Final height (world units) a skeleton grows toward, by planned kind and level. */
function targetHeight(kind: string, level: number) {
  if (kind === "park" || kind === "chalet") return 0.5;
  if (kind === "apartments" || kind === "tower" || kind === "shop")
    return level >= 5 ? 7 : level >= 4 ? 5.2 : 2.6;
  return 1.6;
}

export type SiteObject = {
  group: THREE.Group;
  frames: { mesh: THREE.Group; height: number }[];
  progress: number;
};

export function createSiteObject(site: Site, progress: number): SiteObject {
  const group = new THREE.Group();
  group.name = `site-${site.id}`;
  const a = cellWorld(site.c, site.r);
  const x0 = a.x - CELL_SIZE / 2;
  const z0 = a.z - CELL_SIZE / 2;
  const W = site.w * CELL_SIZE;
  const H = site.h * CELL_SIZE;
  const y = LAND_HEIGHT;
  group.add(mesh(mats.ground, x0 + W / 2, y + 0.03, z0 + H / 2, W - 0.1, 0.06, H - 0.1));

  // Striped fence on all four sides.
  const fence = (fx: number, fz: number, len: number, alongX: boolean) => {
    const segments = Math.max(1, Math.round(len / 1.1));
    for (let i = 0; i < segments; i += 1) {
      const t = (i + 0.5) / segments;
      const px = alongX ? fx + t * len : fx;
      const pz = alongX ? fz : fz + t * len;
      const seg = len / segments - 0.04;
      group.add(
        mesh(
          i % 2 ? mats.stripe : mats.fence,
          px,
          y + 0.35,
          pz,
          alongX ? seg : 0.06,
          0.6,
          alongX ? 0.06 : seg,
        ),
      );
    }
  };
  fence(x0, z0, W, true);
  fence(x0, z0 + H, W, true);
  fence(x0, z0, H, false);
  fence(x0 + W, z0, H, false);

  // Developer's sign at the front corner.
  group.add(mesh(mats.frame, x0 + W - 0.6, y + 0.6, z0 + H + 0.25, 0.06, 1.2, 0.06));
  group.add(mesh(mats.sign, x0 + W - 0.6, y + 1.25, z0 + H + 0.25, 1.4, 0.55, 0.05));

  // Tower cranes: one per ~60 cells, at least one.
  const cranes = Math.max(1, Math.round((site.w * site.h) / 60));
  for (let k = 0; k < cranes; k += 1) {
    const cx = x0 + ((k + 1) / (cranes + 1)) * W;
    const cz = z0 + H * (k % 2 ? 0.3 : 0.65);
    const mast = 8.5;
    group.add(mesh(mats.crane, cx, y + mast / 2, cz, 0.22, mast, 0.22));
    const jib = new THREE.Group();
    jib.position.set(cx, y + mast, cz);
    jib.add(mesh(mats.crane, 2.2, 0, 0, 5.6, 0.16, 0.18));
    jib.add(mesh(mats.crane, -1.0, 0, 0, 1.6, 0.16, 0.18));
    jib.add(mesh(mats.frame, -1.5, -0.25, 0, 0.6, 0.45, 0.45));
    jib.add(mesh(mats.frame, 3.5, -1.2, 0, 0.04, 2.2, 0.04));
    jib.rotation.y = (k * 1.3) % (Math.PI * 2);
    jib.name = "jib";
    group.add(jib);
  }

  // Skeleton frames on the planned lots.
  const def = DEVELOPMENTS[site.kind];
  const plan = def.plan(site.w, site.h);
  const frames: SiteObject["frames"] = [];
  for (const lot of plan.lots) {
    const at = cellWorld(site.c + lot.dc, site.r + lot.dr);
    const height = targetHeight(lot.kind, lot.level);
    const g = new THREE.Group();
    g.position.set(at.x, y, at.z);
    const s = CELL_SIZE * 0.62;
    for (const [px, pz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const)
      g.add(mesh(mats.frame, (px * s) / 2, 0.5, (pz * s) / 2, 0.08, 1, 0.08));
    for (let f = 1; f <= 4; f += 1) g.add(mesh(mats.slab, 0, (f / 4) * 1, 0, s, 0.05, s));
    g.scale.y = 0.001;
    group.add(g);
    frames.push({ mesh: g, height });
  }
  const object = { group, frames, progress: -1 };
  updateSiteObject(object, progress, 0);
  return object;
}

/** Grow frames to the current progress and swing the crane jibs. */
export function updateSiteObject(object: SiteObject, progress: number, time: number) {
  if (Math.abs(object.progress - progress) > 0.002) {
    object.progress = progress;
    for (const f of object.frames) f.mesh.scale.y = Math.max(0.001, f.height * progress);
  }
  for (const child of object.group.children)
    if (child.name === "jib") child.rotation.y += Math.sin(time * 0.4 + child.position.x) * 0.002;
}

export function disposeSiteObject(object: SiteObject) {
  object.group.removeFromParent();
}
