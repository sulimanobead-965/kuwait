import { useEffect, useRef, useState } from "react";
import { CityHud, type HudTool } from "@/components/city-hud";
import { DistrictSelector } from "@/components/district-selector";
import { districtById, isDistrictId, type DistrictId } from "@/game/districts";
import { CityWorld, type WorldDiagnostics } from "@/game/three/renderer";
import type { Cell } from "@/game/three/camera";
import type { DayMode } from "@/game/three/day-night";
import { FallbackCityWorld } from "@/game/three/fallback";
import { createAudio } from "@/game/audio";
import { CATALOG, type Category, type Kind } from "@/game/catalog";
import {
  advanceDays,
  advanceQuest,
  bulldoze,
  cloneSim,
  coastal,
  collectAll,
  collectOne,
  createInitial,
  createInitialDistrict,
  loadSim,
  nearestOpenLot,
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
    __city3d?: {
      diagnostics: () => WorldDiagnostics;
      projectCell: (c: number, r: number) => { x: number; y: number };
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
  const timeRef = useRef(0);
  const worldRef = useRef<CityWorld | FallbackCityWorld | null>(null);
  const lastRoadCell = useRef<Cell | null>(null);
  const [graphicsError, setGraphicsError] = useState(false);
  const [dayMode, setDayModeState] = useState<DayMode>("auto");

  const [snap, setSnap] = useState<Sim>(createInitial());
  const [tool, setTool] = useState<Tool>(null);
  const [zone, setZone] = useState<{ c0: number; r0: number; c1: number; r1: number } | null>(null);
  const [cat, setCat] = useState<Category>("housing");
  const [selected, setSelected] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);
  const [districtChooser, setDistrictChooser] = useState(false);
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
    let world: CityWorld | FallbackCityWorld | null = null;
    function restoreGraphics() {
      setGraphicsError(false);
      if (world instanceof CityWorld) world.renderer.debug.checkShaderErrors = true;
    }
    const audio = createAudio();
    let failed = false;
    try {
      world = new CityWorld(
        canvas,
        {
          cell: (at) => interact(at),
          collect: (id) => collect(id),
          zoom: (factor) => world?.zoom(factor),
          strokeEnd: () => {
            lastRoadCell.current = null;
          },
          zone: (box) => setZone(box),
        },
        () => audio.unlock(),
      );
      worldRef.current = world;
    } catch (error) {
      console.warn("WebGL unavailable; using the interactive 2D compatibility view.", error);
      world = new FallbackCityWorld(
        canvas,
        {
          cell: (at) => interact(at),
          collect: (id) => collect(id),
          zoom: (factor) => world?.zoom(factor),
          strokeEnd: () => {
            lastRoadCell.current = null;
          },
          zone: (box) => setZone(box),
        },
        () => audio.unlock(),
      );
      worldRef.current = world;
      failed = true;
    }
    const savedDistrict = localStorage.getItem("omdat-kuwait-selected-district");
    simRef.current = loadSim(isDistrictId(savedDistrict) ? savedDistrict : null);
    if (simRef.current.district) {
      simRef.current.started = true;
      simRef.current.speed = 0;
    }
    setSnap(cloneSim(simRef.current));
    world.sync(simRef.current, timeRef.current, true);
    window.__city3d = {
      diagnostics: () => world!.diagnostics(),
      projectCell: (c, r) =>
        world instanceof CityWorld ? world.projectCell(c, r) : { x: -1, y: -1 },
    };
    let raf = 0;
    let previous = 0;
    let elapsed = 0;
    let acc = 0;
    let hudAcc = 0;
    let hiddenAt = 0;
    function noteQuests() {
      for (const gained of advanceQuest(simRef.current)) {
        audio.play("quest", simRef.current.mute);
        toastRef.current(`تمت المهمة +${fmt(gained.reward)} د.ك`);
      }
    }
    function collect(id: string) {
      const n = collectOne(simRef.current, id);
      if (n <= 0) return;
      audio.play("collect", simRef.current.mute);
      syncRef.current();
      toastRef.current(`+${fmt(n)} د.ك`);
    }
    function interact(at: Cell) {
      const sim = simRef.current;
      if (!sim.started) return;
      const current = toolRef.current;
      if (current?.kind === "bulldoze") {
        const act = bulldoze(sim, at.c, at.r);
        audio.play(act.ok ? "place" : "error", sim.mute);
        if (!act.ok) toastRef.current(act.msg);
        else noteQuests();
      } else if (current?.kind === "road") {
        const from = lastRoadCell.current;
        const path = from
          ? routeOnLand(from.c, from.r, at.c, at.r)
          : routeOnLand(at.c, at.r, at.c, at.r);
        let changed = false;
        for (const step of path) {
          const act = placeRoad(sim, step.c, step.r);
          if (!act.ok) {
            if (act.msg.includes("رصيد") || !from) {
              audio.play("error", sim.mute);
              toastRef.current(act.msg);
            }
            continue;
          }
          changed ||= Boolean(act.fresh);
        }
        if (changed) {
          audio.play("road", sim.mute);
          noteQuests();
        }
        lastRoadCell.current = at;
      } else if (current?.kind === "build") {
        const lot = nearestOpenLot(sim, at.c, at.r, 1) ?? at;
        const act = placeBuilding(sim, current.building, lot.c, lot.r, timeRef.current);
        audio.play(act.ok ? "place" : "error", sim.mute);
        if (!act.ok) toastRef.current(act.msg);
        else {
          if (coastal(at.c, at.r) && CATALOG[current.building].coastBoost)
            toastRef.current("على الكورنيش +١٥٪");
          noteQuests();
        }
      } else {
        const found = sim.buildings.find((b) => b.c === at.c && b.r === at.r);
        selectRef.current(found ? found.id : null);
      }
      syncRef.current();
    }
    function frame(now: number) {
      const dt = Math.min(0.1, previous ? (now - previous) / 1000 : 0);
      previous = now;
      elapsed += dt;
      timeRef.current = elapsed;
      const sim = simRef.current;
      if (sim.started && sim.speed > 0) {
        const scale = sim.speed === 1 ? 1 : sim.speed === 2 ? 4 : 12;
        const daysPerSec = sim.speed === 1 ? 6 : sim.speed === 2 ? 24 : 72;
        acc += dt * scale;
        while (acc >= 0.25) {
          tick(sim, 0.25);
          acc -= 0.25;
        }
        advanceDays(sim, dt * daysPerSec);
        hudAcc += dt;
        if (hudAcc > 0.45) {
          hudAcc = 0;
          syncRef.current();
        }
      }
      world?.sync(sim, elapsed);
      raf = requestAnimationFrame(frame);
    }
    function onVisibility() {
      if (document.hidden) {
        hiddenAt = performance.now();
        previous = 0;
      } else if (hiddenAt && simRef.current.started) {
        const sec = Math.min(12, (performance.now() - hiddenAt) / 1000);
        const scale =
          simRef.current.speed === 1
            ? 1
            : simRef.current.speed === 2
              ? 4
              : simRef.current.speed === 3
                ? 12
                : 0;
        const days = simRef.current.speed === 1 ? 6 : simRef.current.speed === 2 ? 24 : 72;
        if (scale) {
          tick(simRef.current, sec * scale);
          advanceDays(simRef.current, Math.min(90, sec * days));
        }
        hiddenAt = 0;
        syncRef.current();
      }
    }
    function onGraphicsLost() {
      setGraphicsError(true);
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("city-graphics-lost", onGraphicsLost);
    canvas.addEventListener("webglcontextrestored", restoreGraphics);
    window.__city = {
      place(kind, c, r) {
        if (!(kind in CATALOG)) return "bad kind";
        simRef.current.started = true;
        const act = placeBuilding(simRef.current, kind as Kind, c, r, timeRef.current);
        if (!act.ok) return act.msg;
        noteQuests();
        syncRef.current();
        return "ok";
      },
      road(c, r) {
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
    if (failed) setGraphicsError(true);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("city-graphics-lost", onGraphicsLost);
      canvas.removeEventListener("webglcontextrestored", restoreGraphics);
      world?.dispose();
      worldRef.current = null;
      delete window.__city;
      delete window.__city3d;
    };
  }, []);

  useEffect(() => {
    if (worldRef.current) worldRef.current.disabled = districtChooser;
  }, [districtChooser]);

  useEffect(() => {
    if (!snap.started) return;
    const footer = document.querySelector("main.game-shell footer");
    if (!footer) return;
    const watch = new ResizeObserver(() => worldRef.current?.frameDistrict());
    watch.observe(footer);
    worldRef.current?.frameDistrict();
    return () => watch.disconnect();
  }, [snap.started, snap.district]);

  useEffect(() => {
    worldRef.current?.setTool(tool);
    worldRef.current?.setZone(zone);
    if (tool?.kind !== "road") lastRoadCell.current = null;
  }, [tool, zone]);

  useEffect(() => {
    const shell = document.querySelector("main.game-shell");
    const apply = () => {
      const portrait = window.innerHeight >= window.innerWidth;
      // WebGL already uses the actual CSS viewport; rotating the DOM again produces
      // an offset canvas on portrait phones. A portrait cloud can rotate its CSS
      // screenshot without changing canvas/input coordinates.
      delete document.documentElement.dataset.orient;
      shell?.classList.toggle("city-wide", !portrait);
    };
    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      delete document.documentElement.dataset.orient;
      shell?.classList.remove("city-wide");
    };
  }, []);

  const hasLegacy = () => localStorage.getItem("omdat-kuwait-v1") !== null;
  const stored = totalStored(snap);
  const selectedB = snap.buildings.find((b) => b.id === selected) ?? null;

  function chooseDistrict(id: DistrictId) {
    if (simRef.current.started) saveSim(simRef.current);
    const next = loadSim(id);
    if (!next.started && next.buildings.length === 0) simRef.current = createInitialDistrict(id);
    else simRef.current = next;
    simRef.current.speed = 0;
    simRef.current.started = true;
    localStorage.setItem("omdat-kuwait-selected-district", id);
    setDistrictChooser(false);
    setConfirmReset(false);
    setSelected(null);
    setTool(null);
    setZone(null);
    zoneRectRef.current = null;
    worldRef.current?.sync(simRef.current, timeRef.current, true);
    sync();
    pushToast(`${districtById(id)!.name}: حُفظ تقدّمك، ويمكنك التبديل من زر الأحياء`);
  }

  function resumeLegacy() {
    if (simRef.current.started) saveSim(simRef.current);
    simRef.current = loadSim();
    simRef.current.speed = 0;
    localStorage.removeItem("omdat-kuwait-selected-district");
    setDistrictChooser(false);
    setTool(null);
    setZone(null);
    setSelected(null);
    setConfirmReset(false);
    setSnap(cloneSim(simRef.current));
    worldRef.current?.sync(simRef.current, timeRef.current, true);
    pushToast("استعدت مدينة الكويت القديمة دون تغيير حفظها");
  }

  function stopAndSave() {
    simRef.current.speed = 0;
    if (simRef.current.started) saveSim(simRef.current);
    // Merely opening or browsing the selector never writes an unstarted city.
    setSnap(cloneSim(simRef.current));
  }

  function start() {
    simRef.current.started = true;
    simRef.current.speed = 1;
    worldRef.current?.sync(simRef.current, timeRef.current, true);
    sync();
  }

  function reset() {
    const district = simRef.current.district ?? null;
    simRef.current = district ? createInitialDistrict(district) : createInitial();
    simRef.current.started = true;
    simRef.current.speed = 1;
    setTool(null);
    setSelected(null);
    setConfirmReset(false);
    worldRef.current?.sync(simRef.current, timeRef.current, true);
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
    lastRoadCell.current = null;
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
    pushToast(
      simRef.current.district
        ? `امتلأت القطع: ${act.built} مبنى`
        : `تم التنظيم: ${act.roads} طريق، ${act.built} مبنى`,
    );
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
    setTool((t) =>
      t?.kind === "build" && t.building === kind ? null : { kind: "build", building: kind },
    );
  }

  function onLuck() {
    const act = rollLuck(simRef.current, Date.now());
    pushToast(act.msg);
    sync();
  }

  function onZoom(factor: number) {
    worldRef.current?.zoom(factor);
  }

  function onDayMode(mode: DayMode) {
    setDayModeState(mode);
    worldRef.current?.setDayMode(mode);
  }

  return (
    <main className="game-shell relative bg-sc-bar text-sc-mint">
      <h1 className="sr-only">عمدة الكويت</h1>
      <canvas
        ref={canvasRef}
        data-testid="city-canvas"
        aria-label="خريطة مدينة الكويت ثلاثية الأبعاد"
        className="absolute inset-0 h-full w-full touch-none"
      />
      {graphicsError && (
        <p className="graphics-note" role="status">
          عرض متوافق: اللعب كامل، والتجسيد ثنائي الأبعاد لعدم توفر WebGL.
        </p>
      )}
      <CityHud
        dayMode={dayMode}
        onDayMode={onDayMode}
        snap={snap}
        tool={tool}
        cat={cat}
        selectedId={selected}
        stored={stored}
        confirmReset={confirmReset}
        toasts={toasts}
        onStart={start}
        onDistricts={() => {
          stopAndSave();
          setDistrictChooser(true);
        }}
        onFocusDistrict={() => worldRef.current?.frameDistrict()}
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
      <DistrictSelector
        open={districtChooser}
        current={simRef.current.district ?? null}
        onClose={() => {
          if (districtChooser && simRef.current.started) simRef.current.speed = 0;
          setDistrictChooser(false);
        }}
        onChoose={chooseDistrict}
        onResumeLegacy={resumeLegacy}
        onHasLegacy={hasLegacy}
      />
    </main>
  );
}
