import { useEffect, useRef, useState } from "react";
import { CityHud, type HudTool } from "@/components/city-hud";
import { createAudio } from "@/game/audio";
import {
  CATALOG,
  KINDS,
  type Category,
  type Kind,
} from "@/game/catalog";
import { CELL, COLS, LAND, ROWS, WORLD_H, WORLD_W } from "@/game/land";
import {
  advanceDays,
  advanceQuest,
  bulldoze,
  cellKey,
  cloneSim,
  coastal,
  collectAll,
  collectOne,
  createInitial,
  isLand,
  loadSim,
  placeBuilding,
  placeRoad,
  planZone,
  rollLuck,
  routeOnLand,
  saveSim,
  stats,
  tick,
  totalStored,
  triggerDisaster,
  upgrade,
  type DisasterKind,
  type Ordinances,
  type Sim,
  type ZonePick,
} from "@/game/sim";

type Tool = HudTool;

type Toast = { id: number; text: string };

declare global {
  interface Window {
    __city?: {
      place: (kind: string, c: number, r: number) => string;
      road: (c: number, r: number) => string;
      coins: () => number;
      pop: () => number;
      started: () => void;
    };
  }
}

function fmt(n: number) {
  return Math.floor(n).toLocaleString("en-US");
}

export function CityGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Sim>(createInitial());
  const toolRef = useRef<Tool>(null);
  const syncRef = useRef<() => void>(() => {});
  const toastRef = useRef<(text: string) => void>(() => {});
  const selectRef = useRef<(id: string | null) => void>(() => {});
  const clockRef = useRef(0);
  const timeRef = useRef(0);

  const [snap, setSnap] = useState<Sim>(createInitial());
  const [tool, setTool] = useState<Tool>(null);
  const [zone, setZone] = useState<{ c0: number; r0: number; c1: number; r1: number } | null>(null);
  const [cat, setCat] = useState<Category>("housing");
  const [selected, setSelected] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);
  const toastSeq = useRef(0);

  toolRef.current = tool;

  function pushToast(text: string) {
    const id = ++toastSeq.current;
    setToasts((q) => [...q, { id, text }].slice(-3));
    window.setTimeout(() => {
      setToasts((q) => q.filter((item) => item.id !== id));
    }, 2400);
  }

  function sync() {
    const next = cloneSim(simRef.current);
    setSnap(next);
    saveSim(simRef.current);
  }

  syncRef.current = sync;
  toastRef.current = pushToast;
  selectRef.current = setSelected;
  const zoneRectRef = useRef<{ c0: number; r0: number; c1: number; r1: number } | null>(null);
  const setZoneRef = useRef(setZone);
  setZoneRef.current = setZone;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    simRef.current = loadSim();
    setSnap(cloneSim(simRef.current));

    const audio = createAudio();
    const cam = { x: WORLD_W * 0.56, y: WORLD_H * 0.65, z: 0.7 };
    let cssW = 1;
    let cssH = 1;
    let dpr = 1;
    let t = 0;
    let vis = 0.5;
    let acc = 0;
    let hudAcc = 0;
    let raf = 0;
    let running = true;
    let camReady = false;
    const sprites = new Map<Kind, HTMLImageElement>();
    const map = new Image();
    map.src = "/game/map.jpg";
    for (const kind of KINDS) {
      const img = new Image();
      img.onload = () => sprites.set(kind, img);
      img.src = `/game/${kind}.png`;
      if (img.complete && img.naturalWidth) sprites.set(kind, img);
    }

    const floaters: { x: number; y: number; text: string; life: number }[] = [];
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch: { dist: number; z: number; cx: number; cy: number } | null = null;
    let drag: {
      x: number;
      y: number;
      moved: number;
      paint: boolean;
      zone: boolean;
      fail: string | null;
    } | null = null;
    let hover: { c: number; r: number } | null = null;
    const coinHits: { id: string; x: number; y: number }[] = [];
    let hiddenAt = 0;

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      cssW = Math.max(1, rect.width);
      cssH = Math.max(1, rect.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas!.width = Math.round(cssW * dpr);
      canvas!.height = Math.round(cssH * dpr);
      if (!camReady) {
        const fit = Math.min(cssW / WORLD_W, cssH / WORLD_H) * 0.92;
        cam.z = Math.min(3.2, Math.max(fit, 34 / CELL));
        camReady = true;
      }
      clampCam();
    }

    function clampCam() {
      const minZ = Math.min(cssW / WORLD_W, cssH / WORLD_H) * 0.92;
      cam.z = Math.max(minZ, Math.min(3.4, cam.z));
      const halfW = cssW / 2 / cam.z;
      const halfH = cssH / 2 / cam.z;
      const margin = CELL * 1.4;
      cam.x =
        halfW * 2 >= WORLD_W
          ? WORLD_W / 2
          : Math.max(halfW - margin, Math.min(WORLD_W - halfW + margin, cam.x));
      cam.y =
        halfH * 2 >= WORLD_H
          ? WORLD_H / 2
          : Math.max(halfH - margin, Math.min(WORLD_H - halfH + margin, cam.y));
    }

    function screenToWorld(sx: number, sy: number) {
      return {
        wx: cam.x + (sx - cssW / 2) / cam.z,
        wy: cam.y + (sy - cssH / 2) / cam.z,
      };
    }

    function worldToScreen(wx: number, wy: number) {
      return {
        x: cssW / 2 + (wx - cam.x) * cam.z,
        y: cssH / 2 + (wy - cam.y) * cam.z,
      };
    }

    function applyWorld() {
      ctx!.setTransform(
        dpr * cam.z,
        0,
        0,
        dpr * cam.z,
        dpr * (cssW / 2 - cam.x * cam.z),
        dpr * (cssH / 2 - cam.y * cam.z),
      );
    }
    function local(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function cellAt(sx: number, sy: number) {
      const { wx, wy } = screenToWorld(sx, sy);
      return { c: Math.floor(wx / CELL), r: Math.floor(wy / CELL) };
    }

    function burst(c: number, r: number, text: string) {
      floaters.push({ x: (c + 0.5) * CELL, y: r * CELL, text, life: 0.95 });
      if (floaters.length > 24) floaters.shift();
    }

    function noteQuests() {
      const gained = advanceQuest(simRef.current);
      for (const g of gained) {
        audio.play("quest", simRef.current.mute);
        toastRef.current(`تمت المهمة +${fmt(g.reward)} د.ك`);
      }
    }

    function handleTap(sx: number, sy: number) {
      const sim = simRef.current;
      if (!sim.started) return;
      const current = toolRef.current;
      if (!current || current.kind !== "bulldoze") {
        let best: { id: string; d: number } | null = null;
        for (const hit of coinHits) {
          const d = Math.hypot(hit.x - sx, hit.y - sy);
          if (d < 28 && (!best || d < best.d)) best = { id: hit.id, d };
        }
        if (best) {
          const b = sim.buildings.find((x) => x.id === best!.id);
          const n = collectOne(sim, best.id);
          if (n > 0 && b) {
            audio.play("collect", sim.mute);
            burst(b.c, b.r, `+${n}`);
            syncRef.current();
          }
          return;
        }
      }
      const { c, r } = cellAt(sx, sy);
      if (current?.kind === "bulldoze") {
        const act = bulldoze(sim, c, r);
        if (!act.ok) {
          audio.play("error", sim.mute);
          toastRef.current(act.msg);
        } else {
          audio.play("place", sim.mute);
          noteQuests();
          syncRef.current();
        }
        return;
      }
      if (current?.kind === "road") {
        const act = placeRoad(sim, c, r);
        if (!act.ok) {
          audio.play("error", sim.mute);
          toastRef.current(act.msg);
        } else if (act.fresh) {
          audio.play("road", sim.mute);
          noteQuests();
          syncRef.current();
        }
        return;
      }
      if (current?.kind === "build") {
        const act = placeBuilding(sim, current.building, c, r, t);
        if (!act.ok) {
          audio.play("error", sim.mute);
          toastRef.current(act.msg);
        } else {
          audio.play("place", sim.mute);
          if (coastal(c, r) && CATALOG[current.building].coastBoost) {
            toastRef.current("على الكورنيش +١٥٪");
          }
          noteQuests();
          syncRef.current();
        }
        return;
      }
      const found = sim.buildings.find((b) => b.c === c && b.r === r);
      selectRef.current(found ? found.id : null);
    }

    function onDown(e: PointerEvent) {
      audio.unlock();
      canvas!.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const p = local(e);
      if (pointers.size >= 2) {
        const pts = [...pointers.values()];
        const a = pts[0]!;
        const b = pts[1]!;
        pinch = {
          dist: Math.max(8, Math.hypot(a.x - b.x, a.y - b.y)),
          z: cam.z,
          cx: (a.x + b.x) / 2,
          cy: (a.y + b.y) / 2,
        };
        drag = null;
        return;
      }
      const zoning = Boolean(simRef.current.started && toolRef.current?.kind === "zone");
      const paint = Boolean(simRef.current.started && toolRef.current?.kind === "road");
      const cell = cellAt(p.x, p.y);
      drag = { x: p.x, y: p.y, moved: 0, paint: paint && !zoning, zone: zoning, fail: null };
      if (zoning) {
        zoneRectRef.current = { c0: cell.c, r0: cell.r, c1: cell.c, r1: cell.r };
        setZoneRef.current(null);
      }
      if (paint && !zoning) paintRoad(p.x, p.y);
    }

    let lastCell: { c: number; r: number } | null = null;

    function paintRoad(sx: number, sy: number) {
      if (!drag) return;
      const here = cellAt(sx, sy);
      const from = lastCell ?? here;
      const path = routeOnLand(from.c, from.r, here.c, here.r);
      let sounded = false;
      for (const step of path) {
        const act = placeRoad(simRef.current, step.c, step.r);
        if (!act.ok) {
          if (act.msg.includes("رصيد") && !drag.fail?.startsWith("!")) {
            drag.fail = `!${act.msg}`;
            audio.play("error", simRef.current.mute);
            toastRef.current(act.msg);
          } else if (!act.msg.includes("رصيد")) {
            drag.fail = act.msg;
          }
          continue;
        }
        lastCell = step;
        if (act.fresh && !sounded) {
          sounded = true;
          audio.play("road", simRef.current.mute);
        }
      }
    }

    function onMove(e: PointerEvent) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const p = local(e);
      hover = cellAt(p.x, p.y);
      if (pointers.size >= 2 && pinch) {
        const pts = [...pointers.values()];
        const a = pts[0]!;
        const b = pts[1]!;
        const dist = Math.max(8, Math.hypot(a.x - b.x, a.y - b.y));
        const midX = ((a.x + b.x) / 2) - (canvas!.getBoundingClientRect().left);
        const midY = ((a.y + b.y) / 2) - (canvas!.getBoundingClientRect().top);
        const w = screenToWorld(midX, midY);
        cam.z = pinch.z * (dist / pinch.dist);
        clampCam();
        const w2 = screenToWorld(midX, midY);
        cam.x += w.wx - w2.wx;
        cam.y += w.wy - w2.wy;
        clampCam();
        return;
      }
      if (!drag) return;
      const dx = p.x - drag.x;
      const dy = p.y - drag.y;
      drag.moved += Math.hypot(dx, dy);
      drag.x = p.x;
      drag.y = p.y;
      if (drag.paint) {
        paintRoad(p.x, p.y);
        return;
      }
      if (drag.zone && zoneRectRef.current) {
        const cell = cellAt(p.x, p.y);
        zoneRectRef.current = { ...zoneRectRef.current, c1: cell.c, r1: cell.r };
        return;
      }
      if (drag.moved > 2) {
        cam.x -= (dx / cam.z) * 1.25;
        cam.y -= (dy / cam.z) * 1.25;
        clampCam();
      }
    }

    function onUp(e: PointerEvent) {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size > 0) return;
      const p = local(e);
      if (drag?.zone && zoneRectRef.current) {
        const box = zoneRectRef.current;
        if (Math.abs(box.c1 - box.c0) < 3 || Math.abs(box.r1 - box.r0) < 3) {
          zoneRectRef.current = null;
          toastRef.current("حدّد منطقة أكبر");
        } else {
          setZoneRef.current(box);
        }
      } else if (drag && drag.moved < 14 && !drag.paint) handleTap(p.x, p.y);
      if (drag?.paint) {
        if (drag.moved < 14 && drag.fail && !drag.fail.startsWith("!")) {
          audio.play("error", simRef.current.mute);
          toastRef.current(drag.fail);
        }
        noteQuests();
        syncRef.current();
      }
      drag = null;
      lastCell = null;
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = canvas!.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const w = screenToWorld(sx, sy);
      cam.z *= e.deltaY > 0 ? 0.84 : 1.2;
      clampCam();
      const w2 = screenToWorld(sx, sy);
      cam.x += w.wx - w2.wx;
      cam.y += w.wy - w2.wy;
      clampCam();
    }

    function nightAmount(_phase: number) {
      return 0;
    }

    function streetFace(c: number, r: number, roads: Set<string>) {
      const sides = [
        { side: "s" as const, dc: 0, dr: 1 },
        { side: "n" as const, dc: 0, dr: -1 },
        { side: "e" as const, dc: 1, dr: 0 },
        { side: "w" as const, dc: -1, dr: 0 },
      ];
      let best: (typeof sides)[number] | null = null;
      let bestScore = -1;
      for (const side of sides) {
        if (!roads.has(cellKey(c + side.dc, r + side.dr))) continue;
        const ax = side.dc === 0 ? 1 : 0;
        const ay = side.dr === 0 ? 1 : 0;
        let score = 4;
        for (const dir of [-1, 1]) {
          let k = 1;
          while (k < 8 && roads.has(cellKey(c + side.dc + ax * dir * k, r + side.dr + ay * dir * k))) {
            score += 2;
            k += 1;
          }
        }
        if (side.side === "s") score += 3;
        if (score > bestScore) {
          best = side;
          bestScore = score;
        }
      }
      if (!best) return { axis: "none" as const, side: "s" as const };
      const axis = best.side === "e" || best.side === "w" ? ("v" as const) : ("h" as const);
      return { axis, side: best.side };
    }

    function lotAnchor(c: number, r: number, side: "n" | "s" | "e" | "w") {
      if (side === "n") return { x: (c + 0.5) * CELL, y: r * CELL, flip: 1, hang: 0 };
      if (side === "e") return { x: (c + 1) * CELL, y: (r + 1) * CELL, flip: -1, hang: -1 };
      if (side === "w") return { x: c * CELL, y: (r + 1) * CELL, flip: 1, hang: -1 };
      return { x: (c + 0.5) * CELL, y: (r + 1) * CELL, flip: 1, hang: -1 };
    }

    function lotSize(kind: Kind, img: HTMLImageElement | undefined, axis: "h" | "v" | "none") {
      const aspect = img && img.width ? img.height / img.width : 1.15;
      const landmark = CATALOG[kind].cat === "landmarks";
      if (landmark) {
        const dh = Math.min(CELL * 2.45, CELL * aspect);
        return { dw: dh / aspect, dh };
      }
      if (axis === "v") {
        const dh = CELL;
        const dw = Math.min(CELL, dh / aspect);
        return { dw, dh: dw * aspect > CELL ? CELL : dw * aspect };
      }
      return { dw: CELL, dh: Math.min(CELL * 1.34, CELL * aspect) };
    }

    function drawStreets(roads: Set<string>, night: number) {
      if (!ctx) return;
      const cells: { c: number; r: number }[] = [];
      for (const k of roads) {
        const [c, r] = k.split(",").map(Number);
        cells.push({ c: c!, r: r! });
      }
      const side = CELL * 0.4;
      const asphalt = CELL * 0.26;
      const reach = CELL * 0.5;
      const arms = (
        c: number,
        r: number,
        width: number,
        color: string,
      ) => {
        const L = {
          n: roads.has(cellKey(c, r - 1)),
          e: roads.has(cellKey(c + 1, r)),
          s: roads.has(cellKey(c, r + 1)),
          w: roads.has(cellKey(c - 1, r)),
        };
        const x = (c + 0.5) * CELL;
        const y = (r + 0.5) * CELL;
        ctx.fillStyle = color;
        ctx.fillRect(x - width, y - width, width * 2, width * 2);
        if (L.e) ctx.fillRect(x, y - width, reach, width * 2);
        if (L.w) ctx.fillRect(x - reach, y - width, reach, width * 2);
        if (L.s) ctx.fillRect(x - width, y, width * 2, reach);
        if (L.n) ctx.fillRect(x - width, y - reach, width * 2, reach);
        return L;
      };

      const walk = night > 0.45 ? "#5c564c" : "#d8c9af";
      const tar = night > 0.45 ? "#1c222b" : "#3d4552";
      for (const cell of cells) arms(cell.c, cell.r, side, walk);
      ctx.lineCap = "round";
      ctx.lineWidth = side * 1.7;
      ctx.strokeStyle = walk;
      ctx.beginPath();
      for (const cell of cells) {
        const x = (cell.c + 0.5) * CELL;
        const y = (cell.r + 0.5) * CELL;
        for (const [dc, dr] of [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ] as const) {
          if (!roads.has(cellKey(cell.c + dc, cell.r + dr))) continue;
          if (roads.has(cellKey(cell.c + dc, cell.r)) && roads.has(cellKey(cell.c, cell.r + dr))) continue;
          if (dc < 0) continue;
          ctx.moveTo(x, y);
          ctx.lineTo((cell.c + dc + 0.5) * CELL, (cell.r + dr + 0.5) * CELL);
        }
      }
      ctx.stroke();
      for (const cell of cells) arms(cell.c, cell.r, asphalt, tar);
      ctx.lineWidth = asphalt * 1.85;
      ctx.strokeStyle = tar;
      ctx.beginPath();
      for (const cell of cells) {
        const x = (cell.c + 0.5) * CELL;
        const y = (cell.r + 0.5) * CELL;
        for (const [dc, dr] of [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ] as const) {
          if (!roads.has(cellKey(cell.c + dc, cell.r + dr))) continue;
          if (roads.has(cellKey(cell.c + dc, cell.r)) && roads.has(cellKey(cell.c, cell.r + dr))) continue;
          if (dc < 0) continue;
          ctx.moveTo(x, y);
          ctx.lineTo((cell.c + dc + 0.5) * CELL, (cell.r + dr + 0.5) * CELL);
        }
      }
      ctx.stroke();

      ctx.lineCap = "butt";
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = Math.max(1, CELL * 0.035);
      ctx.setLineDash([CELL * 0.14, CELL * 0.12]);
      ctx.beginPath();
      for (const cell of cells) {
        const L = {
          n: roads.has(cellKey(cell.c, cell.r - 1)),
          e: roads.has(cellKey(cell.c + 1, cell.r)),
          s: roads.has(cellKey(cell.c, cell.r + 1)),
          w: roads.has(cellKey(cell.c - 1, cell.r)),
        };
        const cross = (L.n || L.s) && (L.e || L.w);
        const x = (cell.c + 0.5) * CELL;
        const y = (cell.r + 0.5) * CELL;
        if (!cross && (L.e || L.w || !(L.n || L.s))) {
          ctx.moveTo(cell.c * CELL + (L.w ? 0 : CELL * 0.22), y);
          ctx.lineTo((cell.c + 1) * CELL - (L.e ? 0 : CELL * 0.22), y);
        }
        if (!cross && (L.n || L.s)) {
          ctx.moveTo(x, cell.r * CELL + (L.n ? 0 : CELL * 0.22));
          ctx.lineTo(x, (cell.r + 1) * CELL - (L.s ? 0 : CELL * 0.22));
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = night > 0.4 ? "rgba(255,244,210,0.75)" : "rgba(255,255,255,0.62)";
      ctx.lineWidth = Math.max(0.8, CELL * 0.02);
      ctx.beginPath();
      const edge = asphalt * 0.78;
      for (const cell of cells) {
        const L = {
          n: roads.has(cellKey(cell.c, cell.r - 1)),
          e: roads.has(cellKey(cell.c + 1, cell.r)),
          s: roads.has(cellKey(cell.c, cell.r + 1)),
          w: roads.has(cellKey(cell.c - 1, cell.r)),
        };
        const x = (cell.c + 0.5) * CELL;
        const y = (cell.r + 0.5) * CELL;
        const cross = (L.n || L.s) && (L.e || L.w);
        if (!cross && (L.e || L.w || !(L.n || L.s))) {
          const x0 = L.w ? cell.c * CELL : x - asphalt;
          const x1 = L.e ? (cell.c + 1) * CELL : x + asphalt;
          ctx.moveTo(x0, y - edge);
          ctx.lineTo(x1, y - edge);
          ctx.moveTo(x0, y + edge);
          ctx.lineTo(x1, y + edge);
        }
        if (!cross && (L.n || L.s)) {
          const y0 = L.n ? cell.r * CELL : y - asphalt;
          const y1 = L.s ? (cell.r + 1) * CELL : y + asphalt;
          ctx.moveTo(x - edge, y0);
          ctx.lineTo(x - edge, y1);
          ctx.moveTo(x + edge, y0);
          ctx.lineTo(x + edge, y1);
        }
      }
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.88)";
      for (const cell of cells) {
        const L = {
          n: roads.has(cellKey(cell.c, cell.r - 1)),
          e: roads.has(cellKey(cell.c + 1, cell.r)),
          s: roads.has(cellKey(cell.c, cell.r + 1)),
          w: roads.has(cellKey(cell.c - 1, cell.r)),
        };
        const n = Number(L.n) + Number(L.e) + Number(L.s) + Number(L.w);
        const corner = n === 2 && (L.n || L.s) && (L.e || L.w);
        if (n < 3 && !corner) continue;
        const x = (cell.c + 0.5) * CELL;
        const y = (cell.r + 0.5) * CELL;
        const band = CELL * 0.1;
        const span = asphalt * 1.55;
        const zebra = (x0: number, y0: number, w: number, h: number, across: boolean) => {
          const steps = 4;
          for (let i = 0; i < steps; i += 1) {
            if (across) ctx.fillRect(x0 + (i * w) / steps + 1, y0, w / steps - 2, h);
            else ctx.fillRect(x0, y0 + (i * h) / steps + 1, w, h / steps - 2);
          }
        };
        if (L.n) zebra(x - span / 2, y - asphalt - band * 0.15, span, band, true);
        if (L.s) zebra(x - span / 2, y + asphalt - band * 0.85, span, band, true);
        if (L.w) zebra(x - asphalt - band * 0.15, y - span / 2, band, span, false);
        if (L.e) zebra(x + asphalt - band * 0.85, y - span / 2, band, span, false);
      }

      if (night > 0.18) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (const cell of cells) {
          if ((cell.c + cell.r) % 3 !== 0) continue;
          const horizontal = roads.has(cellKey(cell.c + 1, cell.r)) || roads.has(cellKey(cell.c - 1, cell.r));
          const vertical = roads.has(cellKey(cell.c, cell.r - 1)) || roads.has(cellKey(cell.c, cell.r + 1));
          const x = (cell.c + 0.5) * CELL + (horizontal && !vertical ? 0 : -asphalt - CELL * 0.08);
          const y = (cell.r + 0.5) * CELL + (horizontal && !vertical ? -asphalt - CELL * 0.08 : 0);
          const glow = ctx.createRadialGradient(x, y, 1, x, y, CELL * 1.15);
          glow.addColorStop(0, `rgba(255, 220, 140, ${0.9 * night})`);
          glow.addColorStop(0.45, `rgba(255, 176, 60, ${0.28 * night})`);
          glow.addColorStop(1, "rgba(255, 160, 40, 0)");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(x, y, CELL * 1.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(255, 244, 210, ${night})`;
          ctx.beginPath();
          ctx.arc(x, y, CELL * 0.05, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    function draw() {
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.fillStyle = "#08343c";
      ctx!.fillRect(0, 0, cssW, cssH);
      applyWorld();
      if (map.complete && map.naturalWidth) ctx!.drawImage(map, 0, 0, WORLD_W, WORLD_H);
      else {
        for (let r = 0; r < ROWS; r += 1) {
          for (let c = 0; c < COLS; c += 1) {
            ctx!.fillStyle = LAND[r]![c] ? "#e4d3ae" : "#1a7c8c";
            ctx!.fillRect(c * CELL, r * CELL, CELL, CELL);
          }
        }
      }

      const showGrid = toolRef.current !== null;
      if (showGrid) {
        ctx!.strokeStyle = "rgba(72, 52, 24, 0.22)";
        ctx!.lineWidth = 1.4 / cam.z;
        for (let r = 0; r < ROWS; r += 1) {
          for (let c = 0; c < COLS; c += 1) {
            if (!LAND[r]![c]) continue;
            ctx!.strokeRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
          }
        }
      }

      const night = nightAmount(vis);
      if (night > 0.05) {
        ctx!.fillStyle = `rgba(4, 10, 28, ${night * 0.78})`;
        ctx!.fillRect(0, 0, WORLD_W, WORLD_H);
        const dusk = Math.max(0, 1 - Math.abs(night - 0.42) / 0.42);
        if (dusk > 0.04) {
          ctx!.fillStyle = `rgba(228, 112, 42, ${dusk * 0.18})`;
          ctx!.fillRect(0, 0, WORLD_W, WORLD_H);
        }
      }

      const roads = new Set(simRef.current.roads);
      drawStreets(roads, night);

      if (hover && simRef.current.started) {
        const blocked =
          !isLand(hover.c, hover.r) ||
          roads.has(cellKey(hover.c, hover.r)) ||
          simRef.current.buildings.some((b) => b.c === hover!.c && b.r === hover!.r);
        const bad =
          toolRef.current?.kind === "bulldoze"
            ? !roads.has(cellKey(hover.c, hover.r)) &&
              !simRef.current.buildings.some((b) => b.c === hover!.c && b.r === hover!.r)
            : blocked && toolRef.current !== null;
        ctx!.fillStyle = bad ? "rgba(181, 82, 58, 0.32)" : "rgba(14, 110, 120, 0.28)";
        if (hover.c >= 0 && hover.r >= 0 && hover.c < COLS && hover.r < ROWS) {
          ctx!.fillRect(hover.c * CELL, hover.r * CELL, CELL, CELL);
        }
      }

      const zoneBox = zoneRectRef.current;
      if (zoneBox) {
        const c0 = Math.min(zoneBox.c0, zoneBox.c1);
        const r0 = Math.min(zoneBox.r0, zoneBox.r1);
        const c1 = Math.max(zoneBox.c0, zoneBox.c1);
        const r1 = Math.max(zoneBox.r0, zoneBox.r1);
        ctx!.fillStyle = "rgba(57, 255, 57, 0.16)";
        ctx!.strokeStyle = "#146b22";
        ctx!.lineWidth = 2;
        ctx!.fillRect(c0 * CELL, r0 * CELL, (c1 - c0 + 1) * CELL, (r1 - r0 + 1) * CELL);
        ctx!.strokeRect(c0 * CELL, r0 * CELL, (c1 - c0 + 1) * CELL, (r1 - r0 + 1) * CELL);
      }

      const paintLot = (
        kind: Kind,
        img: HTMLImageElement | undefined,
        c: number,
        r: number,
        alpha: number,
        pop: number,
      ) => {
        if (!img) return;
        const face = streetFace(c, r, roads);
        const lot = lotSize(kind, img, face.axis);
        const at = lotAnchor(c, r, face.side);
        ctx!.save();
        ctx!.translate(at.x, at.y);
        ctx!.globalAlpha = alpha * 0.42;
        ctx!.fillStyle = "rgba(12, 24, 18, 0.55)";
        ctx!.beginPath();
        ctx!.ellipse(lot.dw * 0.08, 3, lot.dw * 0.42, Math.max(3, lot.dw * 0.1), 0, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.scale(at.flip * pop, pop);
        ctx!.globalAlpha = alpha;
        ctx!.drawImage(img, -lot.dw / 2, at.hang * lot.dh, lot.dw, lot.dh);
        if (night > 0.22 && kind !== "park" && kind !== "modern" && alpha > 0.9) {
          ctx!.globalAlpha = 1;
          ctx!.globalCompositeOperation = "lighter";
          const cols = kind === "villa" || kind === "shop" ? 2 : 3;
          const rows = kind === "tower" || kind === "liberation" || kind === "kuwait" || kind === "boubyan" ? 5 : 3;
          for (let i = 0; i < cols; i += 1) {
            for (let j = 0; j < rows; j += 1) {
              const h = (c * 13 + r * 7 + i * 5 + j * 3) % 7;
              if (h > 4) continue;
              ctx!.fillStyle = `rgba(255, ${190 + (h % 3) * 16}, 110, ${0.9 * night})`;
              const top = at.hang < 0 ? -lot.dh * 0.8 : lot.dh * 0.12;
              ctx!.fillRect(-lot.dw * 0.28 + i * lot.dw * 0.22, top + j * lot.dh * 0.15, lot.dw * 0.1, lot.dh * 0.07);
            }
          }
        }
        ctx!.restore();
      };

      if (hover && simRef.current.started && toolRef.current?.kind === "build") {
        const spot = hover;
        const build = toolRef.current.building;
        const ghost = sprites.get(build);
        const blocked =
          !isLand(spot.c, spot.r) ||
          roads.has(cellKey(spot.c, spot.r)) ||
          simRef.current.buildings.some((b) => b.c === spot.c && b.r === spot.r);
        if (ghost && isLand(spot.c, spot.r) && !blocked) paintLot(build, ghost, spot.c, spot.r, 0.62, 1);
      }

      const ordered = [...simRef.current.buildings].sort((a, b) => a.c + a.r - (b.c + b.r));
      for (const b of ordered) {
        const img = sprites.get(b.kind);
        const age = b.born > 0 ? t - b.born : 10;
        const pop = age < 0.28 ? 0.78 + 0.22 * (age / 0.28) : 1;
        paintLot(b.kind, img, b.c, b.r, 1 - night * (b.kind === "park" ? 0.35 : 0.62), pop);
      }

      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      coinHits.length = 0;
      ctx!.font = "700 12px 'Noto Kufi Arabic', sans-serif";
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";
      for (const b of simRef.current.buildings) {
        if (b.stored < 1) continue;
        const img = sprites.get(b.kind);
        const face = streetFace(b.c, b.r, roads);
        const lot = lotSize(b.kind, img, face.axis);
        const at = lotAnchor(b.c, b.r, face.side);
        const screen = worldToScreen(at.x, at.y);
        const dh = lot.dh * cam.z;
        const px = screen.x;
        const py = screen.y + (at.hang < 0 ? -dh : dh * 0.15) - 10 + Math.sin(t * 3 + b.c) * 3;
        coinHits.push({ id: b.id, x: px, y: py });
        ctx!.fillStyle = "#f3eee4";
        ctx!.beginPath();
        ctx!.arc(px, py, 15, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.fillStyle = "#b8893d";
        ctx!.beginPath();
        ctx!.arc(px, py, 12, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.fillStyle = "#1c1915";
        const label = Math.floor(b.stored) > 999 ? "999" : String(Math.floor(b.stored));
        ctx!.fillText(label, px, py + 0.5);
      }

      for (const f of floaters) {
        const at = worldToScreen(f.x, f.y);
        const px = at.x;
        const py = at.y - (1 - f.life / 0.95) * 36;
        ctx!.globalAlpha = Math.max(0, f.life / 0.95);
        ctx!.fillStyle = "#08343c";
        ctx!.font = "800 16px 'Noto Kufi Arabic', sans-serif";
        ctx!.fillText(f.text, px, py);
        ctx!.globalAlpha = 1;
      }
    }

    function frame(now: number) {
      if (!running) return;
      const prev = clockRef.current || now;
      const dt = Math.min(0.05, (now - prev) / 1000);
      clockRef.current = now;
      timeRef.current = t;
      t += dt;
      const spClock = !simRef.current.started ? 0.35 : simRef.current.speed === 0 ? 0 : simRef.current.speed === 1 ? 1 : simRef.current.speed === 2 ? 1.7 : 2.6;
      vis = (vis + (dt * spClock) / 34) % 1;
      if (simRef.current.started) {
        const sp = simRef.current.speed;
        const scale = sp === 1 ? 1 : sp === 2 ? 4 : sp === 3 ? 12 : 0;
        const daysPerSec = sp === 1 ? 6 : sp === 2 ? 24 : sp === 3 ? 72 : 0;
        if (scale > 0) {
          acc += dt * scale;
          while (acc >= 0.25) {
            tick(simRef.current, 0.25);
            acc -= 0.25;
          }
          advanceDays(simRef.current, dt * daysPerSec);
        }
        hudAcc += dt;
        if (hudAcc > 0.45) {
          hudAcc = 0;
          syncRef.current();
        }
      }
      for (const f of floaters) f.life -= dt;
      for (let i = floaters.length - 1; i >= 0; i -= 1) {
        if (floaters[i]!.life <= 0) floaters.splice(i, 1);
      }
      draw();
      raf = requestAnimationFrame(frame);
    }

    function onVis() {
      if (document.hidden) hiddenAt = performance.now();
      else if (hiddenAt && simRef.current.started) {
        const sec = Math.min(12, (performance.now() - hiddenAt) / 1000);
        const sp = simRef.current.speed;
        const scale = sp === 1 ? 1 : sp === 2 ? 4 : sp === 3 ? 12 : 0;
        const daysPerSec = sp === 1 ? 6 : sp === 2 ? 24 : sp === 3 ? 72 : 0;
        if (scale > 0) {
          tick(simRef.current, sec * scale);
          advanceDays(simRef.current, Math.min(90, sec * daysPerSec));
        }
        syncRef.current();
      }
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(frame);

    const zoom = (factor: number) => {
      const wx = cam.x;
      const wy = cam.y;
      cam.z *= factor;
      clampCam();
      cam.x = wx;
      cam.y = wy;
      clampCam();
    };
    canvas.dataset.ready = "1";
    (canvas as HTMLCanvasElement & { __zoom?: (n: number) => void }).__zoom = zoom;

    window.__city = {
      place(kind: string, c: number, r: number) {
        if (!(kind in CATALOG)) return "bad kind";
        simRef.current.started = true;
        const act = placeBuilding(simRef.current, kind as Kind, c, r, t);
        if (!act.ok) return act.msg;
        noteQuests();
        syncRef.current();
        return "ok";
      },
      road(c: number, r: number) {
        simRef.current.started = true;
        const act = placeRoad(simRef.current, c, r);
        if (!act.ok) return act.msg;
        noteQuests();
        syncRef.current();
        return act.fresh ? "ok" : "exists";
      },
      coins: () => simRef.current.coins,
      pop: () => stats(simRef.current).pop,
      started() {
        simRef.current.started = true;
        syncRef.current();
      },
    };

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
      document.removeEventListener("visibilitychange", onVis);
      delete window.__city;
    };
  }, []);

  useEffect(() => {
    const shell = document.querySelector("main.game-shell");
    const apply = () => {
      const legacy = typeof window.orientation === "number" ? window.orientation : 0;
      const angle = screen.orientation?.angle ?? legacy;
      const portraitViewport = window.innerHeight >= window.innerWidth;
      const turned = angle === 90 || angle === -90 || angle === 270;
      const mode = portraitViewport && turned ? (angle === 90 ? "right" : "left") : "";
      document.documentElement.dataset.orient = mode;
      shell?.classList.toggle("city-wide", !portraitViewport || mode !== "");
    };
    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    screen.orientation?.addEventListener("change", apply);
    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      screen.orientation?.removeEventListener("change", apply);
      document.documentElement.dataset.orient = "";
      shell?.classList.remove("city-wide");
    };
  }, []);

  const stored = totalStored(snap);
  const selectedB = snap.buildings.find((b) => b.id === selected) ?? null;

  function start() {
    simRef.current.started = true;
    simRef.current.speed = 1;
    sync();
  }

  function reset() {
    simRef.current = createInitial();
    simRef.current.started = true;
    simRef.current.speed = 1;
    setTool(null);
    setSelected(null);
    setConfirmReset(false);
    sync();
    pushToast("مدينة جديدة على خريطة الكويت");
  }

  function onUpgrade() {
    if (!selectedB) return;
    const act = upgrade(simRef.current, selectedB.id, timeRef.current);
    if (!act.ok) {
      pushToast(act.msg);
      return;
    }
    advanceQuest(simRef.current);
    sync();
  }

  function onCollectAll() {
    const n = collectAll(simRef.current);
    if (n <= 0) return;
    sync();
    pushToast(`+${fmt(n)} د.ك`);
  }

  function onSpeed(n: 0 | 1 | 2 | 3) {
    simRef.current.speed = n;
    sync();
  }

  function onTax(n: number) {
    simRef.current.tax = Math.max(0, Math.min(300, n));
    sync();
  }

  function onOrdinance(key: keyof Ordinances, value: boolean) {
    simRef.current.ordinances = { ...simRef.current.ordinances, [key]: value };
    sync();
  }

  function onDisaster(kind: DisasterKind) {
    const act = triggerDisaster(simRef.current, kind);
    if (selected && !simRef.current.buildings.some((b) => b.id === selected)) setSelected(null);
    pushToast(act.msg);
    sync();
  }

  function onRandom(value: boolean) {
    simRef.current.randomDisasters = value;
    sync();
  }

  function onCategory(id: Category) {
    setCat(id);
    setSelected(null);
    setTool((t) => (t?.kind === "road" || t?.kind === "bulldoze" ? null : t));
  }

  function onRoad() {
    setSelected(null);
    setTool((t) => (t?.kind === "road" ? null : { kind: "road" }));
  }

  function onZone() {
    setSelected(null);
    setZone(null);
    zoneRectRef.current = null;
    setTool((t) => (t?.kind === "zone" ? null : { kind: "zone" }));
  }

  function onZoneApply(pick: ZonePick) {
    if (!zone) return;
    const act = planZone(simRef.current, zone.c0, zone.r0, zone.c1, zone.r1, pick, timeRef.current);
    if (!act.ok) {
      pushToast(act.msg);
      return;
    }
    advanceQuest(simRef.current);
    zoneRectRef.current = null;
    setZone(null);
    setTool(null);
    sync();
    pushToast(`تم التنظيم: ${act.roads} طريق، ${act.built} مبنى`);
  }

  function onZoneCancel() {
    zoneRectRef.current = null;
    setZone(null);
  }

  function onBulldoze() {
    setSelected(null);
    setTool((t) => (t?.kind === "bulldoze" ? null : { kind: "bulldoze" }));
  }

  function onBuild(kind: Kind) {
    setSelected(null);
    setTool((t) => (t?.kind === "build" && t.building === kind ? null : { kind: "build", building: kind }));
  }

  function onLuck() {
    const act = rollLuck(simRef.current, Date.now());
    pushToast(act.msg);
    sync();
  }

  function onZoom(factor: number) {
    const node = canvasRef.current as (HTMLCanvasElement & { __zoom?: (n: number) => void }) | null;
    node?.__zoom?.(factor);
  }

  return (
    <main className="game-shell relative bg-sc-bar text-sc-mint">
      <h1 className="sr-only">عمدة الكويت</h1>
      <canvas
        ref={canvasRef}
        data-testid="city-canvas"
        aria-label="خريطة مدينة الكويت"
        className="absolute inset-0 h-full w-full touch-none"
      />
      <CityHud
        snap={snap}
        tool={tool}
        cat={cat}
        selectedId={selected}
        stored={stored}
        confirmReset={confirmReset}
        toasts={toasts}
        onStart={start}
        onSpeed={onSpeed}
        onCategory={onCategory}
        onRoad={onRoad}
        onBulldoze={onBulldoze}
        onZone={onZone}
        onBuild={onBuild}
        onTax={onTax}
        onOrdinance={onOrdinance}
        onDisaster={onDisaster}
        onRandom={onRandom}
        onLuck={onLuck}
        onUpgrade={onUpgrade}
        onCollect={onCollectAll}
        onMute={() => {
          simRef.current.mute = !simRef.current.mute;
          sync();
        }}
        onAskReset={() => setConfirmReset(true)}
        onReset={reset}
        onCancelReset={() => setConfirmReset(false)}
        onZoom={onZoom}
        zone={zone}
        onZoneApply={onZoneApply}
        onZoneCancel={onZoneCancel}
      />
    </main>
  );
}
