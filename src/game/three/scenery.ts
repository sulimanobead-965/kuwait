import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { COLS, LAND, ROWS } from "../../game/land.ts";
import { CELL_SIZE, LAND_HEIGHT, cellWorld } from "./camera.ts";
import { PALETTE as P } from "./palette.ts";

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
    for (let c = 0; c < COLS; c += 1) {
      if (!LAND[r]![c]) continue;
      const { x, z } = cellWorld(c, r);
      const atWater = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dc, dr]) => LAND[r + dr!]?.[c + dc!] === 0);
      const variation = (c * 13 + r * 7) % 5;
      const color = atWater
        ? P.sand
        : variation === 0
          ? "#dbc798"
          : variation === 1
            ? "#d5c298"
            : "#d1bd93";
      box(
        tiles,
        x,
        LAND_HEIGHT / 2 - 0.08,
        z,
        CELL_SIZE * 0.997,
        LAND_HEIGHT,
        CELL_SIZE * 0.997,
        color,
      );
      if (atWater) {
        for (const [dc, dr] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          if (LAND[r + dr!]?.[c + dc!] !== 0) continue;
          box(
            coast,
            x + dc! * CELL_SIZE * 0.5,
            0.08,
            z + dr! * CELL_SIZE * 0.5,
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

export function createGrid() {
  const vertices: number[] = [];
  const half = CELL_SIZE / 2;
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (!LAND[r]![c]) continue;
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
  const details: THREE.BufferGeometry[] = [];
  const lights: THREE.BufferGeometry[] = [];
  const roads = new Set(roadKeys);
  for (const key of roadKeys) {
    const [c, r] = key.split(",").map(Number);
    const { x, z } = cellWorld(c!, r!);
    const e = roads.has(`${c + 1},${r}`);
    const w = roads.has(`${c - 1},${r}`);
    const n = roads.has(`${c},${r - 1}`);
    const s = roads.has(`${c},${r + 1}`);
    const width = CELL_SIZE * 0.46;
    const span = CELL_SIZE * 0.51;
    box(details, x, LAND_HEIGHT + 0.02, z, CELL_SIZE * 0.99, 0.04, CELL_SIZE * 0.99, P.pavement);
    box(
      asphalt,
      x,
      LAND_HEIGHT + 0.049,
      z,
      e || w ? span : width,
      0.045,
      n || s || !(e || w) ? span : width,
      P.asphalt,
    );
    const mark = (xx: number, zz: number, dx: number, dz: number) =>
      box(details, xx, LAND_HEIGHT + 0.075, zz, dx, 0.014, dz, P.white);
    if (e || (!w && !n && !s)) {
      mark(x + CELL_SIZE * 0.18, z, 0.27, 0.038);
      if (e) mark(x + CELL_SIZE * 0.52, z, 0.24, 0.038);
    }
    if (w) mark(x - CELL_SIZE * 0.36, z, 0.24, 0.038);
    if (s || (!n && !e && !w)) {
      mark(x, z + CELL_SIZE * 0.18, 0.038, 0.27);
      if (s) mark(x, z + CELL_SIZE * 0.52, 0.038, 0.24);
    }
    if (n) mark(x, z - CELL_SIZE * 0.36, 0.038, 0.24);
    if ((c! + r!) % 4 === 0 && (e || w || n || s)) {
      const lx = x + (e || w ? 0 : width * 0.75);
      const lz = z + (e || w ? -width * 0.72 : 0);
      box(details, lx, LAND_HEIGHT + 0.47, lz, 0.045, 0.83, 0.045, P.dark);
      box(details, lx, LAND_HEIGHT + 0.9, lz, 0.19, 0.055, 0.18, P.dark);
      box(lights, lx, LAND_HEIGHT + 0.87, lz, 0.14, 0.032, 0.12, P.gold);
    }
  }
  return { asphalt: merge(asphalt), details: merge(details), lights: merge(lights) };
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
