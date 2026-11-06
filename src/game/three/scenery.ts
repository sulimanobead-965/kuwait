import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { COLS, LAND, ROWS } from "../../game/land.ts";
import { CELL_SIZE, LAND_HEIGHT, cellWorld } from "./camera.ts";
import { PALETTE as P } from "./palette.ts";
import { roadIsSchematic, type Sim } from "../sim.ts";
import { roadMarkingsAt } from "./road-markings.ts";

function tint(geo: THREE.BufferGeometry, color: string) {
  const c = new THREE.Color(color);
  const colors = new Float32Array(geo.attributes.position!.count * 3);
  for (let i = 0; i < colors.length; i += 3) {
    colors[i] = c.r;
    colors[i + 1] = c.g;
    colors[i + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

function box(
  list: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: string,
) {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(x, y, z);
  list.push(tint(geo, color));
}

function merge(list: THREE.BufferGeometry[]) {
  const geo = list.length
    ? (mergeGeometries(list, false) ?? new THREE.BoxGeometry(0, 0, 0))
    : new THREE.BoxGeometry(0, 0, 0);
  for (const g of list) g.dispose();
  geo.computeBoundingSphere();
  return geo;
}

export function createTerrain() {
  const tiles: THREE.BufferGeometry[] = [];
  const coast: THREE.BufferGeometry[] = [];
  for (let r = 0; r < ROWS; r += 1) {
    let c = 0;
    while (c < COLS) {
      if (!LAND[r]![c]) {
        c += 1;
        continue;
      }
      const start = c;
      let shore = false;
      while (c < COLS && LAND[r]![c]) {
        shore ||= [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dc, dr]) => LAND[r + dr!]?.[c + dc!] === 0);
        c += 1;
      }
      const a = cellWorld(start, r);
      const b = cellWorld(c - 1, r);
      const width = b.x - a.x + CELL_SIZE * 0.997;
      box(
        tiles,
        (a.x + b.x) / 2,
        LAND_HEIGHT / 2 - 0.08,
        a.z,
        width,
        LAND_HEIGHT,
        CELL_SIZE * 0.997,
        shore ? P.sand : (start + r) % 2 === 0 ? "#d5c298" : "#d1bd93",
      );
      for (let col = start; col < c; col += 1) {
        const at = cellWorld(col, r);
        for (const [dc, dr] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          if (LAND[r + dr]?.[col + dc] !== 0) continue;
          box(
            coast,
            at.x + dc * CELL_SIZE * 0.5,
            0.08,
            at.z + dr * CELL_SIZE * 0.5,
            dc ? 0.22 : CELL_SIZE * 0.96,
            0.43,
            dr ? 0.22 : CELL_SIZE * 0.96,
            P.paleStone,
          );
        }
      }
    }
  }
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0,
  });
  const land = new THREE.Mesh(merge(tiles), material);
  land.receiveShadow = true;
  group.add(land);
  const shore = new THREE.Mesh(merge(coast), material);
  shore.castShadow = true;
  shore.receiveShadow = true;
  group.add(shore);
  return { group, material };
}

export function createGrid(
  avoid: ReadonlySet<string> = new Set(),
  district: Sim["district"] = null,
) {
  const vertices: number[] = [];
  const half = CELL_SIZE / 2;
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (!LAND[r]![c] || avoid.has(`${c},${r}`) || roadIsSchematic(district, `${c},${r}`))
        continue;
      const { x, z } = cellWorld(c, r);
      vertices.push(
        x - half,
        LAND_HEIGHT + 0.015,
        z - half,
        x + half,
        LAND_HEIGHT + 0.015,
        z - half,
      );
      vertices.push(
        x + half,
        LAND_HEIGHT + 0.015,
        z - half,
        x + half,
        LAND_HEIGHT + 0.015,
        z + half,
      );
      vertices.push(
        x + half,
        LAND_HEIGHT + 0.015,
        z + half,
        x - half,
        LAND_HEIGHT + 0.015,
        z + half,
      );
      vertices.push(
        x - half,
        LAND_HEIGHT + 0.015,
        z + half,
        x - half,
        LAND_HEIGHT + 0.015,
        z - half,
      );
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  const material = new THREE.LineBasicMaterial({ color: P.dark, transparent: true, opacity: 0.17 });
  return new THREE.LineSegments(geometry, material);
}
export function createRoads(roadKeys: string[]) {
  const asphalt: THREE.BufferGeometry[] = [];
  const markings: THREE.BufferGeometry[] = [];
  const lights: THREE.BufferGeometry[] = [];
  const roads = new Set(roadKeys);
  for (const key of [...roadKeys].sort()) {
    const [c, r] = key.split(",").map(Number);
    const { x, z } = cellWorld(c!, r!);
    // Continuous charcoal asphalt: interior paint only, never perimeter curbs/borders.
    box(asphalt, x, LAND_HEIGHT + 0.005, z, CELL_SIZE, 0.016, CELL_SIZE, P.asphalt);
    for (const mark of roadMarkingsAt(roads, c!, r!)) {
      const along = mark.axis === "x";
      const xShift = mark.type === "stop" ? mark.dc * CELL_SIZE * 0.35 : 0;
      const zShift = mark.type === "stop" ? mark.dr * CELL_SIZE * 0.35 : 0;
      const length = mark.type === "dash" ? CELL_SIZE * 0.27 : CELL_SIZE * 0.31;
      box(markings, x + xShift, LAND_HEIGHT + 0.016, z + zShift,
        along ? length : 0.052, 0.005, along ? 0.052 : length, "#e3d8ba");
    }
    const horizontal = roads.has(`${c + 1},${r}`) || roads.has(`${c - 1},${r}`);
    const vertical = roads.has(`${c},${r - 1}`) || roads.has(`${c},${r + 1}`);
    if ((c! + r!) % 4 === 0 && (horizontal || vertical)) {
      const lx = x + (horizontal ? 0 : CELL_SIZE * 0.405);
      const lz = z + (horizontal ? -CELL_SIZE * 0.45 : 0);
      box(asphalt, lx, LAND_HEIGHT + 0.463, lz, 0.042, 0.9, 0.042, P.dark);
      const armX = lx + (horizontal ? 0 : -0.08);
      const armZ = lz + (horizontal ? 0.08 : 0);
      box(
        asphalt,
        armX,
        LAND_HEIGHT + 0.89,
        armZ,
        horizontal ? 0.045 : 0.21,
        0.05,
        horizontal ? 0.21 : 0.045,
        P.dark,
      );
      box(
        lights,
        armX,
        LAND_HEIGHT + 0.865,
        armZ,
        horizontal ? 0.07 : 0.14,
        0.026,
        horizontal ? 0.14 : 0.07,
        P.gold,
      );
    }
  }
  const details = new THREE.BoxGeometry(0, 0, 0);
  return { asphalt: merge(asphalt), markings: merge(markings), details, lights: merge(lights) };
}

export function palmGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.035, 0.065, 1.25, 6);
  trunk.translate(0, 0.625, 0);
  parts.push(tint(trunk, P.trunk));
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2;
    const leaf = new THREE.ConeGeometry(0.13, 0.75, 4);
    leaf.rotateZ(Math.PI / 2.5);
    leaf.rotateY(-angle);
    leaf.translate(Math.cos(angle) * 0.26, 1.29, Math.sin(angle) * 0.26);
    parts.push(tint(leaf, i % 2 ? P.leaf : P.leafLight));
  }
  return merge(parts);
}

export function carGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  box(parts, 0, 0.12, 0, 0.31, 0.16, 0.64, P.white);
  box(parts, 0, 0.255, -0.035, 0.27, 0.15, 0.33, P.glass);
  for (const x of [-0.14, 0.14])
    for (const z of [-0.21, 0.21]) box(parts, x, 0.07, z, 0.08, 0.13, 0.13, P.black);
  box(parts, 0, 0.16, 0.328, 0.22, 0.045, 0.02, P.gold);
  return merge(parts);
}

export function createDistrictNumbers(district: import("../districts.ts").District) {
  const group = new THREE.Group();
  const textures: THREE.Texture[] = [];
  for (const sector of district.sectors) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(64, 64, 47, 0, Math.PI * 2);
    ctx.fillStyle = "#eadcbf";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#4f735e";
    ctx.stroke();
    ctx.fillStyle = "#173c40";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = 'bold 64px "Noto Kufi Arabic", sans-serif';
    ctx.fillText(
      String(sector.number).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!),
      64,
      63,
    );
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    textures.push(map);
    const at = cellWorld(sector.x, sector.y);
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 1.15),
      new THREE.MeshBasicMaterial({
        map,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    );
    label.rotation.x = -Math.PI / 2;
    label.position.set(at.x, LAND_HEIGHT + 0.05, at.z);
    group.add(label);
  }
  group.userData.textures = textures;
  return group;
}
export function disposeDistrictNumbers(group: THREE.Group) {
  const textures = group.userData.textures as THREE.Texture[] | undefined;
  if (textures) for (const texture of textures) texture.dispose();
  group.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.geometry.dispose();
      (node.material as THREE.Material).dispose();
    }
  });
}
