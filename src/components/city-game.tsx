import { useEffect, useRef, useState } from "react";
import { CityHud, type HudTool } from "@/components/city-hud";
import { DistrictSelector } from "@/components/district-selector";
import { districtById, isDistrictId, type DistrictId } from "@/game/districts";
import { CityWorld, type WorldDiagnostics } from "@/game/three/renderer";
import type { Cell } from "@/game/three/camera";
import type { DayMode } from "@/game/three/day-night";
import { FallbackCityWorld } from "@/game/three/fallback";
import { createAudio } from "@/game/audio";
import { bootLang, dirOf, msg, t, useLang } from "@/i18n";
import {
  setInsurance,
  buySukuk,
  depositMudaraba,
  takeMurabaha,
  withdrawMudaraba,
  buyBond,
  deposit as depositMoney,
  hireConsultant,
  startProject,
  withdraw as withdrawMoney,
} from "@/game/finance";
import { TUTORIAL, WelcomeBack, type Celebration } from "@/components/hud-panels";
import { loadPlayer, PlayerSetup, savePlayer, type Player } from "@/components/hud-social";
import { fireBuilder, hireBuilder } from "@/game/builder";
import { borrowFrom, chat, greet, lendTo, markRead, repayNpc, type NpcId } from "@/game/npcs";
import { CATALOG, type Category, type Kind } from "@/game/catalog";
import {
  advanceDays,
  advanceQuest,
  bulldoze,
  buyModelArea,
  startDevelopment,
  giveAid,
  checkPromotion,
  checkAchievements,
  COST_MAX,
  eraOf,
  ERAS,
  RANKS,
  startCrisis,
  welcomeBack,
  type CostKey,
  type CrisisKind,
  repayLoan,
  startEvent,
  takeLoan,
  type EventKind,
  type ModelKind,
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
  type LawBudget,
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
      grant?: (amount: number, days?: number) => void;
      pop: () => number;
      started: () => void;
    };
    __city3d?: {
      diagnostics: () => WorldDiagnostics;
      projectCell: (c: number, r: number) => { x: number; y: number };
    };
  }
}

/** Little dinar coins fly from a building to the treasury counter. */
function flyCoins(from: { x: number; y: number }) {
  const layer = document.querySelector(".coin-fly-layer");
  const target = document.getElementById("hud-coins")?.getBoundingClientRect();
  if (!layer || !target || from.x < 0) return;
  const dx = target.left + target.width / 2 - from.x;
  const dy = target.top + target.height / 2 - from.y;
  for (let i = 0; i < 6; i += 1) {
    const coin = document.createElement("i");
    coin.className = "coin-fly";
    coin.style.left = `${from.x + (Math.random() - 0.5) * 24}px`;
    coin.style.top = `${from.y + (Math.random() - 0.5) * 16}px`;
    coin.style.setProperty("--dx", `${dx}px`);
    coin.style.setProperty("--dy", `${dy}px`);
    coin.style.animationDelay = `${i * 45}ms`;
    layer.appendChild(coin);
    window.setTimeout(() => coin.remove(), 1100 + i * 45);
  }
}

function fmt(n: number) {
  return Math.floor(n).toLocaleString("en-US");
}

export function CityGame() {
  const lang = useLang();
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
  const setToolRef = useRef(setTool);
  setToolRef.current = setTool;
  const notifyRef = useRef<{ promotion: () => void }>({ promotion: () => {} });
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const celebrateQueue = useRef<Celebration[]>([]);
  const [welcome, setWelcome] = useState<ReturnType<typeof welcomeBack> | null>(null);
  const [music, setMusic] = useState(false);
  const [player, setPlayer] = useState<Player | null>(() =>
    typeof localStorage === "undefined" ? null : loadPlayer(),
  );
  const [editPlayer, setEditPlayer] = useState(false);
  const audioRef = useRef<ReturnType<typeof createAudio> | null>(null);
  const [tutorial, setTutorial] = useState<number>(() => {
    if (typeof localStorage === "undefined") return -1;
    const raw = localStorage.getItem("omdat-tutorial");
    return raw === "done" ? -1 : Number(raw ?? 0) || 0;
  });
  const tutorialBase = useRef<{
    roads: number;
    buildings: number;
    collected: number;
    levels: number;
  } | null>(null);

  function celebrate(item: Celebration) {
    celebrateQueue.current.push(item);
    setCelebration((current) => current ?? celebrateQueue.current.shift() ?? null);
  }
  const celebrateRef = useRef(celebrate);
  celebrateRef.current = celebrate;

  function nextCelebration() {
    setCelebration(celebrateQueue.current.shift() ?? null);
  }

  function advanceTutorial(step: number) {
    const next = step + 1 >= TUTORIAL.length ? -1 : step + 1;
    localStorage.setItem("omdat-tutorial", next < 0 ? "done" : String(next));
    tutorialBase.current = null;
    setTutorial(next);
  }

  toolRef.current = tool;

  function pushToast(text: string) {
    const id = ++toastSeq.current;
    setToasts((q) => [...q, { id, text }].slice(-3));
    window.setTimeout(() => {
      setToasts((q) => q.filter((item) => item.id !== id));
    }, 2400);
  }

  // Saving a big city writes ~0.5 MB to localStorage; do it at most every 3 s while
  // playing, and right away when the page is hidden or closed.
  const lastSave = useRef(0);
  function sync() {
    simRef.current.lastSeen = Date.now();
    const next = cloneSim(simRef.current);
    setSnap(next);
    const now = Date.now();
    if (now - lastSave.current > 3000) {
      lastSave.current = now;
      saveSim(simRef.current);
    }
  }
  function flushSave() {
    lastSave.current = Date.now();
    if (simRef.current.started) saveSim(simRef.current);
  }
  const flushRef = useRef(flushSave);
  flushRef.current = flushSave;

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
    audioRef.current = audio;
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
    if (simRef.current.started) {
      const back = welcomeBack(simRef.current, Date.now());
      if (back.daily > 0 || back.offline > 0) setWelcome(back);
      saveSim(simRef.current);
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
        toastRef.current(t("تمت المهمة +{amount} د.ك", { amount: fmt(gained.reward) }));
      }
      notePromotion();
    }
    let eraSeen = eraOf(simRef.current);
    function notePromotion() {
      const sim = simRef.current;
      const up = checkPromotion(sim);
      if (up) {
        audio.play("quest", sim.mute);
        // Stored as keys/encoded messages so the card follows a language switch.
        celebrateRef.current({
          kind: "rank",
          title: up.title,
          detail:
            up.title === RANKS[RANKS.length - 1]!.title
              ? msg("مكافأة {amount} د.ك. صرت المحافظ! الهدف القادم: مليون ساكن.", {
                  amount: fmt(up.bonus),
                })
              : msg("مكافأة {amount} د.ك. الترقية القادمة: {title}", {
                  amount: fmt(up.bonus),
                  title: RANKS[RANKS.findIndex((r) => r.title === up.title) + 1]?.title ?? "",
                }),
        });
      }
      const era = eraOf(sim);
      if (era > eraSeen) {
        eraSeen = era;
        celebrateRef.current({
          kind: "era",
          title: ERAS[era]!,
          detail: msg("انفتحت مبانٍ ومعالم جديدة في قائمة البناء."),
        });
      }
      for (const a of checkAchievements(sim)) {
        audio.play("collect", sim.mute);
        toastRef.current(msg("🏆 إنجاز: {name}", { name: a.name }));
      }
    }
    notifyRef.current = { promotion: notePromotion };
    function collect(id: string) {
      const b = simRef.current.buildings.find((x) => x.id === id);
      const n = collectOne(simRef.current, id);
      if (n <= 0) return;
      if (b && world instanceof CityWorld) flyCoins(world.projectCell(b.c, b.r));
      audio.play("collect", simRef.current.mute);
      syncRef.current();
      toastRef.current(t("+{amount} د.ك", { amount: fmt(n) }));
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
            if (act.msg === t("الرصيد ما يكفي للطريق") || !from) {
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
      } else if (current?.kind === "site") {
        const act = startDevelopment(sim, current.project, at, current.developer);
        audio.play(act.ok ? "quest" : "error", sim.mute);
        if (!act.ok) toastRef.current(act.msg);
        else {
          toastRef.current(t("تم تسوير الموقع وبدأ البناء"));
          setToolRef.current(null);
        }
      } else if (current?.kind === "build") {
        const lot = nearestOpenLot(sim, at.c, at.r, 1) ?? at;
        const act = placeBuilding(sim, current.building, lot.c, lot.r, timeRef.current);
        audio.play(act.ok ? "place" : "error", sim.mute);
        if (!act.ok) toastRef.current(act.msg);
        else {
          if (coastal(at.c, at.r) && CATALOG[current.building].coastBoost)
            toastRef.current(t("على الكورنيش +١٥٪"));
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
        // Income is linear in time, so one tick per frame covers all elapsed steps
        // (big cities used to run dozens of full ticks per frame at top speed).
        if (acc >= 0.25) {
          const step = Math.floor(acc / 0.25) * 0.25;
          tick(sim, step);
          acc -= step;
        }
        const logBefore = sim.log[0];
        advanceDays(sim, dt * daysPerSec);
        if (sim.log[0] !== logBefore && sim.log[0]) {
          // Disasters, loans paid off, events ending: show what just happened.
          const news = sim.log[0];
          if (/حريق|عاصفة|سيول|انقطاع/.test(news)) audio.play("error", sim.mute);
          toastRef.current(news);
        }
        hudAcc += dt;
        if (hudAcc > 0.45) {
          hudAcc = 0;
          notePromotion();
          syncRef.current();
        }
      }
      world?.sync(sim, elapsed);
      raf = requestAnimationFrame(frame);
    }
    function onVisibility() {
      if (document.hidden) {
        flushRef.current();
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
    const onPageHide = () => flushRef.current();
    window.addEventListener("pagehide", onPageHide);
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
      // Development-only helper for visual checks; absent from production builds.
      grant: import.meta.env.DEV
        ? (amount: number, days = 0) => {
            simRef.current.coins += amount;
            if (days > 0) advanceDays(simRef.current, days);
            syncRef.current();
          }
        : undefined,
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
      window.removeEventListener("pagehide", onPageHide);
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

  // Language: pick the saved/browser choice after hydration, then keep 3D labels in step.
  useEffect(() => bootLang(), []);
  useEffect(() => {
    worldRef.current?.setLang(lang);
  }, [lang]);

  // The tutorial watches the city and moves on when the player does each step.
  useEffect(() => {
    if (tutorial < 0 || !snap.started) return;
    const now = {
      roads: snap.roads.length,
      buildings: snap.buildings.length,
      collected: snap.collected,
      levels: snap.buildings.reduce((n, b) => n + b.level, 0),
    };
    const base = tutorialBase.current;
    if (!base) {
      tutorialBase.current = now;
      return;
    }
    const done =
      (tutorial === 0 && snap.speed > 0) ||
      (tutorial === 1 && now.roads > base.roads) ||
      (tutorial === 2 && now.buildings > base.buildings) ||
      (tutorial === 3 && now.collected > base.collected) ||
      (tutorial === 4 && now.levels > base.levels);
    if (done) advanceTutorial(tutorial);
  }, [snap, tutorial]);

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
    pushToast(
      msg("{name}: حُفظ تقدّمك، ويمكنك التبديل من زر الأحياء", { name: districtById(id)!.name }),
    );
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
    pushToast(msg("استعدت مدينة الكويت القديمة دون تغيير حفظها"));
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
    pushToast(msg("مدينة جديدة على خريطة الكويت"));
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
    pushToast(t("+{amount} د.ك", { amount: fmt(n) }));
  }

  function onSpeed(n: 0 | 1 | 2 | 3) {
    simRef.current.speed = n;
    sync();
  }

  function onTax(n: number) {
    simRef.current.tax = Math.max(0, Math.min(300, n));
    sync();
  }

  function onCost(key: CostKey, value: number) {
    simRef.current.costs = { ...simRef.current.costs, [key]: Math.max(0, Math.min(COST_MAX, value)) };
    sync();
  }

  function onAutoRaise(pct: number) {
    simRef.current.autoRaise = pct;
    sync();
  }

  function finance(act: { ok: boolean; msg: string }) {
    pushToast(act.msg);
    sync();
  }

  function onCrisis(kind: CrisisKind) {
    const act = startCrisis(simRef.current, kind);
    pushToast(act.msg);
    sync();
  }

  function onMusic() {
    const next = !music;
    setMusic(next);
    audioRef.current?.music(next);
  }

  async function onPhoto() {
    const world = worldRef.current;
    const canvas = canvasRef.current;
    if (!world || !canvas) return;
    try {
      const shot =
        world instanceof CityWorld &&
        typeof (world as { snapshot?: () => string }).snapshot === "function"
          ? (world as unknown as { snapshot: () => string }).snapshot()
          : canvas.toDataURL("image/jpeg", 0.92);
      const img = new Image();
      img.src = shot;
      await img.decode();
      const out = document.createElement("canvas");
      out.width = img.width;
      out.height = img.height + 90;
      const ctx = out.getContext("2d")!;
      ctx.fillStyle = "#0e6e78";
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(img, 0, 0);
      const st = stats(simRef.current);
      ctx.fillStyle = "#f3eee4";
      // The caption sits on the reading side: right in Arabic, left in English.
      const rtl = dirOf() === "rtl";
      const x = rtl ? out.width - 24 : 24;
      ctx.textAlign = rtl ? "right" : "left";
      ctx.direction = rtl ? "rtl" : "ltr";
      ctx.font = "bold 34px 'Noto Kufi Arabic', sans-serif";
      const name = districtById(simRef.current.district)?.name ?? "الكويت";
      ctx.fillText(t("المحافظ · {name}", { name }), x, img.height + 42);
      ctx.font = "22px 'Noto Kufi Arabic', sans-serif";
      ctx.fillText(
        t("{residents} ساكن · رضا {happy}%", { residents: st.residents, happy: st.happy }),
        x,
        img.height + 74,
      );
      const blob = await new Promise<Blob | null>((ok) => out.toBlob(ok, "image/jpeg", 0.9));
      if (!blob) throw new Error("no image");
      const file = new File([blob], "kuwait-city.jpg", { type: "image/jpeg" });
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: t("مدينتي في المحافظ") });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "kuwait-city.jpg";
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        pushToast(t("تم حفظ صورة المدينة"));
      }
    } catch {
      pushToast(t("ما قدرت ألتقط الصورة"));
    }
  }

  function onLoan(amount: number, rate: number) {
    const act = takeLoan(simRef.current, amount, rate);
    pushToast(act.ok ? t("دخل حسابك {amount} د.ك من البنك", { amount: fmt(amount) }) : act.msg);
    sync();
  }

  function onRepay(amount: number) {
    const act = repayLoan(simRef.current, amount);
    pushToast(act.ok ? t("تم السداد") : act.msg);
    sync();
  }

  function onEvent(kind: EventKind) {
    const act = startEvent(simRef.current, kind);
    if (!act.ok) pushToast(act.msg);
    sync();
  }

  function onModel(kind: ModelKind) {
    const act = buyModelArea(simRef.current, kind, timeRef.current);
    if (!act.ok) {
      pushToast(act.msg);
      return;
    }
    advanceQuest(simRef.current);
    notifyRef.current.promotion();
    worldRef.current?.focus({ c: act.c, r: act.r }, 30);
    sync();
    pushToast(t("تم البناء: {n} مبنى", { n: act.built }));
  }

  function onLawBudget(key: keyof Ordinances, patch: Partial<LawBudget>) {
    const cur = simRef.current.lawBudget[key];
    simRef.current.lawBudget = {
      ...simRef.current.lawBudget,
      [key]: { ...cur, ...patch, value: Math.max(0, patch.value ?? cur.value) },
    };
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
        ? t("امتلأت القطع: {n} مبنى", { n: act.built })
        : t("تم التنظيم: {roads} طريق، {n} مبنى", { roads: act.roads, n: act.built }),
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
      <h1 className="sr-only">{t("المحافظ")}</h1>
      <div className="coin-fly-layer" aria-hidden="true" />
      <canvas
        ref={canvasRef}
        data-testid="city-canvas"
        aria-label={t("خريطة مدينة الكويت ثلاثية الأبعاد")}
        className="absolute inset-0 h-full w-full touch-none"
      />
      {graphicsError && (
        <p className="graphics-note" role="status">
          {t("عرض متوافق: اللعب كامل، والتجسيد ثنائي الأبعاد لعدم توفر WebGL.")}
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
        onCost={onCost}
        onAutoRaise={onAutoRaise}
        onDeposit={(a, rate) => finance(depositMoney(simRef.current, a, rate))}
        onWithdraw={(a) => finance(withdrawMoney(simRef.current, a))}
        onBond={(i) => finance(buyBond(simRef.current, i))}
        onProject={(i) => finance(startProject(simRef.current, i))}
        onConsult={() => finance(hireConsultant(simRef.current))}
        onMudaraba={(a, r) => finance(depositMudaraba(simRef.current, a, r))}
        onMudarabaWithdraw={() => finance(withdrawMudaraba(simRef.current))}
        onSukuk={(issuer, a, r, y) => finance(buySukuk(simRef.current, issuer, a, r, y))}
        onMurabaha={(a, p, m) => finance(takeMurabaha(simRef.current, a, p, m))}
        onHousingAid={(pct) => {
          simRef.current.housingAid = Math.max(0, Math.min(COST_MAX, Math.round(pct)));
          sync();
        }}
        onGiveAid={(amount) => finance(giveAid(simRef.current, amount))}
        onInsure={(on) => finance(setInsurance(simRef.current, on))}
        onDevelop={(kind, dev) => {
          const act = startDevelopment(simRef.current, kind, undefined, dev);
          if (!act.ok) pushToast(act.msg);
          else {
            pushToast(t("تم تسوير الموقع وبدأ البناء"));
            worldRef.current?.focus(
              { c: act.site.c + act.site.w / 2, r: act.site.r + act.site.h / 2 },
              34,
            );
          }
          sync();
        }}
        onPickSite={(kind, dev) => {
          setSelected(null);
          setTool({ kind: "site", project: kind, developer: dev });
          pushToast(t("اضغط على الخريطة في مكان المشروع"));
        }}
        player={player ?? { name: t("المحافظ"), avatar: "🧔🏽" }}
        onEditPlayer={() => setEditPlayer(true)}
        onBuilderHire={() => finance(hireBuilder(simRef.current))}
        onBuilderFire={() => finance(fireBuilder(simRef.current))}
        onBuilderShare={(pct) => {
          simRef.current.builder.share = Math.max(1, Math.min(100, Math.round(pct)));
          sync();
        }}
        onNpcOpen={(id: NpcId) => {
          greet(simRef.current, id);
          markRead(simRef.current, id);
          sync();
        }}
        onChat={(id, text) => {
          chat(simRef.current, id, text);
          markRead(simRef.current, id);
          sync();
        }}
        onLend={(id, amount, rate, months) => {
          finance(lendTo(simRef.current, id, amount, rate, months));
          markRead(simRef.current, id);
        }}
        onBorrow={(id, amount, rate, months) => {
          finance(borrowFrom(simRef.current, id, amount, rate, months));
          markRead(simRef.current, id);
        }}
        onNpcRepay={(id) => finance(repayNpc(simRef.current, id))}
        onCrisis={onCrisis}
        onPhoto={onPhoto}
        onMusic={onMusic}
        music={music}
        tutorial={tutorial}
        onTutorialSkip={() => {
          localStorage.setItem("omdat-tutorial", "done");
          setTutorial(-1);
        }}
        onPanel={(p) => {
          if (p === "budget" && tutorial === TUTORIAL.length - 1) advanceTutorial(tutorial);
        }}
        celebration={celebration}
        onCelebrationClose={nextCelebration}
        onLoan={onLoan}
        onRepay={onRepay}
        onEvent={onEvent}
        onModel={onModel}
        onOrdinance={onOrdinance}
        onLawBudget={onLawBudget}
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
      {snap.started && (editPlayer || !player) && (
        <PlayerSetup
          initial={player}
          onSave={(p) => {
            savePlayer(p);
            setPlayer(p);
            setEditPlayer(false);
            pushToast(t("أهلاً {name}!", { name: p.name }));
          }}
        />
      )}
      {welcome && (
        <WelcomeBack
          daily={welcome.daily}
          streak={welcome.streak}
          offline={welcome.offline}
          months={welcome.months}
          onClose={() => {
            setWelcome(null);
            sync();
          }}
        />
      )}
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
