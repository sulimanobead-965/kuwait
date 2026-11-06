import type { Cell } from "./camera";
import { cellWorld, framedView, worldCell } from "./camera";
import { COLS, LAND, ROWS } from "@/game/land";
import { districtBounds, districtById, isDistrictLand } from "@/game/districts";
import type { Sim } from "@/game/sim";
import type { HudTool } from "@/components/city-hud";
import type { DayMode } from "./day-night";
import { mountDinarCoin } from "@/game/coin-face";
import type { WorldCallbacks, WorldDiagnostics } from "./renderer";
import { getLang } from "@/i18n";

let dinarFace: HTMLCanvasElement | null = null;
function coinFace() {
  if (!dinarFace) {
    const face = mountDinarCoin(256);
    dinarFace = face.canvas;
    void face.ready.then(() => face.paint());
  }
  return dinarFace;
}

/** Accessibility/compatibility path only. No sprite images; the main view is true WebGL meshes. */
export class FallbackCityWorld {
  private ctx: CanvasRenderingContext2D | null;
  private viewHeight = 65;
  private viewHeightGoal = 65;
  private target = { x: 6, z: 8 };
  private tool: HudTool = null;
  private zoneBox: { c0: number; r0: number; c1: number; r1: number } | null = null;
  private sim: Sim | null = null;
  private district: Sim["district"] = null;
  disabled = false;
  private mode: DayMode = "auto";
  private pointers = new Map<number, { x: number; y: number }>();
  private drag: {
    x: number;
    y: number;
    moved: number;
    road: boolean;
    zone: boolean;
    start?: Cell;
  } | null = null;
  private width = 1;
  private height = 1;
  private observer: ResizeObserver;
  private info: WorldDiagnostics = {
    renderer: "unavailable",
    orthographic: true,
    pitch: 32.5,
    yaw: 45,
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

  constructor(
    private canvas: HTMLCanvasElement,
    private callbacks: WorldCallbacks,
    private unlockAudio: () => void,
  ) {
    this.ctx = canvas.getContext("2d");
    canvas.addEventListener("pointerdown", this.unlockAudio, { passive: true });
    canvas.dataset.ready = "1";
    canvas.dataset.renderer = "fallback";
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("pointercancel", this.onUp);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    canvas.style.touchAction = "none";
  }

  focus(cell: Cell, viewHeight = 24) {
    const at = cellWorld(cell.c, cell.r);
    this.target = { x: at.x, z: at.z };
    this.viewHeight = this.viewHeightGoal = viewHeight;
  }

  diagnostics() {
    return this.info;
  }
  setTool(tool: HudTool) {
    this.tool = tool;
  }
  /** Text is drawn every frame in the current language; nothing to rebuild. */
  setLang(_lang: string) {}
  setDayMode(mode: DayMode) {
    this.mode = mode;
    this.info.dayMode = mode;
  }
  setZone(box: typeof this.zoneBox) {
    this.zoneBox = box;
  }
  zoom(factor: number) {
    this.viewHeightGoal = Math.max(15, Math.min(150, this.viewHeightGoal / factor));
  }

  frameDistrict() {
    if (!this.district || this.width < 2) return;
    const box = districtBounds(this.district);
    const canvas = this.canvas.getBoundingClientRect();
    const footer = document.querySelector("main.game-shell footer");
    let occluded = 0.38;
    if (footer && canvas.height > 0) {
      const foot = footer.getBoundingClientRect();
      occluded = Math.min(0.62, Math.max(0.22, (canvas.bottom - foot.top) / canvas.height + 0.03));
    }
    const framed = framedView(box.cols, box.rows, this.width, this.height, occluded);
    const at = cellWorld(box.c, box.r);
    const front = Math.SQRT1_2 * framed.shift;
    this.target = { x: at.x + front, z: at.z + front };
    this.viewHeight = this.viewHeightGoal = framed.viewHeight;
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private project(x: number, z: number) {
    const scale = this.height / this.viewHeight;
    return {
      x: this.width / 2 + (x - this.target.x - (z - this.target.z)) * Math.SQRT1_2 * scale,
      y: this.height / 2 + (x - this.target.x + (z - this.target.z)) * 0.268 * scale,
    };
  }

  private at(e: PointerEvent): Cell {
    const rect = this.canvas.getBoundingClientRect();
    const scale = this.height / this.viewHeight;
    const px = (e.clientX - rect.left - this.width / 2) / (Math.SQRT1_2 * scale);
    const py = (e.clientY - rect.top - this.height / 2) / (0.268 * scale);
    return worldCell(this.target.x + (px + py) / 2, this.target.z + (py - px) / 2);
  }

  private onDown = (e: PointerEvent) => {
    if (this.disabled) return;
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size > 1) {
      this.drag = null;
      return;
    }
    this.callbacks.strokeEnd();
    const rect = this.canvas.getBoundingClientRect();
    const road = Boolean(this.sim?.started && this.tool?.kind === "road");
    const zone = Boolean(
      this.sim?.started && (this.tool?.kind === "zone" || this.tool?.kind === "demolish"),
    );
    this.drag = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      moved: 0,
      road,
      zone,
      start: zone ? this.at(e) : undefined,
    };
    if (road) this.callbacks.cell(this.at(e));
  };

  private onMove = (e: PointerEvent) => {
    if (this.disabled) return;
    if (this.pointers.has(e.pointerId))
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.viewHeightGoal = Math.max(
        15,
        Math.min(150, (this.viewHeight * 170) / Math.max(30, Math.hypot(a!.x - b!.x, a!.y - b!.y))),
      );
      return;
    }
    if (!this.drag) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left,
      y = e.clientY - rect.top;
    const dx = x - this.drag.x,
      dy = y - this.drag.y;
    this.drag.x = x;
    this.drag.y = y;
    this.drag.moved += Math.hypot(dx, dy);
    if (this.drag.road) {
      this.callbacks.cell(this.at(e));
      return;
    }
    if (this.drag.zone) {
      this.callbacks.zone(this.drag.start ? range(this.drag.start, this.at(e)) : null);
      return;
    }
    const placing = this.tool?.kind === "build" || this.tool?.kind === "bulldoze";
    if (placing && this.drag.moved < 88) return;
    if (this.drag.moved < 3) return;
    const scale = this.height / this.viewHeight;
    const px = -dx / (Math.SQRT1_2 * scale),
      py = -dy / (0.268 * scale);
    this.target.x += (px + py) / 2;
    this.target.z += (py - px) / 2;
  };

  private onUp = (e: PointerEvent) => {
    if (this.disabled) return;
    const drag = this.drag;
    this.pointers.delete(e.pointerId);
    if (!drag || this.pointers.size > 0) return;
    this.drag = null;
    if (drag.zone && drag.start) {
      const end = this.at(e);
      const district = this.sim?.district ?? null;
      if (district || this.tool?.kind === "demolish") {
        this.callbacks.zone({
          c0: Math.min(drag.start.c, end.c),
          r0: Math.min(drag.start.r, end.r),
          c1: Math.max(drag.start.c, end.c),
          r1: Math.max(drag.start.r, end.r),
        });
      } else if (Math.abs(end.c - drag.start.c) < 3 || Math.abs(end.r - drag.start.r) < 3) {
        this.callbacks.zone(null);
      } else this.callbacks.zone(range(drag.start, end));
    } else if (!drag.road && drag.moved < 88) this.callbacks.cell(this.at(e));
    this.callbacks.strokeEnd();
  };
  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.zoom(e.deltaY > 0 ? 1.13 : 0.86);
  };

  sync(sim: Sim) {
    this.sim = sim;
    if (sim.district !== this.district) {
      this.district = sim.district;
      if (sim.district) this.frameDistrict();
      else this.focus({ c: 140, r: 49 }, 65); // Sharq, south of Kuwait Towers
    }
    this.viewHeight += (this.viewHeightGoal - this.viewHeight) * 0.16;
    const ctx = this.ctx;
    if (!ctx) return;
    this.info.buildings = sim.buildings.length;
    this.info.roads = sim.roads.length;
    this.info.night = this.mode === "night" ? 1 : 0;
    ctx.setTransform(this.canvas.width / this.width, 0, 0, this.canvas.height / this.height, 0, 0);
    ctx.fillStyle = this.mode === "night" ? "#15354c" : "#217f87";
    ctx.fillRect(0, 0, this.width, this.height);
    const roads = new Set(sim.roads);
    const size = (this.height / this.viewHeight) * 1.56;
    const height = size * 0.538;
    for (let r = 0; r < ROWS; r += 1)
      for (let c = 0; c < COLS; c += 1) {
        if (!LAND[r]![c]) continue;
        const at = cellWorld(c, r);
        const p = this.project(at.x, at.z);
        // Skip off-screen tiles: the real map has ~13.5k land cells.
        if (p.x < -size || p.y < -size || p.x > this.width + size || p.y > this.height + size)
          continue;
        ctx.fillStyle = roads.has(`${c},${r}`)
          ? "#35434a"
          : sim.district && !isDistrictLand(sim.district, `${c},${r}`)
            ? "#d2c2a1"
            : "#d1bd93";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - height / 2);
        ctx.lineTo(p.x + size / 2, p.y);
        ctx.lineTo(p.x, p.y + height / 2);
        ctx.lineTo(p.x - size / 2, p.y);
        ctx.closePath();
        ctx.fill();
      }
    const district = districtById(sim.district);
    if (district) {
      const scale = this.height / this.viewHeight;
      ctx.font = `bold ${Math.max(10, scale * 0.68)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const sector of district.sectors) {
        const at = cellWorld(sector.x, sector.y);
        const point = this.project(at.x, at.z);
        ctx.beginPath();
        ctx.arc(point.x, point.y, scale * 0.68, 0, Math.PI * 2);
        ctx.fillStyle = "#eadcbf";
        ctx.fill();
        ctx.strokeStyle = "#4f735e";
        ctx.stroke();
        ctx.fillStyle = "#173c40";
        ctx.fillText(
          getLang() === "ar"
            ? String(sector.number).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!)
            : String(sector.number),
          point.x,
          point.y,
        );
      }
    }
    for (const b of [...sim.buildings].sort((a, z) => a.c + a.r - z.c - z.r)) {
      const p = this.project(cellWorld(b.c, b.r).x, cellWorld(b.c, b.r).z);
      const scale = this.height / this.viewHeight;
      const width = ["avenues", "stadium", "opera", "mubarakiya"].includes(b.kind)
        ? 17 * scale
        : ["kuwait", "mosque", "palace"].includes(b.kind)
          ? 15 * scale
          : ["hamra"].includes(b.kind)
            ? 10 * scale
            : 12 * scale;
      const skyscraper = ["apartments", "shop", "tower"].includes(b.kind) && b.level >= 4;
      const h =
        b.kind === "hamra"
          ? 48 * scale
          : skyscraper
            ? (b.level >= 5 ? 42 : 36) * scale
            : ["kuwait", "liberation", "boubyan", "tower"].includes(b.kind)
              ? 32 * scale
              : ["avenues", "stadium", "mubarakiya", "chalet"].includes(b.kind)
                ? 9 * scale
                : 15 * scale;
      if (b.kind === "park") {
        ctx.fillStyle = "#477e60";
        ctx.fillRect(p.x - width / 2, p.y - 3, width, 5);
        continue;
      }
      ctx.fillStyle = "#eadbbd";
      ctx.fillRect(p.x - width / 2, p.y - h, width, h);
      ctx.fillStyle = "#796c55";
      ctx.beginPath();
      ctx.moveTo(p.x + width / 2, p.y - h);
      ctx.lineTo(p.x + width / 2 + 5 * scale, p.y - h - 3 * scale);
      ctx.lineTo(p.x + width / 2 + 5 * scale, p.y - 3 * scale);
      ctx.lineTo(p.x + width / 2, p.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#147c82";
      ctx.fillRect(p.x - width / 2, p.y - h, width, 3 * scale);
      ctx.fillStyle = this.mode === "night" ? "#ffe192" : "#345c65";
      for (let i = 0; i < 3; i += 1)
        ctx.fillRect(
          p.x - width * 0.32 + i * width * 0.27,
          p.y - h * 0.7,
          Math.max(1, scale * 2),
          Math.max(1, scale * 3),
        );
      if (b.stored >= 1) {
        const face = coinFace();
        const radius = Math.min(18, Math.max(9, 8 * scale));
        ctx.drawImage(face, p.x - radius, p.y - h - radius * 2.4, radius * 2, radius * 2);
      }
    }
  }

  dispose() {
    this.observer.disconnect();
    this.canvas.removeEventListener("pointerdown", this.unlockAudio);
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("pointerup", this.onUp);
    this.canvas.removeEventListener("pointercancel", this.onUp);
    this.canvas.removeEventListener("wheel", this.onWheel);
  }
}

function range(start: Cell, end: Cell) {
  return { c0: start.c, r0: start.r, c1: end.c, r1: end.r };
}
