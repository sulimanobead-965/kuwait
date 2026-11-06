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
  box(p, 0, 0.1, 0, 1.62, 0.2, 1.38, P.sand);
  box(p, 0, 0.57, 0, 1.25, 0.94, 1.0, P.plaster);
  box(p, 0, 1.1, 0, 1.4, 0.12, 1.14, P.paleStone);
  box(p, 0, 0.58, 0.525, 0.29, 0.66, 0.08, P.gulf);
  if (detail === 0) {
    fourWindows(p, 0.66, 1.25, 1, 3);
    for (const x of [-0.47, 0.47]) cyl(p, x, 0.59, 0.58, 0.045, 0.75, P.white, 0.045, 8);
    parapet(p, 1.4, 1.14, 1.22);
    box(p, -0.4, 1.34, -0.25, 0.26, 0.34, 0.25, P.paleStone);
    box(p, 0.36, 1.28, -0.26, 0.27, 0.16, 0.27, P.dark);
  }
}

function modern(p: ModelParts, detail: number) {
  box(p, 0, 0.22, 0, 1.5, 0.22, 1.3, P.sand);
  box(p, -0.24, 0.64, -0.12, 0.88, 0.85, 0.92, P.plaster);
  box(p, 0.2, 1.0, -0.12, 1.15, 0.1, 1.05, P.dark);
  box(p, 0.49, 0.56, 0.1, 0.5, 0.58, 0.68, P.glass, "glass");
  box(p, -0.52, 0.79, 0.36, 0.16, 1.14, 0.19, P.gulf);
  if (detail === 0) {
    fourWindows(p, 0.69, 0.88, 0.92, 3, 0.34);
    box(p, 0.16, 0.18, 0.6, 1.55, 0.08, 0.2, P.pavement);
    for (const x of [-0.4, -0.1, 0.2]) box(p, x, 1.12, -0.12, 0.17, 0.1, 0.3, P.glass, "glass");
    cyl(p, 0.58, 0.46, -0.5, 0.045, 0.6, P.trunk, 0.06, 7);
    ball(p, 0.58, 0.87, -0.5, 0.25, 0.21, 0.25, P.leaf, detail);
  }
}

function apartments(p: ModelParts, detail: number, level: number) {
  const floors = detail === 2 ? 3 : 2 + level;
  const h = floors * 0.46;
  box(p, 0, 0.11, 0, 1.56, 0.22, 1.34, P.sand);
  box(p, 0, h / 2 + 0.14, 0, 1.22, h, 1.04, P.plaster);
  box(p, 0.19, h + 0.3, -0.13, 0.87, 0.31, 0.78, P.paleStone);
  if (detail < 2)
    for (let f = 0; f < floors; f += 1)
      fourWindows(p, 0.34 + f * 0.44, 1.22, 1.04, detail === 0 ? 3 : 2, 0.23);
  else fourWindows(p, h * 0.5, 1.22, 1.04, 2, h * 0.8);
  for (let f = 1; detail === 0 && f < floors; f += 1) {
    box(p, 0, 0.2 + f * 0.44, 0.57, 1.3, 0.06, 0.24, P.paleStone);
    box(p, -0.59, 0.31 + f * 0.44, 0.67, 0.035, 0.22, 0.035, P.gulf, "metal");
    box(p, 0.59, 0.31 + f * 0.44, 0.67, 0.035, 0.22, 0.035, P.gulf, "metal");
  }
  if (detail === 0) {
    parapet(p, 1.3, 1.12, h + 0.23);
    box(p, 0, 0.38, 0.565, 0.25, 0.38, 0.07, P.gulf);
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
  const h = detail === 2 ? 2.7 : 2.8 + level * 0.37;
  box(p, 0, 0.18, 0, 1.48, 0.36, 1.4, P.limestone);
  box(p, 0, h / 2 + 0.3, 0, 0.98, h, 0.88, P.glass, "glass");
  box(p, -0.52, h / 2 + 0.3, 0, 0.14, h + 0.1, 0.97, P.gulf);
  box(p, 0, h + 0.34, 0, 1.08, 0.14, 1, P.gold, "metal");
  const count = detail === 0 ? 8 : detail === 1 ? 5 : 2;
  for (let i = 0; i < count; i += 1)
    fourWindows(p, 0.54 + (i / count) * (h - 0.16), 0.98, 0.88, detail === 0 ? 4 : 2, 0.1);
  if (detail === 0)
    for (const x of [-0.34, 0.34]) box(p, x, h / 2 + 0.3, 0.45, 0.035, h, 0.04, P.gold, "metal");
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

function boubyan(p: ModelParts, detail: number) {
  const shape = new THREE.Shape();
  shape.moveTo(-0.63, 0);
  shape.lineTo(0.63, 0);
  shape.lineTo(0.07, 3.8);
  shape.lineTo(-0.08, 3.8);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.73, bevelEnabled: false });
  geo.translate(0, 0.23, -0.365);
  p.glass.push(color(geo, P.glass));
  box(p, 0, 0.16, 0, 1.48, 0.32, 1.2, P.limestone);
  box(p, -0.56, 1.02, 0, 0.13, 1.7, 0.86, P.gulf, "metal");
  if (detail < 2) {
    const n = detail === 0 ? 15 : 6;
    for (let i = 0; i < n; i += 1) {
      const y = 0.4 + i * (3.2 / n);
      const edge = 0.63 - (y / 3.8) * 0.56;
      for (let x = -edge + 0.12; x < edge - 0.06; x += 0.22) window(p, x, y, 0.389, 0.1, 0.055);
    }
  }
  box(p, 0.01, 4.05, 0, 0.035, 0.38, 0.035, P.gold, "metal");
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
