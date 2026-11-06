import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { COLS, LAND, ROWS } from "../../game/land.ts";
import { CELL_SIZE, LAND_HEIGHT, cellWorld } from "./camera.ts";
import { PALETTE as P } from "./palette.ts";
import { roadIsSchematic, type Sim } from "../sim.ts";
import { roadMarkingsAt } from "./road-markings.ts";
import { districtById, sectorAt } from "../districts.ts";
import { lonLatToCell, PLACES, type Place } from "../places.ts";
import { getLang, t } from "../../i18n/index.ts";

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

/** Soft pastel per numbered parcel so neighboring sectors read apart on sand. */
const PARCEL_TINTS = ["#8fc7b4", "#e3a98b", "#a7b5e0", "#d9c86f", "#c49ccc", "#86b9d6", "#b9cf8c", "#e3a0ad"];

function parcelTint(number: number) {
  return PARCEL_TINTS[(number - 1 + PARCEL_TINTS.length * 8) % PARCEL_TINTS.length]!;
}

export function createGrid(
  avoid: ReadonlySet<string> = new Set(),
  district: Sim["district"] = null,
) {
  const vertices: number[] = [];
  const colors: number[] = [];
  const half = CELL_SIZE / 2;
  const y = LAND_HEIGHT + 0.015;
  const base = new THREE.Color(P.dark);
  const edge = new THREE.Color();
  const drawn = (c: number, r: number) =>
    LAND[r]?.[c] === 1 && !avoid.has(`${c},${r}`) && !roadIsSchematic(district, `${c},${r}`);
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (!drawn(c, r)) continue;
      const { x, z } = cellWorld(c, r);
      const own = sectorAt(district ?? null, `${c},${r}`);
      if (own !== undefined) edge.set(parcelTint(own)).multiplyScalar(0.45);
      const sides = [
        [x - half, z - half, x + half, z - half, 0, -1],
        [x + half, z - half, x + half, z + half, 1, 0],
        [x + half, z + half, x - half, z + half, 0, 1],
        [x - half, z + half, x - half, z - half, -1, 0],
      ] as const;
      for (const [x0, z0, x1, z1, dc, dr] of sides) {
        // Parcel borders are drawn darker and in the parcel's own hue.
        const border =
          own !== undefined && sectorAt(district ?? null, `${c + dc},${r + dr}`) !== own;
        const color = border ? edge : base;
        const alpha = border ? 0.55 : 0.17;
        vertices.push(x0, y, z0, x1, y, z1);
        colors.push(color.r, color.g, color.b, alpha, color.r, color.g, color.b, alpha);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  });
  return new THREE.LineSegments(geometry, material);
}

/**
 * Always-visible parcel wash: a faint pastel fill per numbered sector and a thin,
 * slightly stronger strip along each parcel's outer edge. Null outside planned districts.
 */
export function createParcels(avoid: ReadonlySet<string>, district: Sim["district"] = null) {
  const sectors = districtById(district)?.sectors;
  if (!sectors?.length) return null;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const y = LAND_HEIGHT + 0.006;
  const half = CELL_SIZE / 2;
  const strip = 0.16;
  const color = new THREE.Color();
  const quad = (x0: number, z0: number, x1: number, z1: number, alpha: number) => {
    const i = positions.length / 3;
    positions.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1);
    for (let k = 0; k < 4; k += 1) colors.push(color.r, color.g, color.b, alpha);
    indices.push(i, i + 2, i + 1, i, i + 3, i + 2);
  };
  for (const sector of sectors) {
    for (const { c, r } of sector.cells) {
      const key = `${c},${r}`;
      if (avoid.has(key) || roadIsSchematic(district, key) || !LAND[r]?.[c]) continue;
      const { x, z } = cellWorld(c, r);
      color.set(parcelTint(sector.number));
      quad(x - half, z - half, x + half, z + half, 0.3);
      color.multiplyScalar(0.55);
      for (const [dc, dr] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        if (sectorAt(district ?? null, `${c + dc},${r + dr}`) === sector.number) continue;
        if (dc === 1) quad(x + half - strip, z - half, x + half, z + half, 0.6);
        if (dc === -1) quad(x - half, z - half, x - half + strip, z + half, 0.6);
        if (dr === 1) quad(x - half, z + half - strip, x + half, z + half, 0.6);
        if (dr === -1) quad(x - half, z - half, x + half, z - half + strip, 0.6);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  // Lit like the sand underneath, so the wash dims with the day-night cycle.
  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.renderOrder = -1;
  return mesh;
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
    // Arabic-Indic digits in Arabic, Western digits in English.
    ctx.fillText(
      getLang() === "ar"
        ? String(sector.number).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!)
        : String(sector.number),
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

/** View height where area names start to appear, and where they are fully opaque. */
const PLACE_FADE_START = 52;
const PLACE_FADE_END = 78;

/**
 * Area names (places.ts, in the current language) as camera-facing sprites over the
 * terrain. They keep a constant on-screen size and fade in only when the camera is
 * zoomed out far enough to read the map as a whole; `updatePlaceLabels` drives both
 * every frame. A language switch rebuilds the group (see `CityWorld.setLang`).
 */
export function createPlaceLabels() {
  const group = new THREE.Group();
  group.name = "place-labels";
  const items: { sprite: THREE.Sprite; material: THREE.SpriteMaterial; size: number }[] = [];
  const rtl = getLang() === "ar";
  const draw = (canvas: HTMLCanvasElement, place: Place) => {
    const name = t(place.name);
    const px = place.major ? 64 : 48;
    const font = `bold ${px}px "Noto Kufi Arabic", "Noto Sans Arabic", sans-serif`;
    const ctx = canvas.getContext("2d")!;
    ctx.font = font;
    const width = Math.ceil(ctx.measureText(name).width + px * 0.9);
    canvas.width = Math.min(1024, width);
    canvas.height = Math.ceil(px * 1.9);
    ctx.font = font;
    ctx.direction = rtl ? "rtl" : "ltr";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = px * 0.22;
    const water = place.name === "جون الكويت";
    ctx.strokeStyle = water ? "rgba(18, 74, 86, 0.75)" : "rgba(250, 243, 226, 0.92)";
    ctx.fillStyle = water ? "#eaf6f4" : "#173c40";
    ctx.strokeText(name, canvas.width / 2, canvas.height / 2);
    ctx.fillText(name, canvas.width / 2, canvas.height / 2);
  };
  const canvases: [HTMLCanvasElement, Place, THREE.CanvasTexture, THREE.Sprite][] = [];
  for (const place of PLACES) {
    const canvas = document.createElement("canvas");
    draw(canvas, place);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({
      map,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      fog: false,
      opacity: 0,
    });
    const sprite = new THREE.Sprite(material);
    const cell = lonLatToCell(place.lon, place.lat);
    const at = cellWorld(cell.c, cell.r);
    sprite.position.set(at.x, LAND_HEIGHT + 3, at.z);
    sprite.renderOrder = 20;
    sprite.userData.aspect = canvas.width / canvas.height;
    group.add(sprite);
    items.push({ sprite, material, size: place.major ? 0.05 : 0.036 });
    canvases.push([canvas, place, map, sprite]);
  }
  // Redraw once the Arabic web font is ready, so the first frame's fallback face is replaced.
  void document.fonts?.ready.then(() => {
    for (const [canvas, place, map, sprite] of canvases) {
      draw(canvas, place);
      map.needsUpdate = true;
      sprite.userData.aspect = canvas.width / canvas.height;
    }
  });
  group.userData.items = items;
  group.visible = false;
  return group;
}

export function updatePlaceLabels(group: THREE.Group, viewHeight: number) {
  const t = THREE.MathUtils.smoothstep(viewHeight, PLACE_FADE_START, PLACE_FADE_END);
  group.visible = t > 0.01;
  if (!group.visible) return;
  const items = group.userData.items as {
    sprite: THREE.Sprite;
    material: THREE.SpriteMaterial;
    size: number;
  }[];
  for (const { sprite, material, size } of items) {
    material.opacity = t;
    const height = viewHeight * size;
    sprite.scale.set(height * (sprite.userData.aspect as number), height, 1);
  }
}

export function disposePlaceLabels(group: THREE.Group) {
  group.traverse((node) => {
    if (node instanceof THREE.Sprite) {
      node.material.map?.dispose();
      node.material.dispose();
    }
  });
}
