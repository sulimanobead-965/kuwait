import * as THREE from "three";
import { COLS, LAND, ROWS } from "../land.ts";
import type { CrisisKind, DisasterKind } from "../sim.ts";
import {
  CAMERA_PITCH_DEGREES,
  CAMERA_YAW_DEGREES,
  CELL_SIZE,
  LAND_HEIGHT,
  cellWorld,
} from "./camera.ts";

/**
 * Atmosphere and particle effects layered over the city: fire and smoke, sandstorms,
 * floods, blackouts, crisis tints, fireworks, birds and build dust. Everything is
 * pooled (fixed-size typed arrays, instancing, Points) and animated on real seconds.
 */

export type FxCell = { kind: "fire" | "smoke"; c: number; r: number; until: number };

export type FxInput = {
  disaster: DisasterKind | null;
  crisis: CrisisKind | null;
  celebrating: boolean;
  /** Cell effects; an entry is active while `day < until`. */
  cells: readonly FxCell[];
  day: number;
  night: number;
  target: THREE.Vector3;
  viewHeight: number;
  aspect: number;
  /** Drawing-buffer pixels per world unit (vertical). */
  pixelsPerUnit: number;
  /** Height (world units) of whatever stands on a cell; flames and smoke start there. */
  heightAt: (c: number, r: number) => number;
};

/** Smoothed 0–1 weights of each mood; read by the renderer for lights and cars. */
export type FxMood = {
  storm: number;
  flood: number;
  blackout: number;
  economic: number;
  pandemic: number;
  war: number;
  celebrate: number;
};

const SOFT_CAPACITY = 300;
const GLOW_CAPACITY = 170;
const RAIN_DROPS = 130;
const FLOCKS = 3;
const FLOCK_SIZE = 7;
const WATER_CAPACITY = 1400;
const MAX_FIRE_CELLS = 8;

const SIN_PITCH = Math.sin(THREE.MathUtils.degToRad(CAMERA_PITCH_DEGREES));
const YAW = THREE.MathUtils.degToRad(CAMERA_YAW_DEGREES);
/** Ground direction that points away from the camera (toward the screen's top edge). */
const FAR_X = -Math.sin(YAW);
const FAR_Z = -Math.cos(YAW);
const WIND_X = 1;
const WIND_Z = 0.35;

const FIREWORK_COLORS = ["#3fe07f", "#ffffff", "#ff4b4b", "#ffd24a", "#5ac8ff", "#ff7ad9"].map(
  (c) => new THREE.Color(c),
);

const pointVertex = /* glsl */ `
attribute float size;
attribute vec4 tint;
uniform float scale;
varying vec4 vTint;
void main() {
  vTint = tint;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(size * scale, 220.0);
}`;

const pointFragment = /* glsl */ `
uniform float hardness;
varying vec4 vTint;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = 1.0 - smoothstep(hardness, 1.0, d);
  if (a * vTint.a < 0.004) discard;
  gl_FragColor = vec4(vTint.rgb, vTint.a * a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const hazeVertex = /* glsl */ `
varying float vY;
void main() {
  vY = position.y * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const hazeFragment = /* glsl */ `
uniform vec3 color;
uniform float opacity;
varying float vY;
void main() {
  // Thicker toward the top of the screen, where the view looks farthest away.
  gl_FragColor = vec4(color, opacity * mix(0.75, 1.25, vY));
  #include <colorspace_fragment>
}`;

/** Fixed-capacity particle pool drawn as one Points object. */
class Pool {
  readonly points: THREE.Points;
  readonly material: THREE.ShaderMaterial;
  private readonly geometry = new THREE.BufferGeometry();
  private readonly pos: Float32Array;
  private readonly tint: Float32Array;
  private readonly size: Float32Array;
  private readonly vel: Float32Array;
  private readonly rgb: Float32Array;
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  private readonly s0: Float32Array;
  private readonly s1: Float32Array;
  private readonly a0: Float32Array;
  private readonly drag: Float32Array;
  private readonly grav: Float32Array;
  private readonly wind: Float32Array;
  private readonly flick: Float32Array;
  private cursor = 0;
  alive = 0;

  constructor(
    readonly capacity: number,
    additive: boolean,
    hardness: number,
  ) {
    this.pos = new Float32Array(capacity * 3);
    this.tint = new Float32Array(capacity * 4);
    this.size = new Float32Array(capacity);
    this.vel = new Float32Array(capacity * 3);
    this.rgb = new Float32Array(capacity * 3);
    this.age = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.s0 = new Float32Array(capacity);
    this.s1 = new Float32Array(capacity);
    this.a0 = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.grav = new Float32Array(capacity);
    this.wind = new Float32Array(capacity);
    this.flick = new Float32Array(capacity);
    const position = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    const tint = new THREE.BufferAttribute(this.tint, 4).setUsage(THREE.DynamicDrawUsage);
    const size = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute("position", position);
    this.geometry.setAttribute("tint", tint);
    this.geometry.setAttribute("size", size);
    this.material = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 20 }, hardness: { value: hardness } },
      vertexShader: pointVertex,
      fragmentShader: pointFragment,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }

  emit(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    s0: number,
    s1: number,
    color: THREE.Color,
    alpha: number,
    drag = 0,
    grav = 0,
    wind = 0,
    flick = 0,
  ) {
    const cap = this.capacity;
    let i = this.cursor;
    let tries = 0;
    while (this.life[i]! > 0 && tries < cap) {
      i = (i + 1) % cap;
      tries += 1;
    }
    if (tries >= cap) return false;
    this.cursor = (i + 1) % cap;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.rgb[i * 3] = color.r;
    this.rgb[i * 3 + 1] = color.g;
    this.rgb[i * 3 + 2] = color.b;
    this.age[i] = 0;
    this.life[i] = life;
    this.s0[i] = s0;
    this.s1[i] = s1;
    this.a0[i] = alpha;
    this.drag[i] = drag;
    this.grav[i] = grav;
    this.wind[i] = wind;
    this.flick[i] = flick;
    this.alive += 1;
    return true;
  }

  update(dt: number, time: number, scale: number) {
    this.material.uniforms.scale!.value = scale;
    if (this.alive === 0) {
      this.points.visible = false;
      return;
    }
    this.points.visible = true;
    let alive = 0;
    for (let i = 0; i < this.capacity; i += 1) {
      const life = this.life[i]!;
      if (life <= 0) continue;
      const age = this.age[i]! + dt;
      if (age >= life) {
        this.life[i] = 0;
        this.size[i] = 0;
        this.tint[i * 4 + 3] = 0;
        continue;
      }
      alive += 1;
      this.age[i] = age;
      const k = age / life;
      const damp = Math.exp(-this.drag[i]! * dt);
      const j = i * 3;
      this.vel[j] = this.vel[j]! * damp;
      this.vel[j + 1] = this.vel[j + 1]! * damp + this.grav[i]! * dt;
      this.vel[j + 2] = this.vel[j + 2]! * damp;
      const w = this.wind[i]!;
      this.pos[j] = this.pos[j]! + (this.vel[j]! + WIND_X * w) * dt;
      this.pos[j + 1] = this.pos[j + 1]! + this.vel[j + 1]! * dt;
      this.pos[j + 2] = this.pos[j + 2]! + (this.vel[j + 2]! + WIND_Z * w) * dt;
      let alpha = this.a0[i]! * Math.min(1, k * 7) * (1 - k);
      let size = this.s0[i]! + (this.s1[i]! - this.s0[i]!) * k;
      const flick = this.flick[i]!;
      if (flick > 0) {
        const f = 0.5 + 0.5 * Math.sin(time * 31 + i * 1.7);
        alpha *= 1 - flick * 0.55 * f;
        size *= 1 - flick * 0.25 * f;
      }
      this.size[i] = size;
      const t = i * 4;
      this.tint[t] = this.rgb[j]!;
      this.tint[t + 1] = this.rgb[j + 1]!;
      this.tint[t + 2] = this.rgb[j + 2]!;
      this.tint[t + 3] = alpha;
    }
    this.alive = alive;
    this.geometry.attributes.position!.needsUpdate = true;
    this.geometry.attributes.tint!.needsUpdate = true;
    this.geometry.attributes.size!.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

type Flock = {
  x: number;
  y: number;
  z: number;
  heading: number;
  goalX: number;
  goalZ: number;
  phase: number;
  speed: number;
};

type Launch = {
  active: boolean;
  t: number;
  x: number;
  y: number;
  z: number;
  color: number;
  /** Size factor so shells stay readable when zoomed out. */
  k: number;
};

function birdGeometry() {
  // A flat "V": body along +z, wing tips raised. Scaling Y flips the tips up and down.
  const g = new THREE.BufferGeometry();
  const v = new Float32Array([
    0, 0, 0.18, -0.55, 0.24, -0.16, 0, 0, -0.1, 0, 0, 0.18, 0, 0, -0.1, 0.55, 0.24, -0.16,
  ]);
  g.setAttribute("position", new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export class CityFx {
  readonly group = new THREE.Group();
  readonly mood: FxMood = {
    storm: 0,
    flood: 0,
    blackout: 0,
    economic: 0,
    pandemic: 0,
    war: 0,
    celebrate: 0,
  };
  /** World-space spots (x,z pairs) fireworks favor: landmarks or the district center. */
  landmarks: number[] = [];
  private soft = new Pool(SOFT_CAPACITY, false, 0.05);
  private glow = new Pool(GLOW_CAPACITY, true, 0.15);
  private rainGeometry = new THREE.BufferGeometry();
  private rainPos = new Float32Array(RAIN_DROPS * 6);
  private rainSeed = new Float32Array(RAIN_DROPS * 3);
  private rain: THREE.LineSegments;
  private rainMaterial = new THREE.LineBasicMaterial({
    color: "#d5e2e8",
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  private water: THREE.InstancedMesh;
  private puddles: THREE.InstancedMesh;
  private waterMaterial = new THREE.MeshStandardMaterial({
    color: "#6f9ca6",
    roughness: 0.05,
    metalness: 0.35,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
  });
  private haze: THREE.Mesh;
  private hazeMaterial = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color() }, opacity: { value: 0 } },
    vertexShader: hazeVertex,
    fragmentShader: hazeFragment,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  private hazeColor = new THREE.Color();
  private birds: THREE.InstancedMesh;
  private birdMaterial = new THREE.MeshBasicMaterial({ color: "#26363a", side: THREE.DoubleSide });
  private flocks: Flock[] = [];
  private seaCells: number[] = [];
  private flocksPlaced = false;
  private launches: Launch[] = Array.from({ length: 4 }, () => ({
    active: false,
    t: 0,
    x: 0,
    y: 0,
    z: 0,
    color: 0,
    k: 1,
  }));
  private fireworkTimer = 1;
  private flashTimer = 3;
  /** War horizon flash brightness, 0–1, decays quickly. */
  flash = 0;
  private flameAcc = 0;
  private smokeAcc = 0;
  private dustAcc = 0;
  private time = 0;
  private color = new THREE.Color();
  private tmp = new THREE.Color();
  private matrix = new THREE.Matrix4();
  private quat = new THREE.Quaternion();
  private scaleV = new THREE.Vector3();
  private posV = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private activeFire: number[] = [];
  private activeSmoke: number[] = [];

  constructor() {
    this.rainGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.rainPos, 3).setUsage(THREE.DynamicDrawUsage),
    );
    for (let i = 0; i < this.rainSeed.length; i += 1) this.rainSeed[i] = Math.random();
    this.rain = new THREE.LineSegments(this.rainGeometry, this.rainMaterial);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    const plane = new THREE.PlaneGeometry(1, 1);
    plane.rotateX(-Math.PI / 2);
    this.water = new THREE.InstancedMesh(plane, this.waterMaterial, WATER_CAPACITY);
    this.water.count = 0;
    this.water.visible = false;
    this.water.receiveShadow = true;
    const disc = new THREE.CircleGeometry(0.5, 18);
    disc.rotateX(-Math.PI / 2);
    this.puddles = new THREE.InstancedMesh(disc, this.waterMaterial, WATER_CAPACITY / 2);
    this.puddles.count = 0;
    this.puddles.visible = false;
    this.puddles.renderOrder = 1;
    this.birds = new THREE.InstancedMesh(birdGeometry(), this.birdMaterial, FLOCKS * FLOCK_SIZE);
    this.birds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.birds.frustumCulled = false;
    this.water.renderOrder = 1;
    this.soft.points.renderOrder = 2;
    this.glow.points.renderOrder = 3;
    this.rain.renderOrder = 4;
    this.haze = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.hazeMaterial);
    this.haze.frustumCulled = false;
    this.haze.renderOrder = 9;
    this.haze.visible = false;
    this.group.add(this.haze);
    this.group.add(
      this.water,
      this.puddles,
      this.soft.points,
      this.glow.points,
      this.rain,
      this.birds,
    );
    // Sea cells within a few cells of the coast, where gulls actually fly.
    // The gulf plane reaches ~10 cells past the map edge, so include that margin.
    for (let r = -10; r < ROWS + 10; r += 1)
      for (let c = -10; c < COLS + 10; c += 1) {
        if (LAND[r]?.[c] === 1) continue;
        let near = false;
        for (let dr = -4; dr <= 4 && !near; dr += 2)
          for (let dc = -4; dc <= 4 && !near; dc += 2) near = LAND[r + dr]?.[c + dc] === 1;
        if (near) this.seaCells.push(c, r);
      }
    for (let i = 0; i < FLOCKS; i += 1)
      this.flocks.push({
        x: 0,
        y: 7 + i * 1.3,
        z: 0,
        heading: i * 2.1,
        goalX: 0,
        goalZ: 0,
        phase: i * 1.9,
        speed: 3 + i * 0.4,
      });
  }

  /** Shallow flood water over roads and a few low, empty lots beside them. */
  setWater(roads: readonly string[], occupied: ReadonlySet<string>) {
    const roadSet = new Set(roads);
    let n = 0;
    let p = 0;
    this.quat.identity();
    const put = (x: number, z: number, sx: number, sz: number, y: number, round: boolean) => {
      const mesh = round ? this.puddles : this.water;
      const at = round ? p : n;
      if (at >= (round ? WATER_CAPACITY / 2 : WATER_CAPACITY)) return;
      this.posV.set(x, y, z);
      this.scaleV.set(sx, 1, sz);
      this.matrix.compose(this.posV, this.quat, this.scaleV);
      mesh.setMatrixAt(at, this.matrix);
      if (round) p += 1;
      else n += 1;
    };
    for (const key of roads) {
      const comma = key.indexOf(",");
      const c = Number(key.slice(0, comma));
      const r = Number(key.slice(comma + 1));
      const at = cellWorld(c, r);
      put(at.x, at.z, CELL_SIZE * 1.0, CELL_SIZE * 1.0, LAND_HEIGHT + 0.03, false);
      for (const [dc, dr] of [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ] as const) {
        const k = `${c + dc},${r + dr}`;
        if (roadSet.has(k) || occupied.has(k) || LAND[r + dr]?.[c + dc] !== 1) continue;
        const h = hash(c * 31 + r * 17 + dc * 5 + dr * 3);
        if (h > 0.32) continue;
        // Oval puddle lying along the road edge, spilling onto the low lot.
        const across = CELL_SIZE * (0.35 + h);
        const along = CELL_SIZE * (0.7 + h * 1.2);
        const slide = (hash(c * 7 + r * 13 + dc) - 0.5) * CELL_SIZE * 0.5;
        put(
          at.x + dc * (CELL_SIZE * 0.5 + across * 0.32) + (dr ? slide : 0),
          at.z + dr * (CELL_SIZE * 0.5 + across * 0.32) + (dc ? slide : 0),
          dc ? across : along,
          dr ? across : along,
          LAND_HEIGHT + 0.026,
          true,
        );
      }
    }
    this.water.count = n;
    this.water.instanceMatrix.needsUpdate = true;
    this.puddles.count = p;
    this.puddles.instanceMatrix.needsUpdate = true;
  }

  /** Small ring of dust kicked up when a building goes up. */
  puff(x: number, z: number) {
    this.color.set("#cdb68a");
    for (let i = 0; i < 14; i += 1) {
      const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
      const s = 1.5 + Math.random() * 0.8;
      this.soft.emit(
        x + Math.cos(a) * 0.55,
        LAND_HEIGHT + 0.15,
        z + Math.sin(a) * 0.55,
        Math.cos(a) * s,
        0.35 + Math.random() * 0.4,
        Math.sin(a) * s,
        0.8 + Math.random() * 0.35,
        0.45,
        1.25,
        this.color,
        0.75,
        2.6,
      );
    }
  }

  update(dt: number, input: FxInput) {
    this.time += dt;
    const ease = 1 - Math.exp(-dt * 1.1);
    const m = this.mood;
    const d = input.disaster;
    const c = input.crisis;
    m.storm += ((d === "storm" ? 1 : 0) - m.storm) * ease;
    m.flood += ((d === "flood" ? 1 : 0) - m.flood) * ease;
    m.blackout += ((d === "blackout" ? 1 : 0) - m.blackout) * ease * 2;
    m.economic += ((c === "economic" ? 1 : 0) - m.economic) * ease;
    m.pandemic += ((c === "pandemic" ? 1 : 0) - m.pandemic) * ease;
    m.war += ((c === "war" ? 1 : 0) - m.war) * ease;
    m.celebrate += ((input.celebrating ? 1 : 0) - m.celebrate) * ease;
    for (const key of [
      "storm",
      "flood",
      "blackout",
      "economic",
      "pandemic",
      "war",
      "celebrate",
    ] as const)
      if (m[key] < 0.002) m[key] = 0;

    this.updateCells(dt, input);
    if (m.storm > 0) this.updateDust(dt, input);
    this.updateRain(dt, input);
    this.water.visible = m.flood > 0.01 && this.water.count > 0;
    this.puddles.visible = m.flood > 0.01 && this.puddles.count > 0;
    // Gentle shimmer so the sheets read as water rather than paint.
    this.waterMaterial.opacity = (0.46 + 0.04 * Math.sin(this.time * 2.3)) * m.flood;
    if (m.war > 0.25) this.updateWar(dt, input);
    this.flash *= Math.exp(-dt * 6);
    this.updateFireworks(dt, input);
    this.updateBirds(dt, input);
    this.soft.update(dt, this.time, input.pixelsPerUnit);
    this.glow.update(dt, this.time, input.pixelsPerUnit);
  }

  private updateCells(dt: number, input: FxInput) {
    const fire = this.activeFire;
    const smoke = this.activeSmoke;
    fire.length = 0;
    smoke.length = 0;
    for (const cell of input.cells) {
      if (input.day >= cell.until) continue;
      const list = cell.kind === "fire" ? fire : smoke;
      if (list.length < MAX_FIRE_CELLS * 2) list.push(cell.c, cell.r);
    }
    const fires = fire.length / 2;
    const smokes = smoke.length / 2;
    if (fires === 0 && smokes === 0) return;
    this.flameAcc += dt * Math.min(100, fires * 30);
    while (this.flameAcc >= 1) {
      this.flameAcc -= 1;
      const k = Math.floor(Math.random() * fires) * 2;
      const at = cellWorld(fire[k]!, fire[k + 1]!);
      const tall = Math.max(0.8, input.heightAt(fire[k]!, fire[k + 1]!));
      const hot = Math.random();
      const x = at.x + (Math.random() - 0.5) * 1.5 - FAR_X * 0.75;
      const y = LAND_HEIGHT + tall * (0.25 + Math.random() * 0.85);
      const z = at.z + (Math.random() - 0.5) * 1.5 - FAR_Z * 0.75;
      const vx = (Math.random() - 0.5) * 0.4;
      const vy = 1.6 + Math.random() * 1.2;
      const vz = (Math.random() - 0.5) * 0.4;
      const life = 0.45 + Math.random() * 0.35;
      // Opaque-ish orange tongue (reads on bright sand by day) ...
      this.color.setRGB(1, 0.1 + hot * 0.16, 0.01);
      this.soft.emit(
        x,
        y,
        z,
        vx,
        vy,
        vz,
        life,
        1.6 + hot * 0.6,
        0.55,
        this.color,
        1,
        0.6,
        0,
        0.15,
        0.4,
      );
      // ... with an additive yellow core that blooms at night.
      if (hot > 0.35) {
        this.color.setRGB(1, 0.32 + hot * 0.2, 0.04);
        this.glow.emit(
          x,
          y + 0.1,
          z,
          vx,
          vy,
          vz,
          life * 0.8,
          0.6,
          0.15,
          this.color,
          0.5,
          0.6,
          0,
          0.15,
          1,
        );
      }
    }
    this.smokeAcc += dt * Math.min(36, fires * 6 + smokes * 4);
    while (this.smokeAcc >= 1) {
      this.smokeAcc -= 1;
      const pick = Math.random() * (fires * 6 + smokes * 4);
      const dark = pick < fires * 6;
      const list = dark ? fire : smoke;
      const k = Math.floor(Math.random() * (list.length / 2)) * 2;
      const at = cellWorld(list[k]!, list[k + 1]!);
      const tall = input.heightAt(list[k]!, list[k + 1]!);
      const g = Math.random() * 0.06;
      if (dark) this.color.setRGB(0.09 + g, 0.08 + g, 0.075 + g);
      else this.color.setRGB(0.5 + g * 2, 0.5 + g * 2, 0.49 + g * 2);
      this.soft.emit(
        at.x + (Math.random() - 0.5) * 0.9,
        LAND_HEIGHT + Math.max(dark ? 1.3 : 0.6, tall + 0.2) + Math.random() * 0.5,
        at.z + (Math.random() - 0.5) * 0.9,
        (Math.random() - 0.5) * 0.3,
        1.5 + Math.random() * 0.6,
        (Math.random() - 0.5) * 0.3,
        2.8 + Math.random() * 1.2,
        dark ? 0.9 : 0.7,
        dark ? 3.2 : 2.6,
        this.color,
        dark ? 0.62 : 0.45,
        0.15,
        0,
        0.55,
      );
    }
  }

  private updateDust(dt: number, input: FxInput) {
    const s = this.mood.storm;
    const reach = input.viewHeight * 0.95 + 6;
    this.dustAcc += dt * 75 * s;
    while (this.dustAcc >= 1) {
      this.dustAcc -= 1;
      const tone = Math.random();
      this.color.setRGB(0.86 + tone * 0.1, 0.7 + tone * 0.1, 0.46 + tone * 0.08);
      const big = Math.random() < 0.3;
      this.soft.emit(
        input.target.x + (Math.random() - 0.5) * 2 * reach - WIND_X * 6,
        LAND_HEIGHT + Math.random() * (big ? 4 : 7),
        input.target.z + (Math.random() - 0.5) * 2 * reach - WIND_Z * 6,
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.4) * 0.6,
        (Math.random() - 0.5) * 1.5,
        2.2 + Math.random() * 1.4,
        big ? 3 + Math.random() * 2 : 0.18 + Math.random() * 0.22,
        big ? 6 + Math.random() * 3 : 0.24,
        this.color,
        (big ? 0.13 : 0.85) * s,
        0,
        0,
        big ? 9 : 14,
      );
    }
  }

  private updateRain(dt: number, input: FxInput) {
    const f = this.mood.flood;
    this.rain.visible = f > 0.01;
    if (!this.rain.visible) return;
    this.rainMaterial.opacity = 0.6 * f;
    const reach = input.viewHeight * 0.95 + 4;
    const top = 24;
    const len = 1.1;
    const speed = 30;
    const tx = input.target.x;
    const tz = input.target.z;
    for (let i = 0; i < RAIN_DROPS; i += 1) {
      const s = i * 3;
      // seed: [x offset, z offset, height] in 0..1; height falls and wraps.
      let h = this.rainSeed[s + 2]! - (dt * speed) / top;
      if (h < 0) {
        h += 1;
        this.rainSeed[s] = Math.random();
        this.rainSeed[s + 1] = Math.random();
      }
      this.rainSeed[s + 2] = h;
      const x = tx + (this.rainSeed[s]! - 0.5) * 2 * reach;
      const z = tz + (this.rainSeed[s + 1]! - 0.5) * 2 * reach;
      const y = LAND_HEIGHT + h * top;
      const p = i * 6;
      this.rainPos[p] = x;
      this.rainPos[p + 1] = y;
      this.rainPos[p + 2] = z;
      this.rainPos[p + 3] = x + 0.12 * len;
      this.rainPos[p + 4] = y - len;
      this.rainPos[p + 5] = z + 0.04 * len;
    }
    this.rainGeometry.attributes.position!.needsUpdate = true;
  }

  private updateWar(dt: number, input: FxInput) {
    this.flashTimer -= dt;
    if (this.flashTimer > 0) return;
    this.flashTimer = 1.6 + Math.random() * 4;
    const dist = ((input.viewHeight * 0.5) / SIN_PITCH) * (0.75 + Math.random() * 0.2);
    const side = (Math.random() - 0.5) * input.viewHeight * input.aspect * 0.9;
    const x = input.target.x + FAR_X * dist - FAR_Z * side;
    const z = input.target.z + FAR_Z * dist + FAR_X * side;
    this.color.set(Math.random() < 0.5 ? "#ff9a4a" : "#ffd08a");
    const big = input.viewHeight * 0.14;
    this.glow.emit(
      x,
      LAND_HEIGHT + 1,
      z,
      0,
      0.6,
      0,
      0.55,
      big,
      big * 1.4,
      this.color,
      0.55 * this.mood.war,
    );
    this.color.set("#ffe2b0");
    this.glow.emit(x, LAND_HEIGHT + 1, z, 0, 0, 0, 0.25, big * 0.35, big * 0.5, this.color, 0.6);
    this.flash = Math.max(this.flash, 0.6 + Math.random() * 0.4);
  }

  private updateFireworks(dt: number, input: FxInput) {
    const cele = this.mood.celebrate;
    if (cele > 0.4) {
      this.fireworkTimer -= dt;
      if (this.fireworkTimer <= 0) {
        const dark = input.night > 0.45;
        this.fireworkTimer = dark ? 0.55 + Math.random() * 0.9 : 1.8 + Math.random() * 1.8;
        this.launch(input);
      }
    }
    for (const l of this.launches) {
      if (!l.active) continue;
      l.t -= dt;
      if (l.t > 0) continue;
      l.active = false;
      this.burst(l);
    }
  }

  private launch(input: FxInput) {
    const slot = this.launches.find((l) => !l.active);
    if (!slot) return;
    let x: number;
    let z: number;
    const spots = this.landmarks.length / 2;
    if (spots > 0 && Math.random() < 0.7) {
      const k = Math.floor(Math.random() * spots) * 2;
      x = this.landmarks[k]!;
      z = this.landmarks[k + 1]!;
    } else {
      x = input.target.x;
      z = input.target.z;
    }
    const spread = input.viewHeight * 0.22;
    x += (Math.random() - 0.5) * spread;
    z += (Math.random() - 0.5) * spread;
    const rise = 0.85 + Math.random() * 0.3;
    const k = THREE.MathUtils.clamp(input.viewHeight / 34, 1, 2.4);
    const apex = (9 + Math.random() * 5) * k;
    slot.active = true;
    slot.t = rise;
    slot.x = x;
    slot.y = LAND_HEIGHT + apex;
    slot.z = z;
    slot.color = Math.floor(Math.random() * FIREWORK_COLORS.length);
    slot.k = k;
    this.color.set("#ffe7b8");
    this.glow.emit(
      x,
      LAND_HEIGHT + 0.5,
      z,
      0,
      apex / rise,
      0,
      rise,
      0.35,
      0.22,
      this.color,
      0.9,
      0,
      0,
      0,
      0.5,
    );
  }

  private burst(l: Launch) {
    const base = FIREWORK_COLORS[l.color]!;
    const second = FIREWORK_COLORS[(l.color + 2) % FIREWORK_COLORS.length]!;
    const n = 40;
    const k = l.k;
    const sk = Math.sqrt(k);
    for (let i = 0; i < n; i += 1) {
      // Even points on a sphere (Fibonacci) so bursts read as round shells.
      const y = 1 - (2 * (i + 0.5)) / n;
      const rr = Math.sqrt(1 - y * y);
      const a = i * 2.39996;
      const speed = (4.6 + Math.random() * 0.8) * k;
      this.tmp.copy(i % 5 === 0 ? second : base);
      this.glow.emit(
        l.x,
        l.y,
        l.z,
        Math.cos(a) * rr * speed,
        y * speed,
        Math.sin(a) * rr * speed,
        1.3 + Math.random() * 0.6,
        0.6 * sk,
        0.22 * sk,
        this.tmp,
        1,
        1.4,
        -2.2 * k,
        0,
        0.8,
      );
    }
    this.color.set("#fff4d6");
    this.glow.emit(l.x, l.y, l.z, 0, 0, 0, 0.3, 3.5 * k, 5 * k, this.color, 0.6);
  }

  /** Debug: live particle counts. */
  particleCounts() {
    return { soft: this.soft.alive, glow: this.glow.alive };
  }

  /** Debug: each flock center (x, y, z) followed by its current goal on the ground. */
  flockCenters() {
    return this.flocks.flatMap((f) => [
      [f.x, LAND_HEIGHT + f.y, f.z] as const,
      [f.goalX, LAND_HEIGHT, f.goalZ] as const,
    ]);
  }

  /** How far a ground point is from the screen center, in half-screens (<1 is on screen). */
  private viewNorm(x: number, z: number, input: FxInput) {
    const dx = x - input.target.x;
    const dz = z - input.target.z;
    const lateral = Math.abs(dx * -FAR_Z + dz * FAR_X);
    const depth = Math.abs(dx * FAR_X + dz * FAR_Z);
    const halfW = (input.viewHeight * input.aspect) / 2;
    const halfD = input.viewHeight / 2 / SIN_PITCH;
    return Math.max(lateral / halfW, depth / halfD);
  }

  private placeFlocks(input: FxInput, all: boolean) {
    for (const flock of this.flocks) {
      if (!all && this.viewNorm(flock.x, flock.z, input) < 2.2) continue;
      const goal = this.pickSea(input);
      // Enter from just off screen, flying toward the chosen stretch of water.
      const reach = input.viewHeight * Math.max(0.6, input.aspect) * 0.75;
      flock.heading = Math.random() * Math.PI * 2;
      flock.x = goal.x - Math.cos(flock.heading) * reach;
      flock.z = goal.z - Math.sin(flock.heading) * reach;
      flock.goalX = goal.x;
      flock.goalZ = goal.z;
    }
  }

  /** A coastal sea cell, preferably one on screen. */
  private pickSea(input: FxInput) {
    const cells = this.seaCells.length / 2;
    let best = { x: input.target.x, z: input.target.z };
    let bestN = Infinity;
    for (let tries = 0; tries < 60 && cells > 0; tries += 1) {
      const k = Math.floor(Math.random() * cells) * 2;
      const at = cellWorld(this.seaCells[k]!, this.seaCells[k + 1]!);
      const n = this.viewNorm(at.x, at.z, input);
      if (n < 0.8) return at;
      if (n < bestN) {
        bestN = n;
        best = at;
      }
    }
    return best;
  }

  private updateBirds(dt: number, input: FxInput) {
    // Birds keep their distance from storms and war; they come back afterwards.
    const calm = 1 - Math.max(this.mood.storm, this.mood.war, this.mood.flood * 0.6);
    this.birds.visible = calm > 0.2 && input.night < 0.8;
    if (!this.birds.visible) return;
    if (!this.flocksPlaced) {
      this.flocksPlaced = true;
      this.placeFlocks(input, true);
    } else this.placeFlocks(input, false);
    // Slightly larger birds when zoomed out so they stay a readable few pixels.
    const size = 1.25 * THREE.MathUtils.clamp(input.viewHeight / 40, 1, 1.7);
    let n = 0;
    for (let f = 0; f < this.flocks.length; f += 1) {
      const flock = this.flocks[f]!;
      const gx = flock.goalX - flock.x;
      const gz = flock.goalZ - flock.z;
      if (gx * gx + gz * gz < 9) {
        const goal = this.pickSea(input);
        flock.goalX = goal.x;
        flock.goalZ = goal.z;
      }
      const want = Math.atan2(gz, gx);
      let turn = want - flock.heading;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      flock.heading += THREE.MathUtils.clamp(turn, -0.6 * dt, 0.6 * dt);
      const hx = Math.cos(flock.heading);
      const hz = Math.sin(flock.heading);
      flock.x += hx * flock.speed * dt;
      flock.z += hz * flock.speed * dt;
      this.quat.setFromAxisAngle(this.up, Math.PI / 2 - flock.heading);
      for (let b = 0; b < FLOCK_SIZE; b += 1) {
        const rank = Math.ceil(b / 2);
        const side = b === 0 ? 0 : b % 2 ? 1 : -1;
        const back = rank * 0.76 * size;
        const lateral = side * rank * 0.64 * size;
        const t = this.time * 9 + flock.phase + b * 0.7;
        const flap = Math.sin(t);
        this.posV.set(
          flock.x - hx * back - hz * lateral,
          LAND_HEIGHT + flock.y + Math.sin(this.time * 0.8 + b) * 0.25,
          flock.z - hz * back + hx * lateral,
        );
        this.scaleV.set(size, size * (0.25 + 0.85 * flap), size);
        this.matrix.compose(this.posV, this.quat, this.scaleV);
        this.birds.setMatrixAt(n++, this.matrix);
      }
    }
    this.birds.count = n;
    this.birds.instanceMatrix.needsUpdate = true;
  }

  /**
   * Re-grade the base sky/sun/hemisphere light for the current mood. Called after the
   * day-night cycle has set its values; fog color should be copied from `sky` afterwards.
   */
  grade(
    sky: THREE.Color,
    fog: THREE.Fog,
    sun: THREE.DirectionalLight,
    hemi: THREE.HemisphereLight,
    night: number,
  ) {
    const m = this.mood;
    const light = 1 - 0.72 * night;
    let near = 220;
    let far = 720;
    const haze = this.hazeColor.setRGB(0, 0, 0);
    let hazeAlpha = 0;
    const addHaze = (hex: string, alpha: number, bright: number) => {
      if (alpha <= 0) return;
      this.tmp.set(hex).multiplyScalar(bright);
      haze.lerp(this.tmp, alpha / (hazeAlpha + alpha));
      hazeAlpha += alpha;
    };
    if (m.economic > 0) {
      const l = sky.r * 0.3 + sky.g * 0.59 + sky.b * 0.11;
      this.tmp.setRGB(l, l, l);
      sky.lerp(this.tmp, 0.55 * m.economic);
      this.tmp.set("#d9d4cc");
      sun.color.lerp(this.tmp, 0.4 * m.economic);
      sun.intensity *= 1 - 0.12 * m.economic;
      near -= 70 * m.economic;
      addHaze("#9c9890", 0.17 * m.economic, light);
    }
    if (m.pandemic > 0) {
      this.tmp.set("#93a88f").multiplyScalar(light);
      sky.lerp(this.tmp, 0.35 * m.pandemic);
      this.tmp.set("#dfe8d0");
      sun.color.lerp(this.tmp, 0.35 * m.pandemic);
      near -= 120 * m.pandemic;
      addHaze("#93b08a", 0.17 * m.pandemic, light);
      far -= 300 * m.pandemic;
    }
    if (m.war > 0) {
      this.tmp.set("#8a4a38").multiplyScalar(0.55 + 0.45 * light);
      sky.lerp(this.tmp, 0.42 * m.war);
      this.tmp.set("#ffb98a");
      sun.color.lerp(this.tmp, 0.35 * m.war);
      sun.intensity *= 1 - 0.25 * m.war;
      hemi.intensity *= 1 - 0.15 * m.war;
      near -= 120 * m.war;
      addHaze("#7a3324", 0.2 * m.war + 0.14 * this.flash * m.war, 0.5 + 0.5 * light);
      far -= 300 * m.war;
      if (this.flash > 0.01) {
        this.tmp.set("#ff9c55");
        sky.lerp(this.tmp, 0.35 * this.flash * m.war);
        hemi.intensity *= 1 + 0.25 * this.flash * m.war;
      }
    }
    if (m.flood > 0) {
      this.tmp.set("#6d7c86").multiplyScalar(light);
      sky.lerp(this.tmp, 0.8 * m.flood);
      sun.intensity *= 1 - 0.6 * m.flood;
      this.tmp.set("#c7d3dc");
      sun.color.lerp(this.tmp, 0.6 * m.flood);
      this.tmp.set("#8b9aa5");
      hemi.color.lerp(this.tmp, 0.5 * m.flood);
      near = THREE.MathUtils.lerp(near, 95, m.flood);
      far = THREE.MathUtils.lerp(far, 380, m.flood);
      addHaze("#8494a0", 0.2 * m.flood, light);
    }
    if (m.storm > 0) {
      this.tmp.set("#c79f63").multiplyScalar(0.3 + 0.7 * light);
      sky.lerp(this.tmp, 0.9 * m.storm);
      sun.intensity *= 1 - 0.65 * m.storm;
      this.tmp.set("#f0c487");
      sun.color.lerp(this.tmp, 0.7 * m.storm);
      this.tmp.set("#d9b47a");
      hemi.color.lerp(this.tmp, 0.6 * m.storm);
      near = THREE.MathUtils.lerp(near, 38, m.storm);
      far = THREE.MathUtils.lerp(far, 205, m.storm);
      addHaze("#cfa468", 0.42 * m.storm, 0.3 + 0.7 * light);
    }
    if (m.blackout > 0) {
      const dark = m.blackout * night;
      hemi.intensity *= 1 - 0.4 * dark;
      sky.multiplyScalar(1 - 0.4 * dark);
    }
    this.haze.visible = hazeAlpha > 0.004;
    this.hazeMaterial.uniforms.color!.value.copy(haze);
    this.hazeMaterial.uniforms.opacity!.value = Math.min(0.6, hazeAlpha);
    fog.near = Math.max(20, near);
    fog.far = Math.max(fog.near + 60, far);
  }

  dispose() {
    this.soft.dispose();
    this.glow.dispose();
    this.rainGeometry.dispose();
    this.rainMaterial.dispose();
    this.water.geometry.dispose();
    this.waterMaterial.dispose();
    this.birds.geometry.dispose();
    this.haze.geometry.dispose();
    this.hazeMaterial.dispose();
    this.birdMaterial.dispose();
    this.water.dispose();
    this.puddles.geometry.dispose();
    this.puddles.dispose();
    this.birds.dispose();
  }
}
