/**
 * The construction advisor (مستشار البناء): the player hires him and sets what share
 * of the treasury he may spend each month. He pays the full building and upgrade
 * costs from that budget, takes a monthly fee, and works in this order:
 *   1. services that are badly short (school, clinic, police, fire, power, water),
 *   2. homes: villas replaced by apartment blocks, then apartments raised floor by
 *      floor up to skyscrapers — this is where most new residents come from,
 *   3. parks next to homes,
 *   4. shops and office towers raised toward skyscrapers,
 *   5. any other building that can still be upgraded.
 */
import { CATALOG, maxLevelOf, type Kind } from "./catalog";
import { siteAt } from "./developments";
import {
  cellKey,
  cellTaken,
  roadSet,
  isLand,
  placeBuilding,
  priceOf,
  settleUpgrade,
  serviceCoverage,
  stats,
  upgradeCost,
  type Building,
  type Sim,
} from "./sim";
import { msg, t, bigNum } from "../i18n/index.ts";

export type BuilderState = {
  hired: boolean;
  /** Share of the current balance he may spend each month, in percent (1–100). */
  share: number;
  /** Lifetime money spent on works (fees excluded) and works done. */
  spent: number;
  works: number;
  /** Last month's report, for the panel (an encoded message, see `msg` in i18n). */
  last: string;
};

export const BUILDER_NAME = "م. عبدالله المقاول";
export const BUILDER_SIGN_ON = 2_000;

export function emptyBuilder(): BuilderState {
  return { hired: false, share: 20, spent: 0, works: 0, last: "" };
}

export function loadBuilder(raw: unknown): BuilderState {
  const b = emptyBuilder();
  if (!raw || typeof raw !== "object") return b;
  const p = raw as Partial<BuilderState>;
  b.hired = Boolean(p.hired);
  b.share = Math.min(100, Math.max(1, Number(p.share) || 20));
  b.spent = Math.max(0, Number(p.spent) || 0);
  b.works = Math.max(0, Number(p.works) || 0);
  b.last = typeof p.last === "string" ? p.last : "";
  return b;
}

/** Monthly fee: a base salary that grows with the city, plus 5٪ of the works. */
export function builderFee(s: Sim, works = 0) {
  return Math.round(300 + stats(s).residents * 0.01 + works * 0.05);
}

const fmt = (n: number) => bigNum(n);

type Plan = { label: string; cost: number; run: () => boolean };

/** Upgrade a building in place, paying the full price. */
function upgradePlan(s: Sim, b: Building, label: string): Plan | null {
  if (b.level >= maxLevelOf(b.kind)) return null;
  const cost = priceOf(upgradeCost(b.kind, b.level), s);
  const level = b.level;
  return {
    label,
    cost,
    run: () => {
      // Planned for this level; skip quietly if it changed meanwhile.
      if (b.level !== level || b.level >= maxLevelOf(b.kind)) return false;
      if (!settleUpgrade(s, cost).ok) return false;
      b.level += 1;
      return true;
    },
  };
}

/** A villa becomes an apartment block on the same lot (demolition included). */
function replacePlan(s: Sim, b: Building): Plan {
  const cost = Math.round(priceOf(CATALOG.apartments.cost, s) * 1.15);
  return {
    label: "عمارة بدل فيلا",
    cost,
    run: () => {
      if (b.kind !== "villa" && b.kind !== "modern") return false;
      if (!settleUpgrade(s, cost).ok) return false;
      b.kind = "apartments";
      b.level = 1;
      b.stored = 0;
      return true;
    },
  };
}

/**
 * Free lots that touch a road and sit next to existing buildings, collected once per
 * month (O(buildings)) and handed out one by one.
 */
/**
 * Candidate lots by city layout: a full map has ~100k buildings, and rescanning all
 * their neighbours for every building the board or builder places took seconds.
 * The list is reused while the layout is unchanged; each lot is re-checked on use.
 */
const lotCache = new WeakMap<Sim, { sig: string; lots: { c: number; r: number }[] }>();

function lotFinder(s: Sim) {
  // Once per game month (and when a site starts or ends): placing buildings only
  // uses lots up, and every lot is re-checked before use, so a fresh scan after each
  // building (several full-map scans a month) bought nothing but freezes.
  const sig =
    s.buildings.length < 1500
      ? `${s.buildings.length}:${s.roads.length}:${s.sites.length}`
      : `${Math.floor(s.day / 30)}:${s.roads.length}:${s.sites.length}:${s.district ?? ""}`;
  const hit = lotCache.get(s);
  const lots = hit && hit.sig === sig ? hit.lots : scanLots(s);
  if (!hit || hit.sig !== sig) lotCache.set(s, { sig, lots });
  let next = 0;
  return () => {
    while (next < lots.length) {
      const lot = lots[next++]!;
      if (!cellTaken(s, lot.c, lot.r) && !siteAt(s.sites, lot.c, lot.r)) return lot;
    }
    return null;
  };
}

function scanLots(s: Sim) {
  const roads = roadSet(s);
  const seen = new Set<string>();
  const lots: { c: number; r: number }[] = [];
  const around = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, -1],
    [1, -1],
    [-1, 1],
  ] as const;
  for (const b of s.buildings)
    for (const [dc, dr] of around) {
      const c = b.c + dc;
      const r = b.r + dr;
      const key = cellKey(c, r);
      if (seen.has(key)) continue;
      seen.add(key);
      if (!isLand(c, r) || cellTaken(s, c, r) || siteAt(s.sites, c, r)) continue;
      if (
        roads.has(cellKey(c + 1, r)) ||
        roads.has(cellKey(c - 1, r)) ||
        roads.has(cellKey(c, r + 1)) ||
        roads.has(cellKey(c, r - 1))
      )
        lots.push({ c, r });
    }
  return lots;
}

/**
 * The month's work list, in priority order, computed once from a single look at the
 * city (the old version re-scanned the whole city before every single job):
 * short services → villas into apartment blocks → apartment floors, lowest first →
 * parks → shops and towers → everything else.
 */
function* plans(s: Sim): Generator<Plan> {
  const st = stats(s);
  const cover = serviceCoverage(s);
  const lot = lotFinder(s);
  const build = (kind: Kind, label: string): Plan | null => {
    const at = lot();
    if (!at) return null;
    return {
      label,
      cost: priceOf(CATALOG[kind].cost, s),
      run: () => placeBuilding(s, kind, at.c, at.r, 0).ok,
    };
  };
  // Services that are badly short: enough new ones to reach ~60٪ coverage.
  const homes = st.capacity;
  const services: [number, Kind, string, number][] = [
    [st.powerGive >= st.powerUse ? 1 : 0, "power", "محطة كهرباء", 0],
    [st.waterGive >= st.waterUse ? 1 : 0, "water", "محطة تحلية", 0],
    [cover.school, "school", "مدرسة", 260],
    [cover.clinic, "clinic", "مستوصف", 300],
    [cover.police, "police", "مركز شرطة", 280],
    [cover.fire, "fire", "مركز إطفاء", 420],
  ];
  services.sort((a, b) => a[0] - b[0]);
  for (const [level, kind, label, per] of services) {
    if (level >= 0.6) continue;
    const need = per ? Math.ceil(((0.6 - level) * homes) / per) : 1;
    for (let k = 0; k < Math.min(need, 50); k += 1) {
      const plan = build(kind, label);
      if (!plan) break;
      yield plan;
    }
  }
  for (const b of s.buildings)
    if (b.kind === "villa" || b.kind === "modern") yield replacePlan(s, b);
  const rounds = (pick: (b: Building) => boolean, label: (b: Building) => string) => {
    const list = s.buildings.filter(pick);
    const out: Plan[] = [];
    for (let level = 1; level < 5; level += 1)
      for (const b of list)
        if (b.level === level) {
          const plan = upgradePlan(s, b, label(b));
          if (plan) out.push(plan);
        }
    return out;
  };
  // Apartment floors are planned level by level; each plan re-checks the level when run.
  for (const plan of rounds(
    (b) => b.kind === "apartments",
    (b) => (b.level >= 3 ? "ناطحة سكنية" : "دور إضافي لعمارة"),
  ))
    yield plan;
  if (cover.park < 0.8) {
    const need = Math.ceil(((0.8 - cover.park) * homes) / 140);
    for (let k = 0; k < Math.min(need, 50); k += 1) {
      const plan = build("park", "حديقة");
      if (!plan) break;
      yield plan;
    }
  }
  for (const plan of rounds(
    (b) => b.kind === "shop" || b.kind === "tower",
    (b) => (b.level >= 3 ? "ناطحة تجارية" : "ترقية تجارية"),
  ))
    yield plan;
  for (const plan of rounds(
    (b) =>
      b.kind !== "apartments" &&
      b.kind !== "shop" &&
      b.kind !== "tower" &&
      CATALOG[b.kind].cat !== "landmarks",
    (b) => msg("ترقية {name}", { name: CATALOG[b.kind].name }),
  ))
    yield plan;
}

/**
 * Spend up to `budget` on the work list (services, homes, upgrades). Used by the
 * construction advisor and by the board's construction director.
 */
export function runPlans(s: Sim, budget: number) {
  let left = budget;
  let spent = 0;
  const done = new Map<string, number>();
  let guard = 0;
  for (const plan of plans(s)) {
    if (guard++ >= 2000) break;
    if (plan.cost > left) continue;
    if (!plan.run()) continue;
    left -= plan.cost;
    spent += plan.cost;
    done.set(plan.label, (done.get(plan.label) ?? 0) + 1);
  }
  const works = [...done.values()].reduce((n, v) => n + v, 0);
  return { spent, works, list: [...done].map(([label, n]) => msg("{n} {label}", { n, label })) };
}

/** A free lot beside a road and next to the city, or null. */
export function freeLot(s: Sim) {
  return lotFinder(s)();
}

/**
 * One month of work. Returns a short report (also kept in `s.builder.last`), or null
 * when not hired. The budget is `share٪` of the balance at the start of the month.
 */
export function builderMonth(s: Sim, reserve = 0) {
  const b = s.builder;
  if (!b.hired) return null;
  // The share is of what is left after a reserve for the coming months' running costs,
  // so even at 100% the advisor never empties the treasury into a deficit.
  const budget = Math.floor(Math.max(0, s.coins - reserve) * (b.share / 100));
  const before = stats(s).residents;
  let left = budget;
  let spent = 0;
  const done = new Map<string, number>();
  let guard = 0;
  for (const plan of plans(s)) {
    if (guard++ >= 2000) break;
    // Skip jobs that don't fit what's left; smaller ones further down may still fit.
    if (plan.cost > left) continue;
    if (!plan.run()) continue;
    // The budget caps the volume of works, whoever ends up paying for them.
    left -= plan.cost;
    spent += plan.cost;
    done.set(plan.label, (done.get(plan.label) ?? 0) + 1);
  }
  const fee = builderFee(s, spent);
  s.coins -= fee;
  s.ytd.spend += fee;
  b.spent += spent;
  const works = [...done.values()].reduce((n, v) => n + v, 0);
  b.works += works;
  const gained = stats(s).residents - before;
  const list = [...done].map(([label, n]) => msg("{n} {label}", { n, label }));
  b.last = works
    ? gained > 0
      ? msg("{works} · {spent} د.ك + أتعاب {fee} · +{gained} ساكن", {
          works: list,
          spent: fmt(spent),
          fee: fmt(fee),
          gained: fmt(gained),
        })
      : msg("{works} · {spent} د.ك + أتعاب {fee}", {
          works: list,
          spent: fmt(spent),
          fee: fmt(fee),
        })
    : msg("ما كفت الميزانية ({budget} د.ك) لأي عمل · أتعاب {fee}", {
        budget: fmt(budget),
        fee: fmt(fee),
      });
  return b.last;
}

export function hireBuilder(s: Sim): { ok: boolean; msg: string } {
  if (s.builder.hired) return { ok: false, msg: t("المستشار يعمل عندك") };
  if (s.coins < BUILDER_SIGN_ON)
    return { ok: false, msg: t("تحتاج {amount} د.ك للتعاقد", { amount: fmt(BUILDER_SIGN_ON) }) };
  s.coins -= BUILDER_SIGN_ON;
  s.builder.hired = true;
  return { ok: true, msg: t("تعاقدت مع {name}", { name: BUILDER_NAME }) };
}

export function fireBuilder(s: Sim) {
  s.builder.hired = false;
  return { ok: true, msg: t("أنهيت عقد مستشار البناء") };
}
