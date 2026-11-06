import * as THREE from "three";
import type { HudTool } from "../../components/city-hud.tsx";
import type { Sim } from "@/game/sim";
import { cellKey } from "@/game/sim";
import { districtById, isDistrictLand } from "@/game/districts";
import {
  CAMERA_PITCH_DEGREES,
  CAMERA_YAW_DEGREES,
  CELL_SIZE,
  LAND_HEIGHT,
  cellWorld,
  clampCameraTarget,
  lodFor,
  worldCell,
  type Cell,
} from "./camera.ts";
import { lightingAt, type DayMode } from "./day-night.ts";
import { createBuildingObject } from "./models.ts";
import { PALETTE, cityMaterials } from "./palette.ts";
import {
  carGeometry,
  createGrid,
  createDistrictNumbers,
  createRoads,
  createTerrain,
  disposeDistrictNumbers,
  palmGeometry,
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
};

type BuildingRecord = {
  object: THREE.Group;
  orientation: number;
  lod: 0 | 1 | 2;
  level: number;
  kind: Sim["buildings"][number]["kind"];
  born: number;
  screen: THREE.Vector2;
  position: THREE.Vector3;
};

export class CityWorld {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  camera: THREE.OrthographicCamera;
  private materials = cityMaterials();
  private terrain = createTerrain();
  private grid = createGrid();
  private roadMesh: THREE.Mesh | null = null;
  private roadDetail: THREE.Mesh | null = null;
  private roadLights: THREE.Mesh | null = null;
  private roadSignature = "";
  disabled = false;
  private districtId: Sim["district"] = null;
  private districtNumbers: THREE.Group | null = null;
  private buildings = new Map<string, BuildingRecord>();
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
    id: number;
  } | null = null;
  private pinch: { dist: number; zoom: number } | null = null;
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
    this.camera = new THREE.OrthographicCamera(-30, 30, 20, -20, 0.1, 260);
    this.camera.position
      .copy(this.target)
      .add(
        new THREE.Vector3(
          Math.sin(yaw) * Math.cos(pitch) * 100,
          Math.sin(pitch) * 100,
          Math.cos(yaw) * Math.cos(pitch) * 100,
        ),
      );
    this.camera.lookAt(this.target);
    this.scene.add(
      this.camera,
      this.hemi,
      this.sun,
      this.sun.target,
      this.terrain.group,
      this.grid,
    );
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
    this.scene.fog = new THREE.Fog("#a5cbd2", 110, 230);
    this.scene.background = new THREE.Color("#a5cbd2");
    const water = new THREE.Mesh(
      new THREE.BoxGeometry(250, 0.3, 230),
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
    this.scene.add(this.highlight, this.zoneMesh);
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
      this.pinch = { dist: Math.hypot(a!.x - b!.x, a!.y - b!.y), zoom: this.viewHeightGoal };
      this.pointerDown = null;
      this.callbacks.strokeEnd();
      return;
    }
    this.callbacks.strokeEnd();
    const p = this.local(e);
    const road = Boolean(this.sim?.started && this.currentTool?.kind === "road");
    const zone = Boolean(this.sim?.started && this.currentTool?.kind === "zone");
    this.pointerDown = { x: p.x, y: p.y, moved: 0, road, zone, id: e.pointerId };
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
        92,
      );
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
      this.drawZone(this.zone, this.hover);
      return;
    }
    if (drag.moved > 3) {
      const factor = this.viewHeight / this.height;
      const right = new THREE.Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2);
      const front = new THREE.Vector3(Math.SQRT1_2, 0, Math.SQRT1_2);
      this.targetGoal
        .addScaledVector(right, -dx * factor)
        .addScaledVector(
          front,
          (dy * factor) / Math.sin(THREE.MathUtils.degToRad(CAMERA_PITCH_DEGREES)),
        );
      clampCameraTarget(this.targetGoal, this.viewHeightGoal);
    }
  };

  private onUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    const drag = this.pointerDown;
    if (!drag || drag.id !== e.pointerId) return;
    if (this.pointers.size === 0) {
      this.pointerDown = null;
      this.callbacks.strokeEnd();
    }
    if (drag.zone && this.zone) {
      if (
        !this.hover ||
        Math.abs(this.hover.c - this.zone.c) < 3 ||
        Math.abs(this.hover.r - this.zone.r) < 3
      ) {
        this.zoneMesh.visible = false;
        this.callbacks.zone(null);
      } else {
        this.callbacks.zone({
          c0: this.zone.c,
          r0: this.zone.r,
          c1: this.hover.c,
          r1: this.hover.r,
        });
      }
      this.zone = null;
      return;
    }
    if (drag.moved >= 14 || drag.road || !this.sim?.started) return;
    const cell = this.rayCell(e);
    if (this.currentTool?.kind !== "bulldoze") {
      let best: { id: string; d: number } | null = null;
      for (const b of this.sim.buildings) {
        if (b.stored < 1) continue;
        const record = this.buildings.get(b.id);
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
    const c0 = Math.min(start.c, end.c),
      c1 = Math.max(start.c, end.c);
    const r0 = Math.min(start.r, end.r),
      r1 = Math.max(start.r, end.r);
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
  }

  setDayMode(mode: DayMode) {
    this.dbg.dayMode = mode;
    this.dirtyShadows = true;
  }

  zoom(factor: number) {
    this.viewHeightGoal = THREE.MathUtils.clamp(this.viewHeightGoal / factor, 10, 92);
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
          Math.sin(yaw) * Math.cos(pitch) * 100,
          Math.sin(pitch) * 100,
          Math.cos(yaw) * Math.cos(pitch) * 100,
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
      this.focus(district ? { c: 36, r: 24 } : { c: 26, r: 24 }, district ? 24 : 31);
    }
    const preview =
      !input.started && !input.district && input.buildings.length === 0 && input.roads.length === 0;
    const sim = preview ? createInitialPreview() : input;
    // On the very first sync, bring a saved city into a portrait-usable frame.
    if (force && input.started && input.buildings.length > 0 && this.viewHeight === 47) {
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
    if (preview && force) this.focus({ c: 26, r: 24 }, 31);
    const roadSignature = sim.roads.join("|");
    if (roadSignature !== this.roadSignature) {
      this.roadSignature = roadSignature;
      this.scene.remove(this.grid);
      this.grid.geometry.dispose();
      this.grid.material.dispose();
      this.grid = createGrid(new Set(sim.roads), input.district);
      this.scene.add(this.grid);
      for (const item of [this.roadMesh, this.roadDetail, this.roadLights]) {
        if (item) {
          this.scene.remove(item);
          item.geometry.dispose();
        }
      }
      const roads = createRoads(sim.roads);
      this.roadMesh = new THREE.Mesh(roads.asphalt, this.materials.opaque);
      this.roadMesh.receiveShadow = true;
      this.roadDetail = new THREE.Mesh(roads.markings, this.materials.opaque);
      this.roadDetail.receiveShadow = true;
      this.roadLights = new THREE.Mesh(roads.lights, this.materials.lamps);
      this.scene.add(this.roadMesh, this.roadDetail, this.roadLights);
      this.refreshPalms(sim);
      this.dirtyShadows = true;
    }
    const ids = new Set<string>();
    const distribution: Record<string, number> = {};
    for (const b of sim.buildings) {
      ids.add(b.id);
      const at = cellWorld(b.c, b.r);
      const distance = Math.hypot(this.target.x - at.x, this.target.z - at.z);
      const lod = lodFor(this.viewHeight, distance);
      let record = this.buildings.get(b.id);
      const orient = this.buildingOrientation(sim, b.c, b.r);
      if (
        !record ||
        record.lod !== lod ||
        record.level !== b.level ||
        record.kind !== b.kind ||
        record.orientation !== orient
      ) {
        if (record) {
          this.scene.remove(record.object);
          this.hideCoin(record.object.userData.buildingId as string);
        }
        const detail =
          lod === 2 && ["kuwait", "mosque", "liberation", "palace", "boubyan"].includes(b.kind)
            ? 1
            : lod;
        const built = createBuildingObject(b.kind, b.level, detail, this.materials);
        built.object.position.set(at.x, LAND_HEIGHT + 0.02, at.z);
        built.object.rotation.y = orient;
        built.object.userData.buildingId = b.id;
        this.scene.add(built.object);
        record = {
          object: built.object,
          orientation: orient,
          lod,
          level: b.level,
          kind: b.kind,
          born: b.born,
          screen: new THREE.Vector2(),
          position: new THREE.Vector3(at.x, LAND_HEIGHT + 4, at.z),
        };
        this.buildings.set(b.id, record);
        this.dirtyShadows = true;
      }
      const age = Math.max(0, now - b.born);
      if (record.object.rotation.y !== orient) {
        record.object.rotation.y = orient;
        this.dirtyShadows = true;
      }
      const scale = age < 0.5 ? Math.min(1, 0.65 + age * 0.7) : 1;
      record.object.scale.setScalar(scale);
      distribution[record.lod] = (distribution[record.lod] ?? 0) + 1;
    }
    for (const sprite of this.coinSprites.values()) sprite.visible = false;
    for (const [id, record] of this.buildings) {
      if (ids.has(id)) continue;
      this.hideCoin(id);
      this.scene.remove(record.object);
      this.buildings.delete(id);
      this.dirtyShadows = true;
    }
    if (this.cars.count === 0) this.dbg.instancedCars = 0;
    if (force) {
      this.dirtyShadows = true;
      this.refreshPalms(sim);
    }
    this.dbg.buildings = sim.buildings.length;
    this.dbg.roads = sim.roads.length;
    this.dbg.lodDistribution = distribution;
    this.dbg.lodLevels = new Set(Object.keys(distribution)).size;
  }

  private buildingOrientation(sim: Sim, c: number, r: number) {
    if (sim.roads.includes(cellKey(c, r + 1))) return 0;
    if (sim.roads.includes(cellKey(c + 1, r))) return Math.PI / 2;
    if (sim.roads.includes(cellKey(c, r - 1))) return Math.PI;
    if (sim.roads.includes(cellKey(c - 1, r))) return -Math.PI / 2;
    return 0;
  }

  private refreshPalms(sim: Sim) {
    const matrix = new THREE.Matrix4();
    let index = 0;
    for (const key of sim.roads) {
      const [c, r] = key.split(",").map(Number);
      if ((c! * 5 + r! * 3) % 5 !== 0 || index >= 158) continue;
      const at = cellWorld(c!, r!);
      matrix.makeTranslation(at.x + CELL_SIZE * 0.37, LAND_HEIGHT, at.z + CELL_SIZE * 0.37);
      this.palms.setMatrixAt(index++, matrix);
    }
    this.palms.count = index;
    this.palms.instanceMatrix.needsUpdate = true;
    if (this.dbg) this.dbg.instancedPalms = index;
    this.dirtyShadows = true;
  }

  private updateCars(sim: Sim) {
    if (this.viewHeight > 55 || this.dbg.night > 0.9) {
      this.cars.count = 0;
      return;
    }
    const matrix = new THREE.Matrix4();
    let count = 0;
    for (let i = 0; i < sim.roads.length && count < 60; i += 5) {
      const [c, r] = sim.roads[i]!.split(",").map(Number);
      const at = cellWorld(c!, r!);
      const horizontal =
        sim.roads.includes(cellKey(c! + 1, r!)) || sim.roads.includes(cellKey(c! - 1, r!));
      const move = (((this.elapsed * 0.33 + i * 0.07) % 1) - 0.5) * CELL_SIZE * 0.76;
      matrix.makeRotationY(horizontal ? Math.PI / 2 : 0);
      matrix.setPosition(
        at.x + (horizontal ? move : CELL_SIZE * 0.09),
        LAND_HEIGHT + 0.09,
        at.z + (horizontal ? -CELL_SIZE * 0.1 : move),
      );
      this.cars.setMatrixAt(count++, matrix);
      this.cars.setColorAt(
        count - 1,
        new THREE.Color(
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
    const light = lightingAt(this.dbg.dayMode, (this.elapsed / 110 + 0.16) % 1);
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
    const sky = new THREE.Color().setRGB(
      THREE.MathUtils.lerp(0.48, 0.035, light.night),
      THREE.MathUtils.lerp(0.72, 0.094, light.night),
      THREE.MathUtils.lerp(0.76, 0.17, light.night),
    );
    this.scene.background = sky;
    (this.scene.fog as THREE.Fog).color.copy(sky);
    this.materials.windows.emissiveIntensity = 0.06 + light.emission * 2.4;
    this.materials.lamps.emissiveIntensity = 0.1 + light.emission * 3.5;
    if (!this.sim?.started && this.dbg.dayMode === "auto") this.sun.color.set("#ffe6bd");
    if (
      dt > 0 &&
      this.dbg.dayMode === "auto" &&
      Math.floor(this.elapsed) !== Math.floor(this.elapsed - dt)
    )
      this.dirtyShadows = true;
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
    const { c, r } = this.hover;
    const blocked =
      !isDistrictLand(this.sim.district ?? null, cellKey(c, r)) ||
      this.sim.roads.includes(cellKey(c, r)) ||
      this.sim.buildings.some((b) => b.c === c && b.r === r);
    const material = this.highlight.material as THREE.MeshBasicMaterial;
    material.color.set((current.kind === "bulldoze" ? !blocked : blocked) ? "#d56845" : "#45e0d5");
    const at = cellWorld(c, r);
    this.highlight.position.set(at.x, LAND_HEIGHT + 0.14, at.z);
    this.highlight.visible = true;
  }

  private frame() {
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
      const pitch = THREE.MathUtils.degToRad(CAMERA_PITCH_DEGREES),
        yaw = THREE.MathUtils.degToRad(CAMERA_YAW_DEGREES);
      this.camera.position
        .copy(this.target)
        .add(
          new THREE.Vector3(
            Math.sin(yaw) * Math.cos(pitch) * 100,
            Math.sin(pitch) * 100,
            Math.cos(yaw) * Math.cos(pitch) * 100,
          ),
        );
      this.camera.lookAt(this.target);
      this.dirtyShadows = true;
    }
    if (this.sim) this.updateCars(this.sim);
    this.updateLighting(dt);
    this.updateHover();
    for (const b of this.sim?.buildings ?? []) {
      if (b.stored < 1) continue;
      const record = this.buildings.get(b.id);
      if (record) record.position.y = LAND_HEIGHT + 3.5 + Math.sin(this.elapsed * 2 + b.c) * 0.18;
    }
    if (this.viewHeight < 65 && this.sim)
      for (const b of this.sim.buildings) {
        const record = this.buildings.get(b.id);
        if (!record || b.stored < 1) continue;
        const position = record.position.clone().project(this.camera);
        if (Math.abs(position.x) < 1.1 && Math.abs(position.y) < 1.1) this.drawCoin(record);
      }
    if (this.dirtyShadows) this.renderer.shadowMap.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
    this.dbg.drawCalls = this.renderer.info.render.calls;
    this.dbg.triangles = this.renderer.info.render.triangles;
    if (this.dirtyShadows) this.dirtyShadows = false;
  }

  private coinGroup = new THREE.Group();
  private coinSprites = new Map<string, THREE.Sprite>();
  private drawCoin(record: BuildingRecord) {
    let sprite = this.coinSprites.get(record.object.userData.buildingId as string);
    if (!sprite) {
      const canvas = document.createElement("canvas");
      canvas.width = 96;
      canvas.height = 96;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#e2b54e";
      ctx.beginPath();
      ctx.arc(48, 48, 37, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = "#f6df9d";
      ctx.stroke();
      ctx.fillStyle = "#143c43";
      ctx.font = "bold 45px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("د", 48, 47);
      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({
        map: texture,
        depthTest: false,
        depthWrite: false,
      });
      sprite = new THREE.Sprite(material);
      sprite.scale.setScalar(1.12);
      this.coinGroup.add(sprite);
      this.coinSprites.set(record.object.userData.buildingId as string, sprite);
      this.scene.add(this.coinGroup);
    }
    sprite.position.copy(record.position);
    sprite.visible = true;
  }

  private hideCoin(id: string) {
    const coin = this.coinSprites.get(id);
    if (!coin) return;
    this.coinGroup.remove(coin);
    coin.material.map?.dispose();
    coin.material.dispose();
    this.coinSprites.delete(id);
  }

  dispose() {
    if (this.districtNumbers) disposeDistrictNumbers(this.districtNumbers);
    for (const id of [...this.coinSprites.keys()]) this.hideCoin(id);
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
    this.buildings.clear();
    this.renderer.dispose();
  }
}

function createInitialPreview(): Sim {
  const roads = [];
  for (let c = 17; c <= 34; c += 1) roads.push(`${c},23`);
  for (const c of [19, 24, 29, 34]) for (let r = 24; r <= 27; r += 1) roads.push(`${c},${r}`);
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
      c,
      r,
      level,
      stored: 0,
      born: 0,
    })),
    ordinances: {
      education: false,
      recycling: false,
      carpool: false,
      clinicFund: false,
      smokeBan: false,
    },
    disaster: null,
    randomDisasters: false,
    log: [],
    history: [],
    difficulty: "easy",
    luckAt: 0,
  };
}

const VehicleColors = { gold: "#c89030", white: "#ffffff", teal: PALETTE.gulf };
