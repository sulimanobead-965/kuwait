import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";
import type { Kind } from "@/game/catalog";
import type { CityMaterials } from "./palette.ts";
import { PALETTE as P } from "./palette.ts";

type Geo = THREE.BufferGeometry;
export type ModelBucket = "opaque" | "metal" | "glass" | "windows";
export type ModelParts = Record<ModelBucket, Geo[]>;
export type BuildingModel = { opaque: Geo; metal: Geo; glass: Geo; windows: Geo };

function emptyParts(): ModelParts {
  return { opaque: [], metal: [], glass: [], windows: [] };
}

function color(g: Geo, value: string) {
  const c = new THREE.Color(value);
  const array = new Float32Array(g.attributes.position!.count * 3);
  for (let i = 0; i < array.length; i += 3) {
    array[i] = c.r;
    array[i + 1] = c.g;
    array[i + 2] = c.b;
  }
  // BufferGeometry requires the same channels across every batched primitive.
  // These models are solid-color meshes, so unused UVs are deterministic zeros.
  if (!g.attributes.uv)
    g.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position!.count * 2), 2),
    );
  g.setAttribute("color", new THREE.BufferAttribute(array, 3));
  return g;
}

function place(g: Geo, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, ry = 0, rz = 0) {
  if (sx !== 1 || sy !== 1 || sz !== 1) g.scale(sx, sy, sz);
  if (ry) g.rotateY(ry);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
}

function box(
  p: ModelParts,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  tint: string = P.limestone,
  bucket: ModelBucket = "opaque",
) {
  p[bucket].push(color(place(new THREE.BoxGeometry(w, h, d), x, y, z), tint));
}

function cyl(
  p: ModelParts,
  x: number,
  y: number,
  z: number,
  r: number,
  h: number,
  tint: string = P.limestone,
  rb = r,
  segments = 12,
  bucket: ModelBucket = "opaque",
) {
  p[bucket].push(color(place(new THREE.CylinderGeometry(r, rb, h, segments), x, y, z), tint));
}

function ball(
  p: ModelParts,
  x: number,
  y: number,
  z: number,
  rx: number,
  ry: number,
  rz: number,
  tint: string,
  detail: number,
  bucket: ModelBucket = "opaque",
) {
  p[bucket].push(
    color(
      place(
        new THREE.SphereGeometry(1, detail === 0 ? 12 : 8, detail === 0 ? 8 : 5),
        x,
        y,
        z,
        rx,
        ry,
        rz,
      ),
      tint,
    ),
  );
}

function cone(
  p: ModelParts,
  x: number,
  y: number,
  z: number,
  r: number,
  h: number,
  tint: string,
  detail = 8,
) {
  p[bucketWith(tint)].push(color(place(new THREE.ConeGeometry(r, h, detail), x, y, z), tint));
}

function bucketWith(tint: string): ModelBucket {
  return tint === P.gold ? "metal" : "opaque";
}

function arch(p: ModelParts, x: number, y: number, z: number, w: number, h: number, ry = 0) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, -h / 2);
  shape.lineTo(w / 2, -h / 2);
  shape.lineTo(w / 2, h * 0.08);
  shape.quadraticCurveTo(w / 2, h * 0.33, 0, h / 2);
  shape.quadraticCurveTo(-w / 2, h * 0.33, -w / 2, h * 0.08);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.035,
    bevelEnabled: false,
    curveSegments: 4,
  });
  geo.rotateY(ry);
  geo.translate(x, y, z);
  p.windows.push(color(geo, P.glass));
}

function window(p: ModelParts, x: number, y: number, z: number, w = 0.16, h = 0.23, ry = 0) {
  const geo = new THREE.BoxGeometry(w, h, 0.035);
  geo.rotateY(ry);
  geo.translate(x, y, z);
  p.windows.push(color(geo, P.gold));
}

function fourWindows(p: ModelParts, y: number, w: number, d: number, cols: number, height = 0.2) {
  for (let i = 0; i < cols; i += 1) {
    const t = (i + 1) / (cols + 1) - 0.5;
    window(p, t * w, y, d / 2 + 0.022, Math.min(0.16, w / (cols * 2)), height);
    window(p, t * w, y, -d / 2 - 0.022, Math.min(0.16, w / (cols * 2)), height);
    window(p, w / 2 + 0.022, y, t * d, Math.min(0.16, d / (cols * 2)), height, Math.PI / 2);
    window(p, -w / 2 - 0.022, y, t * d, Math.min(0.16, d / (cols * 2)), height, Math.PI / 2);
  }
}

function parapet(p: ModelParts, w: number, d: number, y: number, tint: string = P.paleStone) {
  box(p, 0, y, d / 2, w, 0.1, 0.09, tint);
  box(p, 0, y, -d / 2, w, 0.1, 0.09, tint);
  box(p, w / 2, y, 0, 0.09, 0.1, d, tint);
  box(p, -w / 2, y, 0, 0.09, 0.1, d, tint);
}

function villa(p: ModelParts, detail: number) {
  // Traditional Kuwaiti courtyard house: open centre, four low wings, dark wood,
  // carved lattice wind tower and the characteristic crenellated roofline.
  const wall = P.plaster;
  box(p, 0, 0.055, 0, 2.02, 0.11, 1.94, P.sand);
  box(p, 0, 0.115, 0.04, 0.98, 0.035, 1.23, P.paleStone);
  box(p, 0, 0.63, -0.66, 1.96, 1.02, 0.52, wall);
  box(p, -0.77, 0.51, 0.1, 0.42, 0.78, 1.0, wall);
  box(p, 0.77, 0.51, 0.1, 0.42, 0.78, 1.0, wall);
  // Entrance pieces leave a real opening rather than a solid rectangular cube.
  for (const x of [-0.6, 0.6]) box(p, x, 0.49, 0.72, 0.76, 0.74, 0.43, wall);
  box(p, 0, 0.94, 0.72, 0.46, 0.35, 0.43, wall);
  box(p, 0, 0.12, 0.01, 0.41, 0.055, 0.41, P.limestone);
  box(p, 0, 0.154, 0.01, 0.36, 0.025, 0.105, P.blue, "glass");
  box(p, 0, 0.154, 0.01, 0.105, 0.025, 0.36, P.blue, "glass");
  const courtyardPalm = (scale: number) => {
    cyl(p, 0.29, 0.14 + scale * 0.32, 0.24, 0.025 * scale, 0.64 * scale, P.trunk, 0.046 * scale, 7);
    for (let i = 0; i < 7; i += 1) {
      const a = (i * Math.PI * 2) / 7;
      box(
        p,
        0.29 + Math.cos(a) * 0.13,
        0.79,
        0.24 + Math.sin(a) * 0.13,
        0.25 * scale,
        0.065,
        0.082,
        i % 2 ? P.leaf : P.leafLight,
      );
    }
  };
  courtyardPalm(0.8);
  woodDoor(p, 0, 0.51, 0.942, 0.37, 0.69);
  for (const x of [-0.25, 0.25]) {
    cyl(p, x, 0.46, 0.996, 0.032, 0.66, P.paleStone, 0.033, 8);
    box(p, x, 0.58, 0.956, 0.065, 0.13, 0.073, P.gold, "windows");
  }
  box(p, 0, 0.81, 0.98, 0.65, 0.095, 0.17, wall);
  for (const x of [-0.64, 0.64]) woodDoor(p, x, 0.55, 0.942, 0.18, 0.32);
  for (const z of [-0.22, 0.22]) {
    const side = new THREE.BoxGeometry(0.035, 0.25, 0.19);
    p.opaque.push(color(place(side, -0.987, 0.55, z), P.wood));
    for (let n = 0; n < 3; n += 1) box(p, -1.009, 0.46 + n * 0.085, z, 0.022, 0.021, 0.22, P.trunk);
    for (const n of [-0.055, 0.055]) box(p, -1.011, 0.55, z + n, 0.024, 0.27, 0.018, P.trunk);
  }
  for (const z of [-0.78, -0.57])
    for (const x of [-0.62, 0.03, 0.64]) woodDoor(p, x, 0.75, z, 0.2, 0.29);
  if (detail < 2) {
    parapet(p, 1.96, 0.57, 1.25, P.plaster);
    for (const side of [-0.77, 0.77]) {
      box(p, side, 1.0, 0.6, 0.45, 0.1, 0.09, P.plaster);
      box(p, side, 1.0, -0.4, 0.45, 0.1, 0.09, P.plaster);
      box(p, side - 0.225, 1.0, 0.1, 0.09, 0.1, 1.0, P.plaster);
      box(p, side + 0.225, 1.0, 0.1, 0.09, 0.1, 1.0, P.plaster);
    }
    toothParapet(p, -0.98, 0.1, 1.065, 0.09, 0.95, 0);
    toothParapet(p, 0.98, 0.1, 1.065, 0.09, 0.95, 0);
    box(p, -0.6, 0.88, 0.72, 0.76, 0.07, 0.43, wall);
    box(p, 0.6, 0.88, 0.72, 0.76, 0.07, 0.43, wall);
    toothParapet(p, -0.6, 0.94, 0.94, 0.75, 0.08, 0);
    toothParapet(p, 0.6, 0.94, 0.94, 0.75, 0.08, 0);
    // Raised mashrabiya wind tower, screened on two visible facades.
    box(p, -0.46, 1.38, -0.65, 0.42, 0.43, 0.38, wall);
    box(p, -0.46, 1.42, -0.445, 0.29, 0.27, 0.035, P.wood);
    box(p, -0.235, 1.42, -0.65, 0.035, 0.27, 0.29, P.wood);
    for (const n of [-0.1, 0, 0.1]) {
      box(p, -0.46 + n, 1.42, -0.419, 0.018, 0.29, 0.021, P.trunk);
      box(p, -0.21, 1.42, -0.65 + n, 0.021, 0.29, 0.018, P.trunk);
    }
    toothParapet(p, -0.46, -0.65, 1.63, 0.48, 0.44, 0);
    box(p, 0.49, 1.2, -0.64, 0.3, 0.035, 0.26, P.pavement);
    box(p, 0.49, 1.245, -0.64, 0.2, 0.06, 0.17, P.paleStone);
    box(p, 1.02, 0.09, 0.4, 0.28, 0.12, 0.57, P.sand);
    ball(p, 1.05, 0.25, 0.54, 0.15, 0.22, 0.18, P.leaf, detail);
  }
}

function woodDoor(p: ModelParts, x: number, y: number, z: number, w: number, h: number) {
  box(p, x, y, z, w + 0.06, h + 0.06, 0.043, P.paleStone);
  box(p, x, y, z + 0.027, w, h, 0.039, P.wood);
  for (const shift of [-w * 0.24, w * 0.24])
    box(p, x + shift, y, z + 0.051, 0.022, h * 0.94, 0.02, P.trunk);
  box(p, x, y + h * 0.22, z + 0.055, w, 0.028, 0.02, P.trunk);
}

function toothParapet(
  p: ModelParts,
  x: number,
  z: number,
  y: number,
  w: number,
  d: number,
  detail: number,
) {
  box(p, x, y - 0.095, z, w, 0.11, d, P.plaster);
  const count = Math.max(1, Math.ceil(w / (detail === 0 ? 0.17 : 0.27)));
  for (let i = 0; i < count; i += 1) {
    const xx = x - w / 2 + ((i + 0.5) * w) / count;
    box(p, xx, y, z, (w / count) * 0.58, 0.12, Math.max(d, 0.065), P.plaster);
  }
}

function modern(p: ModelParts, detail: number) {
  // Modern Kuwaiti villa from the reference: recessed volumes, balcony glazing,
  // offset parapets and a timber front door, not a teal slab.
  box(p, 0, 0.07, 0, 1.98, 0.14, 1.78, P.pavement);
  box(p, -0.24, 0.58, -0.2, 1.18, 1.0, 1.24, P.plaster);
  box(p, -0.27, 1.22, -0.26, 1.29, 0.31, 1.19, P.plaster);
  box(p, 0.59, 0.6, 0.16, 0.62, 0.98, 0.94, P.dark);
  box(p, 0.59, 1.21, 0.1, 0.65, 0.18, 1.03, P.plaster);
  box(p, 0.25, 1.45, -0.16, 1.45, 0.13, 1.51, P.dark);
  box(p, 0.5, 0.99, 0.39, 0.89, 0.095, 0.53, P.plaster);
  box(p, 0.51, 0.57, 0.635, 0.73, 0.64, 0.036, P.glass, "glass");
  box(p, 0.51, 0.57, 0.66, 0.041, 0.68, 0.05, P.black);
  box(p, -0.39, 0.47, 0.441, 0.3, 0.65, 0.058, P.trunk);
  for (const n of [-0.08, 0.08]) box(p, -0.39 + n, 0.47, 0.476, 0.025, 0.55, 0.025, P.wood);
  box(p, -0.4, 1.19, 0.347, 0.7, 0.19, 0.037, P.glass, "glass");
  box(p, 0.64, 1.18, 0.632, 0.53, 0.04, 0.04, P.gold, "windows");
  box(p, -0.21, 1.027, 0.4, 1.21, 0.04, 0.04, P.gold, "windows");
  box(p, 0.68, 0.5, 0.64, 0.07, 0.14, 0.055, P.gold, "windows");
  if (detail < 2) {
    box(p, 0.48, 1.101, 0.635, 0.87, 0.22, 0.024, P.glass, "glass");
    box(p, 0.924, 1.101, 0.403, 0.024, 0.22, 0.46, P.glass, "glass");
    for (const x of [0.048, 0.48, 0.922])
      box(p, x, 1.1, 0.647, 0.025, 0.275, 0.028, P.dark, "metal");
    box(p, 0.49, 1.235, 0.649, 0.93, 0.03, 0.032, P.dark, "metal");
    box(p, -0.74, 0.51, 0.32, 0.041, 0.63, 1.01, P.black);
    for (let i = 0; i < 5; i += 1)
      box(p, -0.772, 0.51, -0.065 + i * 0.18, 0.028, 0.57, 0.047, P.dark);
    box(p, -0.78, 0.88, -0.02, 0.12, 0.95, 0.99, P.plaster);
    parapet(p, 1.41, 1.46, 1.535, P.plaster);
    box(p, -0.29, 1.585, -0.55, 0.39, 0.25, 0.32, P.paleStone);
    box(p, -0.29, 1.73, -0.55, 0.46, 0.045, 0.39, P.dark);
    if (detail === 0) {
      for (let i = 0; i < 4; i += 1)
        box(p, -0.41 + i * 0.08, 1.76, -0.55, 0.023, 0.023, 0.26, P.silver, "metal");
      for (const x of [-0.12, 0.81]) box(p, x, 0.55, 0.7, 0.07, 0.17, 0.07, P.gold, "windows");
    }
  }
}

function apartments(p: ModelParts, detail: number, level: number) {
  const floors = detail === 2 ? 3 : Math.min(4, level + 1);
  const h = floors * 0.48;
  const w = 1.44,
    d = 1.14;
  box(p, 0, 0.065, 0, 1.92, 0.13, 1.76, P.pavement);
  box(p, 0, h / 2 + 0.16, -0.05, w, h, d, P.limestone);
  for (const x of [-0.69, 0.69])
    for (const z of [-0.56, 0.46]) box(p, x, h / 2 + 0.16, z, 0.14, h + 0.09, 0.14, P.plaster);
  for (let f = 0; f < floors; f += 1) {
    const y = 0.29 + f * 0.48;
    box(p, 0, y, -0.05, 1.55, 0.075, 1.27, P.plaster);
    if (detail < 2)
      for (const x of [-0.36, 0.36]) {
        box(p, x, y + 0.25, 0.537, 0.34, 0.28, 0.044, P.glass, "glass");
        box(p, x, y + 0.09, 0.594, 0.49, 0.07, 0.19, P.plaster);
        box(p, x, y + 0.215, 0.684, 0.46, 0.035, 0.032, P.white, "metal");
        for (const dx of [-0.21, 0, 0.21])
          box(p, x + dx, y + 0.148, 0.682, 0.027, 0.18, 0.031, P.white, "metal");
        box(p, x, y + 0.25, 0.568, 0.025, 0.28, 0.026, P.white);
      }
    for (const z of [-0.32, 0.09]) {
      box(p, 0.744, y + 0.24, z, 0.035, 0.22, 0.28, P.glass, "glass");
      box(p, 0.769, y + 0.24, z, 0.03, 0.255, 0.32, P.plaster);
      box(p, 0.793, y + 0.24, z, 0.021, 0.2, 0.25, P.glass, "glass");
    }
  }
  const roof = 0.17 + h;
  parapet(p, 1.47, 1.23, roof + 0.13, P.plaster);
  if (detail === 0) {
    // The signature rooftop tank and mechanical dish distinguish a Kuwait apartment.
    for (const x of [0.32, 0.58])
      for (const z of [-0.39, -0.11])
        box(p, x, roof + 0.13, z, 0.035, 0.25, 0.035, P.dark, "metal");
    cyl(p, 0.45, roof + 0.39, -0.25, 0.32, 0.46, P.white, 0.28, 16);
    cyl(p, 0.45, roof + 0.28, -0.25, 0.324, 0.07, P.paleStone, 0.324, 16);
    cyl(p, -0.37, roof + 0.17, -0.23, 0.04, 0.3, P.dark, 0.04, 8);
    const dish = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.32);
    dish.scale(0.28, 0.1, 0.28);
    dish.rotateX(-0.62);
    dish.translate(-0.37, roof + 0.34, -0.23);
    p.metal.push(color(dish, P.paleStone));
    box(p, 0.49, roof + 0.12, 0.31, 0.35, 0.15, 0.22, P.pavement);
  }
}

function shop(p: ModelParts, detail: number) {
  box(p, 0, 0.12, 0, 1.65, 0.24, 1.28, P.sand);
  box(p, 0, 0.52, -0.12, 1.42, 0.8, 0.88, P.paleStone);
  box(p, 0, 0.47, 0.34, 1.26, 0.52, 0.04, P.glass, "glass");
  box(p, 0, 0.89, 0.41, 1.51, 0.18, 0.24, P.gulf);
  box(p, 0, 0.97, -0.1, 1.55, 0.1, 1.04, P.plaster);
  if (detail === 0) {
    for (let i = 0; i < 6; i += 1)
      box(p, -0.6 + i * 0.24, 0.79, 0.5, 0.11, 0.33, 0.34, i % 2 ? P.white : P.gold);
    for (const x of [-0.44, 0, 0.44]) window(p, x, 0.49, 0.38, 0.26, 0.36);
    box(p, -0.43, 0.43, -0.594, 0.35, 0.48, 0.03, P.dark);
    cyl(p, 0.46, 1.1, -0.1, 0.17, 0.2, P.dark, 0.17, 10, "metal");
  }
}

function tower(p: ModelParts, detail: number, level: number) {
  // Office reference: pale structural grid around blue windows, and a real
  // mechanical roof. It should not read as another pointed dark teal tower.
  const h = detail === 2 ? 2.65 : 2.45 + level * 0.27;
  const w = 1.15,
    d = 0.98,
    y = h / 2 + 0.2;
  box(p, 0, 0.11, 0, 1.84, 0.22, 1.57, P.pavement);
  box(p, 0, y, -0.02, w, h, d, P.glass, "glass");
  const floors = detail === 0 ? 7 : 4;
  for (let f = 0; f <= floors; f += 1)
    box(p, 0, 0.23 + (f * h) / floors, -0.02, 1.35, 0.065, 1.15, P.plaster);
  for (const x of [-0.57, -0.18, 0.18, 0.57])
    for (const z of [-0.49, 0.49]) box(p, x, y, z, 0.065, h, 0.064, P.plaster);
  for (const z of [-0.29, 0, 0.29])
    for (const x of [-0.61, 0.61]) box(p, x, y, z, 0.068, h, 0.065, P.plaster);
  const roof = h + 0.2;
  box(p, 0, roof + 0.05, 0, 1.43, 0.1, 1.24, P.plaster);
  box(p, 0, roof + 0.111, 0, 1.22, 0.034, 1.03, P.asphalt);
  parapet(p, 1.43, 1.24, roof + 0.18, P.limestone);
  cyl(p, -0.26, roof + 0.135, -0.02, 0.34, 0.016, P.gold, 0.34, 24);
  if (detail === 0) {
    box(p, -0.26, roof + 0.151, -0.02, 0.052, 0.017, 0.27, P.white);
    box(p, -0.205, roof + 0.151, -0.15, 0.16, 0.017, 0.042, P.white);
    box(p, -0.205, roof + 0.151, 0.11, 0.16, 0.017, 0.042, P.white);
    box(p, -0.134, roof + 0.151, -0.02, 0.042, 0.017, 0.25, P.white);
    box(p, 0.39, roof + 0.19, -0.3, 0.31, 0.16, 0.23, P.dark);
    for (const x of [-0.38, -0.16, 0.06])
      cyl(p, x, roof + 0.23, 0.33, 0.055, 0.22, P.paleStone, 0.055, 8, "metal");
  }
}

function power(p: ModelParts, detail: number) {
  box(p, 0, 0.1, 0, 1.8, 0.2, 1.6, P.pavement);
  box(p, -0.28, 0.39, 0.15, 0.84, 0.58, 1, P.dark);
  for (const x of [-0.5, 0.27]) {
    cyl(p, x, 0.7, -0.15, 0.18, 1, P.paleStone, 0.23, 12, "metal");
    cyl(p, x, 1.3, -0.15, 0.15, 0.3, P.dark, 0.15, 10);
    if (detail === 0) cyl(p, x, 1.48, -0.15, 0.19, 0.07, P.gulf, 0.19, 10, "metal");
  }
  if (detail < 2) {
    for (const x of [0.44, 0.68]) {
      box(p, x, 0.34, 0.49, 0.13, 0.5, 0.14, P.paleStone);
      for (let i = 0; i < (detail === 0 ? 4 : 1); i += 1)
        box(p, x, 0.18 + i * 0.1, 0.49, 0.3, 0.026, 0.22, P.gulf, "metal");
    }
    box(p, 0, 0.55, -0.69, 1.63, 0.05, 0.04, P.gold, "metal");
  }
}

function water(p: ModelParts, detail: number) {
  box(p, 0, 0.1, 0, 1.82, 0.2, 1.46, P.pavement);
  for (const x of [-0.46, 0, 0.46]) {
    cyl(p, x, 0.58, 0, 0.2, 0.9, P.white, 0.2, detail === 0 ? 16 : 10, "metal");
    cone(p, x, 1.13, 0, 0.22, 0.2, P.gulf, 10);
    if (detail === 0) {
      cyl(p, x, 0.76, 0, 0.211, 0.05, P.gulf, 0.211, 12, "metal");
      cyl(p, x, 0.47, 0, 0.211, 0.05, P.gulf, 0.211, 12, "metal");
    }
  }
  box(p, 0, 0.32, 0.47, 1.45, 0.36, 0.26, P.glass, "glass");
  if (detail === 0) {
    const pipe = new THREE.TorusGeometry(0.29, 0.045, 6, 12, Math.PI);
    pipe.rotateX(Math.PI / 2);
    p.metal.push(color(place(pipe, 0, 0.28, 0.59), P.gulf));
  }
}

function civic(p: ModelParts, kind: "police" | "clinic" | "school" | "fire", detail: number) {
  const colorByKind =
    kind === "police" ? P.blue : kind === "clinic" ? P.gulf : kind === "school" ? P.gold : P.red;
  box(p, 0, 0.09, 0, 1.67, 0.18, 1.4, P.sand);
  box(p, 0, 0.46, 0, 1.42, 0.74, 1.08, P.plaster);
  box(p, 0, 0.86, 0, 1.58, 0.12, 1.22, colorByKind);
  if (kind === "fire") {
    box(p, 0, 0.4, 0.557, 0.83, 0.54, 0.04, P.dark);
    box(p, -0.59, 0.66, 0.561, 0.1, 0.19, 0.04, P.gold);
    if (detail === 0) box(p, 0.4, 0.4, 0.58, 0.25, 0.51, 0.05, P.red);
  } else {
    box(p, 0, 0.39, 0.568, 0.23, 0.45, 0.04, P.dark);
    for (const x of [-0.48, 0.48]) window(p, x, 0.51, 0.568, 0.25, 0.27);
  }
  if (detail === 0) {
    if (kind === "clinic") {
      box(p, 0, 0.73, 0.574, 0.34, 0.09, 0.055, P.white);
      box(p, 0, 0.73, 0.576, 0.09, 0.27, 0.055, P.white);
    }
    if (kind === "police") {
      ball(p, 0, 0.76, 0.568, 0.09, 0.1, 0.025, P.blue, 0, "metal");
      box(p, 0.59, 1.07, -0.3, 0.025, 0.34, 0.025, P.paleStone, "metal");
    }
    fourWindows(p, 0.57, 1.12, 1.08, 1, 0.21);
    box(p, -0.42, 0.29, 0.7, 0.42, 0.08, 0.12, P.trunk);
  }
}

function park(p: ModelParts, detail: number) {
  box(p, 0, 0.04, 0, 1.8, 0.08, 1.75, P.leaf);
  box(p, 0, 0.091, 0, 0.22, 0.025, 1.75, P.sand);
  box(p, 0, 0.092, 0, 1.8, 0.025, 0.22, P.sand);
  if (detail === 0) {
    for (const [x, z] of [
      [-0.62, -0.57],
      [0.56, 0.5],
    ])
      palm(p, Number(x), Number(z), 0.95);
    cyl(p, 0.52, 0.18, -0.5, 0.3, 0.24, P.paleStone, 0.3, 12);
    cyl(p, 0.52, 0.32, -0.5, 0.24, 0.06, P.glass, 0.24, 12, "glass");
    for (const z of [-0.55, 0.57]) {
      box(p, -0.55, 0.24, z, 0.47, 0.09, 0.15, P.trunk);
      box(p, -0.55, 0.36, z - 0.06, 0.47, 0.19, 0.045, P.trunk);
    }
  }
}

function palm(p: ModelParts, x: number, z: number, scale: number) {
  cyl(p, x, scale * 0.53, z, 0.035 * scale, scale, P.trunk, 0.073 * scale, 7);
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI * 2;
    const leaf = new THREE.ConeGeometry(0.11 * scale, 0.62 * scale, 4);
    leaf.rotateZ(Math.PI / 2.7);
    leaf.rotateY(-a);
    p.opaque.push(
      color(
        place(leaf, x + Math.cos(a) * 0.22 * scale, scale + 0.03, z + Math.sin(a) * 0.22 * scale),
        i % 2 ? P.leaf : P.leafLight,
      ),
    );
  }
}

function kuwait(p: ModelParts, detail: number) {
  // Original stylized mesh interpretation, not an exact architectural scan.
  cyl(p, 0, 0.09, 0, 0.88, 0.18, P.pavement, 0.88, 20);
  const towers =
    detail === 2
      ? [{ x: -0.22, h: 2.75, r: 0.105, spheres: [[1.72, 0.33]] }]
      : [
          {
            x: -0.3,
            h: 3.65,
            r: 0.1,
            spheres: [
              [1.75, 0.39],
              [2.6, 0.26],
            ],
          },
          { x: 0.28, h: 2.84, r: 0.105, spheres: [[1.9, 0.33]] },
          { x: 0.62, h: 1.78, r: 0.065, spheres: [] },
        ];
  for (const t of towers) {
    cyl(p, t.x, 0.2 + t.h / 2, 0, t.r * 0.33, t.h, P.white, t.r, detail === 0 ? 12 : 8);
    cone(p, t.x, t.h + 0.38, 0, t.r * 0.36, 0.38, P.white, 8);
    for (const [at, radius] of t.spheres) {
      ball(p, t.x, at, 0, radius, radius * 1.06, radius, P.gulf, detail);
      if (detail < 2) {
        cyl(
          p,
          t.x,
          at - radius * 0.16,
          0,
          radius * 0.96,
          radius * 0.25,
          P.glass,
          radius * 0.96,
          16,
          "glass",
        );
        for (let j = 0; detail === 0 && j < 16; j += 1) {
          const a = (j / 16) * Math.PI * 2;
          ball(
            p,
            t.x + Math.cos(a) * radius * 0.93,
            at + radius * 0.17,
            Math.sin(a) * radius * 0.93,
            0.046,
            0.043,
            0.046,
            j % 2 ? P.blue : P.white,
            1,
          );
        }
      }
    }
  }
}

function mosque(p: ModelParts, detail: number) {
  box(p, 0, 0.08, 0, 1.83, 0.16, 1.71, P.pavement);
  box(p, 0, 0.52, -0.14, 1.38, 0.88, 1.15, P.plaster);
  box(p, 0, 0.99, -0.14, 1.51, 0.13, 1.29, P.gold);
  ball(p, 0, 1.12, -0.14, 0.5, 0.42, 0.5, P.gulf, detail);
  cyl(p, 0, 1.04, -0.14, 0.51, 0.13, P.gold, 0.51, 16, "metal");
  ball(p, 0, 1.57, -0.14, 0.045, 0.095, 0.045, P.gold, 0, "metal");
  cyl(p, 0.67, 0.98, 0.47, 0.072, 1.72, P.limestone, 0.095, 10);
  cone(p, 0.67, 1.97, 0.47, 0.14, 0.32, P.gulf);
  ball(p, 0.67, 1.73, 0.47, 0.14, 0.12, 0.14, P.gold, 0, "metal");
  if (detail === 0) {
    for (const x of [-0.48, 0, 0.48]) arch(p, x, 0.51, 0.447, 0.24, 0.54);
    for (const z of [-0.44, 0.02]) arch(p, -0.713, 0.53, z, 0.21, 0.47, -Math.PI / 2);
    for (let i = 0; i < 3; i += 1)
      cyl(p, 0.67, 1.35 + i * 0.19, 0.47, 0.11, 0.05, P.gold, 0.11, 10, "metal");
  }
}

function liberation(p: ModelParts, detail: number) {
  box(p, 0, 0.17, 0, 1.4, 0.34, 1.4, P.limestone);
  cyl(p, 0, 1.54, 0, 0.14, 2.8, P.paleStone, 0.28, 8);
  cyl(p, 0, 2.62, 0, 0.27, 0.44, P.gulf, 0.25, 12, "metal");
  cyl(p, 0, 2.9, 0, 0.19, 0.21, P.gold, 0.27, 12, "metal");
  cone(p, 0, 3.39, 0, 0.06, 0.91, P.paleStone, 8);
  if (detail < 2)
    for (let i = 0; i < (detail === 0 ? 4 : 1); i += 1)
      cyl(p, 0, 0.7 + i * 0.4, 0, 0.21 - i * 0.02, 0.055, P.gulf, 0.21 - i * 0.02, 8, "metal");
}

function palace(p: ModelParts, detail: number) {
  box(p, 0, 0.08, 0, 1.96, 0.16, 1.7, P.pavement);
  box(p, 0, 0.48, -0.12, 1.68, 0.78, 0.95, P.limestone);
  box(p, 0, 0.92, -0.12, 1.84, 0.14, 1.13, P.gulf);
  box(p, 0, 0.42, 0.51, 0.41, 0.68, 0.39, P.plaster);
  cyl(p, 0, 1.16, 0.46, 0.12, 0.9, P.limestone, 0.14, 12);
  cone(p, 0, 1.74, 0.46, 0.18, 0.28, P.gold);
  if (detail === 0) {
    for (const x of [-0.64, -0.34, 0.34, 0.64]) {
      arch(p, x, 0.54, 0.365, 0.18, 0.42);
      box(p, x, 0.14, 0.58, 0.15, 0.15, 0.24, P.paleStone);
    }
    for (let i = 0; i < 5; i += 1)
      box(p, -0.75 + i * 0.37, 1.04, -0.09, 0.14, 0.14, 0.13, P.paleStone);
    parapet(p, 1.96, 1.7, 0.21, P.gulf);
  }
}

export interface BoubyanProfile {
  radius: number;
  depth: number;
  x: number;
  y: number;
}
export function boubyanProfile(t: number, angle = 0): BoubyanProfile {
  const crown = Math.pow(Math.max(0, (t - 0.66) / 0.34), 1.4);
  return {
    radius: 0.63 - 0.14 * t,
    depth: 0.47 - 0.1 * t,
    x: Math.cos(angle) * (0.63 - 0.14 * t) - 0.04 + 0.18 * t,
    y: 0.54 + 3.65 * t + 0.52 * crown * (0.5 - 0.5 * Math.cos(angle)),
  };
}

function boubyan(p: ModelParts, detail: number) {
  // Volumetric interpretation of the original curved Boubyan reference.
  const segments = detail === 0 ? 32 : detail === 1 ? 20 : 12;
  const levels = detail === 0 ? 12 : detail === 1 ? 7 : 3;
  const point = (t: number, a: number) => {
    const sample = boubyanProfile(t, a);
    return new THREE.Vector3(sample.x, sample.y, Math.sin(a) * sample.depth);
  };

  const shell = (bucket: ModelBucket, tint: string) => {
    const verts: THREE.Vector3[] = [],
      indices: number[] = [];
    for (let f = 0; f < levels; f += 1)
      for (let i = 0; i < segments; i += 1) {
        const a = (i * Math.PI * 2) / segments,
          b = ((i + 1) * Math.PI * 2) / segments;
        const n = verts.length;
        verts.push(
          point(f / levels, a),
          point(f / levels, b),
          point((f + 1) / levels, a),
          point((f + 1) / levels, b),
        );
        indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        verts.flatMap((v) => v.toArray()),
        3,
      ),
    );
    geo.setIndex(indices);
    geo.computeVertexNormals();
    p[bucket].push(color(geo, tint));
  };
  const cap = (
    capPoint: (a: number) => THREE.Vector3,
    center: THREE.Vector3,
    upward: boolean,
    tint: string,
  ) => {
    const verts: number[] = [],
      indices: number[] = [];
    for (let i = 0; i < segments; i += 1) {
      verts.push(
        ...capPoint((i * Math.PI * 2) / segments).toArray(),
        ...capPoint(((i + 1) * Math.PI * 2) / segments).toArray(),
        ...center.toArray(),
      );
      indices.push(...(upward ? [i * 3, i * 3 + 2, i * 3 + 1] : [i * 3, i * 3 + 1, i * 3 + 2]));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    p.metal.push(color(g, tint));
  };
  shell("glass", P.boubyanGlass);
  const center = point(1, 0).add(point(1, Math.PI)).multiplyScalar(0.5);
  cap((a) => point(1, a), center, true, P.silver);
  cap((a) => point(0, a), new THREE.Vector3(-0.04, 0.54, 0), false, P.silver);
  box(p, 0, 0.19, 0, 1.94, 0.38, 1.59, P.paleStone);
  box(p, 0, 0.42, 0, 1.76, 0.14, 1.39, P.silver, "metal");
  box(p, -0.2, 0.32, 0.817, 0.62, 0.17, 0.033, P.glass, "glass");
  const fins = detail === 0 ? 28 : detail === 1 ? 16 : 8;
  for (let i = 0; i < fins; i += 1) {
    const a = (i * Math.PI * 2) / fins;
    const offset = new THREE.Vector3(Math.cos(a) * 0.026, 0, Math.sin(a) * 0.026);
    const bottom = point(0, a).add(offset),
      top = point(1, a).add(offset);
    const mid = bottom.clone().lerp(top, 0.5);
    const g = new THREE.BoxGeometry(0.023, top.distanceTo(bottom), 0.036);
    g.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        top.clone().sub(bottom).normalize(),
      ),
    );
    g.translate(mid.x, mid.y, mid.z);
    p.metal.push(color(g, P.silver));
  }
  for (const t of [0.54, 0.88]) {
    const g = new THREE.BoxGeometry(0.045, 0.05, 0.045);
    for (let i = 0; i < segments; i++) {
      const at = point(t, (i * Math.PI * 2) / segments);
      const band = g.clone();
      band.translate(at.x, at.y, at.z);
      p.metal.push(color(band, P.dark));
    }
    g.dispose();
  }
  if (detail < 2) {
    const front = point(0.94, Math.PI * 0.5);
    for (const x of [-0.065, 0.065]) {
      const arc = new THREE.TorusGeometry(0.065, 0.021, 4, 10, Math.PI * 1.28);
      arc.rotateZ(x > 0 ? 0.7 : -2.0);
      arc.translate(front.x + x, front.y - 0.17, front.z + 0.073);
      p.opaque.push(color(arc, P.red));
    }
    box(p, front.x, front.y - 0.3, front.z + 0.073, 0.27, 0.024, 0.018, P.white);
    for (const x of [-0.54, -0.2, 0.24, 0.56]) box(p, x, 0.49, -0.34, 0.19, 0.12, 0.22, P.dark);
  }
}

function push(p: ModelParts, g: Geo, tint: string, bucket: ModelBucket = "opaque") {
  if (!g.index) {
    const count = g.attributes.position!.count;
    g.setIndex(Array.from({ length: count }, (_, i) => i));
  }
  p[bucket].push(color(g, tint));
}

/** Open-ended ring with its outside (or inside) facing the viewer, scaled into an oval. */
function ring(
  p: ModelParts,
  profile: [number, number][],
  tint: string,
  segments: number,
  oval: number,
  bucket: ModelBucket = "opaque",
) {
  const g = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );
  g.scale(1, 1, oval);
  g.computeVertexNormals();
  push(p, g, tint, bucket);
}

function storeyBand(p: ModelParts, x: number, y: number, z: number, w: number, d: number) {
  // Night-lit ribbon windows on the two camera-facing facades.
  box(p, x, y, z + d / 2 + 0.012, w * 0.86, 0.07, 0.02, P.gold, "windows");
  box(p, x + w / 2 + 0.012, y, z, 0.02, 0.07, d * 0.86, P.gold, "windows");
}

function residentialSkyscraper(p: ModelParts, detail: number, level: number) {
  // Levels 4–5: a limestone-framed residential tower with continuous balconies.
  const floors = level >= 5 ? 14 : 11;
  const fh = 0.3;
  const base = 0.62;
  const w = 1.02,
    d = 0.9;
  const top = base + floors * fh;
  box(p, 0, 0.065, 0, 1.92, 0.13, 1.76, P.pavement);
  box(p, 0, 0.36, -0.02, 1.52, 0.46, 1.34, P.limestone);
  box(p, 0, 0.31, 0.66, 1.3, 0.3, 0.035, P.glass, "glass");
  box(p, 0.77, 0.31, -0.02, 0.035, 0.3, 1.1, P.glass, "glass");
  box(p, 0, 0.6, -0.02, 1.6, 0.05, 1.42, P.plaster);
  box(p, 0, (base + top) / 2, -0.05, w, top - base, d, P.glass, "glass");
  for (const x of [-w / 2, w / 2])
    for (const z of [-0.05 - d / 2, -0.05 + d / 2])
      box(p, x, (base + top) / 2, z, 0.17, top - base, 0.17, P.limestone);
  box(p, 0, (base + top) / 2, -0.05 + d / 2 + 0.01, 0.12, top - base, 0.06, P.limestone);
  box(p, w / 2 + 0.01, (base + top) / 2, -0.05, 0.06, top - base, 0.12, P.limestone);
  const step = detail === 2 ? 3 : 1;
  for (let f = 1; f <= floors; f += step) {
    const y = base + f * fh - 0.02;
    box(p, 0, y, -0.05, w + 0.14, 0.045, d + 0.14, P.plaster);
    if (detail === 0 && f % 2 === 0) storeyBand(p, -0.25, y - 0.15, -0.05, 0.36, d - 0.02);
    if (detail < 2) {
      box(p, 0, y + 0.07, -0.05 + d / 2 + 0.065, w + 0.1, 0.012, 0.012, P.white, "metal");
      box(p, w / 2 + 0.065, y + 0.07, -0.05, 0.012, 0.012, d + 0.1, P.white, "metal");
    }
  }
  if (level >= 5) {
    // Setback penthouse, open crown frame and a slim spire.
    const sw = 0.72,
      sd = 0.62,
      sh = 0.62;
    box(p, 0, top + sh / 2, -0.05, sw, sh, sd, P.glass, "glass");
    box(p, 0, top + 0.03, -0.05, w + 0.06, 0.06, d + 0.06, P.limestone);
    box(p, 0, top + sh + 0.03, -0.05, sw + 0.08, 0.06, sd + 0.08, P.limestone);
    for (const x of [-sw / 2, sw / 2])
      for (const z of [-0.05 - sd / 2, -0.05 + sd / 2])
        box(p, x, top + sh + 0.26, z, 0.07, 0.46, 0.07, P.limestone);
    box(p, 0, top + sh + 0.5, -0.05, sw + 0.08, 0.06, sd + 0.08, P.gold, "metal");
    cyl(p, 0, top + sh + 0.86, -0.05, 0.012, 0.72, P.silver, 0.04, 6, "metal");
    if (detail === 0) storeyBand(p, 0, top + 0.32, -0.05, sw, sd);
  } else {
    parapet(p, w + 0.06, d + 0.06, top + 0.05, P.limestone);
    if (detail === 0) {
      cyl(p, 0.2, top + 0.2, -0.2, 0.17, 0.32, P.white, 0.15, 12);
      box(p, -0.22, top + 0.12, 0.05, 0.3, 0.16, 0.24, P.pavement);
    }
  }
}

function retailSkyscraper(p: ModelParts, detail: number, level: number) {
  // Levels 4–5: a round blue-glass commercial tower on the souq-style shop podium.
  const floors = level >= 5 ? 13 : 10;
  const fh = 0.3;
  const base = 0.72;
  const top = base + floors * fh;
  const seg = detail === 0 ? 20 : detail === 1 ? 14 : 10;
  box(p, 0, 0.1, 0, 1.86, 0.2, 1.62, P.sand);
  box(p, 0, 0.44, -0.06, 1.6, 0.56, 1.32, P.paleStone);
  box(p, 0, 0.38, 0.61, 1.38, 0.38, 0.04, P.glass, "glass");
  box(p, 0.81, 0.38, -0.06, 0.04, 0.38, 1.12, P.glass, "glass");
  box(p, 0, 0.66, 0.66, 1.68, 0.12, 0.18, P.gulf);
  box(p, 0.86, 0.66, -0.06, 0.18, 0.12, 1.42, P.gulf);
  box(p, 0, 0.73, -0.06, 1.66, 0.06, 1.38, P.plaster);
  const g = new THREE.CylinderGeometry(0.52, 0.56, top - base, seg, 1);
  g.scale(1, 1, 0.86);
  g.translate(0, (base + top) / 2, -0.08);
  push(p, g, P.boubyanGlass, "glass");
  const step = detail === 2 ? 4 : 2;
  for (let f = 0; f <= floors; f += step) {
    const r = 0.565 - (0.04 * f) / floors;
    const band = new THREE.CylinderGeometry(r, r, 0.05, seg, 1);
    band.scale(1, 1, 0.86);
    band.translate(0, base + f * fh, -0.08);
    push(p, band, P.silver, "metal");
  }
  if (detail === 0)
    for (let f = 1; f < floors; f += 2) {
      const lit = new THREE.CylinderGeometry(0.55, 0.55, 0.06, seg, 1, true, 0, Math.PI / 2);
      lit.scale(1, 1, 0.86);
      lit.translate(0, base + f * fh + 0.15, -0.08);
      push(p, lit, P.gold, "windows");
    }
  if (detail < 2)
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      box(
        p,
        Math.sin(a) * 0.53,
        (base + top) / 2,
        -0.08 + Math.cos(a) * 0.46,
        0.04,
        top - base,
        0.04,
        P.silver,
        "metal",
      );
    }
  if (level >= 5) {
    // Tapered gold crown and a needle spire.
    const crown = new THREE.CylinderGeometry(0.2, 0.52, 0.55, seg, 1);
    crown.scale(1, 1, 0.86);
    crown.translate(0, top + 0.275, -0.08);
    push(p, crown, P.boubyanGlass, "glass");
    const lip = new THREE.CylinderGeometry(0.54, 0.54, 0.07, seg, 1);
    lip.scale(1, 1, 0.86);
    lip.translate(0, top + 0.02, -0.08);
    push(p, lip, P.gold, "metal");
    cyl(p, 0, top + 0.6, -0.08, 0.21, 0.08, P.gold, 0.21, seg, "metal");
    cyl(p, 0, top + 1.05, -0.08, 0.012, 0.86, P.silver, 0.05, 6, "metal");
  } else {
    const cap = new THREE.CylinderGeometry(0.5, 0.5, 0.08, seg, 1);
    cap.scale(1, 1, 0.86);
    cap.translate(0, top + 0.04, -0.08);
    push(p, cap, P.plaster);
    if (detail === 0) cyl(p, 0.1, top + 0.18, -0.1, 0.16, 0.2, P.dark, 0.16, 10, "metal");
  }
}

function officeSkyscraper(p: ModelParts, detail: number, level: number) {
  // Levels 4–5: a stepped dark-glass office tower with silver mullions.
  const tiers =
    level >= 5
      ? [
          { w: 1.2, d: 1.04, h: 2.3 },
          { w: 0.96, d: 0.84, h: 1.6 },
          { w: 0.7, d: 0.62, h: 0.95 },
        ]
      : [
          { w: 1.2, d: 1.04, h: 2.45 },
          { w: 0.94, d: 0.82, h: 1.3 },
        ];
  box(p, 0, 0.11, 0, 1.86, 0.22, 1.62, P.pavement);
  box(p, 0, 0.36, -0.02, 1.4, 0.3, 1.24, P.plaster);
  box(p, 0, 0.34, 0.6, 1.1, 0.22, 0.035, P.glass, "glass");
  let y = 0.5;
  for (const t of tiers) {
    box(p, 0, y + t.h / 2, -0.02, t.w, t.h, t.d, P.deepGlass, "glass");
    const cols = detail === 2 ? 1 : 3;
    for (let i = 0; i <= cols + 1; i += 1) {
      const u = -0.5 + i / (cols + 1);
      box(p, u * t.w, y + t.h / 2, -0.02 + t.d / 2 + 0.012, 0.035, t.h, 0.03, P.silver, "metal");
      box(p, t.w / 2 + 0.012, y + t.h / 2, -0.02 + u * t.d, 0.03, t.h, 0.035, P.silver, "metal");
    }
    const bands = detail === 0 ? Math.round(t.h / 0.42) : detail === 1 ? 2 : 0;
    for (let b = 1; b <= bands; b += 1) {
      const by = y + (b * t.h) / (bands + 1);
      box(p, 0, by, -0.02, t.w + 0.03, 0.035, t.d + 0.03, P.silver, "metal");
      if (detail === 0) storeyBand(p, 0, by + 0.12, -0.02, t.w - 0.08, t.d - 0.02);
    }
    y += t.h;
    box(p, 0, y + 0.04, -0.02, t.w + 0.06, 0.08, t.d + 0.06, P.plaster);
    y += 0.08;
  }
  const last = tiers[tiers.length - 1]!;
  if (level >= 5) {
    // Pyramidal crown with a lit band and a tall mast: the city's showpiece office.
    const cap = new THREE.ConeGeometry(Math.hypot(last.w, last.d) / 2, 0.75, 4, 1);
    cap.rotateY(Math.PI / 4);
    cap.scale(1, 1, last.d / last.w);
    cap.translate(0, y + 0.375, -0.02);
    push(p, cap, P.deepGlass, "glass");
    box(p, 0, y + 0.03, -0.02, last.w + 0.02, 0.06, last.d + 0.02, P.gold, "metal");
    cyl(p, 0, y + 1.25, -0.02, 0.014, 1.15, P.silver, 0.05, 6, "metal");
    if (detail < 2) ball(p, 0, y + 1.84, -0.02, 0.04, 0.04, 0.04, P.red, detail, "metal");
  } else {
    parapet(p, last.w + 0.06, last.d + 0.06, y + 0.05, P.plaster);
    box(p, 0, y + 0.04, -0.02, last.w - 0.1, 0.03, last.d - 0.1, P.asphalt);
    cyl(p, -0.12, y + 0.06, -0.02, 0.26, 0.016, P.gold, 0.26, 20);
    if (detail === 0) {
      box(p, 0.25, y + 0.15, -0.25, 0.22, 0.16, 0.18, P.dark);
      cyl(p, 0.3, y + 0.42, 0.22, 0.012, 0.6, P.silver, 0.03, 6, "metal");
    }
  }
}

function chalet(p: ModelParts, detail: number) {
  // Beach chalet: low white villa, pergola terrace, turquoise pool, umbrella and palm.
  box(p, 0, 0.04, 0, 2.06, 0.08, 2.0, P.sand);
  box(p, 0.08, 0.1, 0.12, 1.84, 0.05, 1.7, P.paleStone);
  // Villa wraps the back corner; glass faces the pool and the sea.
  box(p, -0.32, 0.43, -0.48, 1.32, 0.62, 0.78, P.white);
  box(p, -0.66, 0.43, 0.2, 0.64, 0.62, 0.62, P.white);
  box(p, -0.32, 0.765, -0.48, 1.4, 0.05, 0.86, P.plaster);
  box(p, -0.66, 0.765, 0.2, 0.72, 0.05, 0.7, P.plaster);
  box(p, -0.2, 0.39, -0.083, 0.96, 0.48, 0.03, P.glass, "glass");
  box(p, -0.333, 0.39, 0.22, 0.03, 0.48, 0.5, P.glass, "glass");
  box(p, -0.5, 1.0, -0.6, 0.72, 0.42, 0.5, P.white);
  box(p, -0.5, 1.23, -0.6, 0.8, 0.045, 0.58, P.plaster);
  box(p, -0.32, 1.0, -0.344, 0.32, 0.3, 0.025, P.glass, "glass");
  box(p, -0.14, 1.0, -0.6, 0.025, 0.3, 0.32, P.glass, "glass");
  if (detail < 2) {
    // Roof terrace railing and timber pergola over the pool deck.
    box(p, -0.32, 0.84, -0.06, 1.38, 0.1, 0.03, P.white);
    box(p, 0.36, 0.84, -0.48, 0.03, 0.1, 0.84, P.white);
    for (const x of [0.42, 0.9])
      for (const z of [-0.22, -0.8]) cyl(p, x, 0.42, z, 0.022, 0.6, P.wood, 0.022, 6);
    for (const z of [-0.22, -0.8]) box(p, 0.66, 0.73, z, 0.56, 0.035, 0.035, P.wood);
    const slats = detail === 0 ? 7 : 3;
    for (let i = 0; i < slats; i += 1)
      box(p, 0.42 + (i * 0.48) / (slats - 1), 0.765, -0.51, 0.03, 0.03, 0.66, P.wood);
    box(p, 0.66, 0.16, -0.51, 0.4, 0.07, 0.42, P.canvas);
    box(p, 0.66, 0.22, -0.7, 0.4, 0.1, 0.05, P.red);
    box(p, 0.66, 0.17, -0.47, 0.16, 0.04, 0.12, P.wood);
    window(p, -0.66, 0.42, 0.524, 0.3, 0.36);
    box(p, -0.66, 0.25, 0.56, 0.24, 0.02, 0.1, P.wood);
  }
  // Pool with white coping.
  box(p, 0.42, 0.135, 0.42, 0.98, 0.04, 0.78, P.white);
  box(p, 0.42, 0.158, 0.42, 0.86, 0.02, 0.66, P.pool, "glass");
  if (detail < 2) {
    // Umbrella and loungers.
    cyl(p, -0.26, 0.38, 0.62, 0.012, 0.52, P.wood, 0.012, 5);
    cone(p, -0.26, 0.66, 0.62, 0.3, 0.12, P.red, detail === 0 ? 10 : 6);
    for (const x of [-0.12, -0.42]) {
      box(p, x, 0.16, 0.86, 0.14, 0.04, 0.3, P.white);
      box(p, x, 0.2, 0.75, 0.14, 0.08, 0.04, P.white);
    }
    palm(p, 0.86, -0.62, 0.78);
  }
  if (detail === 0) {
    palm(p, -0.88, 0.82, 0.6);
    box(p, 0.42, 0.17, 0.82, 0.06, 0.06, 0.06, P.gold, "windows");
    box(p, 0.93, 0.13, 0.42, 0.04, 0.03, 0.2, P.silver, "metal");
    ball(p, 0.75, 0.16, 0.9, 0.06, 0.06, 0.06, P.leafLight, detail);
  }
}

function hamra(p: ModelParts, detail: number) {
  // Al Hamra Tower: limestone-clad tower whose shell is carved away in a twisting
  // cut, exposing the glass core, with a sloping, sculpted crown.
  const cx = -0.08,
    cz = -0.08;
  box(p, 0, 0.08, 0, 1.94, 0.16, 1.86, P.pavement);
  box(p, -0.08, 0.36, -0.12, 1.6, 0.42, 1.44, P.limestone);
  box(p, -0.08, 0.31, 0.605, 1.3, 0.28, 0.035, P.glass, "glass");
  box(p, 0.725, 0.31, -0.12, 0.035, 0.28, 1.1, P.glass, "glass");
  box(p, -0.08, 0.6, -0.12, 1.66, 0.06, 1.5, P.paleStone);
  const base = 0.62,
    height = 5.6;
  const slices = detail === 0 ? 24 : detail === 1 ? 12 : 6;
  const seg = detail === 0 ? 20 : detail === 1 ? 14 : 8;
  const radius = (t: number) => 0.6 - 0.06 * t + 0.04 * Math.pow(t, 3);
  const oval = 0.84;
  const shell = (
    y: number,
    h: number,
    rTop: number,
    rBottom: number,
    start: number,
    len: number,
  ) => {
    const g = new THREE.CylinderGeometry(
      rTop,
      rBottom,
      h,
      Math.max(3, Math.round((seg * len) / (Math.PI * 2))),
      1,
      false,
      start,
      len,
    );
    g.scale(1, 1, oval);
    g.translate(cx, y, cz);
    push(p, g, P.limestone);
  };
  // Glass core visible through the carved cut.
  const coreTop = height;
  const core = new THREE.CylinderGeometry(0.4, 0.44, coreTop, seg, 1);
  core.scale(1, 1, oval);
  core.translate(cx, base + coreTop / 2, cz);
  push(p, core, P.deepGlass, "glass");
  if (detail < 2) {
    const floors = detail === 0 ? 20 : 8;
    for (let f = 1; f < floors; f += 1) {
      const y = base + (f / floors) * coreTop;
      const r = 0.412 + 0.04 * (1 - f / floors);
      const line = new THREE.CylinderGeometry(r, r, 0.03, seg, 1, true);
      line.scale(1, 1, oval);
      line.translate(cx, y, cz);
      push(p, line, P.gold, "windows");
    }
  }
  const dh = height / slices;
  let topCentre = 0;
  for (let i = 0; i < slices; i += 1) {
    const t0 = i / slices,
      t1 = (i + 1) / slices,
      t = (t0 + t1) / 2;
    // The cut faces the camera at the base and twists around the corner as it rises.
    const centre = -0.2 + 1.9 * t;
    const width = 0.8 + 0.9 * t;
    topCentre = centre;
    shell(
      base + t * height,
      dh + 0.003,
      radius(t1),
      radius(t0),
      centre + width / 2,
      Math.PI * 2 - width,
    );
  }
  // Sloping crown: a stone cap whose top is cut on a steep plane, rising at the
  // back, giving Al Hamra's angled summit; the cut face is glazed.
  const back = topCentre + Math.PI;
  const r1 = radius(1);
  const top = base + height;
  const rise = 1.0;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < seg; i += 1) {
    const a = (i / seg) * Math.PI * 2;
    const x = cx + Math.sin(a) * r1,
      z = cz + Math.cos(a) * r1 * oval;
    pts.push(new THREE.Vector3(x, top - 0.02, z));
    pts.push(new THREE.Vector3(x, top + 0.12 + rise * (0.5 + 0.5 * Math.cos(a - back)), z));
  }
  const crown = new ConvexGeometry(pts);
  push(p, crown, P.limestone);
  const ccol = crown.attributes.color!;
  const cpos = crown.attributes.position!;
  const glassTint = new THREE.Color(P.deepGlass);
  const va = new THREE.Vector3(),
    vb = new THREE.Vector3(),
    vc = new THREE.Vector3();
  for (let f = 0; f < cpos.count / 3; f += 1) {
    va.fromBufferAttribute(cpos, f * 3);
    vb.fromBufferAttribute(cpos, f * 3 + 1);
    vc.fromBufferAttribute(cpos, f * 3 + 2);
    const n = vb.sub(va).cross(vc.sub(va)).normalize();
    if (n.y > 0.3)
      for (let k = 0; k < 3; k += 1) ccol.setXYZ(f * 3 + k, glassTint.r, glassTint.g, glassTint.b);
  }
  if (detail < 2) {
    // Mast rising from the high back edge of the crown.
    const lip = new THREE.Vector3(Math.sin(back) * r1, 0, Math.cos(back) * r1 * oval);
    cyl(
      p,
      cx + lip.x * 0.8,
      top + rise + 0.5,
      cz + lip.z * 0.8,
      0.012,
      0.8,
      P.silver,
      0.035,
      6,
      "metal",
    );
  }
  if (detail === 0) {
    // Plaza: palms and a water feature in front of the entrance.
    palm(p, 0.78, 0.78, 0.6);
    palm(p, -0.85, 0.82, 0.55);
    box(p, 0.15, 0.17, 0.8, 0.6, 0.03, 0.18, P.pool, "glass");
  }
}

function avenues(p: ModelParts, detail: number) {
  // The Avenues: a vast low mall whose galleria streets are covered by glass
  // barrel vaults meeting under a glazed central dome.
  box(p, 0, 0.05, 0, 2.12, 0.1, 2.12, P.pavement);
  const gap = 0.36;
  const half = 1.0;
  const q = (half - gap / 2) / 2 + gap / 2;
  const s = half - gap / 2;
  const blocks = [
    { x: -q, z: -q, h: 0.62, tint: P.limestone },
    { x: -q, z: q, h: 0.48, tint: P.plaster },
    { x: q, z: -q, h: 0.48, tint: P.plaster },
    { x: q, z: q, h: 0.5, tint: P.white },
  ];
  for (const b of blocks) {
    box(p, b.x, 0.1 + b.h / 2, b.z, s, b.h, s, b.tint);
    box(p, b.x, 0.1 + b.h + 0.03, b.z, s + 0.04, 0.06, s + 0.04, P.paleStone);
    if (detail === 0) {
      box(p, b.x - 0.12, 0.1 + b.h + 0.12, b.z - 0.1, 0.26, 0.12, 0.18, P.silver, "metal");
      box(p, b.x + 0.16, 0.1 + b.h + 0.1, b.z + 0.12, 0.14, 0.08, 0.14, P.pavement);
    }
  }
  // Galleria floor between the blocks.
  box(p, 0, 0.12, 0, gap, 0.04, 2.0, P.paleStone);
  box(p, 0, 0.121, 0, 2.0, 0.04, gap, P.paleStone);
  const seg = detail === 0 ? 10 : 6;
  const vaultY = 0.58;
  for (const alongX of [true, false])
    for (const side of [-1, 1]) {
      const len = s;
      const g = new THREE.CylinderGeometry(
        gap / 2 + 0.02,
        gap / 2 + 0.02,
        len,
        seg,
        1,
        false,
        -Math.PI / 2,
        Math.PI,
      );
      g.rotateX(-Math.PI / 2);
      if (alongX) g.rotateY(Math.PI / 2);
      const off = side * (gap / 2 + len / 2);
      g.translate(alongX ? off : 0, vaultY, alongX ? 0 : off);
      push(p, g, P.skylight, "glass");
      // Walls carrying the vault above the shop roofs (clerestory).
      for (const w of [-1, 1]) {
        const wall = new THREE.BoxGeometry(alongX ? len : 0.04, vaultY - 0.12, alongX ? 0.04 : len);
        wall.translate(
          alongX ? off : (w * (gap + 0.04)) / 2,
          0.12 + (vaultY - 0.12) / 2,
          alongX ? (w * (gap + 0.04)) / 2 : off,
        );
        push(p, wall, P.paleStone);
      }
      if (detail < 2) {
        const ribs = detail === 0 ? 5 : 2;
        for (let i = 0; i <= ribs; i += 1) {
          const at = off - len / 2 + (i * len) / ribs;
          const rib = new THREE.TorusGeometry(gap / 2 + 0.025, 0.012, 4, seg, Math.PI);
          if (alongX) rib.rotateY(Math.PI / 2);
          rib.translate(alongX ? at : 0, vaultY, alongX ? 0 : at);
          push(p, rib, P.white);
        }
      }
    }
  // Central glazed dome on a drum.
  cyl(p, 0, vaultY + 0.02, 0, gap * 0.78, 0.16, P.white, gap * 0.78, 16);
  const dome = new THREE.SphereGeometry(
    gap * 0.74,
    detail === 0 ? 16 : 10,
    6,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2,
  );
  dome.scale(1, 0.8, 1);
  dome.translate(0, vaultY + 0.1, 0);
  push(p, dome, P.skylight, "glass");
  ball(p, 0, vaultY + 0.38, 0, 0.03, 0.03, 0.03, P.gold, 1, "metal");
  // Grand entrances with canopies and signage on the camera-facing facades.
  for (const [x, z, ry] of [
    [0, 1.02, 0],
    [1.02, 0, Math.PI / 2],
  ] as const) {
    const ent = new THREE.BoxGeometry(gap + 0.06, 0.36, 0.05);
    ent.rotateY(ry);
    ent.translate(x, 0.3, z);
    push(p, ent, P.glass, "glass");
    const cano = new THREE.BoxGeometry(gap + 0.3, 0.04, 0.22);
    cano.rotateY(ry);
    cano.translate(x * 1.02, 0.5, z * 1.02);
    push(p, cano, P.white);
    const sign = new THREE.BoxGeometry(gap - 0.04, 0.07, 0.03);
    sign.rotateY(ry);
    sign.translate(x * 1.005, 0.56, z * 1.005);
    push(p, sign, P.gold, "windows");
  }
  if (detail < 2) {
    // Shopfront glazing along the outer facades.
    for (const c of [-q, q]) {
      box(p, c, 0.26, 1.004, s * 0.82, 0.18, 0.02, P.glass, "glass");
      box(p, 1.004, 0.26, c, 0.02, 0.18, s * 0.82, P.glass, "glass");
      box(p, c, 0.4, 1.012, s * 0.86, 0.03, 0.06, P.gulf);
      box(p, 1.012, 0.4, c, 0.06, 0.03, s * 0.86, P.gulf);
    }
  }
  if (detail === 0)
    for (const [x, z] of [
      [-0.95, 1.0],
      [1.0, -0.95],
      [0.98, 0.98],
    ] as const)
      palm(p, x, z, 0.45);
}

function opera(p: ModelParts, detail: number) {
  // Sheikh Jaber Al-Ahmad Cultural Centre: angular faceted volumes clad in a
  // white geometric lattice, raised on glass lobbies around a reflecting pool.
  box(p, 0, 0.06, 0, 2.0, 0.12, 1.96, P.pavement);
  box(p, 0.4, 0.13, 0.42, 0.66, 0.03, 0.52, P.pool, "glass");
  const all = [
    { x: -0.32, z: -0.3, w: 1.08, d: 0.84, h: 1.35, tilt: 0.42, rot: 0.15 },
    { x: 0.5, z: -0.42, w: 0.72, d: 0.62, h: 1.0, tilt: -0.38, rot: 0.6 },
    { x: -0.42, z: 0.52, w: 0.72, d: 0.56, h: 0.8, tilt: 0.36, rot: -0.3 },
    { x: 0.66, z: 0.68, w: 0.44, d: 0.4, h: 0.55, tilt: -0.3, rot: 0.4 },
  ];
  const volumes = detail === 2 ? all.slice(0, 3) : all;
  const lobby = 0.15;
  const view = new THREE.Vector3(1, 0.9, 1).normalize();
  for (const v of volumes) {
    box(p, v.x, 0.12 + lobby / 2, v.z, v.w * 0.62, lobby, v.d * 0.62, P.glass, "glass");
    const y0 = 0.12 + lobby;
    // Cut-crystal volume: a pentagon waist that flares out, then a sharply
    // tilted roof.
    const pts: THREE.Vector3[] = [];
    const ring = (n: number, sx: number, sz: number, y: number, slope: number, rot: number) => {
      for (let i = 0; i < n; i += 1) {
        const a = v.rot + rot + (i / n) * Math.PI * 2;
        const px = Math.cos(a) * sx,
          pz = Math.sin(a) * sz;
        pts.push(new THREE.Vector3(v.x + px, y + slope * (px / sx), v.z + pz));
      }
    };
    ring(4, v.w * 0.4, v.d * 0.4, y0, 0, 0);
    ring(5, v.w * 0.52, v.d * 0.52, y0 + v.h * 0.36, 0, Math.PI / 5);
    ring(3, v.w * 0.32, v.d * 0.3, y0 + v.h * 0.8, v.h * v.tilt * 0.6, 0.3);
    const hull = new ConvexGeometry(pts);
    const faces = hull.attributes.position!.count / 3;
    push(p, hull, P.white);
    const col = hull.attributes.color!;
    const pos = hull.attributes.position!;
    const tints = [
      new THREE.Color(P.white),
      new THREE.Color(P.plaster),
      new THREE.Color("#e9ecea"),
    ];
    const a = new THREE.Vector3(),
      b = new THREE.Vector3(),
      c = new THREE.Vector3();
    const seen = new Set<string>();
    for (let f = 0; f < faces; f += 1) {
      const tint = tints[f % 3]!;
      for (let k = 0; k < 3; k += 1) col.setXYZ(f * 3 + k, tint.r, tint.g, tint.b);
      if (detail === 2) continue;
      a.fromBufferAttribute(pos, f * 3);
      b.fromBufferAttribute(pos, f * 3 + 1);
      c.fromBufferAttribute(pos, f * 3 + 2);
      const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
      if (normal.dot(view) < 0.05) continue;
      // Lattice: ribs on the facet edges plus, at full detail, a rib from each
      // corner to the opposite edge, breaking every facet into a triangle mesh.
      const edges: [THREE.Vector3, THREE.Vector3][] = [
        [a, b],
        [b, c],
        [c, a],
      ];
      if (detail === 0) {
        const centre = a.clone().add(b).add(c).divideScalar(3);
        edges.push([a.clone(), centre], [b.clone(), centre.clone()], [c.clone(), centre.clone()]);
      }
      for (const [u, w] of edges) {
        const key = [u, w]
          .map((q) =>
            q
              .toArray()
              .map((n) => n.toFixed(3))
              .join(","),
          )
          .sort()
          .join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        const rib = new THREE.BoxGeometry(0.016, u.distanceTo(w), 0.016);
        rib.applyQuaternion(
          new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            w.clone().sub(u).normalize(),
          ),
        );
        const mid = u.clone().lerp(w, 0.5).addScaledVector(normal, 0.006);
        rib.translate(mid.x, mid.y, mid.z);
        push(p, rib, P.silver);
      }
    }
  }
  if (detail < 2) {
    // Glass bridges linking the halls and lit plaza lamps.
    box(p, 0.12, 0.4, -0.38, 0.3, 0.1, 0.12, P.glass, "glass");
    box(p, -0.38, 0.36, 0.14, 0.12, 0.1, 0.28, P.glass, "glass");
    for (const [x, z] of [
      [0.24, 0.0],
      [0.0, 0.68],
      [0.86, 0.1],
    ] as const) {
      box(p, x, 0.21, z, 0.012, 0.18, 0.012, P.dark, "metal");
      box(p, x, 0.31, z, 0.04, 0.04, 0.04, P.gold, "windows");
    }
  }
  if (detail === 0) {
    palm(p, 0.9, -0.88, 0.5);
    palm(p, 0.08, 0.9, 0.45);
    palm(p, -0.9, 0.05, 0.45);
  }
}

function mubarakiya(p: ModelParts, detail: number) {
  // Souq Al-Mubarakiya: low clay-and-stone shops with arcades, covered alleys
  // under timber and palm-frond roofs, cloth awnings, lanterns and goods.
  box(p, 0, 0.05, 0, 2.0, 0.1, 1.96, P.pavement);
  const h = 0.48;
  const alley = 0.3;
  const blocks = [
    { x: -0.55, z: -0.55, w: 0.78, d: 0.74, h: 0.56, tint: P.clay },
    { x: 0.55, z: -0.55, w: 0.78, d: 0.74, h: 0.48, tint: P.limestone },
    { x: -0.55, z: 0.55, w: 0.78, d: 0.7, h: 0.48, tint: P.limestone },
    { x: 0.55, z: 0.55, w: 0.78, d: 0.7, h: 0.42, tint: P.clay },
  ];
  for (const b of blocks) {
    box(p, b.x, 0.1 + b.h / 2, b.z, b.w, b.h, b.d, b.tint);
    box(p, b.x, 0.1 + b.h + 0.025, b.z, b.w + 0.03, 0.05, b.d + 0.03, P.paleStone);
    if (detail < 2) {
      // Arcades of pointed arches on every facade the camera sees.
      const n = detail === 0 ? 3 : 2;
      for (let i = 0; i < n; i += 1) {
        const t = (i + 0.5) / n - 0.5;
        arch(p, b.x + t * b.w, 0.27, b.z + b.d / 2 - 0.005, 0.17, 0.28);
        arch(p, b.x + b.w / 2 - 0.03, 0.27, b.z + t * b.d, 0.17, 0.28, Math.PI / 2);
      }
      for (let i = 0; i <= n; i += 1) {
        const t = i / n - 0.5;
        box(p, b.x + t * b.w, 0.25, b.z + b.d / 2 + 0.025, 0.05, 0.3, 0.05, P.paleStone);
        box(p, b.x + b.w / 2 + 0.025, 0.25, b.z + t * b.d, 0.05, 0.3, 0.05, P.paleStone);
      }
    }
    if (detail === 0) {
      // Low roof parapet and wooden mashrabiya windows above the arcade.
      box(p, b.x, 0.1 + b.h + 0.08, b.z + b.d / 2, b.w + 0.03, 0.07, 0.04, P.paleStone);
      box(p, b.x + b.w / 2, 0.1 + b.h + 0.08, b.z, 0.04, 0.07, b.d + 0.03, P.paleStone);
      box(p, b.x, 0.1 + b.h - 0.07, b.z + b.d / 2 + 0.015, 0.2, 0.08, 0.03, P.wood);
      box(p, b.x + b.w / 2 + 0.015, 0.1 + b.h - 0.07, b.z, 0.03, 0.08, 0.2, P.wood);
      box(p, b.x - 0.18, 0.1 + b.h + 0.1, b.z - 0.16, 0.14, 0.15, 0.14, P.paleStone);
      box(p, b.x - 0.18, 0.1 + b.h + 0.12, b.z - 0.088, 0.09, 0.07, 0.02, P.wood);
    }
  }
  // Covered alleys: raised timber roofs with palm-frond panels over the lanes.
  const roofY = 0.1 + h + 0.1;
  for (const alongX of [true, false]) {
    const g = new THREE.BoxGeometry(
      alongX ? 1.96 : alley + 0.06,
      0.03,
      alongX ? alley + 0.06 : 1.96,
    );
    g.translate(0, roofY + (alongX ? 0 : 0.012), 0);
    push(p, g, P.canvas);
  }
  const beams = detail === 0 ? 8 : detail === 1 ? 5 : 3;
  for (let i = 0; i < beams; i += 1) {
    const t = ((i + 0.5) / beams - 0.5) * 1.9;
    if (Math.abs(t) < alley / 2 + 0.03) continue;
    box(p, 0, roofY + 0.03, t, alley + 0.1, 0.03, 0.035, P.wood);
    box(p, t, roofY + 0.04, 0, 0.035, 0.03, alley + 0.1, P.wood);
  }
  // Timber posts carrying the alley roof at the open ends.
  for (const e of [-0.97, 0.97])
    for (const w of [-1, 1]) {
      box(p, e, roofY / 2 + 0.05, (w * alley) / 2, 0.04, roofY - 0.1, 0.04, P.wood);
      box(p, (w * alley) / 2, roofY / 2 + 0.05, e, 0.04, roofY - 0.1, 0.04, P.wood);
    }
  // Gateway on the front alley: a stone arch crowned with crenellations.
  box(p, 0, 0.47, 1.0, alley + 0.26, 0.74, 0.1, P.limestone);
  box(p, 0, 0.36, 1.052, alley - 0.04, 0.46, 0.012, P.dark);
  arch(p, 0, 0.36, 1.052, alley - 0.04, 0.48);
  if (detail < 2) toothParapet(p, 0, 1.0, 0.92, alley + 0.26, 0.1, 0);
  if (detail < 2) {
    // Cloth awnings over the shopfronts and lanterns along the lanes.
    const awn = [P.red, P.gulf, P.gold, P.red];
    blocks.forEach((b, i) => {
      box(p, b.x, 0.45, b.z + b.d / 2 + 0.08, b.w * 0.9, 0.022, 0.14, awn[i]!);
      box(p, b.x + b.w / 2 + 0.08, 0.45, b.z, 0.14, 0.022, b.d * 0.9, awn[(i + 1) % 4]!);
    });
    const lamps = detail === 0 ? 5 : 3;
    for (let i = 0; i < lamps; i += 1) {
      const t = ((i + 0.5) / lamps - 0.5) * 1.7;
      if (Math.abs(t) < 0.1) continue;
      box(p, 0, roofY - 0.12, t, 0.045, 0.06, 0.045, P.gold, "windows");
      box(p, t, roofY - 0.12, 0, 0.045, 0.06, 0.045, P.gold, "windows");
    }
  }
  if (detail === 0) {
    // Sacks and crates of spices, dates and fabric spilling into the lanes.
    const goods = [P.red, P.gold, P.sand, P.trunk, P.leafLight, P.red, P.gold];
    goods.forEach((g, i) => {
      const side = i % 2 ? 1 : -1;
      const t = -0.8 + i * 0.27;
      if (i < 4) box(p, t, 0.15, side * 0.09, 0.08, 0.09, 0.08, g);
      else box(p, side * 0.09, 0.15, t, 0.08, 0.09, 0.08, g);
    });
    ball(p, 0.09, 0.16, 0.6, 0.06, 0.05, 0.06, P.gold, detail);
    ball(p, -0.09, 0.16, -0.4, 0.06, 0.05, 0.06, P.red, detail);
  }
}

function stadium(p: ModelParts, detail: number) {
  // Jaber Al-Ahmad International Stadium: oval bowl wrapped in white fins,
  // two seating tiers, ring roof canopy and a floodlit green pitch.
  const seg = detail === 0 ? 40 : detail === 1 ? 28 : 18;
  const oval = 0.8;
  const base = new THREE.CylinderGeometry(1.06, 1.06, 0.1, seg, 1);
  base.scale(1, 1, oval);
  base.translate(0, 0.05, 0);
  push(p, base, P.pavement);
  // Outer facade: profile listed bottom → top so the faces point outward.
  ring(
    p,
    [
      [0.99, 0.1],
      [1.01, 0.3],
      [0.99, 0.5],
    ],
    P.white,
    seg,
    oval,
  );
  // Seating tiers: listed top → bottom so the faces point in toward the pitch.
  ring(
    p,
    [
      [0.99, 0.5],
      [0.86, 0.34],
    ],
    P.red,
    seg,
    oval,
  );
  ring(
    p,
    [
      [0.86, 0.34],
      [0.83, 0.32],
    ],
    P.white,
    seg,
    oval,
  );
  ring(
    p,
    [
      [0.83, 0.32],
      [0.7, 0.15],
    ],
    P.blue,
    seg,
    oval,
  );
  // Running track and pitch.
  const track = new THREE.CylinderGeometry(0.71, 0.71, 0.04, seg, 1);
  track.scale(1, 1, oval);
  track.translate(0, 0.13, 0);
  push(p, track, P.track);
  box(p, 0, 0.155, 0, 0.9, 0.02, 0.54, P.pitch);
  if (detail < 2) {
    for (let i = 0; i < 6; i += 1)
      if (i % 2) box(p, -0.375 + i * 0.15, 0.166, 0, 0.15, 0.004, 0.54, P.leafLight);
    box(p, 0, 0.168, 0, 0.012, 0.004, 0.54, P.white);
    const lines = [
      [0, 0.27, 0.9, 0.012],
      [0, -0.27, 0.9, 0.012],
      [0.45, 0, 0.012, 0.54],
      [-0.45, 0, 0.012, 0.54],
    ] as const;
    for (const [x, z, w, d] of lines) box(p, x, 0.168, z, w, 0.004, d, P.white);
    const centre = new THREE.TorusGeometry(0.08, 0.006, 3, 16);
    centre.rotateX(Math.PI / 2);
    centre.translate(0, 0.168, 0);
    push(p, centre, P.white);
    for (const x of [-0.45, 0.45]) box(p, x, 0.2, 0, 0.012, 0.06, 0.12, P.white);
  }
  // Ring roof canopy: listed outer → inner so its top faces upward.
  ring(
    p,
    [
      [1.05, 0.56],
      [0.9, 0.62],
    ],
    P.white,
    seg,
    oval,
  );
  ring(
    p,
    [
      [0.9, 0.62],
      [0.9, 0.59],
      [1.05, 0.53],
    ],
    P.paleStone,
    seg,
    oval,
  );
  const ribs = detail === 0 ? 28 : detail === 1 ? 14 : 0;
  for (let i = 0; i < ribs; i += 1) {
    const a = (i / ribs) * Math.PI * 2;
    // Facade fin plus a radial roof truss for each structural bay.
    const fin = new THREE.BoxGeometry(0.03, 0.44, 0.05);
    fin.rotateY(a);
    fin.translate(Math.sin(a) * 1.02, 0.32, Math.cos(a) * 1.02 * oval);
    push(p, fin, P.white);
    const from = new THREE.Vector3(Math.sin(a) * 1.05, 0.58, Math.cos(a) * 1.05 * oval);
    const to = new THREE.Vector3(Math.sin(a) * 0.9, 0.645, Math.cos(a) * 0.9 * oval);
    const truss = new THREE.BoxGeometry(0.02, from.distanceTo(to), 0.02);
    truss.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        to.clone().sub(from).normalize(),
      ),
    );
    const mid = from.clone().lerp(to, 0.5);
    truss.translate(mid.x, mid.y, mid.z);
    push(p, truss, P.silver, "metal");
  }
  if (detail < 2) {
    // Floodlight strips under the roof's inner edge.
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const g = new THREE.BoxGeometry(0.16, 0.03, 0.03);
      g.rotateY(a + Math.PI / 2);
      g.translate(Math.sin(a) * 0.9, 0.58, Math.cos(a) * 0.9 * oval);
      push(p, g, P.gold, "windows");
    }
  }
}

const cache = new Map<string, BuildingModel>();

export function buildingModel(kind: Kind, level: number, detail: 0 | 1 | 2): BuildingModel {
  const key = `${kind}:${level}:${detail}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const p = emptyParts();
  switch (kind) {
    case "villa":
      villa(p, detail);
      break;
    case "modern":
      modern(p, detail);
      break;
    case "apartments":
      if (level >= 4) residentialSkyscraper(p, detail, level);
      else apartments(p, detail, level);
      break;
    case "shop":
      if (level >= 4) retailSkyscraper(p, detail, level);
      else shop(p, detail);
      break;
    case "tower":
      if (level >= 4) officeSkyscraper(p, detail, level);
      else tower(p, detail, level);
      break;
    case "power":
      power(p, detail);
      break;
    case "water":
      water(p, detail);
      break;
    case "police":
    case "clinic":
    case "school":
    case "fire":
      civic(p, kind, detail);
      break;
    case "park":
      park(p, detail);
      break;
    case "kuwait":
      kuwait(p, detail);
      break;
    case "mosque":
      mosque(p, detail);
      break;
    case "liberation":
      liberation(p, detail);
      break;
    case "palace":
      palace(p, detail);
      break;
    case "boubyan":
      boubyan(p, detail);
      break;
    case "chalet":
      chalet(p, detail);
      break;
    case "hamra":
      hamra(p, detail);
      break;
    case "avenues":
      avenues(p, detail);
      break;
    case "opera":
      opera(p, detail);
      break;
    case "mubarakiya":
      mubarakiya(p, detail);
      break;
    case "stadium":
      stadium(p, detail);
      break;
  }
  const merge = (list: Geo[]) => {
    // Mixed indexed/non-indexed parts (e.g. extruded arches beside boxes) cannot
    // be merged, so give every part an index first.
    for (const item of list)
      if (!item.index)
        item.setIndex(Array.from({ length: item.attributes.position!.count }, (_, i) => i));
    const geo =
      mergeGeometries(list.length ? list : [new THREE.BoxGeometry(0, 0, 0)], false) ??
      new THREE.BoxGeometry(0, 0, 0);
    for (const item of list) item.dispose();
    // A few legacy open decorative prisms are non-indexed. Normalize indices
    // when the merged model is created, including their empty-bucket sentinel.
    const index: number[] = [];
    const count = geo.attributes.position?.count ?? 0;
    for (let i = 0; i < count; i += 1) index.push(i);
    if (!geo.index && count % 3 === 0) geo.setIndex(index);
    geo.computeBoundingSphere();
    return geo;
  };
  const model = {
    opaque: merge(p.opaque),
    metal: merge(p.metal),
    glass: merge(p.glass),
    windows: merge(p.windows),
  };
  cache.set(key, model);
  return model;
}

export function createBuildingObject(
  kind: Kind,
  level: number,
  detail: 0 | 1 | 2,
  materials: CityMaterials,
) {
  const model = buildingModel(kind, level, detail);
  const object = new THREE.Group();
  object.name = `building-${kind}`;
  const meshes: THREE.Mesh[] = [];
  for (const bucket of ["opaque", "metal", "glass", "windows"] as const) {
    const mesh = new THREE.Mesh(model[bucket], materials[bucket]);
    mesh.castShadow = bucket !== "windows";
    mesh.receiveShadow = bucket === "opaque";
    object.add(mesh);
    meshes.push(mesh);
  }
  return { object, meshes };
}

export function modelTriangles(kind: Kind, detail: 0 | 1 | 2) {
  const model = buildingModel(kind, 1, detail);
  return Object.values(model).reduce(
    (n, g) => n + (g.index ? g.index.count / 3 : (g.attributes.position?.count ?? 0) / 3),
    0,
  );
}

export function modelVertices(kind: Kind, detail: 0 | 1 | 2) {
  const model = buildingModel(kind, 1, detail);
  return Object.values(model).reduce((n, g) => n + g.attributes.position!.count, 0);
}
