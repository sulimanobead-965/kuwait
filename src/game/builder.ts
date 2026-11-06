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
  isLand,
  placeBuilding,
  priceOf,
  serviceCoverage,
  stats,
  upgradeCost,
  type Building,
  type Sim,
} from "./sim";
import { msg, t } from "../i18n/index.ts";

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

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

type Plan = { label: string; cost: number; run: () => boolean };

/** Upgrade a building in place, paying the full price. */
function upgradePlan(s: Sim, b: Building, label: string): Plan | null {
  if (b.level >= maxLevelOf(b.kind)) return null;
  const cost = priceOf(upgradeCost(b.kind, b.level), s);
  return {
    label,
    cost,
    run: () => {
      if (s.coins < cost) return false;
      s.coins -= cost;
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
      if (s.coins < cost) return false;
      s.coins -= cost;
      b.kind = "apartments";
      b.level = 1;
      b.stored = 0;
      return true;
    },
  };
}

/** An open lot beside a road, near the existing city. */
function openLot(s: Sim) {
  const taken = new Set(s.roads);
  for (const b of s.buildings) taken.add(cellKey(b.c, b.r));
  const near = s.buildings.length ? s.buildings : [];
  for (const b of near) {
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
    ] as const) {
      const c = b.c + dc;
      const r = b.r + dr;
      const key = cellKey(c, r);
      if (!isLand(c, r) || taken.has(key) || siteAt(s.sites, c, r)) continue;
      const fronts = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([x, y]) => s.roads.includes(cellKey(c + x!, r + y!)));
      if (fronts) return { c, r };
    }
  }
  return null;
}

function buildPlan(s: Sim, kind: Kind, label: string): Plan | null {
  const lot = openLot(s);
  if (!lot) return null;
  const cost = priceOf(CATALOG[kind].cost, s);
  return {
    label,
    cost,
    run: () => placeBuilding(s, kind, lot.c, lot.r, 0).ok,
  };
}

function nextPlan(s: Sim): Plan | null {
  const st = stats(s);
  const cover = serviceCoverage(s);
  const short: [number, Kind, string][] = [
    [st.powerGive >= st.powerUse ? 1 : 0, "power", "محطة كهرباء"],
    [st.waterGive >= st.waterUse ? 1 : 0, "water", "محطة تحلية"],
    [cover.school, "school", "مدرسة"],
    [cover.clinic, "clinic", "مستوصف"],
    [cover.police, "police", "مركز شرطة"],
    [cover.fire, "fire", "مركز إطفاء"],
  ];
  short.sort((a, b) => a[0] - b[0]);
  const worst = short[0]!;
  if (worst[0] < 0.6) {
    const plan = buildPlan(s, worst[1], worst[2]);
    if (plan) return plan;
  }
  const villa = s.buildings.find((b) => b.kind === "villa" || b.kind === "modern");
  if (villa) return replacePlan(s, villa);
  const flats = s.buildings
    .filter((b) => b.kind === "apartments" && b.level < maxLevelOf(b.kind))
    .sort((a, b) => a.level - b.level)[0];
  if (flats) return upgradePlan(s, flats, flats.level >= 3 ? "ناطحة سكنية" : "دور إضافي لعمارة");
  if (cover.park < 0.8) {
    const plan = buildPlan(s, "park", "حديقة");
    if (plan) return plan;
  }
  const trade = s.buildings
    .filter((b) => (b.kind === "shop" || b.kind === "tower") && b.level < maxLevelOf(b.kind))
    .sort((a, b) => a.level - b.level)[0];
  if (trade) return upgradePlan(s, trade, trade.level >= 3 ? "ناطحة تجارية" : "ترقية تجارية");
  const other = s.buildings
    .filter((b) => b.level < maxLevelOf(b.kind) && CATALOG[b.kind].cat !== "landmarks")
    .sort((a, b) => a.level - b.level)[0];
  if (other) return upgradePlan(s, other, msg("ترقية {name}", { name: CATALOG[other.kind].name }));
  return null;
}

/**
 * One month of work. Returns a short report (also kept in `s.builder.last`), or null
 * when not hired. The budget is `share٪` of the balance at the start of the month.
 */
export function builderMonth(s: Sim) {
  const b = s.builder;
  if (!b.hired) return null;
  const budget = Math.floor(Math.max(0, s.coins) * (b.share / 100));
  const before = stats(s).residents;
  let left = budget;
  let spent = 0;
  const done = new Map<string, number>();
  for (let guard = 0; guard < 400; guard += 1) {
    const plan = nextPlan(s);
    if (!plan || plan.cost > left) break;
    const coins = s.coins;
    if (!plan.run()) break;
    const cost = coins - s.coins;
    left -= cost;
    spent += cost;
    done.set(plan.label, (done.get(plan.label) ?? 0) + 1);
  }
  const fee = builderFee(s, spent);
  s.coins -= fee;
  s.ytd.spend += spent + fee;
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
