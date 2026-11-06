import * as THREE from "three";
import type { HudTool } from "../../components/city-hud.tsx";
import type { Sim } from "@/game/sim";
import { cellKey, createInitial, isCelebrating, isLand, nearestOpenLot } from "@/game/sim";
import type { CrisisKind, DisasterKind } from "@/game/sim";
import { COLS, ROWS } from "@/game/land";
import { isLandmark } from "@/game/catalog";
import { districtBounds, districtById, sectorsForZone } from "@/game/districts";
import {
  CAMERA_DISTANCE,
  CAMERA_PITCH_DEGREES,
  CAMERA_YAW_DEGREES,
  CELL_SIZE,
  LAND_HEIGHT,
  cellWorld,
  clampCameraTarget,
  framedView,
  lodFor,
  worldCell,
  type Cell,
} from "./camera.ts";
import { lightingAt, type DayMode } from "./day-night.ts";
import { BuildingBatch, buildingModel, modelHeight } from "./models.ts";
import { createSiteObject, disposeSiteObject, updateSiteObject, type SiteObject } from "./construction.ts";
import { progressOf } from "../developments.ts";
import { CityFx, type FxCell, type FxInput } from "./fx.ts";
import { PALETTE, cityMaterials } from "./palette.ts";
import { mountDinarCoin } from "@/game/coin-face";
import { getLang, type Lang } from "@/i18n";
import {
  carGeometry,
  createGrid,
  createParcels,
  createDistrictNumbers,
  createRoads,
  createPlaceLabels,
  createTerrain,
  disposeDistrictNumbers,
  disposePlaceLabels,
  palmGeometry,
  updatePlaceLabels,
} from "./scenery.ts";

export type WorldCallbacks = {
  cell: (cell: Cell) => void;
  collect: (id: string) => void;
  zoom: (factor: number) => void;
  strokeEnd: () => void;
  zone: (box: { c0: number; r0: number; c1: number; r1: number } | null) => void;
};

export type WorldDiagnostics = {
  renderer: "three.js-webgl" | "unavailable";
  orthographic: boolean;
  pitch: number;
  yaw: number;
  buildings: number;
  roads: number;
  drawCalls: number;
  triangles: number;
  lodLevels: number;
  instancedPalms: number;
  instancedCars: number;
  dayMode: DayMode;
  night: number;
  lodDistribution: Record<string, number>;
  /** Buildings off screen (beyond a margin) and not drawn at all. */
  culledBuildings: number;
  /** Instanced building batches in use (one per kind, level and detail). */
  batches: number;
  /** CPU milliseconds the last `sync()` took (simulation → scene). */
  syncMs: number;
  /** CPU milliseconds the last rendered frame took, `render()` included. */
  frameMs: number;
};

type BuildingRecord = {
  id: string;
  /** The simulation object this record last mirrored. */
  src: Sim["buildings"][number];
  kind: Sim["buildings"][number]["kind"];
  level: number;
  c: number;
  r: number;
  x: number;
  z: number;
  born: number;
  orientation: number;
  lod: 0 | 1 | 2;
  /** Close enough to the camera target to fall inside the sun's shadow box. */
  shadow: boolean;
  /** Near enough to the screen (at the last re-bucket) to be drawn. */
  visible: boolean;
  /** Top of the current model above the ground, for fire and smoke. */
  height: number;
  batch: BuildingBatch<BuildingRecord> | null;
  slot: number;
  /** Build animation scale: across and up. */
  spread: number;
  rise: number;
  /** Coin anchor above the lot (also used to pick a tapped coin). */
  position: THREE.Vector3;
  seen: number;
};

type CarSlot = { i: number; x: number; z: number; horizontal: boolean };

/** Finger travel (px) before a build tap turns into a map drag. */
const PLACE_SLOP = 14;
/** Farthest zoom-out: a desktop sees the whole 210×203 map, a phone its full height. */
const MAX_VIEW = 410;
/** Start-screen showcase sits on the real Sharq waterfront just south of Kuwait Towers (see land.ts). */
const PREVIEW_SHIFT = { c: 114, r: 25 } as const;
export const PREVIEW_FOCUS = { c: 26 + PREVIEW_SHIFT.c, r: 24 + PREVIEW_SHIFT.r } as const;

export class CityWorld {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  camera: THREE.OrthographicCamera;
  private materials = cityMaterials();
  private terrain = createTerrain();
  /** Tile grid, built lazily: only a selected tool shows it, and it spans every land cell. */
  private grid = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial());
  private gridSource: { roads: ReadonlySet<string>; district: Sim["district"] } | null = {
    roads: new Set(),
    district: null,
  };
  private placeLabels = createPlaceLabels();
  /** Language the text sprites (place names, parcel numbers) were drawn in. */
  private lang: Lang = getLang();
  private parcels: THREE.Mesh | null = null;
  private fx = new CityFx();
  private fxInput: FxInput = {
    disaster: null,
    crisis: null,
    celebrating: false,
    cells: [],
    day: 0,
    night: 0,
    target: new THREE.Vector3(),
    viewHeight: 47,
    aspect: 1,
    pixelsPerUnit: 20,
    heightAt: (c, r) => this.heights.get(cellKey(c, r)) ?? 0,
  };
  /** Top height of each building by cell key, for anchoring fire and smoke. */
  private heights = new Map<string, number>();
  /** Debug-only visual overrides set through `window.__cityFx` in development. */
  private fxOverride: {
    disaster?: DisasterKind | null;
    crisis?: CrisisKind | null;
    celebrate?: boolean;
    cells?: FxCell[];
  } = {};
  private phaseOverride: number | null = null;
  private celebrateDay = -1;
  private celebrateCached = false;
  private puffed = new Set<string>();
  private landmarkSignature = "";
  private waterSignature = "";
  private sky = new THREE.Color();
  private carColor = new THREE.Color();
  private carMatrix = new THREE.Matrix4();
  /** Road meshes per map chunk, so an edit rebuilds a chunk rather than every road. */
  private roadChunks = new Map<number, THREE.Mesh[]>();
  private roadSet: ReadonlySet<string> = new Set();
  /** What the road list looked like at the last rebuild (cheap change detection). */
  private roadsSeen: {
    list: readonly string[] | null;
    length: number;
    first: string | undefined;
    last: string | undefined;
    district: Sim["district"];
    at: number;
    cost: number;
  } = { list: null, length: 0, first: undefined, last: undefined, district: null, at: 0, cost: 0 };
  private roadVersion = 0;
  private buildingVersion = 0;
  private carSlots: CarSlot[] = [];
  private previewSim: Sim | null = null;
  private labelsHeight = -1;
  private aimMemo: { c: number; r: number; version: number; cell: Cell | null } = {
    c: NaN,
    r: NaN,
    version: -1,
    cell: null,
  };
  disabled = false;
  private districtId: Sim["district"] = null;
  private districtNumbers: THREE.Group | null = null;
  /** Building records by id, by cell, and in the simulation's array order. */
  private records = new Map<string, BuildingRecord>();
  private cellRecords = new Map<string, BuildingRecord>();
  private order: (BuildingRecord | undefined)[] = [];
  private stamp = 0;
  /** Instanced batches by model key; every building is an instance in one of them. */
  private batches = new Map<string, BuildingBatch<BuildingRecord>>();
  private dirtyBatches = new Set<BuildingBatch<BuildingRecord>>();
  private buildingLayer = new THREE.Group();
  private rising = new Set<BuildingRecord>();
  private lodCounts: Record<string, number> = {};
  /** The view buildings were last bucketed for (LOD and on-screen culling). */
  private lodView = {
    matrix: new THREE.Matrix4(),
    pad: { x: 0, y: 0 },
    x: 0,
    z: 0,
    height: 1,
    aspect: 1,
    at: 0,
  };
  /** Fenced developer construction sites, by site id. */
  private sites = new Map<string, SiteObject>();
  private palms: THREE.InstancedMesh;
  private cars: THREE.InstancedMesh;
  private highlight: THREE.Mesh;
  private zoneMesh: THREE.Mesh;
  private sun = new THREE.DirectionalLight("#fff0d4", 2.3);
  private hemi = new THREE.HemisphereLight("#c2e5e6", "#ae986f", 1.65);
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -LAND_HEIGHT);
  private pointers = new Map<number, { x: number; y: number }>();
  private target = new THREE.Vector3(9, LAND_HEIGHT, 8);
  private targetGoal = this.target.clone();
  private viewHeight = 47;
  private viewHeightGoal = 47;
  private width = 1;
  private height = 1;
  private pixelRatio = 1;
  private timer = new THREE.Timer();
  private elapsed = 0;
  private currentTool: HudTool = null;
  private sim: Sim | null = null;
  private pointerDown: {
    x: number;
    y: number;
    moved: number;
    road: boolean;
    zone: boolean;
    place: Cell | null;
    id: number;
  } | null = null;
  private pinch: { dist: number; zoom: number; mx: number; my: number } | null = null;
  /** Last pointer position while dragging out a zone/demolish box (for edge scrolling). */
  private edgePointer: { x: number; y: number } | null = null;
  private hover: Cell | null = null;
  private zone: Cell | null = null;
  private dirtyShadows = true;
  private dbg!: WorldDiagnostics;
  private readonly observer: ResizeObserver;

  constructor(
    private canvas: HTMLCanvasElement,
    private callbacks: WorldCallbacks,
    private unlockAudio: () => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    const pitch = THREE.MathUtils.degToRad(CAMERA_PITCH_DEGREES);
    const yaw = THREE.MathUtils.degToRad(CAMERA_YAW_DEGREES);
    this.camera = new THREE.OrthographicCamera(-30, 30, 20, -20, 0.1, CAMERA_DISTANCE + 800);
    this.camera.position
      .copy(this.target)
      .add(
        new THREE.Vector3(
          Math.sin(yaw) * Math.cos(pitch) * CAMERA_DISTANCE,
          Math.sin(pitch) * CAMERA_DISTANCE,
          Math.cos(yaw) * Math.cos(pitch) * CAMERA_DISTANCE,
        ),
      );
    this.camera.lookAt(this.target);
    this.grid.visible = false;
    this.scene.add(
      this.camera,
      this.hemi,
      this.sun,
      this.sun.target,
      this.terrain.group,
      this.grid,
      this.placeLabels,
      this.buildingLayer,
    );
    this.buildingLayer.name = "buildings";
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.width < 600 ? 1024 : 2048, this.width < 600 ? 1024 : 2048);
    this.sun.shadow.camera.left = -45;
    this.sun.shadow.camera.right = 45;
    this.sun.shadow.camera.top = 45;
    this.sun.shadow.camera.bottom = -45;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 190;
    this.sun.shadow.normalBias = 0.025;
    this.sun.shadow.bias = -0.00018;
    this.sun.shadow.radius = 2;
    this.scene.fog = new THREE.Fog("#a5cbd2", CAMERA_DISTANCE + 120, CAMERA_DISTANCE + 620);
    this.scene.background = new THREE.Color("#a5cbd2");
    const water = new THREE.Mesh(
      new THREE.BoxGeometry(COLS * CELL_SIZE + 1200, 0.3, ROWS * CELL_SIZE + 1200),
      new THREE.MeshStandardMaterial({ color: PALETTE.gulf, roughness: 0.24, metalness: 0.22 }),
    );
    water.position.y = -0.34;
    water.receiveShadow = true;
    this.scene.add(water);
    this.palms = new THREE.InstancedMesh(palmGeometry(), this.materials.opaque, 160);
    this.palms.count = 0;
    this.palms.castShadow = true;
    this.palms.receiveShadow = true;
    this.cars = new THREE.InstancedMesh(carGeometry(), this.materials.vehicles, 60);
    this.cars.count = 0;
    this.cars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cars.frustumCulled = false;
    this.scene.add(this.palms, this.cars);
    this.highlight = new THREE.Mesh(
      new THREE.BoxGeometry(CELL_SIZE * 0.96, 0.035, CELL_SIZE * 0.96),
      new THREE.MeshBasicMaterial({
        color: "#45e0d5",
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
      }),
    );
    this.highlight.visible = false;
    this.zoneMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.04, 1),
      new THREE.MeshBasicMaterial({
        color: "#29c995",
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
      }),
    );
    this.zoneMesh.visible = false;
    this.scene.add(this.highlight, this.zoneMesh, this.fx.group);
    if (import.meta.env.DEV) this.installFxDebug();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.timer.connect(document);
    this.bindEvents();
    this.resize();
    this.dbg = {
      renderer: "three.js-webgl",
      orthographic: this.camera.isOrthographicCamera,
      pitch: CAMERA_PITCH_DEGREES,
      yaw: CAMERA_YAW_DEGREES,
      buildings: 0,
      roads: 0,
      drawCalls: 0,
      triangles: 0,
      lodLevels: 0,
      instancedPalms: 0,
      instancedCars: 0,
      dayMode: "auto",
      night: 0,
      lodDistribution: {},
      culledBuildings: 0,
      batches: 0,
      syncMs: 0,
      frameMs: 0,
    };
    this.canvas.addEventListener("pointerdown", this.unlockAudio, { passive: true });
    this.canvas.addEventListener("webglcontextrestored", this.onContextRestored);
    this.canvas.dataset.ready = "1";
    this.canvas.dataset.renderer = "three";
    this.renderer.setAnimationLoop(() => this.frame());
  }

  diagnostics(): Readonly<WorldDiagnostics> {
    return this.dbg;
  }

  /** Render once and return the frame as a JPEG data URL (for the "city photo" share). */
  snapshot(): string {
    if (this.dirtyShadows) this.renderer.shadowMap.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
    this.dirtyShadows = false;
    return this.renderer.domElement.toDataURL("image/jpeg", 0.92);
  }

  /**
   * Development helper: `window.__cityFx.force({ disaster: "storm", phase: 0.6, ... })`
   * forces effects on screen without touching the simulation; `clear()` undoes it.
   */
  private installFxDebug() {
    const w = window as unknown as { __cityFx?: unknown };
    w.__cityFx = {
      force: (o: {
        disaster?: DisasterKind | null;
        crisis?: CrisisKind | null;
        celebrate?: boolean;
        fire?: [number, number][];
        smoke?: [number, number][];
        phase?: number | null;
      }) => {
        if ("disaster" in o) this.fxOverride.disaster = o.disaster;
        if ("crisis" in o) this.fxOverride.crisis = o.crisis;
        if ("celebrate" in o) this.fxOverride.celebrate = o.celebrate;
        if (o.fire || o.smoke)
          this.fxOverride.cells = [
            ...(o.fire ?? []).map(([c, r]) => ({ kind: "fire" as const, c, r, until: Infinity })),
            ...(o.smoke ?? []).map(([c, r]) => ({ kind: "smoke" as const, c, r, until: Infinity })),
          ];
        if ("phase" in o) this.phaseOverride = o.phase ?? null;
      },
      clear: () => {
        this.fxOverride = {};
        this.phaseOverride = null;
      },
      mood: () => ({ ...this.fx.mood }),
      focus: (c: number, r: number, height = 30) => this.focus({ c, r }, height),
      probe: (id: string) => {
        const rec = this.records.get(id);
        return { y: rec?.rise ?? -1, x: rec?.spread ?? -1, ...this.fx.particleCounts() };
      },
      birds: () =>
        this.fx.flockCenters().map(([x, y, z]) => {
          const p = new THREE.Vector3(x, y, z).project(this.camera);
          return [Math.round(((p.x + 1) * this.width) / 2), Math.round(((1 - p.y) * this.height) / 2)];
        }),
      info: () => ({
        parcels: this.parcels?.geometry.getAttribute("position").count ?? 0,
        parcelsInScene: Boolean(this.parcels?.parent),
        viewHeight: this.viewHeight,
        buildings: this.sim?.buildings.map((b) => [b.id, b.kind, b.c, b.r]) ?? [],
      }),
    };
  }

  private updateFxInput(sim: Sim) {
    const input = this.fxInput;
    const o = this.fxOverride;
    const disaster = sim.disaster && sim.day < sim.disaster.until ? sim.disaster.kind : null;
    const crisis = sim.crisis && sim.day < sim.crisis.until ? sim.crisis.kind : null;
    // isCelebrating builds a Date; only re-check when the day or the event changes.
    const key = Math.floor(sim.day) * 2 + (sim.event && sim.day < sim.event.until ? 1 : 0);
    if (key !== this.celebrateDay) {
      this.celebrateDay = key;
      this.celebrateCached = sim.started && isCelebrating(sim);
    }
    input.disaster = o.disaster !== undefined ? o.disaster : disaster;
    input.crisis = o.crisis !== undefined ? o.crisis : crisis;
    input.celebrating = o.celebrate ?? this.celebrateCached;
    input.cells = o.cells ?? sim.fx ?? [];
    input.day = o.cells ? 0 : sim.day;
  }

  private bindEvents() {
    this.canvas.addEventListener("pointerdown", this.onDown);
    this.canvas.addEventListener("pointermove", this.onMove);
    this.canvas.addEventListener("pointerup", this.onUp);
    this.canvas.addEventListener("pointercancel", this.onUp);
    this.canvas.addEventListener("pointerleave", this.onLeave);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.canvas.style.touchAction = "none";
    this.canvas.addEventListener("webglcontextlost", this.onContextLost);
  }

  private onContextRestored = () => {
    this.dirtyShadows = true;
    this.resize();
  };

  private onContextLost = (event: Event) => {
    event.preventDefault();
    window.dispatchEvent(new CustomEvent("city-graphics-lost"));
  };

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.pixelRatio = Math.min(window.innerWidth < 700 ? 1.5 : 1.8, window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(this.width < 600 ? 1 : this.pixelRatio);
    this.renderer.setSize(this.width, this.height, false);
    this.updateProjection();
    if (this.districtId) this.frameDistrict();
  }

  private updateProjection() {
    const aspect = this.width / this.height;
    this.camera.left = (-this.viewHeight * aspect) / 2;
    this.camera.right = -this.camera.left;
    this.camera.top = this.viewHeight / 2;
    this.camera.bottom = -this.camera.top;
    this.camera.updateProjectionMatrix();
  }

  private local(e: PointerEvent | WheelEvent) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private cellAt(x: number, y: number): Cell {
    const rect = this.canvas.getBoundingClientRect();
    const pixel = new THREE.Vector2((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(pixel, this.camera);
    const point = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.groundPlane, point);
    return worldCell(point.x, point.z);
  }

  private rayCell(event: PointerEvent) {
    const point = this.local(event);
    return this.cellAt(point.x, point.y);
  }

  private onDown = (e: PointerEvent) => {
    if (this.disabled) return;
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const rect = this.canvas.getBoundingClientRect();
      this.pinch = {
        dist: Math.hypot(a!.x - b!.x, a!.y - b!.y),
        zoom: this.viewHeightGoal,
        mx: (a!.x + b!.x) / 2 - rect.left,
        my: (a!.y + b!.y) / 2 - rect.top,
      };
      // A second finger turns a half-drawn selection box into a map move; any box
      // already chosen stays on the map.
      if (this.pointerDown?.zone && this.zone) {
        this.zone = null;
        this.zoneMesh.visible = false;
      }
      this.edgePointer = null;
      this.pointerDown = null;
      this.callbacks.strokeEnd();
      return;
    }
    this.callbacks.strokeEnd();
    // Finish any glide so the first drag frame starts from where the map really is.
    this.target.copy(this.targetGoal);
    this.viewHeight = this.viewHeightGoal;
    this.updateProjection();
    this.poseCamera();
    const p = this.local(e);
    const road = Boolean(this.sim?.started && this.currentTool?.kind === "road");
    const zone = Boolean(
      this.sim?.started && (this.currentTool?.kind === "zone" || this.currentTool?.kind === "demolish"),
    );
    const placing = Boolean(
      this.sim?.started &&
        (this.currentTool?.kind === "build" || this.currentTool?.kind === "bulldoze"),
    );
    this.pointerDown = {
      x: p.x,
      y: p.y,
      moved: 0,
      road,
      zone,
      place: placing ? this.rayCell(e) : null,
      id: e.pointerId,
    };
    if (road) this.callbacks.cell(this.rayCell(e));
    if (zone) this.zone = this.rayCell(e);
  };

  private onMove = (e: PointerEvent) => {
    if (this.disabled) return;
    if (this.pointers.has(e.pointerId))
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.hover = this.rayCell(e);
    if (this.pointers.size >= 2 && this.pinch) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      this.viewHeightGoal = THREE.MathUtils.clamp(
        (this.pinch.zoom * this.pinch.dist) / Math.max(12, dist),
        10,
        MAX_VIEW,
      );
      // Two fingers also move the map, so it can be panned while a tool is active.
      const rect = this.canvas.getBoundingClientRect();
      const mx = (a!.x + b!.x) / 2 - rect.left;
      const my = (a!.y + b!.y) / 2 - rect.top;
      const before = this.groundAt(this.pinch.mx, this.pinch.my);
      const after = this.groundAt(mx, my);
      this.pinch.mx = mx;
      this.pinch.my = my;
      if (before && after) {
        this.target.add(before.sub(after));
        clampCameraTarget(this.target, this.viewHeight);
        this.targetGoal.copy(this.target);
        this.poseCamera();
      }
      return;
    }
    const drag = this.pointerDown;
    if (!drag) return;
    const p = this.local(e);
    const dx = p.x - drag.x;
    const dy = p.y - drag.y;
    drag.moved += Math.hypot(dx, dy);
    drag.x = p.x;
    drag.y = p.y;
    if (drag.road) {
      this.callbacks.cell(this.hover);
      return;
    }
    if (drag.zone && this.zone) {
      this.edgePointer = { x: p.x, y: p.y };
      this.drawZone(this.zone, this.hover);
      return;
    }
    if (drag.place && drag.moved < PLACE_SLOP) return;
    if (drag.moved > 3) {
      // Keep the ground point under the finger glued to it: project the previous and
      // current pointer onto the ground with the same camera and move by the difference.
      const before = this.groundAt(p.x - dx, p.y - dy);
      const after = this.groundAt(p.x, p.y);
      if (!before || !after) return;
      this.target.add(before.sub(after));
      clampCameraTarget(this.target, this.viewHeight);
      this.targetGoal.copy(this.target);
      this.poseCamera();
    }
  };

  private groundAt(x: number, y: number) {
    const pixel = new THREE.Vector2((x / this.width) * 2 - 1, -(y / this.height) * 2 + 1);
    this.raycaster.setFromCamera(pixel, this.camera);
    const point = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.groundPlane, point);
  }

  private poseCamera() {
    const pitch = THREE.MathUtils.degToRad(CAMERA_PITCH_DEGREES),
      yaw = THREE.MathUtils.degToRad(CAMERA_YAW_DEGREES);
    this.camera.position
      .copy(this.target)
      .add(
        new THREE.Vector3(
          Math.sin(yaw) * Math.cos(pitch) * CAMERA_DISTANCE,
          Math.sin(pitch) * CAMERA_DISTANCE,
          Math.cos(yaw) * Math.cos(pitch) * CAMERA_DISTANCE,
        ),
      );
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
    this.dirtyShadows = true;
  }

  private onUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    const drag = this.pointerDown;
    if (!drag || drag.id !== e.pointerId) return;
    if (this.pointers.size === 0) {
      this.pointerDown = null;
      this.callbacks.strokeEnd();
    }
    this.edgePointer = null;
    if (drag.zone && this.zone) {
      const end = this.hover ?? this.rayCell(e);
      const district = this.sim?.district ?? null;
      const demolish = this.currentTool?.kind === "demolish";
      const tooSmall = Math.abs(end.c - this.zone.c) < 3 || Math.abs(end.r - this.zone.r) < 3;
      this.zoneMesh.visible = false;
      if (district || demolish) {
        this.callbacks.zone({
          c0: Math.min(this.zone.c, end.c),
          r0: Math.min(this.zone.r, end.r),
          c1: Math.max(this.zone.c, end.c),
          r1: Math.max(this.zone.r, end.r),
        });
      } else if (tooSmall) {
        this.callbacks.zone(null);
      } else {
        this.callbacks.zone({
          c0: this.zone.c,
          r0: this.zone.r,
          c1: end.c,
          r1: end.r,
        });
      }
      this.zone = null;
      return;
    }
    if (drag.place && drag.moved < PLACE_SLOP && this.sim) {
      const released = this.rayCell(e);
      const cell =
        nearestOpenLot(this.sim, released.c, released.r, 1) ??
        (drag.place ? nearestOpenLot(this.sim, drag.place.c, drag.place.r, 1) : null) ??
        released;
      this.callbacks.cell(cell);
      return;
    }
    if (drag.moved >= 14 || drag.road || !this.sim?.started) return;
    const cell = this.rayCell(e);
    if (this.currentTool?.kind !== "bulldoze") {
      let best: { id: string; d: number } | null = null;
      for (const b of this.sim.buildings) {
        if (b.stored < 1) continue;
        const record = this.records.get(b.id);
        if (!record) continue;
        const projected = record.position.clone().project(this.camera);
        const x = ((projected.x + 1) * this.width) / 2;
        const y = ((1 - projected.y) * this.height) / 2;
        const d = Math.hypot(
          x - (e.clientX - this.canvas.getBoundingClientRect().left),
          y - (e.clientY - this.canvas.getBoundingClientRect().top),
        );
        if (d < 31 && (!best || d < best.d)) best = { id: b.id, d };
      }
      if (best) {
        this.callbacks.collect(best.id);
        return;
      }
    }
    this.callbacks.cell(cell);
  };

  private onLeave = () => {
    if (this.pointers.size === 0) {
      this.hover = null;
      this.highlight.visible = false;
    }
  };

  private onWheel = (e: WheelEvent) => {
    if (this.disabled) return;
    e.preventDefault();
    this.callbacks.zoom(e.deltaY > 0 ? 1.13 : 0.86);
  };

  private drawZone(start: Cell, end: Cell) {
    const demolish = this.currentTool?.kind === "demolish";
    (this.zoneMesh.material as THREE.MeshBasicMaterial).color.set(demolish ? "#e5484d" : "#29c995");
    const district = demolish ? null : (this.sim?.district ?? null);
    const parcels = district
      ? sectorsForZone(
          district,
          Math.min(start.c, end.c),
          Math.min(start.r, end.r),
          Math.max(start.c, end.c),
          Math.max(start.r, end.r),
        )
      : [];
    let c0 = Math.min(start.c, end.c);
    let c1 = Math.max(start.c, end.c);
    let r0 = Math.min(start.r, end.r);
    let r1 = Math.max(start.r, end.r);
    if (parcels.length) {
      c0 = 99;
      c1 = 0;
      r0 = 99;
      r1 = 0;
      for (const parcel of parcels) {
        for (const cell of parcel.cells) {
          c0 = Math.min(c0, cell.c);
          c1 = Math.max(c1, cell.c);
          r0 = Math.min(r0, cell.r);
          r1 = Math.max(r1, cell.r);
        }
      }
    }
    const a = cellWorld(c0, r0),
      b = cellWorld(c1, r1);
    this.zoneMesh.position.set((a.x + b.x) / 2, LAND_HEIGHT + 0.11, (a.z + b.z) / 2);
    this.zoneMesh.scale.set((c1 - c0 + 1) * CELL_SIZE, 1, (r1 - r0 + 1) * CELL_SIZE);
    this.zoneMesh.visible = true;
  }

  setZone(box: { c0: number; r0: number; c1: number; r1: number } | null) {
    if (!box) {
      this.zoneMesh.visible = false;
      return;
    }
    this.drawZone({ c: box.c0, r: box.r0 }, { c: box.c1, r: box.r1 });
  }

  setTool(tool: HudTool) {
    this.currentTool = tool;
    this.grid.visible = Boolean(tool);
    if (tool) this.buildGrid();
  }

  /** Builds the pending tile grid, if any; cheap no-op once it is current. */
  private buildGrid() {
    if (!this.gridSource) return;
    const { roads, district } = this.gridSource;
    this.gridSource = null;
    this.scene.remove(this.grid);
    this.grid.geometry.dispose();
    this.grid.material.dispose();
    this.grid = createGrid(roads, district);
    this.grid.visible = Boolean(this.currentTool);
    this.scene.add(this.grid);
  }

  /** Redraws the map's text (place names and parcel numbers) in another language. */
  setLang(lang: Lang) {
    if (lang === this.lang) return;
    this.lang = lang;
    const visible = this.placeLabels.visible;
    this.scene.remove(this.placeLabels);
    disposePlaceLabels(this.placeLabels);
    this.placeLabels = createPlaceLabels();
    this.placeLabels.visible = visible;
    this.scene.add(this.placeLabels);
    const district = districtById(this.districtId);
    if (this.districtNumbers && district) {
      this.scene.remove(this.districtNumbers);
      disposeDistrictNumbers(this.districtNumbers);
      this.districtNumbers = createDistrictNumbers(district);
      this.scene.add(this.districtNumbers);
    }
  }

  setDayMode(mode: DayMode) {
    this.dbg.dayMode = mode;
    this.dirtyShadows = true;
  }

  zoom(factor: number) {
    this.viewHeightGoal = THREE.MathUtils.clamp(this.viewHeightGoal / factor, 10, MAX_VIEW);
  }

  focus(cell: Cell, viewHeight = 32) {
    const at = cellWorld(cell.c, cell.r);
    this.targetGoal.set(at.x, LAND_HEIGHT, at.z);
    this.target.copy(this.targetGoal);
    this.viewHeightGoal = viewHeight;
    this.viewHeight = viewHeight;
    this.updateProjection();
    const pitch = THREE.MathUtils.degToRad(CAMERA_PITCH_DEGREES),
      yaw = THREE.MathUtils.degToRad(CAMERA_YAW_DEGREES);
    this.camera.position
      .copy(this.target)
      .add(
        new THREE.Vector3(
          Math.sin(yaw) * Math.cos(pitch) * CAMERA_DISTANCE,
          Math.sin(pitch) * CAMERA_DISTANCE,
          Math.cos(yaw) * Math.cos(pitch) * CAMERA_DISTANCE,
        ),
      );
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
    this.dirtyShadows = true;
  }

  frameDistrict() {
    if (!this.districtId || this.width < 2) return;
    const box = districtBounds(this.districtId);
    const canvas = this.canvas.getBoundingClientRect();
    const footer = document.querySelector("main.game-shell footer");
    let occluded = 0.38;
    if (footer && canvas.height > 0) {
      const foot = footer.getBoundingClientRect();
      occluded = Math.min(0.62, Math.max(0.22, (canvas.bottom - foot.top) / canvas.height + 0.03));
    }
    const framed = framedView(box.cols, box.rows, this.width, this.height, occluded);
    const at = cellWorld(box.c, box.r);
    this.targetGoal.set(at.x, LAND_HEIGHT, at.z).addScaledVector(
      new THREE.Vector3(Math.SQRT1_2, 0, Math.SQRT1_2),
      framed.shift,
    );
    clampCameraTarget(this.targetGoal, framed.viewHeight);
    this.target.copy(this.targetGoal);
    this.viewHeightGoal = framed.viewHeight;
    this.viewHeight = framed.viewHeight;
    this.updateProjection();
    const pitch = THREE.MathUtils.degToRad(CAMERA_PITCH_DEGREES),
      yaw = THREE.MathUtils.degToRad(CAMERA_YAW_DEGREES);
    this.camera.position.copy(this.target).add(
      new THREE.Vector3(
        Math.sin(yaw) * Math.cos(pitch) * CAMERA_DISTANCE,
        Math.sin(pitch) * CAMERA_DISTANCE,
        Math.cos(yaw) * Math.cos(pitch) * CAMERA_DISTANCE,
      ),
    );
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
    this.dirtyShadows = true;
  }

  projectCell(c: number, r: number) {
    const world = cellWorld(c, r);
    const ndc = new THREE.Vector3(world.x, LAND_HEIGHT, world.z).project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: rect.left + ((ndc.x + 1) * rect.width) / 2,
      y: rect.top + ((1 - ndc.y) * rect.height) / 2,
    };
  }

  sync(input: Sim, now: number, force = false) {
    const started = performance.now();
    this.syncScene(input, now, force);
    this.dbg.syncMs = performance.now() - started;
  }

  private syncScene(input: Sim, now: number, force: boolean) {
    // Pointer interaction uses the same live simulation reference as drawing.
    // The preview below is visual only and must never overwrite this binding.
    this.sim = input;
    if (input.district !== this.districtId) {
      this.districtId = input.district;
      if (this.districtNumbers) {
        this.scene.remove(this.districtNumbers);
        disposeDistrictNumbers(this.districtNumbers);
        this.districtNumbers = null;
      }
      const district = districtById(this.districtId);
      if (district) {
        this.districtNumbers = createDistrictNumbers(district);
        this.scene.add(this.districtNumbers);
      }
      if (district) this.frameDistrict();
      else this.focus(PREVIEW_FOCUS, 31);
    }
    const preview =
      !input.started && !input.district && input.buildings.length === 0 && input.roads.length === 0;
    // The showcase is built once: a fresh copy every frame would look like a new city.
    const sim = preview ? (this.previewSim ??= createInitialPreview()) : input;
    // Saved cities without a neighborhood still need a portrait-usable frame.
    if (force && input.started && !input.district && input.buildings.length > 0 && this.viewHeight === 47) {
      const mean = input.buildings.reduce((a, b) => ({ c: a.c + b.c, r: a.r + b.r }), {
        c: 0,
        r: 0,
      });
      const aspect = this.width / Math.max(1, this.height);
      this.focus(
        { c: mean.c / input.buildings.length, r: mean.r / input.buildings.length },
        (14 + input.buildings.length) * Math.max(1, 0.9 / aspect),
      );
    }
    if (preview && force) this.focus(PREVIEW_FOCUS, 31);
    this.syncRoads(sim, input.district);
    this.syncBuildings(sim, now);
    if (this.puffed.size > 64) this.puffed.clear();
    this.updateFxInput(input);
    const landmarkSignature = `${sim.buildings.length}:${input.district ?? ""}`;
    if (landmarkSignature !== this.landmarkSignature) {
      this.landmarkSignature = landmarkSignature;
      const spots: number[] = [];
      for (const b of sim.buildings) {
        if (!isLandmark(b.kind) || spots.length >= 24) continue;
        const at = cellWorld(b.c, b.r);
        spots.push(at.x, at.z);
      }
      if (!spots.length && input.district) {
        const box = districtBounds(input.district);
        const at = cellWorld(box.c, box.r);
        spots.push(at.x, at.z);
      }
      this.fx.landmarks = spots;
    }
    if (this.fxInput.disaster === "flood" || this.fx.mood.flood > 0) {
      const waterSignature = `${this.roadVersion}|${this.buildingVersion}`;
      if (waterSignature !== this.waterSignature) {
        this.waterSignature = waterSignature;
        this.fx.setWater(sim.roads, new Set(this.cellRecords.keys()));
      }
    }
    this.syncSites(sim, now);
    if (this.cars.count === 0) this.dbg.instancedCars = 0;
    if (force) {
      this.dirtyShadows = true;
      this.refreshPalms(sim);
    }
    this.dbg.buildings = sim.buildings.length;
    this.dbg.roads = sim.roads.length;
  }

  /**
   * Roads change rarely but there can be many thousands of them: detect a change from
   * the array's identity, length and ends (never by joining every key), then rebuild
   * only the road chunks around the cells that actually changed.
   */
  private syncRoads(sim: Sim, district: Sim["district"]) {
    const roads = sim.roads;
    const n = roads.length;
    const same =
      roads === this.roadsSeen.list &&
      n === this.roadsSeen.length &&
      district === this.roadsSeen.district &&
      (n === 0 || (roads[0] === this.roadsSeen.first && roads[n - 1] === this.roadsSeen.last));
    if (same) return;
    // A burst of edits (an advisor laying a whole block) is coalesced: when the last
    // rebuild was expensive, wait a little so the work is not repeated every frame.
    const clock = performance.now();
    if (
      this.roadsSeen.list !== null &&
      district === this.roadsSeen.district &&
      clock - this.roadsSeen.at < Math.min(250, this.roadsSeen.cost * 6)
    )
      return;
    const fresh = new Set(roads);
    const previous = this.roadSet;
    const rebuildAll = district !== this.roadsSeen.district || this.roadChunks.size === 0;
    this.roadsSeen = {
      list: roads,
      length: n,
      first: roads[0],
      last: roads[n - 1],
      district,
      at: clock,
      cost: this.roadsSeen.cost,
    };
    const changed: string[] = [];
    if (!rebuildAll) {
      for (const key of fresh) if (!previous.has(key)) changed.push(key);
      for (const key of previous) if (!fresh.has(key)) changed.push(key);
      if (!changed.length && fresh.size === previous.size) {
        this.roadsSeen.cost = performance.now() - clock;
        return;
      }
    }
    this.roadSet = fresh;
    this.roadVersion += 1;
    this.gridSource = { roads: fresh, district };
    if (this.currentTool) this.buildGrid();
    if (this.parcels) {
      this.scene.remove(this.parcels);
      this.parcels.geometry.dispose();
      (this.parcels.material as THREE.Material).dispose();
    }
    this.parcels = createParcels(fresh, district);
    if (this.parcels) this.scene.add(this.parcels);
    // Group keys by chunk once; rebuild the chunks touched by a change (markings and
    // lamps look two cells around, so a change dirties its neighbors' chunks too).
    const byChunk = new Map<number, string[]>();
    for (const key of roads) {
      const comma = key.indexOf(",");
      const id = roadChunkId(+key.slice(0, comma), +key.slice(comma + 1));
      let list = byChunk.get(id);
      if (!list) byChunk.set(id, (list = []));
      list.push(key);
    }
    const dirty = new Set<number>();
    if (rebuildAll) {
      for (const id of this.roadChunks.keys()) dirty.add(id);
      for (const id of byChunk.keys()) dirty.add(id);
    } else {
      for (const key of changed) {
        const comma = key.indexOf(",");
        const c = +key.slice(0, comma),
          r = +key.slice(comma + 1);
        for (const dc of [-2, 0, 2]) for (const dr of [-2, 0, 2]) dirty.add(roadChunkId(c + dc, r + dr));
      }
    }
    for (const id of dirty) {
      const old = this.roadChunks.get(id);
      if (old) {
        for (const mesh of old) {
          this.scene.remove(mesh);
          mesh.geometry.dispose();
        }
        this.roadChunks.delete(id);
      }
      const keys = byChunk.get(id);
      if (!keys?.length) continue;
      const built = createRoads(keys, fresh);
      const meshes: THREE.Mesh[] = [];
      const asphalt = new THREE.Mesh(built.asphalt, this.materials.opaque);
      asphalt.receiveShadow = true;
      meshes.push(asphalt);
      if (built.markings.getAttribute("position").count > 24) {
        const markings = new THREE.Mesh(built.markings, this.materials.opaque);
        markings.receiveShadow = true;
        meshes.push(markings);
      } else built.markings.dispose();
      if (built.lights.getAttribute("position").count > 24)
        meshes.push(new THREE.Mesh(built.lights, this.materials.lamps));
      else built.lights.dispose();
      built.details.dispose();
      for (const mesh of meshes) {
        mesh.matrixAutoUpdate = false;
        mesh.name = "roads";
        this.scene.add(mesh);
      }
      this.roadChunks.set(id, meshes);
    }
    // Buildings face the street: re-aim only those beside a changed cell.
    if (rebuildAll) {
      for (const rec of this.records.values()) this.reorient(rec);
    } else {
      for (const key of changed) {
        const comma = key.indexOf(",");
        const c = +key.slice(0, comma),
          r = +key.slice(comma + 1);
        for (const [dc, dr] of [
          [0, 1],
          [1, 0],
          [0, -1],
          [-1, 0],
        ] as const) {
          const rec = this.cellRecords.get(cellKey(c + dc, r + dr));
          if (rec) this.reorient(rec);
        }
      }
    }
    this.refreshCarSlots(roads);
    this.refreshPalms(sim);
    this.dirtyShadows = true;
    this.roadsSeen.cost = performance.now() - clock;
  }

  private buildingOrientation(c: number, r: number) {
    const roads = this.roadSet;
    if (roads.has(cellKey(c, r + 1))) return 0;
    if (roads.has(cellKey(c + 1, r))) return Math.PI / 2;
    if (roads.has(cellKey(c, r - 1))) return Math.PI;
    if (roads.has(cellKey(c - 1, r))) return -Math.PI / 2;
    return 0;
  }

  private reorient(rec: BuildingRecord) {
    const orient = this.buildingOrientation(rec.c, rec.r);
    if (orient === rec.orientation) return;
    rec.orientation = orient;
    this.writeMatrix(rec);
    this.dirtyShadows = true;
  }

  /**
   * Reconciles the simulation's buildings with the instanced batches. The common
   * frame (nothing added, removed or upgraded) is one pass of identity and field
   * compares; Map lookups and batch moves only happen for what changed.
   */
  private syncBuildings(sim: Sim, now: number) {
    const list = sim.buildings;
    const order = this.order;
    const stamp = ++this.stamp;
    let structural = list.length !== order.length;
    for (let i = 0; i < list.length; i += 1) {
      const b = list[i]!;
      let rec = order[i];
      if (!rec || rec.src !== b) {
        rec = this.records.get(b.id);
        if (rec) rec.src = b;
        else rec = this.addRecord(b, now);
        order[i] = rec;
        structural = true;
      }
      rec.seen = stamp;
      if (rec.level !== b.level || rec.kind !== b.kind || rec.c !== b.c || rec.r !== b.r)
        this.remodel(rec, b);
      if (rec.born !== b.born) {
        rec.born = b.born;
        if (now - b.born < BUILD_RISE) this.rising.add(rec);
      }
    }
    if (structural) {
      order.length = list.length;
      for (const rec of this.records.values()) if (rec.seen !== stamp) this.removeRecord(rec);
      this.buildingVersion += 1;
    }
    if (this.rising.size) this.animateRising(now);
    this.maybeRebucket(false);
    for (const batch of this.dirtyBatches) batch.flush();
    this.dirtyBatches.clear();
    this.dbg.lodDistribution = { ...this.lodCounts };
    this.dbg.lodLevels = Object.keys(this.lodCounts).length;
  }

  private addRecord(b: Sim["buildings"][number], now: number) {
    const at = cellWorld(b.c, b.r);
    const rec: BuildingRecord = {
      id: b.id,
      src: b,
      kind: b.kind,
      level: b.level,
      c: b.c,
      r: b.r,
      x: at.x,
      z: at.z,
      born: b.born,
      orientation: this.buildingOrientation(b.c, b.r),
      lod: 2,
      shadow: true,
      visible: true,
      height: 0,
      batch: null,
      slot: -1,
      spread: 1,
      rise: 1,
      position: new THREE.Vector3(at.x, LAND_HEIGHT + 5.15, at.z),
      seen: 0,
    };
    this.records.set(b.id, rec);
    this.cellRecords.set(cellKey(b.c, b.r), rec);
    rec.lod = this.lodOf(rec);
    rec.shadow = this.castsShadow(rec);
    this.countLod(rec.lod, 1);
    rec.visible = this.inView(rec);
    this.place(rec);
    if (now - b.born < BUILD_RISE) {
      this.rising.add(rec);
      // Start flat so the first drawn frame is not a full-height flash.
      rec.spread = 0.88;
      rec.rise = 0.001;
      this.writeMatrix(rec);
    }
    this.dirtyShadows = true;
    return rec;
  }

  private remodel(rec: BuildingRecord, b: Sim["buildings"][number]) {
    if (rec.c !== b.c || rec.r !== b.r) {
      if (this.cellRecords.get(cellKey(rec.c, rec.r)) === rec) this.cellRecords.delete(cellKey(rec.c, rec.r));
      this.heights.delete(cellKey(rec.c, rec.r));
      const at = cellWorld(b.c, b.r);
      rec.c = b.c;
      rec.r = b.r;
      rec.x = at.x;
      rec.z = at.z;
      rec.position.set(at.x, LAND_HEIGHT + 5.15, at.z);
      rec.orientation = this.buildingOrientation(b.c, b.r);
      this.cellRecords.set(cellKey(b.c, b.r), rec);
    }
    rec.kind = b.kind;
    rec.level = b.level;
    this.place(rec, true);
    this.dirtyShadows = true;
  }

  private removeRecord(rec: BuildingRecord) {
    if (rec.batch) {
      rec.batch.remove(rec.slot);
      this.dirtyBatches.add(rec.batch);
    }
    rec.batch = null;
    this.records.delete(rec.id);
    const key = cellKey(rec.c, rec.r);
    if (this.cellRecords.get(key) === rec) {
      this.cellRecords.delete(key);
      this.heights.delete(key);
    }
    this.rising.delete(rec);
    this.countLod(rec.lod, -1);
    this.dirtyShadows = true;
  }

  private countLod(lod: number, delta: number) {
    const next = (this.lodCounts[lod] ?? 0) + delta;
    if (next > 0) this.lodCounts[lod] = next;
    else delete this.lodCounts[lod];
  }

  private detailOf(rec: BuildingRecord): 0 | 1 | 2 {
    return rec.lod === 2 && isLandmark(rec.kind) ? 1 : rec.lod;
  }

  /** Puts a record in the batch its model and visibility call for (or none). */
  private place(rec: BuildingRecord, remodeled = false) {
    const detail = this.detailOf(rec);
    rec.height = modelHeight(rec.kind, rec.level, detail) + 0.02;
    this.heights.set(cellKey(rec.c, rec.r), rec.height);
    const batch = rec.visible ? this.batchFor(rec.kind, rec.level, detail, rec.shadow) : null;
    if (batch === rec.batch) {
      if (remodeled) this.writeMatrix(rec);
      return;
    }
    if (rec.batch) {
      rec.batch.remove(rec.slot);
      this.dirtyBatches.add(rec.batch);
    }
    rec.batch = batch;
    rec.slot = -1;
    if (batch) {
      batch.add(rec);
      this.writeMatrix(rec);
    }
  }

  private batchFor(
    kind: BuildingRecord["kind"],
    level: number,
    detail: 0 | 1 | 2,
    shadow: boolean,
  ) {
    const key = `${kind}:${level}:${detail}${shadow ? "" : ":flat"}`;
    let batch = this.batches.get(key);
    if (!batch) {
      batch = new BuildingBatch<BuildingRecord>(
        key,
        buildingModel(kind, level, detail),
        this.materials,
        this.buildingLayer,
        detail,
      );
      batch.setShadows(shadow);
      this.batches.set(key, batch);
    }
    return batch;
  }

  private writeMatrix(rec: BuildingRecord) {
    if (!rec.batch) return;
    rec.batch.write(rec.slot, rec.x, LAND_HEIGHT + 0.02, rec.z, rec.orientation, rec.spread, rec.rise);
    this.dirtyBatches.add(rec.batch);
  }

  /** Only the few buildings still rising out of the ground are touched per frame. */
  private animateRising(now: number) {
    // A developer finishing a whole block raises hundreds at once: dust for a few.
    let puffs = 0;
    for (const rec of this.rising) {
      const age = Math.max(0, now - rec.born);
      if (age >= BUILD_RISE) {
        rec.spread = 1;
        rec.rise = 1;
        this.rising.delete(rec);
      } else {
        // Rise out of the ground with a small overshoot, plus a ring of dust at the base.
        const t = age / BUILD_RISE;
        const back = 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
        rec.spread = 0.88 + 0.12 * (1 - (1 - t) ** 3);
        rec.rise = Math.max(0.001, back);
        const tag = `${rec.id}@${rec.born}`;
        if (rec.born > 0 && age < 0.35 && !this.puffed.has(tag)) {
          this.puffed.add(tag);
          if (puffs++ < MAX_PUFFS) this.fx.puff(rec.x, rec.z);
        }
      }
      this.writeMatrix(rec);
      this.dirtyShadows = true;
    }
  }

  private lodOf(rec: BuildingRecord) {
    return lodFor(this.viewHeight, Math.hypot(this.target.x - rec.x, this.target.z - rec.z));
  }

  /**
   * The sun's shadow camera only covers the area around the target, so instances far
   * from it go in batches that skip the shadow pass instead of being drawn into it.
   */
  private castsShadow(rec: BuildingRecord) {
    return Math.hypot(this.target.x - rec.x, this.target.z - rec.z) <= SHADOW_REACH;
  }

  /**
   * Whether a building is near enough to the screen to be drawn, using the view
   * captured at the last re-bucket plus a generous margin, so small pans and zooms
   * never need a pass over every building.
   */
  private inView(rec: BuildingRecord) {
    const e = this.lodView.matrix.elements;
    const y = LAND_HEIGHT;
    const x = e[0]! * rec.x + e[4]! * y + e[8]! * rec.z + e[12]!;
    const base = e[1]! * rec.x + e[5]! * y + e[9]! * rec.z + e[13]!;
    const top = base + e[5]! * Math.max(rec.height, 1.5);
    const m = VIEW_MARGIN;
    const pad = this.lodView.pad;
    return (
      x > -1 - m - pad.x && x < 1 + m + pad.x && top > -1 - m - pad.y && base - pad.y < 1 + m
    );
  }

  /**
   * Level-of-detail and visibility are re-evaluated only when the view moved or
   * zoomed enough to matter (throttled), not every frame.
   */
  private maybeRebucket(forced: boolean) {
    const view = this.lodView;
    const clock = performance.now();
    if (!forced && view.at > 0) {
      const aspect = this.width / this.height;
      const zoom = Math.abs(Math.log(this.viewHeight / view.height));
      const moved = Math.hypot(this.target.x - view.x, this.target.z - view.z);
      // Where the current target lands in the captured view (orthographic, so linear).
      const e = view.matrix.elements;
      const nx = e[0]! * this.target.x + e[4]! * this.target.y + e[8]! * this.target.z + e[12]!;
      const ny = e[1]! * this.target.x + e[5]! * this.target.y + e[9]! * this.target.z + e[13]!;
      const off = Math.max(Math.abs(nx), Math.abs(ny));
      const hard =
        off > VIEW_MARGIN * 0.6 || this.viewHeight > view.height * (1 + VIEW_MARGIN * 0.5);
      const soft = hard || zoom > 0.08 || moved > 6 || aspect !== view.aspect;
      if (!soft) return;
      if (!hard && clock - view.at < 140) return;
    }
    this.camera.updateMatrixWorld();
    view.matrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    view.x = this.target.x;
    view.z = this.target.z;
    view.height = this.viewHeight;
    view.aspect = this.width / this.height;
    view.at = clock;
    // A building's footprint, in clip units, around its base point.
    view.pad.x = (CELL_SIZE * 2) / ((this.viewHeight * view.aspect) / 2);
    view.pad.y = (CELL_SIZE * 2) / (this.viewHeight / 2);
    let moves = 0;
    for (const rec of this.records.values()) {
      const lod = this.lodOf(rec);
      const visible = this.inView(rec);
      const shadow = this.castsShadow(rec);
      if (lod === rec.lod && visible === rec.visible && shadow === rec.shadow) continue;
      rec.shadow = shadow;
      if (lod !== rec.lod) {
        this.countLod(rec.lod, -1);
        this.countLod(lod, 1);
        rec.lod = lod;
      }
      rec.visible = visible;
      this.place(rec);
      moves += 1;
    }
    for (const batch of this.dirtyBatches) batch.flush();
    this.dirtyBatches.clear();
    let culled = 0;
    for (const rec of this.records.values()) if (!rec.batch) culled += 1;
    this.dbg.culledBuildings = culled;
    this.dbg.batches = [...this.batches.values()].filter((b) => b.count > 0).length;
    if (moves) this.dirtyShadows = true;
    this.coinsAt = 0;
  }

  private refreshPalms(sim: Sim) {
    const matrix = new THREE.Matrix4();
    let index = 0;
    for (const key of sim.roads) {
      if (index >= 158) break;
      const comma = key.indexOf(",");
      const c = +key.slice(0, comma),
        r = +key.slice(comma + 1);
      if ((c * 5 + r * 3) % 5 !== 0) continue;
      const at = cellWorld(c, r);
      matrix.makeTranslation(at.x + CELL_SIZE * 0.37, LAND_HEIGHT, at.z + CELL_SIZE * 0.37);
      this.palms.setMatrixAt(index++, matrix);
    }
    this.palms.count = index;
    this.palms.instanceMatrix.needsUpdate = true;
    if (this.dbg) this.dbg.instancedPalms = index;
    this.dirtyShadows = true;
  }

  /** Street spots cars may drive on, worked out once per road change (not per frame). */
  private refreshCarSlots(roads: readonly string[]) {
    const slots: CarSlot[] = [];
    for (let i = 0; i < roads.length && slots.length < 150; i += 5) {
      const key = roads[i]!;
      const comma = key.indexOf(",");
      const c = +key.slice(0, comma),
        r = +key.slice(comma + 1);
      const at = cellWorld(c, r);
      const horizontal = this.roadSet.has(cellKey(c + 1, r)) || this.roadSet.has(cellKey(c - 1, r));
      slots.push({ i, x: at.x, z: at.z, horizontal });
    }
    this.carSlots = slots;
  }

  private updateCars() {
    if (this.viewHeight > 55 || this.dbg.night > 0.9) {
      this.cars.count = 0;
      return;
    }
    const matrix = this.carMatrix;
    let count = 0;
    // Pandemic lockdown empties ~60% of the streets.
    const keep = 1 - 0.6 * this.fx.mood.pandemic;
    for (const slot of this.carSlots) {
      if (count >= 60) break;
      const i = slot.i;
      if (keep < 1 && ((i * 0.6180339) % 1) > keep) continue;
      const horizontal = slot.horizontal;
      const move = (((this.elapsed * 0.33 + i * 0.07) % 1) - 0.5) * CELL_SIZE * 0.76;
      matrix.makeRotationY(horizontal ? Math.PI / 2 : 0);
      matrix.setPosition(
        slot.x + (horizontal ? move : CELL_SIZE * 0.09),
        LAND_HEIGHT + 0.09,
        slot.z + (horizontal ? -CELL_SIZE * 0.1 : move),
      );
      this.cars.setMatrixAt(count++, matrix);
      this.cars.setColorAt(
        count - 1,
        this.carColor.set(
          i % 3 === 0 ? VehicleColors.gold : i % 3 === 1 ? VehicleColors.white : VehicleColors.teal,
        ),
      );
    }
    this.cars.count = count;
    this.cars.instanceMatrix.needsUpdate = true;
    if (this.cars.instanceColor) this.cars.instanceColor.needsUpdate = true;
    this.dbg.instancedCars = count;
  }

  private updateLighting(dt: number) {
    const light = lightingAt(
      this.phaseOverride === null ? this.dbg.dayMode : "auto",
      this.phaseOverride ?? (this.elapsed / 110 + 0.16) % 1,
    );
    this.dbg.night = light.night;
    this.sun.intensity = THREE.MathUtils.lerp(2.35, 0.11, light.night);
    this.sun.color.set(light.dusk > 0.25 ? "#ffd0a5" : light.night > 0.7 ? "#91bbdf" : "#fff0d5");
    this.hemi.intensity = THREE.MathUtils.lerp(1.5, 0.62, light.night);
    this.hemi.color.set(light.night > 0.5 ? "#426b8d" : "#c2e5e6");
    this.sun.position
      .copy(this.target)
      .add(
        new THREE.Vector3(
          Math.cos(light.azimuth) * Math.cos(THREE.MathUtils.degToRad(light.elevation)) * 90,
          Math.max(14, Math.sin(THREE.MathUtils.degToRad(light.elevation)) * 110),
          Math.sin(light.azimuth) * Math.cos(THREE.MathUtils.degToRad(light.elevation)) * 90,
        ),
      );
    this.sun.target.position.copy(this.target);
    const sky = this.sky.setRGB(
      THREE.MathUtils.lerp(0.48, 0.035, light.night),
      THREE.MathUtils.lerp(0.72, 0.094, light.night),
      THREE.MathUtils.lerp(0.76, 0.17, light.night),
    );
    const fog = this.scene.fog as THREE.Fog;
    this.fx.grade(sky, fog, this.sun, this.hemi, light.night);
    this.scene.background = sky;
    fog.color.copy(sky);
    // A blackout kills window glow and street lamps; the city goes dark.
    const power = 1 - this.fx.mood.blackout;
    this.materials.windows.emissiveIntensity = (0.06 + light.emission * 2.4) * power;
    this.materials.lamps.emissiveIntensity = (0.1 + light.emission * 3.5) * power;
    if (!this.sim?.started && this.dbg.dayMode === "auto") this.sun.color.set("#ffe6bd");
    if (
      dt > 0 &&
      this.dbg.dayMode === "auto" &&
      Math.floor(this.elapsed) !== Math.floor(this.elapsed - dt)
    )
      this.dirtyShadows = true;
  }

  private updateFx(dt: number) {
    const input = this.fxInput;
    input.night = this.dbg.night;
    input.target.copy(this.target);
    input.viewHeight = this.viewHeight;
    input.aspect = this.width / this.height;
    input.pixelsPerUnit = (this.height * this.renderer.getPixelRatio()) / this.viewHeight;
    this.fx.update(dt, input);
  }

  private updateHover() {
    if (!this.hover || !this.sim?.started) {
      this.highlight.visible = false;
      return;
    }
    const current = this.currentTool;
    if (!current) {
      this.highlight.visible = false;
      return;
    }
    let aimed = this.hover;
    if (current.kind === "build") {
      // The open-lot search scans the city; redo it only when the cell or the city changes.
      const memo = this.aimMemo;
      const version = this.roadVersion * 1_000_003 + this.buildingVersion;
      if (memo.c !== this.hover.c || memo.r !== this.hover.r || memo.version !== version) {
        memo.c = this.hover.c;
        memo.r = this.hover.r;
        memo.version = version;
        memo.cell = nearestOpenLot(this.sim, this.hover.c, this.hover.r, 1) ?? this.hover;
      }
      aimed = memo.cell ?? this.hover;
    }
    const { c, r } = aimed;
    const key = cellKey(c, r);
    const blocked = !isLand(c, r) || this.roadSet.has(key) || this.cellRecords.has(key);
    const material = this.highlight.material as THREE.MeshBasicMaterial;
    material.color.set((current.kind === "bulldoze" ? !blocked : blocked) ? "#d56845" : "#45e0d5");
    const at = cellWorld(c, r);
    this.highlight.position.set(at.x, LAND_HEIGHT + 0.14, at.z);
    this.highlight.visible = true;
  }

  /**
   * While a selection box is being dragged, holding the finger near a screen edge
   * scrolls the map that way, so the box can reach past what is on screen.
   */
  private edgeScroll(dt: number) {
    const at = this.edgePointer;
    if (!at || !this.zone || !this.pointerDown?.zone) return;
    const band = Math.min(64, Math.min(this.width, this.height) * 0.12);
    const push = (v: number, size: number) =>
      v < band ? -(band - v) / band : v > size - band ? (v - (size - band)) / band : 0;
    const px = push(at.x, this.width);
    const py = push(at.y, this.height);
    if (!px && !py) return;
    const speed = 520 * dt;
    const before = this.groundAt(at.x, at.y);
    const after = this.groundAt(at.x + px * speed, at.y + py * speed);
    if (!before || !after) return;
    this.target.add(after.sub(before));
    clampCameraTarget(this.target, this.viewHeight);
    this.targetGoal.copy(this.target);
    this.poseCamera();
    this.hover = this.cellAt(at.x, at.y);
    this.drawZone(this.zone, this.hover);
  }

  private frame() {
    const started = performance.now();
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.08);
    this.elapsed += dt;
    const smoothing = 1 - Math.exp(-dt * 9);
    const viewChanged =
      Math.abs(this.viewHeight - this.viewHeightGoal) > 0.015 ||
      this.target.distanceToSquared(this.targetGoal) > 0.00001;
    this.viewHeight = THREE.MathUtils.lerp(this.viewHeight, this.viewHeightGoal, smoothing);
    this.target.lerp(this.targetGoal, smoothing);
    if (viewChanged) {
      this.updateProjection();
      this.poseCamera();
    }
    if (this.viewHeight !== this.labelsHeight) {
      this.labelsHeight = this.viewHeight;
      updatePlaceLabels(this.placeLabels, this.viewHeight);
    }
    this.edgeScroll(dt);
    if (this.sim) this.updateCars();
    this.updateLighting(dt);
    this.updateFx(dt);
    this.updateHover();
    this.updateCoins();
    if (this.dirtyShadows) this.renderer.shadowMap.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
    this.dbg.drawCalls = this.renderer.info.render.calls;
    this.dbg.triangles = this.renderer.info.render.triangles;
    if (this.dirtyShadows) this.dirtyShadows = false;
    this.dbg.frameMs = performance.now() - started;
  }

  /**
   * Coins over buildings with money to collect: one instanced quad (a single draw
   * call), only for buildings on screen, capped, and re-chosen a few times a second
   * rather than projecting every building every frame.
   */
  private coins: THREE.InstancedMesh | null = null;
  private coinTexture: THREE.CanvasTexture | null = null;
  private coinShown: BuildingRecord[] = [];
  private coinsAt = 0;
  private coinMatrix = new THREE.Matrix4();
  private coinPoint = new THREE.Vector3();
  private coinScale = new THREE.Vector3(1.28, 1.28, 1.28);

  private coinMesh() {
    if (this.coins) return this.coins;
    const face = mountDinarCoin(256);
    const texture = new THREE.CanvasTexture(face.canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    this.coinTexture = texture;
    void face.ready.then(() => {
      texture.needsUpdate = true;
    });
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const coins = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, COIN_CAP);
    coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    coins.frustumCulled = false;
    coins.renderOrder = 10;
    coins.count = 0;
    coins.name = "coins";
    this.scene.add(coins);
    this.coins = coins;
    return coins;
  }

  private updateCoins() {
    const sim = this.sim;
    if (!sim || this.viewHeight >= 65) {
      if (this.coins) this.coins.count = 0;
      this.coinShown.length = 0;
      return;
    }
    const clock = performance.now();
    if (clock - this.coinsAt > 220) {
      this.coinsAt = clock;
      const shown = this.coinShown;
      shown.length = 0;
      const candidates: { rec: BuildingRecord; d: number }[] = [];
      for (const b of sim.buildings) {
        if (b.stored < 1) continue;
        const rec = this.records.get(b.id);
        if (!rec || !rec.batch) continue;
        const p = this.coinPoint.copy(rec.position).project(this.camera);
        if (Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1) candidates.push({ rec, d: p.x * p.x + p.y * p.y });
      }
      if (candidates.length > COIN_CAP) candidates.sort((a, b) => a.d - b.d);
      for (let i = 0; i < candidates.length && i < COIN_CAP; i += 1) shown.push(candidates[i]!.rec);
    }
    if (!this.coinShown.length && !this.coins) return;
    const coins = this.coinMesh();
    let count = 0;
    for (const rec of this.coinShown) {
      // Collected (or demolished) since the last pick: drop it right away.
      if (rec.src.stored < 1 || !this.records.has(rec.id)) continue;
      this.coinPoint.set(
        rec.x,
        LAND_HEIGHT + 5.15 + Math.sin(this.elapsed * 2 + rec.c) * 0.2,
        rec.z,
      );
      this.coinMatrix.compose(this.coinPoint, this.camera.quaternion, this.coinScale);
      coins.setMatrixAt(count++, this.coinMatrix);
    }
    coins.count = count;
    coins.instanceMatrix.needsUpdate = count > 0;
  }

  private syncSites(sim: Sim, now: number) {
    const live = new Set<string>();
    for (const site of sim.sites ?? []) {
      live.add(site.id);
      const progress = progressOf(sim.day, site);
      let obj = this.sites.get(site.id);
      if (!obj) {
        obj = createSiteObject(site, progress);
        this.scene.add(obj.group);
        this.sites.set(site.id, obj);
        this.dirtyShadows = true;
      }
      const before = obj.progress;
      updateSiteObject(obj, progress, now);
      if (Math.abs(before - obj.progress) > 0.02) this.dirtyShadows = true;
    }
    for (const [id, obj] of this.sites) {
      if (live.has(id)) continue;
      disposeSiteObject(obj);
      this.sites.delete(id);
      this.dirtyShadows = true;
    }
  }

  dispose() {
    for (const obj of this.sites.values()) disposeSiteObject(obj);
    this.sites.clear();
    this.scene.remove(this.fx.group);
    this.fx.dispose();
    const w = window as unknown as { __cityFx?: unknown };
    delete w.__cityFx;
    if (this.districtNumbers) disposeDistrictNumbers(this.districtNumbers);
    this.scene.remove(this.placeLabels);
    disposePlaceLabels(this.placeLabels);
    for (const batch of this.batches.values()) batch.dispose();
    this.batches.clear();
    this.coinTexture?.dispose();
    this.coinTexture = null;
    this.renderer.setAnimationLoop(null);
    this.observer.disconnect();
    this.timer.dispose();
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("pointerup", this.onUp);
    this.canvas.removeEventListener("pointercancel", this.onUp);
    this.canvas.removeEventListener("pointerleave", this.onLeave);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.canvas.removeEventListener("pointerdown", this.unlockAudio);
    this.canvas.removeEventListener("webglcontextrestored", this.onContextRestored);
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.scene.traverse((object) => {
      if (!(
        object instanceof THREE.Mesh ||
        object instanceof THREE.LineSegments ||
        object instanceof THREE.Sprite
      ))
        return;
      if ("geometry" in object) geometries.add(object.geometry);
      for (const m of Array.isArray(object.material) ? object.material : [object.material])
        materials.add(m);
    });
    for (const geo of geometries) geo.dispose();
    for (const mat of materials) {
      if (mat instanceof THREE.SpriteMaterial) mat.map?.dispose();
      mat.dispose();
    }
    this.records.clear();
    this.cellRecords.clear();
    this.renderer.dispose();
  }
}

function createInitialPreview(): Sim {
  // Sharq waterfront on the real map: landmarks along one avenue south of Ras Ajuza.
  const dc = PREVIEW_SHIFT.c;
  const dr = PREVIEW_SHIFT.r;
  const roads = [];
  for (let c = 17; c <= 34; c += 1) roads.push(`${c + dc},${23 + dr}`);
  for (const c of [19, 24, 29, 34])
    for (let r = 24; r <= 27; r += 1) roads.push(`${c + dc},${r + dr}`);
  const lots: [Sim["buildings"][number]["kind"], number, number, number?][] = [
    ["palace", 18, 22],
    ["mosque", 21, 22],
    ["kuwait", 26, 22],
    ["boubyan", 30, 22, 2],
    ["liberation", 33, 22],
    ["villa", 20, 24],
    ["modern", 22, 24],
    ["apartments", 23, 25, 2],
    ["park", 26, 24],
    ["tower", 28, 24],
    ["shop", 31, 24],
    ["clinic", 32, 25],
    ["water", 26, 26],
    ["power", 30, 26],
    ["school", 32, 27],
  ];
  return {
    // New simulation fields come from the real initial state; the showcase overrides below.
    ...createInitial(),
    coins: 3200,
    roads,
    quest: 0,
    mute: false,
    started: false,
    day: 0,
    speed: 0,
    tax: 7,
    buildings: lots.map(([kind, c, r, level = 1], i) => ({
      id: `show-${i}`,
      kind,
      c: c + dc,
      r: r + dr,
      level,
      stored: 0,
      born: 0,
    })),
    disaster: null,
    randomDisasters: false,
    log: [],
    history: [],
    difficulty: "easy",
    luckAt: 0,
    occupancy: 1,
    loan: 0,
    event: null,
    fame: 0,
    rank: 0,
    fx: [],
    crisis: null,
  };
}

/** Seconds a new building takes to rise out of the ground. */
const BUILD_RISE = 0.8;
/** Extra room (in clip units, 1 = half the screen) kept around the view when culling. */
const VIEW_MARGIN = 0.5;
/** Buildings farther than this from the target cannot reach the sun's shadow map. */
const SHADOW_REACH = 95;
/** Most dust rings started in one frame. */
const MAX_PUFFS = 8;
/** Most coins drawn at once. */
const COIN_CAP = 120;
/** Road meshes are built per square chunk of this many cells. */
const ROAD_CHUNK = 48;
const roadChunkId = (c: number, r: number) =>
  Math.floor(Math.max(0, c) / ROAD_CHUNK) * 1024 + Math.floor(Math.max(0, r) / ROAD_CHUNK);

const VehicleColors = { gold: "#c89030", white: "#ffffff", teal: PALETTE.gulf };
