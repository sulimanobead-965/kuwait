import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
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
      apartments(p, detail, level);
      break;
    case "shop":
      shop(p, detail);
      break;
    case "tower":
      tower(p, detail, level);
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
  }
  const merge = (list: Geo[]) => {
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
