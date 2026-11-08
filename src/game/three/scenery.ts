import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { COLS, LAND, ROWS } from "../../game/land.ts";
import { CAMERA_PITCH_DEGREES, CELL_SIZE, LAND_HEIGHT, cellWorld } from "./camera.ts";
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

/** Axis-aligned boxes collected as plain numbers and written straight into one geometry. */
type BoxBatch = number[];
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const batchColors = new Map<string, THREE.Color>();

function addBox(
  batch: BoxBatch,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: string,
) {
  let tone = batchColors.get(color);
  if (!tone) batchColors.set(color, (tone = new THREE.Color(color)));
  batch.push(x, y, z, w, h, d, tone.r, tone.g, tone.b);
}

/**
 * Same geometry as merging one tinted BoxGeometry per entry (position, normal, uv,
 * color and index), without allocating thousands of intermediate geometries.
 */
function buildBoxes(batch: BoxBatch) {
  const count = batch.length / 9;
  if (!count) {
    const empty = new THREE.BoxGeometry(0, 0, 0);
    empty.computeBoundingSphere();
    return empty;
  }
  const unitPos = UNIT_BOX.getAttribute("position").array as Float32Array;
  const unitNormal = UNIT_BOX.getAttribute("normal").array as Float32Array;
  const unitUv = UNIT_BOX.getAttribute("uv").array as Float32Array;
  const unitIndex = UNIT_BOX.index!.array;
  const verts = unitPos.length / 3;
  const position = new Float32Array(count * verts * 3);
  const normal = new Float32Array(count * verts * 3);
  const uv = new Float32Array(count * verts * 2);
  const color = new Float32Array(count * verts * 3);
  const index = new Uint32Array(count * unitIndex.length);
  for (let b = 0; b < count; b += 1) {
    const o = b * 9;
    const x = batch[o]!,
      y = batch[o + 1]!,
      z = batch[o + 2]!,
      w = batch[o + 3]!,
      h = batch[o + 4]!,
      d = batch[o + 5]!;
    const cr = batch[o + 6]!,
      cg = batch[o + 7]!,
      cb = batch[o + 8]!;
    const v0 = b * verts;
    for (let v = 0; v < verts; v += 1) {
      const i3 = (v0 + v) * 3;
      position[i3] = unitPos[v * 3]! * w + x;
      position[i3 + 1] = unitPos[v * 3 + 1]! * h + y;
      position[i3 + 2] = unitPos[v * 3 + 2]! * d + z;
      color[i3] = cr;
      color[i3 + 1] = cg;
      color[i3 + 2] = cb;
    }
    normal.set(unitNormal, v0 * 3);
    uv.set(unitUv, v0 * 2);
    const i0 = b * unitIndex.length;
    for (let k = 0; k < unitIndex.length; k += 1) index[i0 + k] = unitIndex[k]! + v0;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setAttribute("color", new THREE.BufferAttribute(color, 3));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.computeBoundingSphere();
  return geo;
}

/** Terrain is split into squares of this many cells, so off-screen land is skipped. */
const TERRAIN_CHUNK = 64;

export function createTerrain() {
  // One batch of land boxes and one of shore walls per chunk.
  const chunks = new Map<number, { tiles: BoxBatch; coast: BoxBatch }>();
  const chunkOf = (c: number, r: number) => {
    const id = Math.floor(r / TERRAIN_CHUNK) * 1000 + Math.floor(c / TERRAIN_CHUNK);
    let ch = chunks.get(id);
    if (!ch) chunks.set(id, (ch = { tiles: [], coast: [] }));
    return ch;
  };
  for (let r = 0; r < ROWS; r += 1) {
    let c = 0;
    while (c < COLS) {
      if (!LAND[r]![c]) {
        c += 1;
        continue;
      }
      const start = c;
      const kind = LAND[r]![c];
      const block = Math.floor(start / TERRAIN_CHUNK);
      const { tiles, coast } = chunkOf(start, r);
      let shore = false;
      // A run stops at the edge of its chunk.
      while (c < COLS && LAND[r]![c] === kind && Math.floor(c / TERRAIN_CHUNK) === block) {
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
      addBox(
        tiles,
        (a.x + b.x) / 2,
        LAND_HEIGHT / 2 - 0.08,
        a.z,
        width,
        LAND_HEIGHT,
        CELL_SIZE * 0.997,
        // Land across the border is a darker, greyer desert.
        kind === 2
          ? (start + r) % 2 === 0
            ? "#b3a588"
            : "#afa184"
          : shore
            ? P.sand
            : (start + r) % 2 === 0
              ? "#d5c298"
              : "#d1bd93",
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
          addBox(
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
  // Flat, matte ground: Lambert shading looks the same here and is much cheaper per
  // pixel than the physically based material, and land fills most of the screen.
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  // Separate meshes per chunk: the camera only draws the chunks it can see, and
  // the shadow pass only those near the player. The low shore walls cast no shadow
  // worth its cost.
  for (const { tiles, coast } of chunks.values()) {
    if (tiles.length) {
      const land = new THREE.Mesh(buildBoxes(tiles), material);
      land.receiveShadow = true;
      land.name = "land";
      group.add(land);
    }
    if (coast.length) {
      const shore = new THREE.Mesh(buildBoxes(coast), material);
      shore.receiveShadow = true;
      shore.name = "shore";
      group.add(shore);
    }
  }
  return { group, material };
}

/** Soft pastel per numbered parcel so neighboring sectors read apart on sand. */
const PARCEL_TINTS = ["#8fc7b4", "#e3a98b", "#a7b5e0", "#d9c86f", "#c49ccc", "#86b9d6", "#b9cf8c", "#e3a0ad"];

function parcelTint(number: number) {
  return PARCEL_TINTS[(number - 1 + PARCEL_TINTS.length * 8) % PARCEL_TINTS.length]!;
}

/** Every land cell's four grid edges for one district, built once and then sliced. */
const gridCache = new Map<
  string,
  { keys: string[]; positions: Float32Array; colors: Float32Array }
>();

function gridTemplate(district: Sim["district"]) {
  const id = district ?? "";
  const cached = gridCache.get(id);
  if (cached) return cached;
  const keys: string[] = [];
  for (let r = 0; r < ROWS; r += 1)
    for (let c = 0; c < COLS; c += 1)
      if (LAND[r]![c] === 1 && !roadIsSchematic(district, `${c},${r}`)) keys.push(`${c},${r}`);
  // 4 edges × 2 vertices per cell.
  const positions = new Float32Array(keys.length * 24);
  const colors = new Float32Array(keys.length * 32);
  const half = CELL_SIZE / 2;
  const y = LAND_HEIGHT + 0.015;
  const base = new THREE.Color(P.dark);
  const edge = new THREE.Color();
  let p = 0,
    q = 0;
  for (const key of keys) {
    const [c, r] = key.split(",").map(Number) as [number, number];
    const { x, z } = cellWorld(c, r);
    const own = sectorAt(district ?? null, key);
    if (own !== undefined) edge.set(parcelTint(own)).multiplyScalar(0.45);
    const sides = [
      [x - half, z - half, x + half, z - half, 0, -1],
      [x + half, z - half, x + half, z + half, 1, 0],
      [x + half, z + half, x - half, z + half, 0, 1],
      [x - half, z + half, x - half, z - half, -1, 0],
    ] as const;
    for (const [x0, z0, x1, z1, dc, dr] of sides) {
      // Parcel borders are drawn darker and in the parcel's own hue.
      const border = own !== undefined && sectorAt(district ?? null, `${c + dc},${r + dr}`) !== own;
      const color = border ? edge : base;
      const alpha = border ? 0.55 : 0.17;
      positions.set([x0, y, z0, x1, y, z1], p);
      colors.set([color.r, color.g, color.b, alpha, color.r, color.g, color.b, alpha], q);
      p += 6;
      q += 8;
    }
  }
  const template = { keys, positions, colors };
  gridCache.set(id, template);
  return template;
}

/**
 * Tile outlines for every open land cell. The per-district template is computed once;
 * later calls (every road change while a tool is active) only copy the cells that are
 * not in `avoid`, which keeps the ~32k-cell free zone cheap to refresh.
 */
export function createGrid(
  avoid: ReadonlySet<string> = new Set(),
  district: Sim["district"] = null,
  /** Only cells within `radius` of this cell (the whole country is too many lines). */
  around?: { c: number; r: number; radius: number },
) {
  const template = gridTemplate(district);
  const kept: number[] = [];
  for (let i = 0; i < template.keys.length; i += 1) {
    if (around) {
      const key = template.keys[i]!;
      const comma = key.indexOf(",");
      const c = +key.slice(0, comma),
        r = +key.slice(comma + 1);
      if (Math.abs(c - around.c) > around.radius || Math.abs(r - around.r) > around.radius) continue;
    }
    if (!avoid.has(template.keys[i]!)) kept.push(i);
  }
  const positions = new Float32Array(kept.length * 24);
  const colors = new Float32Array(kept.length * 32);
  // Copy runs of consecutive kept cells in one go.
  let out = 0;
  for (let k = 0; k < kept.length;) {
    let end = k + 1;
    while (end < kept.length && kept[end] === kept[end - 1]! + 1) end += 1;
    const from = kept[k]!,
      count = end - k;
    positions.set(template.positions.subarray(from * 24, (from + count) * 24), out * 24);
    colors.set(template.colors.subarray(from * 32, (from + count) * 32), out * 32);
    out += count;
    k = end;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 4));
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
/**
 * Asphalt, paint and street lamps for `roadKeys`. `all` is every road on the map
 * (defaults to `roadKeys`): markings and lamps look at neighbors, so a chunk of the
 * network is drawn exactly as it would be as part of the whole.
 */
export function createRoads(roadKeys: readonly string[], all?: ReadonlySet<string>) {
  const asphalt: BoxBatch = [];
  const markings: BoxBatch = [];
  const lights: BoxBatch = [];
  /** Lamp posts: hidden with the paint and lamps when zoomed far out. */
  const posts: BoxBatch = [];
  const roads = all ?? new Set(roadKeys);
  // Continuous charcoal asphalt: one slab per run of road along a row (a whole
  // street is one box, not one per cell), interior paint only, never curbs.
  const rows = new Map<number, number[]>();
  for (const key of roadKeys) {
    const comma = key.indexOf(",");
    const c = +key.slice(0, comma),
      r = +key.slice(comma + 1);
    let list = rows.get(r);
    if (!list) rows.set(r, (list = []));
    list.push(c);
  }
  for (const [r, cs] of rows) {
    cs.sort((a, b) => a - b);
    for (let i = 0; i < cs.length; ) {
      let j = i;
      while (j + 1 < cs.length && cs[j + 1] === cs[j]! + 1) j += 1;
      const a = cellWorld(cs[i]!, r),
        b = cellWorld(cs[j]!, r);
      addBox(asphalt, (a.x + b.x) / 2, LAND_HEIGHT + 0.005, a.z, CELL_SIZE * (j - i + 1), 0.016, CELL_SIZE, P.asphalt);
      i = j + 1;
    }
  }
  for (const key of [...roadKeys].sort()) {
    const [c, r] = key.split(",").map(Number);
    const { x, z } = cellWorld(c!, r!);
    if (LAND[r!]?.[c!] === 0) {
      // A bridge over the sea: concrete deck, piers down into the water, and railings
      // along the sides that do not continue the bridge.
      addBox(asphalt, x, LAND_HEIGHT - 0.09, z, CELL_SIZE, 0.18, CELL_SIZE, P.paleStone);
      if ((c! + r!) % 2 === 0) addBox(asphalt, x, LAND_HEIGHT / 2 - 0.35, z, 0.42, LAND_HEIGHT + 0.6, 0.42, P.paleStone);
      const along = (dc: number, dr: number) => roads.has(`${c! + dc},${r! + dr}`) || (LAND[r! + dr]?.[c! + dc] ?? 0) !== 0;
      const rail = (dx: number, dz: number, w: number, d: number) =>
        addBox(asphalt, x + dx, LAND_HEIGHT + 0.12, z + dz, w, 0.2, d, P.white);
      const edge = CELL_SIZE / 2 - 0.05;
      if (!along(0, -1)) rail(0, -edge, CELL_SIZE, 0.08);
      if (!along(0, 1)) rail(0, edge, CELL_SIZE, 0.08);
      if (!along(-1, 0)) rail(-edge, 0, 0.08, CELL_SIZE);
      if (!along(1, 0)) rail(edge, 0, 0.08, CELL_SIZE);
    }
    for (const mark of roadMarkingsAt(roads, c!, r!)) {
      const along = mark.axis === "x";
      const xShift = mark.type === "stop" ? mark.dc * CELL_SIZE * 0.35 : 0;
      const zShift = mark.type === "stop" ? mark.dr * CELL_SIZE * 0.35 : 0;
      const length = mark.type === "dash" ? CELL_SIZE * 0.27 : CELL_SIZE * 0.31;
      addBox(markings, x + xShift, LAND_HEIGHT + 0.016, z + zShift,
        along ? length : 0.052, 0.005, along ? 0.052 : length, "#e3d8ba");
    }
    const horizontal = roads.has(`${c + 1},${r}`) || roads.has(`${c - 1},${r}`);
    const vertical = roads.has(`${c},${r - 1}`) || roads.has(`${c},${r + 1}`);
    if ((c! + r!) % 4 === 0 && (horizontal || vertical)) {
      const lx = x + (horizontal ? 0 : CELL_SIZE * 0.405);
      const lz = z + (horizontal ? -CELL_SIZE * 0.45 : 0);
      addBox(posts, lx, LAND_HEIGHT + 0.463, lz, 0.042, 0.9, 0.042, P.dark);
      const armX = lx + (horizontal ? 0 : -0.08);
      const armZ = lz + (horizontal ? 0.08 : 0);
      addBox(
        posts,
        armX,
        LAND_HEIGHT + 0.89,
        armZ,
        horizontal ? 0.045 : 0.21,
        0.05,
        horizontal ? 0.21 : 0.045,
        P.dark,
      );
      addBox(
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
  const details = buildBoxes(posts);
  return {
    asphalt: buildBoxes(asphalt),
    markings: buildBoxes(markings),
    details,
    lights: buildBoxes(lights),
  };
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

export function updatePlaceLabels(group: THREE.Group, viewHeight: number, yawDegrees = 45) {
  const t = THREE.MathUtils.smoothstep(viewHeight, PLACE_FADE_START, PLACE_FADE_END);
  group.visible = t > 0.01;
  if (!group.visible) return;
  const items = group.userData.items as {
    sprite: THREE.Sprite;
    material: THREE.SpriteMaterial;
    size: number;
  }[];
  // Declutter in screen space for the current heading: labels are
  // listed by priority, and one that would overlap an earlier shown label is hidden
  // until the player zooms in far enough for both to fit.
  const sinPitch = Math.sin(THREE.MathUtils.degToRad(CAMERA_PITCH_DEGREES));
  const yaw = THREE.MathUtils.degToRad(yawDegrees);
  const cosYaw = Math.cos(yaw),
    sinYaw = Math.sin(yaw);
  const shown: { x: number; y: number; w: number; h: number }[] = [];
  for (const { sprite, material, size } of items) {
    material.opacity = t;
    const h = viewHeight * size;
    const w = h * (sprite.userData.aspect as number);
    sprite.scale.set(w, h, 1);
    const x = sprite.position.x * cosYaw - sprite.position.z * sinYaw;
    const y = (sprite.position.x * sinYaw + sprite.position.z * cosYaw) * sinPitch;
    sprite.visible = !shown.some(
      (o) => Math.abs(o.x - x) < (o.w + w) * 0.5 && Math.abs(o.y - y) < (o.h + h) * 0.45,
    );
    if (sprite.visible) shown.push({ x, y, w, h });
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
