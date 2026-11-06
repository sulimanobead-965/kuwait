import { CATALOG, isLandmark, maxLevelOf, ROAD_COST, type Kind } from "./catalog";
import {
  claim,
  consulting,
  emptyFinance,
  financeMonth,
  loadFinance,
  type FinanceState,
} from "./finance";
import { builderMonth, emptyBuilder, loadBuilder, type BuilderState } from "./builder";
import { emptyNpcs, loadNpcs, npcMonth, type NpcState } from "./npcs";
import {
  DEVELOPERS,
  DEVELOPER_IDS,
  DEVELOPMENTS,
  loadSites,
  type DeveloperId,
  siteAt,
  type DevelopmentKind,
  type Site,
} from "./developments";
import { COLS, GRID_GEN, LAND, ROWS } from "./land";
import { msg, t, tx } from "../i18n/index.ts";
export { districtById, isDistrictLand } from "./districts";
import {
  districtById,
  districtRoads,
  districtSaveKey,
  isDistrictLand,
  isSchematicRoad,
  sectorsForZone,
  type DistrictId,
} from "./districts";
export type { DistrictId } from "./districts";

export type Building = {
  id: string;
  kind: Kind;
  c: number;
  r: number;
  level: number;
  stored: number;
  born: number;
};

export type Sim = {
  coins: number;
  roads: string[];
  buildings: Building[];
  quest: number;
  mute: boolean;
  started: boolean;
  day: number;
  speed: 0 | 1 | 2 | 3;
  tax: number;
  ordinances: Ordinances;
  /** How much each law is funded: a fixed amount or a share of income, monthly or yearly. */
  lawBudget: LawBudgets;
  disaster: Disaster | null;
  randomDisasters: boolean;
  log: string[];
  history: Sample[];
  difficulty: Difficulty;
  luckAt: number;
  /** Legacy v2 saves intentionally omit this optional top-level field. */
  district?: DistrictId | null;
  /** Cost of living the governor sets, in percent of the normal tariff per item. */
  costs: Costs;
  /** Automatic yearly raise of every cost item, in percent (0 = frozen). */
  autoRaise: number;
  /**
   * Housing support: the share of every family's rent the city pays each month, in
   * percent (0 = none, 100 = rent-free, above 100 = rent paid plus extra cash help).
   */
  housingAid: number;
  /** A one-off emergency grant: extra happiness until this day. */
  aidUntil: number;
  aidHappy: number;
  /** Year-end measurements (most recent last). */
  years: YearRow[];
  /** Running totals for the current year. */
  ytd: { income: number; spend: number; residents0: number };
  /** Share of housing capacity that is lived in (0.25–1); drifts toward satisfaction. */
  occupancy: number;
  /** Outstanding loan, interest included. Repaid monthly. */
  loan: number;
  /** Money-weighted yearly rate of the outstanding bank loan (for insurance). */
  loanRate: number;
  /** A running city event (tournament, festival…) and its end day. */
  event: CityEvent | null;
  /** Lasting reputation from past events (0–12), a small permanent satisfaction bonus. */
  fame: number;
  /** Highest title reached; used to announce promotions once. */
  rank: number;
  /** Visual effects pinned to cells (burning buildings, smoke) for the renderer. */
  fx: CellFx[];
  /** A running global crisis. */
  crisis: Crisis | null;
  /** Bank, developer and consultancy dealings. */
  finance: FinanceState;
  /** The construction advisor who builds and upgrades with a share of the budget. */
  builder: BuilderState;
  /** Virtual players: chats and loans in both directions. */
  npcs: NpcState[];
  /** Fenced developer construction sites inside the city. */
  sites: Site[];
  /** One-off story markers (event held, loan repaid, crisis survived…). */
  flags: string[];
  achievements: string[];
  /** Coins ever collected from buildings (tutorial and achievements). */
  collected: number;
  /** Wall-clock bookkeeping for daily rewards and offline earnings. */
  lastSeen: number;
  dailyDay: string;
  streak: number;
};

export type CostKey = "housing" | "education" | "health" | "utilities" | "transport";
export type Costs = Record<CostKey, number>;
export type YearRow = {
  year: number;
  residents: number;
  happy: number;
  costIndex: number;
  income: number;
  spend: number;
  coins: number;
};

export type CellFx = { kind: "fire" | "smoke"; c: number; r: number; until: number };
export type CrisisKind = "economic" | "pandemic" | "war";
export type Crisis = { kind: CrisisKind; until: number };

export type EventKind = "football" | "marathon" | "festival" | "concert";
export type CityEvent = { kind: EventKind; until: number };

export type Difficulty = "easy" | "medium" | "hard";

export type Ordinances = {
  education: boolean;
  recycling: boolean;
  carpool: boolean;
  clinicFund: boolean;
  smokeBan: boolean;
};

export type LawBudget = { mode: "amount" | "percent"; value: number; period: "month" | "year" };
export type LawBudgets = Record<keyof Ordinances, LawBudget>;

export function defaultLawBudgets(): LawBudgets {
  const one = (value: number): LawBudget => ({ mode: "amount", value, period: "month" });
  return {
    education: one(20),
    recycling: one(10),
    carpool: one(6),
    clinicFund: one(14),
    smokeBan: one(8),
  };
}

export type DisasterKind = "fire" | "storm" | "blackout" | "flood";

export type Disaster = { kind: DisasterKind; until: number };

export type Sample = {
  day: number;
  water: number;
  power: number;
  crime: number;
  pop: number;
  funds: number;
  pollution: number;
  traffic: number;
  unemployment: number;
  industry: number;
  approval: number;
  size: number;
  commerce: number;
  land: number;
  health: number;
  education: number;
};

export type CityStats = {
  /** Housing units lived in (simulation scale). */
  pop: number;
  /** People: `pop × RESIDENTS_PER_UNIT`. */
  residents: number;
  /** Homes available if everyone moved in. */
  capacity: number;
  /** Lowest service coverage, 0–1. */
  service: number;
  happy: number;
  powerUse: number;
  powerGive: number;
  waterUse: number;
  waterGive: number;
  mult: number;
  short: boolean;
};

const SAVE_KEY = "omdat-kuwait-v1";
const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
const EPOCH = Date.UTC(1961, 1, 13);

export function cellKey(c: number, r: number) {
  return `${c},${r}`;
}

export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function formatCityDate(day: number) {
  const d = new Date(EPOCH + Math.floor(day) * 86400000);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getUTCFullYear()}`;
}

export function emptyOrdinances(): Ordinances {
  return {
    education: false,
    recycling: false,
    carpool: false,
    clinicFund: false,
    smokeBan: false,
  };
}

/** Set while a prepaid package (model area) places its own buildings. */
let prepaid = false;
/** Set while the developer builds inside its own fence. */
let developing = false;

/** The reason a cell is off-limits: it's inside someone's fenced construction site. */
function fenced(s: Sim, c: number, r: number) {
  if (developing || !s.sites?.length || !siteAt(s.sites, c, r)) return null;
  const site = siteAt(s.sites, c, r)!;
  return t("منطقة محمية: قيد التطوير من {company}", {
    company: DEVELOPERS[site.developer ?? "marsa"].name,
  });
}

export function priceOf(base: number, _s: Sim) {
  return prepaid ? 0 : Math.round(base);
}

/**
 * Homes multiplier by level. Levels 1–3 add a floor each; skyscraper levels 4 and 5
 * stack dozens of floors, so a level-5 residential tower houses ~10,000 people.
 */
export function homesPerLevel(level: number) {
  return level <= 3 ? level : level === 4 ? 6 : 10;
}

/** Lowest share of homes still lived in, however bad things get. */
export const OCCUPANCY_MIN = 0.1;

/** People per housing unit: the grid counts households, the HUD counts residents. */
export const RESIDENTS_PER_UNIT = 15;

// ---------------------------------------------------------------- titles

/** Thresholds are in residents. */
export const RANKS: readonly { title: string; pop: number }[] = [
  { title: "مساعد المختار", pop: 0 },
  { title: "مختار المنطقة", pop: 15_000 },
  { title: "المحافظ", pop: 100_000 },
];

export function rankOf(residents: number) {
  let i = 0;
  for (let n = 0; n < RANKS.length; n += 1) if (residents >= RANKS[n]!.pop) i = n;
  return i;
}

/** Announces a promotion once; returns the new title or null. */
export function checkPromotion(s: Sim, st = stats(s)) {
  const now = rankOf(st.residents);
  if (now <= s.rank) return null;
  s.rank = now;
  const title = RANKS[now]!.title;
  const bonus = now === 1 ? 5000 : 50000;
  s.coins += bonus;
  pushLog(s, msg("ترقية: صرت {title}", { title }));
  return { title, bonus };
}

// ---------------------------------------------------------------- events

export const EVENTS: Record<
  EventKind,
  { name: string; cost: number; days: number; income: number; happy: number; draw: number; fame: number; blurb: string }
> = {
  football: {
    name: "بطولة كرة قدم",
    cost: 3500,
    days: 45,
    income: 0.3,
    happy: 12,
    draw: 0.12,
    fame: 3,
    blurb: "جماهير وفنادق ومطاعم: دخل أعلى وناس تنتقل للمنطقة.",
  },
  marathon: {
    name: "ماراثون الكورنيش",
    cost: 1200,
    days: 20,
    income: 0.1,
    happy: 8,
    draw: 0.05,
    fame: 1,
    blurb: "رياضة وصحة على شارع الخليج. رخيص ويرفع الرضا.",
  },
  festival: {
    name: "مهرجان هلا فبراير",
    cost: 2500,
    days: 30,
    income: 0.22,
    happy: 10,
    draw: 0.08,
    fame: 2,
    blurb: "تسوّق وفعاليات عائلية: التجارة تنتعش.",
  },
  concert: {
    name: "حفلة وطنية",
    cost: 1800,
    days: 10,
    income: 0.15,
    happy: 14,
    draw: 0.04,
    fame: 2,
    blurb: "ليلة واحدة ترفع الرضا كثيراً.",
  },
};

function activeEvent(s: Sim) {
  if (!s.event || s.day >= s.event.until) return null;
  const def = EVENTS[s.event.kind];
  // A stadium doubles what a football tournament does for the city.
  if (s.event.kind === "football" && s.buildings.some((b) => b.kind === "stadium"))
    return { ...def, income: def.income * 2, happy: def.happy + 6, draw: def.draw * 2 };
  return def;
}

export function startEvent(s: Sim, kind: EventKind): Act {
  if (activeEvent(s)) return { ok: false, msg: t("في فعالية شغّالة. استنى تخلص") };
  if (crisisOf(s) === "pandemic") return { ok: false, msg: t("الوباء يمنع التجمعات الآن") };
  const def = EVENTS[kind];
  if (s.coins < def.cost) return { ok: false, msg: t("تحتاج {amount} د.ك", { amount: def.cost }) };
  if (stats(s).residents < 600)
    return { ok: false, msg: t("تحتاج ٦٠٠ ساكن على الأقل لتنظيم فعالية") };
  s.coins -= def.cost;
  s.event = { kind, until: s.day + def.days };
  s.flags.push(`event:${kind}`);
  pushLog(s, msg("انطلقت: {name}", { name: def.name }));
  return { ok: true };
}

// ---------------------------------------------------------------- loans

export const LOAN_RATE = 0.12;
export const LOAN_LIMIT = 40000;

/** The bank lends more to bigger cities. */
export function loanLimit(s: Sim, st = stats(s)) {
  return Math.max(LOAN_LIMIT, Math.round(st.residents * 4 + Math.max(0, s.coins) * 0.5));
}

/**
 * The lowest yearly rate the bank accepts right now: dearer when you already owe a
 * lot, during an economic crisis or a war.
 */
export function minLoanRate(s: Sim, st = stats(s)) {
  const load = s.loan / Math.max(1, loanLimit(s, st));
  const crisis = crisisOf(s);
  return 0.05 + load * 0.15 + (crisis === "economic" ? 0.08 : crisis === "war" ? 0.05 : 0);
}

export function takeLoan(s: Sim, amount: number, rate = LOAN_RATE): Act {
  if (!(amount > 0) || !(rate >= 0)) return { ok: false, msg: t("مبلغ غير صحيح") };
  if (!s.finance || s.finance.down.bank > s.day) return { ok: false, msg: t("البنك مغلق بعد إفلاسه") };
  // No ceiling and no minimum rate: the bank lends whatever the governor asks for.
  const debt = Math.round(amount * (1 + rate));
  s.loanRate = s.loan + debt > 0 ? (s.loan * (s.loanRate ?? LOAN_RATE) + debt * rate) / (s.loan + debt) : rate;
  s.coins += amount;
  s.loan += debt;
  pushLog(s, msg("قرض {amount} د.ك من البنك", { amount }));
  return { ok: true };
}

export function repayLoan(s: Sim, amount: number): Act {
  const pay = Math.min(amount, s.loan, Math.max(0, s.coins));
  if (pay <= 0) return { ok: false, msg: t(s.loan <= 0 ? "ما عليك دين" : "الرصيد ما يكفي للسداد") };
  s.coins -= pay;
  s.loan -= pay;
  if (s.loan <= 0) {
    pushLog(s, msg("سدّدت القرض كاملاً"));
    if (!s.flags.includes("repaid")) s.flags.push("repaid");
  }
  return { ok: true };
}

export function loanInstallment(s: Sim) {
  return s.loan <= 0 ? 0 : Math.min(s.loan, Math.max(150, Math.round(s.loan * 0.06)));
}

// ---------------------------------------------------------------- services

/** How well each service covers the people living here (1 = fully covered). */
export function serviceCoverage(s: Sim, capacity?: number) {
  const pop = capacity ?? housingCapacity(s);
  const count = (kind: Kind) =>
    s.buildings.filter((b) => b.kind === kind).reduce((n, b) => n + b.level, 0);
  const cover = (kind: Kind, per: number) =>
    pop <= 0 ? 1 : clamp((count(kind) * per) / pop, 0, 1);
  return {
    school: cover("school", 260),
    clinic: cover("clinic", 300),
    police: cover("police", 280),
    fire: cover("fire", 420),
    park: cover("park", 140),
  };
}

export const SERVICE_NAMES: Record<keyof ReturnType<typeof serviceCoverage>, string> = {
  school: "مدارس",
  clinic: "مستوصفات",
  police: "شرطة",
  fire: "إطفاء",
  park: "حدائق",
};

function housingCapacity(s: Sim) {
  let pop = 0;
  for (const b of s.buildings) pop += CATALOG[b.kind].pop * homesPerLevel(b.level) * 2;
  return pop;
}

// ---------------------------------------------------------------- cost of living

export const COST_ITEMS: Record<
  CostKey,
  { name: string; perResident: number; weight: number; blurb: string }
> = {
  housing: { name: "السكن والإيجارات", perResident: 0.015, weight: 0.35, blurb: "أكبر بند في ميزانية الأسرة" },
  education: { name: "التعليم", perResident: 0.008, weight: 0.2, blurb: "رسوم المدارس والكتب" },
  health: { name: "الصحة", perResident: 0.007, weight: 0.2, blurb: "المستوصفات والأدوية" },
  utilities: { name: "الكهرباء والماء", perResident: 0.007, weight: 0.15, blurb: "فواتير البيت" },
  transport: { name: "النقل والمواصلات", perResident: 0.003, weight: 0.1, blurb: "الباصات والبنزين" },
};
export const COST_KEYS = Object.keys(COST_ITEMS) as CostKey[];

export function defaultCosts(): Costs {
  return { housing: 100, education: 100, health: 100, utilities: 100, transport: 100 };
}

/** Weighted cost-of-living index (100 = normal). */
export function costIndex(s: Sim) {
  return Math.round(
    COST_KEYS.reduce(
      (n, k) => n + COST_ITEMS[k].weight * (k === "housing" ? effectiveHousing(s) : s.costs[k]),
      0,
    ),
  );
}

/** What families really feel for rent after the city's housing support (may go below 0). */
export function effectiveHousing(s: Sim) {
  return s.costs.housing * (1 - (s.housingAid ?? 0) / 100);
}

/**
 * Monthly cost of housing support: the city pays `housingAid٪` of the normal rent
 * bill for every resident (based on the rent residents would owe at today's price).
 */
export function housingAidCost(s: Sim, st = stats(s)) {
  const rent = st.residents * COST_ITEMS.housing.perResident * (s.costs.housing / 100);
  return Math.round(rent * ((s.housingAid ?? 0) / 100));
}

/** One-off emergency aid: money now, happiness for six months (bigger grants, more). */
export function giveAid(s: Sim, amount: number) {
  if (!(amount > 0)) return { ok: false as const, msg: t("مبلغ غير صحيح") };
  if (s.coins < amount) return { ok: false as const, msg: t("الرصيد ما يكفي") };
  const st = stats(s);
  const perFamily = amount / Math.max(1, st.pop);
  const boost = Math.min(25, Math.round(4 + perFamily * 2));
  s.coins -= amount;
  s.ytd.spend += amount;
  s.aidUntil = s.day + 180;
  s.aidHappy = Math.max(s.aidUntil > s.day ? s.aidHappy : 0, boost);
  pushLog(s, msg("صرفت مساعدة للسكان بقيمة {amount} د.ك", { amount: Math.round(amount) }));
  return { ok: true as const, msg: t("وصلت المساعدة للسكان: الرضا +{n} لستة أشهر", { n: boost }) };
}

/** Monthly revenue per cost item and in total. */
export function costRevenue(s: Sim, st = stats(s)) {
  const rows = {} as Record<CostKey, number>;
  let total = 0;
  for (const k of COST_KEYS) {
    const v = Math.round(st.residents * COST_ITEMS[k].perResident * collectedShare(s.costs[k]));
    rows[k] = v;
    total += v;
  }
  return { rows, total };
}

/** Highest cost setting, in percent of the normal tariff. */
export const COST_MAX = 100_000;

/**
 * What a price setting actually brings in, as a multiple of the normal tariff.
 * People pay more as prices rise, but past ~400% they stop paying, cheat or leave,
 * so 10,000% brings in almost nothing (a Laffer curve).
 */
export function collectedShare(percent: number) {
  const p = Math.max(0, percent) / 100;
  return p <= 1 ? p : p * Math.exp(-(p - 1) / 4);
}

/** Monthly revenue from living costs paid by residents. */
export function feeRevenue(s: Sim, st = stats(s)) {
  return costRevenue(s, st).total;
}

// ---------------------------------------------------------------- global crises

export const CRISES: Record<
  CrisisKind,
  { name: string; months: [number, number]; income: number; happy: number; leave: number; blurb: string }
> = {
  economic: {
    name: "أزمة اقتصادية عالمية",
    months: [14, 26],
    income: 0.65,
    happy: 8,
    leave: 0.04,
    blurb: "الدخل ينزل، والبنوك والشركات معرضة للإفلاس.",
  },
  pandemic: {
    name: "وباء عالمي",
    months: [8, 14],
    income: 0.8,
    happy: 14,
    leave: 0.1,
    blurb: "الناس تطلع والفعاليات ممنوعة. المستوصفات تخفف الأثر.",
  },
  war: {
    name: "حرب إقليمية",
    months: [6, 12],
    income: 0.72,
    happy: 16,
    leave: 0.08,
    blurb: "خوف ونزوح ومصاريف دفاع مدني كل شهر.",
  },
};

export function crisisOf(s: Sim): CrisisKind | null {
  return s.crisis && s.day < s.crisis.until ? s.crisis.kind : null;
}

export function startCrisis(s: Sim, kind: CrisisKind, random = Math.random) {
  if (crisisOf(s)) return { ok: false as const, msg: t("في أزمة جارية") };
  const [a, b] = CRISES[kind].months;
  s.crisis = { kind, until: s.day + Math.round(a + random() * (b - a)) * 30 };
  const entry = msg("{name}! {blurb}", { name: CRISES[kind].name, blurb: CRISES[kind].blurb });
  pushLog(s, entry);
  if (kind === "pandemic" && s.event) s.event = null;
  return { ok: true as const, msg: tx(entry) };
}

// ---------------------------------------------------------------- calendar

/** Kuwait National Day / Liberation Day week, and Ramadan with its Eid. */
let moodMemo: { day: number; mood: { national: boolean; ramadan: boolean; eid: boolean } } | null =
  null;

export function calendarMood(s: Sim) {
  const day = Math.floor(s.day);
  if (moodMemo && moodMemo.day === day) return moodMemo.mood;
  const mood = computeMood(day);
  moodMemo = { day, mood };
  return mood;
}

function computeMood(day: number) {
  const d = new Date(EPOCH + day * 86400000);
  const month = d.getUTCMonth();
  const date = d.getUTCDate();
  const national = month === 1 && date >= 20 && date <= 28;
  // Ramadan 1380 AH began on 17 Feb 1961; the lunar year is ~354.37 days.
  const lunar = 354.367;
  const since = (day - 4 + lunar * 10) % lunar;
  const ramadan = since < 30;
  const eid = since >= 30 && since < 33;
  return { national, ramadan, eid };
}

export function isCelebrating(s: Sim) {
  const mood = calendarMood(s);
  return Boolean(activeEvent(s)) || mood.national || mood.eid;
}

// ---------------------------------------------------------------- neighbors


/** Income multiplier from neighbors, with readable reasons. */
/** Income multiplier from neighbors only (the hot path; no text). */
export function neighborMult(s: Sim, b: Building) {
  const d = CATALOG[b.kind];
  const housing = d.pop > 0;
  const trade = !housing && (d.cat === "commerce" || b.kind === "avenues" || b.kind === "mubarakiya" || b.kind === "hamra");
  if (!housing && !trade) return 1;
  const lots = cityIndex(s).lots;
  let parks = 0,
    shops = 0,
    plants = 0,
    homes = 0;
  for (let dr = -1; dr <= 1; dr += 1)
    for (let dc = -1; dc <= 1; dc += 1) {
      if (!dc && !dr) continue;
      const k = lots.get(cellKey(b.c + dc, b.r + dr))?.kind;
      if (!k) continue;
      if (k === "park") parks += 1;
      else if (k === "shop" || k === "mubarakiya" || k === "avenues") shops += 1;
      else if (k === "power" || k === "water") plants += 1;
      if (CATALOG[k].pop > 0) homes += 1;
    }
  if (housing)
    return (
      (1 + Math.min(2, parks) * 0.12) *
      (1 + Math.min(2, shops) * 0.06) *
      Math.max(0.5, 1 - plants * 0.15)
    );
  return 1 + Math.min(4, homes) * 0.05;
}

export function neighborEffect(s: Sim, b: Building) {
  const lots = cityIndex(s).lots;
  const near: Kind[] = [];
  for (let dr = -1; dr <= 1; dr += 1)
    for (let dc = -1; dc <= 1; dc += 1) {
      if (!dc && !dr) continue;
      const k = lots.get(cellKey(b.c + dc, b.r + dr))?.kind;
      if (k) near.push(k);
    }
  const count = (kinds: Kind[]) => near.filter((k) => kinds.includes(k)).length;
  let mult = 1;
  const notes: string[] = [];
  const d = CATALOG[b.kind];
  if (d.pop > 0) {
    const parks = Math.min(2, count(["park"]));
    if (parks) {
      mult *= 1 + parks * 0.12;
      notes.push(t("بجانب حديقة +{n}٪", { n: parks * 12 }));
    }
    const shops = Math.min(2, count(["shop", "mubarakiya", "avenues"]));
    if (shops) {
      mult *= 1 + shops * 0.06;
      notes.push(t("قريب من السوق +{n}٪", { n: shops * 6 }));
    }
    const plants = count(["power", "water"]);
    if (plants) {
      mult *= Math.max(0.5, 1 - plants * 0.15);
      notes.push(t("بجانب محطة −{n}٪", { n: plants * 15 }));
    }
  } else if (d.cat === "commerce" || ["avenues", "mubarakiya", "hamra"].includes(b.kind)) {
    const homes = Math.min(4, near.filter((k) => CATALOG[k].pop > 0).length);
    if (homes) {
      mult *= 1 + homes * 0.05;
      notes.push(t("زبائن من البيوت حوله +{n}٪", { n: homes * 5 }));
    }
  }
  return { mult, notes };
}

// ---------------------------------------------------------------- story eras

export const ERAS = ["الاستقلال ١٩٦١", "طفرة النفط", "الكويت الحديثة", "مدينة المليون"];

export function eraOf(s: Sim) {
  if (s.quest >= QUESTS.length) return ERAS.length - 1;
  return QUESTS[s.quest]?.era ?? 0;
}

export function isUnlocked(s: Sim, kind: Kind) {
  return (CATALOG[kind].era ?? 0) <= eraOf(s);
}

// ---------------------------------------------------------------- achievements

const has = (s: Sim, kind: Kind) => s.buildings.some((b) => b.kind === kind);

export const ACHIEVEMENTS: readonly {
  id: string;
  name: string;
  detail: string;
  test: (s: Sim, st: CityStats) => boolean;
}[] = [
  { id: "first", name: "أول حجر", detail: "ابنِ أول مبنى", test: (s) => s.buildings.length > 0 },
  { id: "ten", name: "فريج صغير", detail: "١٠ مبانٍ", test: (s) => s.buildings.length >= 10 },
  { id: "hundred", name: "منطقة كاملة", detail: "١٠٠ مبنى", test: (s) => s.buildings.length >= 100 },
  { id: "chalet", name: "على البحر", detail: "ابنِ شاليهاً", test: (s) => has(s, "chalet") },
  {
    id: "sky",
    name: "ناطحة سحاب",
    detail: "رقِّ مبنى تجارياً أو سكنياً للمستوى ٥",
    test: (s) => s.buildings.some((b) => b.level >= 5),
  },
  {
    id: "icons",
    name: "معالم الكويت",
    detail: "ابنِ كل المعالم",
    test: (s) => Object.values(CATALOG).every((d) => d.cat !== "landmarks" || has(s, d.kind)),
  },
  { id: "r10k", name: "١٠ آلاف ساكن", detail: "", test: (_s, st) => st.residents >= 10_000 },
  { id: "r100k", name: "١٠٠ ألف ساكن", detail: "", test: (_s, st) => st.residents >= 100_000 },
  { id: "r1m", name: "مدينة المليون", detail: "مليون ساكن", test: (_s, st) => st.residents >= 1_000_000 },
  { id: "happy", name: "شعب سعيد", detail: "رضا ٩٠٪", test: (_s, st) => st.happy >= 90 },
  { id: "rich", name: "خزينة عامرة", detail: "مليون د.ك في الصندوق", test: (s) => s.coins >= 1_000_000 },
  { id: "bonds", name: "مستثمر", detail: "اشترِ سندات", test: (s) => s.flags.includes("bonds") },
  { id: "repaid", name: "بلا ديون", detail: "سدّد قرضاً كاملاً", test: (s) => s.flags.includes("repaid") },
  {
    id: "events",
    name: "عاصمة الفعاليات",
    detail: "نظّم ٣ فعاليات",
    test: (s) => s.flags.filter((f) => f.startsWith("event:")).length >= 3,
  },
  {
    id: "survivor",
    name: "صامد",
    detail: "اعبر أزمة عالمية",
    test: (s) => s.flags.includes("crisis-survived"),
  },
  { id: "decade", name: "عشر سنوات", detail: "احكم ١٠ سنوات", test: (s) => s.day >= 3600 },
];

export function checkAchievements(s: Sim, st = stats(s)) {
  const fresh: { name: string }[] = [];
  for (const a of ACHIEVEMENTS) {
    if (s.achievements.includes(a.id) || !a.test(s, st)) continue;
    s.achievements.push(a.id);
    fresh.push({ name: a.name });
  }
  return fresh;
}

// ---------------------------------------------------------------- daily & offline

function localDay(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * Rewards for coming back: a daily bonus that grows with the streak, and a share of
 * the city's net monthly result for the time away (one game month per 10 minutes,
 * half value, at most four years).
 */
export function welcomeBack(s: Sim, nowMs: number) {
  const out = { daily: 0, streak: s.streak, offline: 0, months: 0 };
  if (!s.started) return out;
  const today = localDay(nowMs);
  if (s.dailyDay !== today) {
    const yesterday = localDay(nowMs - 86400000);
    s.streak = s.dailyDay === yesterday ? Math.min(30, s.streak + 1) : 1;
    s.dailyDay = today;
    const st = stats(s);
    out.daily = Math.round((300 + st.residents * 0.02) * Math.min(7, s.streak));
    out.streak = s.streak;
    s.coins += out.daily;
  }
  if (s.lastSeen > 0 && nowMs - s.lastSeen > 5 * 60_000) {
    const months = Math.min(48, Math.floor((nowMs - s.lastSeen) / 600_000));
    const net = monthlyIncome(s) + feeRevenue(s) - monthlyUpkeep(s);
    if (months > 0 && net > 0) {
      out.months = months;
      out.offline = Math.round(net * months * 0.5);
      s.coins += out.offline;
    }
  }
  s.lastSeen = nowMs;
  return out;
}

export function routeOnLand(c0: number, r0: number, c1: number, r1: number) {
  const out: { c: number; r: number }[] = [];
  const seen = new Set<string>();
  const push = (c: number, r: number) => {
    if (!isLand(c, r) || seen.has(cellKey(c, r))) return;
    seen.add(cellKey(c, r));
    out.push({ c, r });
  };
  if (!isLand(c0, r0)) {
    if (isLand(c1, r1)) push(c1, r1);
    return out;
  }
  let c = c0;
  let r = r0;
  push(c, r);
  let guard = 0;
  while ((c !== c1 || r !== r1) && guard < 120) {
    guard += 1;
    const dc = Math.sign(c1 - c);
    const dr = Math.sign(r1 - r);
    const options: [number, number][] = [];
    if (dc !== 0 && dr !== 0) options.push([dc, 0], [0, dr], [dc, dr]);
    else if (dc !== 0) options.push([dc, 0], [dc, -1], [dc, 1], [0, -1], [0, 1]);
    else if (dr !== 0) options.push([0, dr], [-1, dr], [1, dr], [-1, 0], [1, 0]);
    let moved = false;
    for (const [sc, sr] of options) {
      const nc = c + sc;
      const nr = r + sr;
      if (!isLand(nc, nr) || seen.has(cellKey(nc, nr))) continue;
      c = nc;
      r = nr;
      push(c, r);
      moved = true;
      break;
    }
    if (!moved) break;
  }
  return out;
}

export function isLand(c: number, r: number) {
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return false;
  return LAND[r]?.[c] === 1;
}

export function isWater(c: number, r: number) {
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return false;
  return LAND[r]?.[c] === 0;
}

export function coastal(c: number, r: number) {
  return DIRS.some(([dc, dr]) => isWater(c + dc, r + dr));
}

export function createInitial(): Sim {
  const s: Sim = {
    coins: 5000,
    roads: [],
    buildings: [],
    quest: 0,
    mute: false,
    started: false,
    day: 0,
    speed: 1,
    tax: 7,
    ordinances: emptyOrdinances(),
    lawBudget: defaultLawBudgets(),
    disaster: null,
    randomDisasters: true,
    log: [],
    history: [],
    difficulty: "easy",
    luckAt: 0,
    district: null,
    costs: defaultCosts(),
    autoRaise: 0,
    housingAid: 0,
    aidUntil: 0,
    aidHappy: 0,
    years: [],
    ytd: { income: 0, spend: 0, residents0: 0 },
    occupancy: 0.85,
    loan: 0,
    loanRate: LOAN_RATE,
    event: null,
    fame: 0,
    rank: 0,
    fx: [],
    crisis: null,
    finance: emptyFinance(),
    sites: [],
    builder: emptyBuilder(),
    npcs: emptyNpcs(),
    flags: [],
    achievements: [],
    collected: 0,
    lastSeen: 0,
    dailyDay: "",
    streak: 0,
  };
  s.history.push(takeSample(s));
  return s;
}

export function cloneSim(s: Sim): Sim {
  return {
    ...s,
    roads: [...s.roads],
    buildings: s.buildings.map((b) => ({ ...b })),
    ordinances: { ...s.ordinances },
    lawBudget: Object.fromEntries(
      Object.entries(s.lawBudget).map(([k, v]) => [k, { ...v }]),
    ) as LawBudgets,
    disaster: s.disaster ? { ...s.disaster } : null,
    event: s.event ? { ...s.event } : null,
    crisis: s.crisis ? { ...s.crisis } : null,
    costs: { ...s.costs },
    ytd: { ...s.ytd },
    years: [...s.years],
    flags: [...s.flags],
    achievements: [...s.achievements],
    builder: { ...s.builder },
    sites: s.sites.map((x) => ({ ...x })),
    npcs: s.npcs.map((n) => ({
      ...n,
      owesMe: n.owesMe.map((l) => ({ ...l })),
      iOwe: n.iOwe.map((l) => ({ ...l })),
      chat: [...n.chat],
    })),
    finance: {
      ...s.finance,
      bonds: s.finance.bonds.map((b) => ({ ...b })),
      projects: s.finance.projects.map((p) => ({ ...p })),
      down: { ...s.finance.down },
    },
    fx: s.fx.map((f) => ({ ...f })),
    log: [...s.log],
    history: s.history,
  };
}

function countKind(s: Sim, kind: Kind) {
  return s.buildings.filter((b) => b.kind === kind).length;
}

export const QUESTS: {
  text: string;
  reward: number;
  total: number;
  progress: (s: Sim) => number;
  done: (s: Sim) => boolean;
  /** Index into ERAS; finishing the last quest of an era opens the next one. */
  era?: number;
}[] = [
  {
    text: "ارصف ١٦ طرق",
    reward: 500,
    total: 16,
    progress: (s) => Math.min(16, s.roads.length),
    done: (s) => s.roads.length >= 16,
  },
  {
    text: "ابنِ ٣ فلل",
    reward: 600,
    total: 3,
    progress: (s) => Math.min(3, countKind(s, "villa")),
    done: (s) => countKind(s, "villa") >= 3,
  },
  {
    text: "وفّر كهرباء وماء",
    reward: 900,
    total: 2,
    progress: (s) => (countKind(s, "power") > 0 ? 1 : 0) + (countKind(s, "water") > 0 ? 1 : 0),
    done: (s) => countKind(s, "power") > 0 && countKind(s, "water") > 0,
  },
  {
    text: "ارفع معلماً كويتياً",
    reward: 1200,
    total: 1,
    progress: (s) =>
      s.buildings.some((b) => isLandmark(b.kind))
        ? 1
        : 0,
    done: (s) =>
      s.buildings.some((b) => isLandmark(b.kind)),
  },
  {
    text: "أوصل السكان إلى ٣٬٠٠٠",
    reward: 2000,
    total: 3000,
    era: 0,
    progress: (s) => Math.min(3000, stats(s).residents),
    done: (s) => stats(s).residents >= 3000,
  },
  {
    text: "طفرة النفط: افتح ٥ محلات",
    reward: 3000,
    total: 5,
    era: 1,
    progress: (s) => Math.min(5, s.buildings.filter((b) => b.kind === "shop").length),
    done: (s) => s.buildings.filter((b) => b.kind === "shop").length >= 5,
  },
  {
    text: "ابنِ سوق المباركية",
    reward: 4000,
    total: 1,
    era: 1,
    progress: (s) => Math.min(1, s.buildings.filter((b) => b.kind === "mubarakiya").length),
    done: (s) => s.buildings.filter((b) => b.kind === "mubarakiya").length >= 1,
  },
  {
    text: "رقِّ برج مكاتب للمستوى ٣",
    reward: 5000,
    total: 1,
    era: 1,
    progress: (s) => Math.min(1, s.buildings.filter((b) => ["tower"].includes(b.kind) && b.level >= 3).length),
    done: (s) => s.buildings.filter((b) => ["tower"].includes(b.kind) && b.level >= 3).length >= 1,
  },
  {
    text: "أوصل السكان إلى ١٥٬٠٠٠",
    reward: 8000,
    total: 15000,
    era: 1,
    progress: (s) => Math.min(15000, stats(s).residents),
    done: (s) => stats(s).residents >= 15000,
  },
  {
    text: "الكويت الحديثة: ابنِ ٣ شاليهات",
    reward: 12000,
    total: 3,
    era: 2,
    progress: (s) => Math.min(3, s.buildings.filter((b) => b.kind === "chalet").length),
    done: (s) => s.buildings.filter((b) => b.kind === "chalet").length >= 3,
  },
  {
    text: "ارفع برج الحمراء",
    reward: 20000,
    total: 1,
    era: 2,
    progress: (s) => Math.min(1, s.buildings.filter((b) => b.kind === "hamra").length),
    done: (s) => s.buildings.filter((b) => b.kind === "hamra").length >= 1,
  },
  {
    text: "افتتح مجمع الأفنيوز",
    reward: 25000,
    total: 1,
    era: 2,
    progress: (s) => Math.min(1, s.buildings.filter((b) => b.kind === "avenues").length),
    done: (s) => s.buildings.filter((b) => b.kind === "avenues").length >= 1,
  },
  {
    text: "حوّل مبنى إلى ناطحة سحاب (مستوى ٥)",
    reward: 30000,
    total: 1,
    era: 2,
    progress: (s) => Math.min(1, s.buildings.filter((b) => ["apartments","shop","tower"].includes(b.kind) && b.level >= 5).length),
    done: (s) => s.buildings.filter((b) => ["apartments","shop","tower"].includes(b.kind) && b.level >= 5).length >= 1,
  },
  {
    text: "أوصل السكان إلى ١٠٠٬٠٠٠",
    reward: 60000,
    total: 100000,
    era: 2,
    progress: (s) => Math.min(100000, stats(s).residents),
    done: (s) => stats(s).residents >= 100000,
  },
  {
    text: "مدينة المليون: ٥٠٠٬٠٠٠ ساكن",
    reward: 200000,
    total: 500000,
    era: 3,
    progress: (s) => Math.min(500000, stats(s).residents),
    done: (s) => stats(s).residents >= 500000,
  },
  {
    text: "مليون ساكن في الكويت",
    reward: 500000,
    total: 1000000,
    era: 3,
    progress: (s) => Math.min(1000000, stats(s).residents),
    done: (s) => stats(s).residents >= 1000000,
  },
];

export function stats(s: Sim): CityStats {
  let pop = 0;
  let happy = 52;
  let powerUse = 0;
  let powerGive = 0;
  let waterUse = 0;
  let waterGive = 0;
  let police = 0;
  for (const b of s.buildings) {
    const d = CATALOG[b.kind];
    const lv = b.level;
    pop += d.pop * homesPerLevel(lv) * 2;
    powerUse += d.powerUse * lv;
    waterUse += d.waterUse * lv;
    powerGive += Math.round(d.powerGive * (1 + (lv - 1) * 0.45));
    waterGive += Math.round(d.waterGive * (1 + (lv - 1) * 0.45));
    happy += d.happy + Math.sign(d.happy) * (lv - 1) * 2;
    if (b.kind === "police") police += 1;
  }
  const capacity = pop;
  pop = Math.round(capacity * clamp(s.occupancy ?? 1, OCCUPANCY_MIN, 1));
  const blackout = s.disaster?.kind === "blackout" && s.day < s.disaster.until;
  if (blackout) powerGive = 0;
  const grace = pop < 20;
  const shortP = !grace && powerUse > powerGive;
  const shortW = !grace && waterUse > waterGive;
  if (shortP) happy -= 18;
  if (shortW) happy -= 14;
  if (pop >= 48 && police === 0) happy -= 10;
  if (s.tax > 40) happy -= Math.min(24, Math.round((s.tax - 40) / 18));
  else if (s.tax > 8) happy -= Math.round((s.tax - 8) * 0.6);
  if (s.tax < 5) happy += 5;
  happy += 3 * lawStrength(s, "education");
  happy += 2 * lawStrength(s, "recycling");
  const hit = s.disaster && s.day < s.disaster.until ? s.disaster.kind : null;
  if (hit === "storm") happy -= 14;
  if (hit === "flood") happy -= 10;
  // Services: each missing one costs up to 9 points once the city is past a village.
  const cover = serviceCoverage(s, capacity);
  const service = Math.min(...Object.values(cover));
  // A village forgives a lot; a big district without services does not.
  const weight = clamp((capacity - 60) / 400, 0, 1) * 9;
  for (const v of Object.values(cover)) happy -= Math.round((1 - v) * weight);
  // Living costs above the normal tariff anger people; below it pleases them.
  happy -= Math.round(Math.min(120, Math.max(-12, (costIndex(s) - 100) / 6)));
  // Support beyond free rent is cash in hand: a little more goodwill, capped.
  if ((s.housingAid ?? 0) > 100) happy += Math.min(6, Math.round(((s.housingAid ?? 0) - 100) / 25));
  if ((s.aidUntil ?? 0) > s.day) happy += s.aidHappy ?? 0;
  const crisis = crisisOf(s);
  if (crisis) {
    let hit2 = CRISES[crisis].happy;
    if (crisis === "pandemic") hit2 *= 1 - serviceCoverage(s, capacity).clinic * 0.6;
    happy -= Math.round(hit2);
  }
  const mood = calendarMood(s);
  if (mood.national) happy += 6;
  if (mood.eid) happy += 4;
  if (mood.ramadan && s.buildings.some((b) => b.kind === "mosque")) happy += 4;
  if (consulting(s)) happy += 3;
  const ev = activeEvent(s);
  if (ev) happy += ev.happy;
  happy += Math.min(12, s.fame ?? 0);
  happy = clamp(Math.round(happy), 6, 100);
  const utilP = powerUse === 0 || grace ? 1 : Math.min(1, powerGive / powerUse);
  const utilW = waterUse === 0 || grace ? 1 : Math.min(1, waterGive / waterUse);
  const util = Math.min(utilP, utilW);
  const utilFactor = util >= 0.999 ? 1 : 0.22 + util * 0.78;
  // Unhappy cities earn less: 0.35× at the floor, 1.3× when everyone is pleased.
  const ev2 = activeEvent(s);
  const crisisMult = crisis ? CRISES[crisis].income : 1;
  const mult =
    (0.3 + (happy / 100) * 1.0) * utilFactor * (1 + (ev2?.income ?? 0)) * crisisMult;
  return {
    pop,
    residents: pop * RESIDENTS_PER_UNIT,
    capacity,
    service,
    happy,
    powerUse,
    powerGive,
    waterUse,
    waterGive,
    mult,
    short: shortP || shortW,
  };
}

/**
 * Fast lookups for big cities: road cells and building lots by cell key. Built once
 * and then updated in place when a road or building is added; any other change
 * (bulldozing, loading) is detected by length/last-item and triggers a rebuild.
 */
type CityIndex = {
  rn: number;
  rlast: string;
  bn: number;
  blast: string;
  roads: Set<string>;
  lots: Map<string, Building>;
};
const indexCache = new WeakMap<Sim, CityIndex>();

function cityIndex(s: Sim): CityIndex {
  const rlast = s.roads[s.roads.length - 1] ?? "";
  const blast = s.buildings[s.buildings.length - 1]?.id ?? "";
  const hit = indexCache.get(s);
  if (
    hit &&
    hit.rn === s.roads.length &&
    hit.rlast === rlast &&
    hit.bn === s.buildings.length &&
    hit.blast === blast
  )
    return hit;
  const lots = new Map<string, Building>();
  for (const b of s.buildings) lots.set(cellKey(b.c, b.r), b);
  const fresh = { rn: s.roads.length, rlast, bn: s.buildings.length, blast, roads: new Set(s.roads), lots };
  indexCache.set(s, fresh);
  return fresh;
}

function indexRoadAdded(s: Sim, key: string) {
  const ix = indexCache.get(s);
  if (!ix || ix.rn !== s.roads.length - 1) return;
  ix.roads.add(key);
  ix.rn = s.roads.length;
  ix.rlast = key;
}

function indexBuildingAdded(s: Sim, b: Building) {
  const ix = indexCache.get(s);
  if (!ix || ix.bn !== s.buildings.length - 1) return;
  ix.lots.set(cellKey(b.c, b.r), b);
  ix.bn = s.buildings.length;
  ix.blast = b.id;
}

export function roadSet(s: Sim) {
  return cityIndex(s).roads;
}

/** Is there a building or a road on this cell? */
export function cellTaken(s: Sim, c: number, r: number) {
  const ix = cityIndex(s);
  const k = cellKey(c, r);
  return ix.roads.has(k) || ix.lots.has(k);
}

export function buildingAt(s: Sim, c: number, r: number) {
  return cityIndex(s).lots.get(cellKey(c, r)) ?? null;
}

function besideRoad(c: number, r: number, roads: Set<string>) {
  return DIRS.some(([dc, dr]) => roads.has(cellKey(c + dc, r + dr)));
}

/**
 * Per-building factors that only change when roads or buildings change (road access,
 * neighbors, coast), cached by building id and rebuilt when the city index changes.
 */
const placeCache = new WeakMap<
  Sim,
  { ix: CityIndex; rn: number; bn: number; map: Map<string, { kind: Kind; value: number }> }
>();

function placeFactor(s: Sim, b: Building) {
  const ix = cityIndex(s);
  let cache = placeCache.get(s);
  if (!cache || cache.ix !== ix || cache.rn !== ix.rn || cache.bn !== ix.bn) {
    cache = { ix, rn: ix.rn, bn: ix.bn, map: new Map() };
    placeCache.set(s, cache);
  }
  const hit = cache.map.get(b.id);
  if (hit && hit.kind === b.kind) return hit.value;
  const d = CATALOG[b.kind];
  let value = 1;
  if (d.needsRoad && !besideRoad(b.c, b.r, ix.roads)) value = 0;
  else {
    value *= neighborMult(s, b);
    if (d.coastBoost && coastal(b.c, b.r)) value *= 1.15;
  }
  cache.map.set(b.id, { kind: b.kind, value });
  return value;
}

export function incomePerSec(b: Building, s: Sim, st = stats(s)) {
  const d = CATALOG[b.kind];
  if (d.income <= 0) return 0;
  const place = placeFactor(s, b);
  if (place === 0) return 0;
  let v = d.income * (1 + (b.level - 1) * 0.62) * (b.level >= 4 ? 1.5 : 1);
  v *= place;
  if ((b.kind === "shop" || b.kind === "avenues" || b.kind === "mubarakiya") && calendarMood(s).ramadan)
    v *= 1.1;
  if (d.needsPop > 0 && st.pop < d.needsPop) v *= 0.35;
  if (d.pop > 0) v *= 2 * clamp(s.occupancy ?? 1, OCCUPANCY_MIN, 1);
  if (s.ordinances.smokeBan && (b.kind === "shop" || b.kind === "tower"))
    v *= Math.max(0.6, 1 - 0.1 * lawStrength(s, "smokeBan"));
  const tax = 0.55 + (clamp(s.tax, 0, 300) / 100) * 1.2;
  return v * st.mult * tax;
}

export function blockReason(b: Building, s: Sim, st = stats(s)) {
  const d = CATALOG[b.kind];
  if (d.income <= 0) return null;
  if (d.needsRoad && !besideRoad(b.c, b.r, roadSet(s))) return t("ارصف طريقاً بجانبه عشان ينتج");
  if (st.short) return t("الكهرباء أو الماء ناقص");
  if (d.needsPop > 0 && st.pop < d.needsPop) return t("يحتاج {n} ساكن", { n: d.needsPop });
  return null;
}

export function tick(s: Sim, dt: number) {
  if (!s.started || dt <= 0) return;
  const st = stats(s);
  for (const b of s.buildings) {
    const rate = incomePerSec(b, s, st);
    if (rate <= 0) continue;
    const cap = rate * 48;
    b.stored = Math.min(cap, b.stored + rate * dt);
  }
}

export function totalStored(s: Sim) {
  return s.buildings.reduce((n, b) => n + Math.floor(b.stored), 0);
}

export function collectOne(s: Sim, id: string) {
  const b = s.buildings.find((x) => x.id === id);
  if (!b) return 0;
  const n = Math.floor(b.stored);
  if (n <= 0) return 0;
  b.stored -= n;
  s.coins += n;
  s.collected = (s.collected ?? 0) + n;
  s.ytd.income += n;
  return n;
}

export function collectAll(s: Sim) {
  let n = 0;
  for (const b of s.buildings) n += collectOne(s, b.id);
  return n;
}

export function upgradeCost(kind: Kind, level: number) {
  return Math.round(CATALOG[kind].cost * (0.5 + level * 0.45));
}

function spent(b: Building) {
  let n = CATALOG[b.kind].cost;
  for (let level = 1; level < b.level; level += 1) n += upgradeCost(b.kind, level);
  return n;
}

export type Act = { ok: true; fresh?: boolean } | { ok: false; msg: string };

export function placeRoad(s: Sim, c: number, r: number): Act {
  if (!isLand(c, r)) return { ok: false, msg: t("ما ينفع الطريق في البحر") };
  const fence = fenced(s, c, r);
  if (fence) return { ok: false, msg: fence };
  if (
    !developing &&
    s.district &&
    s.district !== "free" &&
    isDistrictLand(s.district, cellKey(c, r))
  )
    return { ok: false, msg: t("المخطط يفصل القطع؛ ارصف الشارع الجانبي على حدود القطعة") };
  if (buildingAt(s, c, r)) return { ok: false, msg: t("في مبنى هنا") };
  const k = cellKey(c, r);
  if (roadSet(s).has(k)) return { ok: true, fresh: false };
  const cost = priceOf(ROAD_COST, s);
  if (cost > 0 && s.coins < cost) return { ok: false, msg: t("الرصيد ما يكفي للطريق") };
  s.coins -= cost;
  s.roads.push(k);
  indexRoadAdded(s, k);
  return { ok: true, fresh: true };
}

export function placeBuilding(s: Sim, kind: Kind, c: number, r: number, now: number): Act {
  const fence = fenced(s, c, r);
  if (fence) return { ok: false, msg: fence };
  if (!isLand(c, r)) return { ok: false, msg: t("ما ينفع البناء في البحر") };
  if (cellTaken(s, c, r)) {
    return { ok: false, msg: t("الأرض مشغولة") };
  }
  if (CATALOG[kind].needsCoast && !coastal(c, r))
    return { ok: false, msg: t("الشاليه لازم يكون على البحر مباشرة") };
  if (!prepaid && !isUnlocked(s, kind))
    return { ok: false, msg: t("يُفتح في حقبة {era}", { era: ERAS[CATALOG[kind].era ?? 0]! }) };
  const cost = priceOf(CATALOG[kind].cost, s);
  if (cost > 0 && s.coins < cost) return { ok: false, msg: t("الرصيد ما يكفي") };
  s.coins -= cost;
  s.buildings.push({
    id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    c,
    r,
    level: 1,
    stored: 0,
    born: now,
  });
  indexBuildingAdded(s, s.buildings[s.buildings.length - 1]!);
  return { ok: true };
}

/** Fat-finger snap: the lot under the tap, or an open neighboring lot. */
export function nearestOpenLot(s: Sim, c: number, r: number, radius = 1) {
  let best: { c: number; r: number; d: number } | null = null;
  for (let dr = -radius; dr <= radius; dr += 1) {
    for (let dc = -radius; dc <= radius; dc += 1) {
      const cc = c + dc;
      const rr = r + dr;
      const key = cellKey(cc, rr);
      if (!isLand(cc, rr)) continue;
      if (cellTaken(s, cc, rr)) continue;
      const d = dc * dc + dr * dr;
      if (!best || d < best.d) best = { c: cc, r: rr, d };
    }
  }
  return best ? { c: best.c, r: best.r } : null;
}

export type ZonePick = {
  streets: boolean;
  schools: boolean;
  fire: boolean;
  landmarks: boolean;
  parks: boolean;
};

function fillParcel(
  s: Sim,
  cells: readonly { c: number; r: number }[],
  pick: ZonePick,
  now: number,
): { ok: true; roads: number; built: number } | { ok: false; msg: string } {
  const open = cells.filter(
    ({ c, r }) =>
      isLand(c, r) &&
      !cellTaken(s, c, r),
  );
  const midC = open.reduce((n, cell) => n + cell.c, 0) / Math.max(1, open.length);
  const midR = open.reduce((n, cell) => n + cell.r, 0) / Math.max(1, open.length);
  const pool = open
    .map((cell) => ({ ...cell, score: Math.abs(cell.c - midC) + Math.abs(cell.r - midR) }))
    .sort((a, b) => a.score - b.score);
  let built = 0;
  const take = (kind: Kind) => {
    const lot = pool.shift();
    if (!lot) return false;
    const act = placeBuilding(s, kind, lot.c, lot.r, now);
    if (!act.ok) return false;
    built += 1;
    return true;
  };
  if (pick.schools) take("school");
  if (pick.fire) take("fire");
  if (pick.landmarks) {
    const icons: Kind[] = ["boubyan", "kuwait", "mosque", "liberation", "palace"];
    take(icons.find((k) => !s.buildings.some((b) => b.kind === k)) ?? "kuwait");
  }
  if (pick.parks) {
    const limit = pick.streets ? Math.max(1, Math.floor(open.length / 5)) : Math.min(12, pool.length);
    let n = 0;
    while (pool.length && n < limit) {
      if (!take("park")) break;
      n += 1;
    }
  }
  if (pick.streets) {
    let i = 0;
    while (pool.length) {
      const kind: Kind = i % 7 === 3 ? "apartments" : i % 5 === 0 ? "modern" : "villa";
      if (!take(kind)) break;
      i += 1;
    }
  }
  if (built === 0) return { ok: false, msg: t("ما لقيت أرض فاضية في المنطقة") };
  return { ok: true, roads: 0, built };
}

// The whole map: with the city index, filling even a huge zone takes milliseconds.
const ZONE_CAP = COLS * ROWS;

function capCells(cells: { c: number; r: number }[], midC: number, midR: number) {
  if (cells.length <= ZONE_CAP) return cells;
  return [...cells]
    .sort(
      (a, b) =>
        Math.abs(a.c - midC) + Math.abs(a.r - midR) - (Math.abs(b.c - midC) + Math.abs(b.r - midR)),
    )
    .slice(0, ZONE_CAP);
}

function collectOpen(
  s: Sim,
  cA: number,
  rA: number,
  cB: number,
  rB: number,
  skip: ReadonlySet<string>,
) {
  const cells: { c: number; r: number }[] = [];
  for (let r = rA; r <= rB; r += 1) {
    for (let c = cA; c <= cB; c += 1) {
      const key = cellKey(c, r);
      if (!isLand(c, r) || skip.has(key) || roadIsSchematic(s.district, key)) continue;
      if (cellTaken(s, c, r)) continue;
      cells.push({ c, r });
    }
  }
  return cells;
}

function zoneOpenLand(
  s: Sim,
  cA: number,
  rA: number,
  cB: number,
  rB: number,
  pick: ZonePick,
  now: number,
  skip: ReadonlySet<string>,
): { ok: true; roads: number; built: number } | { ok: false; msg: string } {
  const cells = capCells(collectOpen(s, cA, rA, cB, rB, skip), (cA + cB) / 2, (rA + rB) / 2);
  if (!cells.length) return { ok: false, msg: t("ما لقيت أرض فاضية في المنطقة") };
  let roads = 0;
  if (pick.streets && cells.length >= 12) {
    for (const cell of cells) {
      if (cell.c % 5 !== 0 && cell.r % 5 !== 0) continue;
      const act = placeRoad(s, cell.c, cell.r);
      if (act.ok && act.fresh) roads += 1;
    }
  }
  const act = fillParcel(s, cells, pick, now);
  if (!act.ok) return roads > 0 ? { ok: true, roads, built: 0 } : act;
  return { ok: true, roads, built: act.built };
}

export function planZone(
  s: Sim,
  c0: number,
  r0: number,
  c1: number,
  r1: number,
  pick: ZonePick,
  now: number,
): { ok: true; roads: number; built: number } | { ok: false; msg: string } {
  let cA = Math.max(0, Math.min(c0, c1));
  let cB = Math.min(COLS - 1, Math.max(c0, c1));
  let rA = Math.max(0, Math.min(r0, r1));
  let rB = Math.min(ROWS - 1, Math.max(r0, r1));
  if (!pick.streets && !pick.schools && !pick.fire && !pick.landmarks && !pick.parks) {
    return { ok: false, msg: t("اختر ماذا يُبنى في المنطقة") };
  }
  if (s.district === "free") return zoneOpenLand(s, cA, rA, cB, rB, pick, now, new Set());
  if (s.district) {
    const parcels = sectorsForZone(s.district, c0, r0, c1, r1);
    const parcelKeys = new Set(
      parcels.flatMap((parcel) => parcel.cells.map((cell) => cellKey(cell.c, cell.r))),
    );
    let built = 0;
    if (parcels.length) {
      const act = fillParcel(
        s,
        capCells(
          parcels.flatMap((parcel) => [...parcel.cells]),
          (cA + cB) / 2,
          (rA + rB) / 2,
        ),
        pick,
        now,
      );
      if (act.ok) built += act.built;
      else if (!collectOpen(s, cA, rA, cB, rB, parcelKeys).length) return act;
    }
    const outside = collectOpen(s, cA, rA, cB, rB, parcelKeys);
    if (!outside.length) {
      return built > 0
        ? { ok: true, roads: 0, built }
        : { ok: false, msg: t("ما لقيت أرض فاضية في المنطقة") };
    }
    const act = zoneOpenLand(s, cA, rA, cB, rB, pick, now, parcelKeys);
    if (!act.ok) return built > 0 ? { ok: true, roads: 0, built } : act;
    return { ok: true, roads: act.roads, built: built + act.built };
  }
  if (cB - cA < 3 || rB - rA < 3) return { ok: false, msg: t("حدّد منطقة أكبر") };
  let roads = 0;
  let built = 0;
  const period = 4;
  const linesBetween = (a: number, b: number) => {
    const lines = [a];
    for (let n = a + period; n < b; n += period) lines.push(n);
    if (lines[lines.length - 1] !== b) lines.push(b);
    return lines;
  };
  const cols = linesBetween(cA, cB);
  const rows = linesBetween(rA, rB);
  if (pick.streets) {
    for (const c of cols) {
      for (let r = rA; r <= rB; r += 1) {
        const act = placeRoad(s, c, r);
        if (act.ok && act.fresh) roads += 1;
      }
    }
    for (const r of rows) {
      for (let c = cA; c <= cB; c += 1) {
        const act = placeRoad(s, c, r);
        if (act.ok && act.fresh) roads += 1;
      }
    }
  }
  const front: { c: number; r: number; score: number }[] = [];
  const inside: { c: number; r: number; score: number }[] = [];
  const midC = (cA + cB) / 2;
  const midR = (rA + rB) / 2;
  for (let bi = 0; bi < cols.length - 1; bi += 1) {
    for (let bj = 0; bj < rows.length - 1; bj += 1) {
      for (let c = cols[bi]! + 1; c < cols[bi + 1]!; c += 1) {
        for (let r = rows[bj]! + 1; r < rows[bj + 1]!; r += 1) {
          if (!isLand(c, r)) continue;
          if (cellTaken(s, c, r)) continue;
          const score = Math.abs(c - midC) + Math.abs(r - midR);
          const item = { c, r, score };
          if (besideRoad(c, r, roadSet(s))) front.push(item);
          else inside.push(item);
        }
      }
    }
  }
  if (!pick.streets) {
    for (let r = rA; r <= rB; r += 1) {
      for (let c = cA; c <= cB; c += 1) {
        if (!isLand(c, r)) continue;
        if (cellTaken(s, c, r)) continue;
        front.push({ c, r, score: Math.abs(c - midC) + Math.abs(r - midR) });
      }
    }
  }
  front.sort((a, b) => a.score - b.score);
  inside.sort((a, b) => a.score - b.score);
  const takeFrom = (list: { c: number; r: number }[], kind: Kind) => {
    const lot = list.shift();
    if (!lot) return false;
    const act = placeBuilding(s, kind, lot.c, lot.r, now);
    if (!act.ok) return false;
    built += 1;
    return true;
  };
  if (pick.schools) takeFrom(front, "school");
  if (pick.fire) {
    const edge = front.length > 1 ? front.pop() : undefined;
    if (edge) front.unshift(edge);
    takeFrom(front, "fire");
  }
  if (pick.landmarks) {
    const icons: Kind[] = ["boubyan", "kuwait", "mosque", "liberation", "palace"];
    takeFrom(front, icons.find((k) => !s.buildings.some((b) => b.kind === k)) ?? "kuwait");
  }
  if (pick.parks) {
    const pool = inside.length ? inside : front;
    let n = 0;
    while (pool.length && n < 12) {
      if (takeFrom(pool, "park")) n += 1;
      else break;
    }
  }
  if (pick.streets) {
    let i = 0;
    while (front.length) {
      const kind: Kind = i % 7 === 3 ? "apartments" : i % 5 === 0 ? "modern" : "villa";
      if (!takeFrom(front, kind)) break;
      i += 1;
    }
  }
  if (roads === 0 && built === 0) return { ok: false, msg: t("ما لقيت أرض فاضية في المنطقة") };
  return { ok: true, roads, built };
}

// ---------------------------------------------------------------- model areas

export type ModelKind = "homes" | "market" | "services";

export const MODEL_AREAS: Record<
  ModelKind,
  { name: string; cost: number; blurb: string; w: number; h: number; plan: Kind[]; filler: Kind[] }
> = {
  homes: {
    name: "ضاحية سكنية نموذجية",
    cost: 9000,
    blurb: "شوارع جاهزة وفلل ومدرسة ومستوصف وجمعية وحدائق.",
    w: 9,
    h: 7,
    plan: ["school", "clinic", "park", "shop", "park"],
    filler: ["villa", "villa", "modern", "villa", "apartments"],
  },
  market: {
    name: "مجمع تجاري نموذجي",
    cost: 11000,
    blurb: "محلات وبرج مكاتب ومواقف: وظائف ودخل أعلى.",
    w: 7,
    h: 5,
    plan: ["tower", "park", "police"],
    filler: ["shop", "shop", "shop", "tower"],
  },
  services: {
    name: "مركز خدمات متكامل",
    cost: 6500,
    blurb: "مدرسة ومستوصف وشرطة وإطفاء وحدائق ومحطتا كهرباء وماء.",
    w: 7,
    h: 5,
    plan: ["school", "clinic", "police", "fire", "power", "water"],
    filler: ["park"],
  },
};

function cityCenter(s: Sim) {
  if (s.buildings.length) {
    const sum = s.buildings.reduce((a, b) => ({ c: a.c + b.c, r: a.r + b.r }), { c: 0, r: 0 });
    return { c: sum.c / s.buildings.length, r: sum.r / s.buildings.length };
  }
  if (s.roads.length) {
    const sum = s.roads.reduce(
      (a, k) => {
        const [c, r] = k.split(",").map(Number);
        return { c: a.c + c!, r: a.r + r! };
      },
      { c: 0, r: 0 },
    );
    return { c: sum.c / s.roads.length, r: sum.r / s.roads.length };
  }
  return { c: COLS / 2, r: ROWS / 2 };
}

/** Open, buildable rectangle closest to the city. Districts keep their numbered parcels. */
/**
 * Summed-area tables over the map: one counts blocked cells, the other coastal cells,
 * so whether any w×h rectangle is free (and touches the sea) is an O(1) lookup.
 */
function areaTables(s: Sim, blockParcels: boolean, blockSchematic: boolean) {
  const W = COLS + 1;
  const blocked = new Int32Array(W * (ROWS + 1));
  const shore = new Int32Array(W * (ROWS + 1));
  const ix = cityIndex(s);
  for (let r = 0; r < ROWS; r += 1) {
    let rowB = 0;
    let rowS = 0;
    for (let c = 0; c < COLS; c += 1) {
      const k = cellKey(c, r);
      const bad =
        !isLand(c, r) ||
        ix.roads.has(k) ||
        ix.lots.has(k) ||
        (s.sites.length > 0 && siteAt(s.sites, c, r) !== null) ||
        (blockParcels && !!s.district && s.district !== "free" && isDistrictLand(s.district, k)) ||
        (blockSchematic && roadIsSchematic(s.district, k));
      rowB += bad ? 1 : 0;
      rowS += isLand(c, r) && coastal(c, r) ? 1 : 0;
      blocked[(r + 1) * W + c + 1] = blocked[r * W + c + 1]! + rowB;
      shore[(r + 1) * W + c + 1] = shore[r * W + c + 1]! + rowS;
    }
  }
  const sum = (t: Int32Array, c: number, r: number, w: number, h: number) =>
    t[(r + h) * W + c + w]! - t[r * W + c + w]! - t[(r + h) * W + c]! + t[r * W + c]!;
  return {
    free: (c: number, r: number, w: number, h: number) => sum(blocked, c, r, w, h) === 0,
    coast: (c: number, r: number, w: number, h: number) => sum(shore, c, r, w, h) > 0,
  };
}

/** The free w×h rectangle closest to a point, or null. */
function nearestRect(
  w: number,
  h: number,
  mid: { c: number; r: number },
  ok: (c: number, r: number) => boolean,
) {
  let best: { c: number; r: number; d: number } | null = null;
  for (let r = 0; r + h <= ROWS; r += 1)
    for (let c = 0; c + w <= COLS; c += 1) {
      const d = Math.abs(c + w / 2 - mid.c) + Math.abs(r + h / 2 - mid.r);
      if (best && d >= best.d) continue;
      if (ok(c, r)) best = { c, r, d };
    }
  return best ? { c: best.c, r: best.r } : null;
}

/** Open, buildable rectangle closest to the city. Districts keep their numbered parcels. */
export function findModelSite(s: Sim, w: number, h: number) {
  const area = areaTables(s, true, true);
  return nearestRect(w, h, cityCenter(s), (c, r) => area.free(c, r, w, h));
}

export function buyModelArea(
  s: Sim,
  kind: ModelKind,
  now: number,
): { ok: true; c: number; r: number; built: number } | { ok: false; msg: string } {
  const def = MODEL_AREAS[kind];
  if (s.coins < def.cost)
    return { ok: false, msg: t("تحتاج {amount} د.ك", { amount: def.cost }) };
  const site = findModelSite(s, def.w, def.h);
  if (!site) return { ok: false, msg: t("ما في أرض فاضية تكفي المشروع") };
  s.coins -= def.cost;
  s.ytd.spend += def.cost;
  const built = placePackage(s, kind, now, site);
  pushLog(s, msg("افتتاح {name}", { name: def.name }));
  return { ok: true, c: site.c + def.w / 2, r: site.r + def.h / 2, built };
}

/** Builds a model area for free (prepaid, handed over, or a starter town). */
export function placePackage(
  s: Sim,
  kind: ModelKind,
  now: number,
  at?: { c: number; r: number } | null,
) {
  const def = MODEL_AREAS[kind];
  const site = at ?? findModelSite(s, def.w, def.h);
  if (!site) return 0;
  prepaid = true;
  let built = 0;
  try {
    const { c: c0, r: r0 } = site;
    const c1 = c0 + def.w - 1;
    const r1 = r0 + def.h - 1;
    const midR = r0 + Math.floor(def.h / 2);
    // Ring road plus one spine; every lot fronts asphalt.
    for (let c = c0; c <= c1; c += 1) {
      placeRoad(s, c, r0);
      placeRoad(s, c, r1);
      if (def.h >= 7) placeRoad(s, c, midR);
    }
    for (let r = r0; r <= r1; r += 1) {
      placeRoad(s, c0, r);
      placeRoad(s, c1, r);
    }
    const lots: { c: number; r: number }[] = [];
    for (let r = r0 + 1; r < r1; r += 1)
      for (let c = c0 + 1; c < c1; c += 1)
        if (!roadSet(s).has(cellKey(c, r))) lots.push({ c, r });
    const plan = [...def.plan];
    let i = 0;
    for (const lot of lots) {
      const kind2 = plan.shift() ?? def.filler[i++ % def.filler.length]!;
      if (placeBuilding(s, kind2, lot.c, lot.r, now).ok) built += 1;
    }
  } finally {
    prepaid = false;
  }
  return built;
}

// ---------------------------------------------------------------- developer projects

/** Why a site can't host this development at (c, r) top-left, or null if it can. */
export function developmentBlocker(s: Sim, kind: DevelopmentKind, c: number, r: number) {
  const def = DEVELOPMENTS[kind];
  let shore = false;
  for (let y = r; y < r + def.h; y += 1)
    for (let x = c; x < c + def.w; x += 1) {
      if (!isLand(x, y)) return t("الموقع يدخل البحر أو خارج الخريطة");
      if (cellTaken(s, x, y)) return t("الموقع فيه مبانٍ أو طرق");
      if (s.district && s.district !== "free" && isDistrictLand(s.district, cellKey(x, y)))
        return t("الموقع داخل قطع الحي المرقّمة");
      if (siteAt(s.sites, x, y)) return t("الموقع داخل مشروع آخر");
      if (coastal(x, y)) shore = true;
    }
  if (def.coast && !shore) return t("هذا المشروع لازم يكون على البحر");
  return null;
}

/** The nearest valid site to the city (or to a tapped cell). */
export function findDevelopmentSite(
  s: Sim,
  kind: DevelopmentKind,
  near?: { c: number; r: number },
) {
  const def = DEVELOPMENTS[kind];
  const area = areaTables(s, true, false);
  return nearestRect(def.w, def.h, near ?? cityCenter(s), (c, r) =>
    area.free(c, r, def.w, def.h) && (!def.coast || area.coast(c, r, def.w, def.h)),
  );
}

/**
 * Invest with the developer: the money goes now, the site is fenced off, and the
 * finished neighbourhood is handed over when the months are up.
 */
export function startDevelopment(
  s: Sim,
  kind: DevelopmentKind,
  at?: { c: number; r: number },
  developer: DeveloperId = "marsa",
): ({ ok: true; site: Site } | { ok: false; msg: string }) {
  const def = DEVELOPMENTS[kind];
  if (!developerOpen(s, developer)) return { ok: false, msg: t("الشركة مغلقة بعد إفلاسها") };
  if (s.coins < def.cost) return { ok: false, msg: t("تحتاج {amount} د.ك", { amount: def.cost }) };
  let spot = at ? { c: at.c - Math.floor(def.w / 2), r: at.r - Math.floor(def.h / 2) } : null;
  if (spot) {
    const why = developmentBlocker(s, kind, spot.c, spot.r);
    if (why) {
      // Slide to the nearest valid spot around the tap before giving up.
      const near = findDevelopmentSite(s, kind, at);
      if (!near || Math.abs(near.c - spot.c) + Math.abs(near.r - spot.r) > 8)
        return { ok: false, msg: why };
      spot = near;
    }
  } else spot = findDevelopmentSite(s, kind);
  if (!spot) return { ok: false, msg: t("ما في أرض فاضية تكفي المشروع") };
  s.coins -= def.cost;
  s.ytd.spend += def.cost;
  const site: Site = {
    id: `${Math.floor(s.day)}-${Math.random().toString(36).slice(2, 7)}`,
    developer,
    kind,
    c: spot.c,
    r: spot.r,
    w: def.w,
    h: def.h,
    amount: def.cost,
    started: s.day,
    completes: s.day + Math.round(def.months * DEVELOPERS[developer].speed) * 30,
  };
  s.sites.push(site);
  pushLog(s, msg("بدأت {company} بناء {name}", { company: DEVELOPERS[developer].name, name: def.name }));
  return { ok: true, site };
}

/** Hands over finished developments; abandons sites if the developer went bankrupt. */
export function developmentMonth(s: Sim, random = Math.random) {
  // Private developers other than Al Marsa (whose risk lives in finance.ts) may fail too.
  const crisis = crisisOf(s);
  const base = crisis === "economic" ? 0.03 : crisis === "war" ? 0.01 : 0.002;
  for (const id of DEVELOPER_IDS) {
    const d = DEVELOPERS[id];
    if (d.state || id === "marsa" || !developerOpen(s, id)) continue;
    if (random() < base * d.risk) {
      s.finance.devDown[id] = s.day + 18 * 30;
      pushLog(s, msg("إفلاس {company}! مشاريعها متوقفة", { company: d.name }));
    }
  }
  if (!s.sites.length) return;
  const failed = s.sites.filter((x) => !developerOpen(s, x.developer ?? "marsa"));
  if (failed.length) {
    for (const site of failed) {
      const back = site.amount * 0.2;
      s.coins += back;
      s.finance.lost += site.amount - back;
      claim(s, site.amount - back);
      pushLog(
        s,
        msg("توقف بناء {name} بعد إفلاس {company}. استرجعت {amount} د.ك فقط", {
          company: DEVELOPERS[site.developer ?? "marsa"].name,
          name: DEVELOPMENTS[site.kind].name,
          amount: Math.round(back),
        }),
      );
    }
    s.sites = s.sites.filter((x) => !failed.includes(x));
  }
  for (const site of [...s.sites]) {
    if (s.day < site.completes) continue;
    const def = DEVELOPMENTS[site.kind];
    const plan = def.plan(site.w, site.h);
    let built = 0;
    developing = true;
    prepaid = true;
    try {
      s.sites = s.sites.filter((x) => x.id !== site.id);
      for (const [dc, dr] of plan.roads) placeRoad(s, site.c + dc, site.r + dr);
      for (const lot of plan.lots) {
        let act = placeBuilding(s, lot.kind, site.c + lot.dc, site.r + lot.dr, 0);
        // A chalet lot that ended up a step from the water becomes a seaside garden.
        if (!act.ok && lot.kind === "chalet")
          act = placeBuilding(s, "park", site.c + lot.dc, site.r + lot.dr, 0);
        if (!act.ok) continue;
        const b = s.buildings[s.buildings.length - 1]!;
        b.level = Math.min(maxLevelOf(b.kind), lot.level);
        built += 1;
      }
    } finally {
      developing = false;
      prepaid = false;
    }
    if (!s.flags.includes("development")) s.flags.push("development");
    pushLog(s, msg("اكتمل {name}: {count} مبنى جاهز ومسكون", { name: def.name, count: built }));
  }
}

export function bulldoze(s: Sim, c: number, r: number): Act {
  const fence = fenced(s, c, r);
  if (fence) return { ok: false, msg: fence };
  const i = s.buildings.findIndex((b) => b.c === c && b.r === r);
  if (i >= 0) {
    const b = s.buildings[i]!;
    s.coins += Math.round(priceOf(spent(b), s) * 0.5);
    s.buildings.splice(i, 1);
    return { ok: true };
  }
  const k = cellKey(c, r);
  if (roadIsSchematic(s.district, k)) return { ok: false, msg: t("الشارع الرئيسي ثابت في مخطط الحي") };
  const ri = s.roads.indexOf(k);
  if (ri >= 0) {
    s.roads.splice(ri, 1);
    s.coins += Math.round(priceOf(ROAD_COST, s) * 0.5);
    return { ok: true };
  }
  return { ok: false, msg: t("ما في شيء تهدّه هنا") };
}

/** Share of an upgrade's price that residents pay to the governor; the rest is the developer's fee. */
export const GOVERNOR_UPGRADE_SHARE = 0.99;

/**
 * Upgrades are carried out by the real-estate developer and paid for by the
 * residents who get the better homes and shops: 99٪ of the price goes to the city
 * treasury and 1٪ to the developer. If the developer is bankrupt, the city pays
 * the full price itself as before.
 */
/** Is this developer open for business today? The national authority always is. */
export function developerOpen(s: Sim, id: DeveloperId) {
  if (DEVELOPERS[id].state) return true;
  if (id === "marsa") return s.finance.down.developer <= s.day;
  return (s.finance.devDown[id] ?? 0) <= s.day;
}

/**
 * Who carries out the next upgrade: the open private developer with the least work so
 * far, or the national development authority if every private firm is bankrupt.
 */
export function upgradeDeveloper(s: Sim): DeveloperId {
  const open = DEVELOPER_IDS.filter((id) => !DEVELOPERS[id].state && developerOpen(s, id));
  if (!open.length) return "national";
  return open.sort((a, b) => (s.finance.devFees[a] ?? 0) - (s.finance.devFees[b] ?? 0))[0]!;
}

export function settleUpgrade(
  s: Sim,
  cost: number,
): { ok: true; byResidents: boolean; gain: number; developer: DeveloperId } {
  const developer = upgradeDeveloper(s);
  const gain = cost * GOVERNOR_UPGRADE_SHARE;
  s.coins += gain;
  s.ytd.income += gain;
  s.finance.upgradeIncome += gain;
  s.finance.developerFees += cost - gain;
  s.finance.devFees[developer] = (s.finance.devFees[developer] ?? 0) + (cost - gain);
  return { ok: true, byResidents: true, gain, developer };
}

export function upgrade(s: Sim, id: string, now: number): Act {
  const b = s.buildings.find((x) => x.id === id);
  if (!b) return { ok: false, msg: t("المبنى مو موجود") };
  if (b.level >= maxLevelOf(b.kind)) return { ok: false, msg: t("وصل آخر مستوى") };
  const cost = priceOf(upgradeCost(b.kind, b.level), s);
  settleUpgrade(s, cost);
  b.level += 1;
  b.born = now;
  return { ok: true };
}

export function metrics(s: Sim, st = stats(s)): Sample {
  const shops = countKind(s, "shop");
  const towers = countKind(s, "tower");
  const parks = countKind(s, "park");
  const police = countKind(s, "police");
  const clinics = countKind(s, "clinic");
  const industryN = countKind(s, "power") + countKind(s, "water");
  const power = st.powerUse <= 0 ? 100 : clamp((st.powerGive / st.powerUse) * 100, 0, 100);
  const water = st.waterUse <= 0 ? 100 : clamp((st.waterGive / st.waterUse) * 100, 0, 100);
  let coast = 0;
  for (const b of s.buildings) if (coastal(b.c, b.r)) coast += 1;
  const jobs = shops * 18 + towers * 26;
  const unemployment =
    st.pop <= 0 ? 0 : clamp(((st.pop - jobs) / Math.max(st.pop, 1)) * 100, 0, 100);
  let pollution = industryN * 18 + towers * 7 - parks * 8;
  pollution -= 14 * lawStrength(s, "recycling");
  pollution -= 12 * lawStrength(s, "smokeBan");
  pollution = clamp(pollution, 0, 100);
  let traffic = clamp((s.buildings.length * 70) / Math.max(3, s.roads.length) - 20, 0, 100);
  traffic = clamp(traffic - 18 * lawStrength(s, "carpool"), 0, 100);
  const crime = clamp(62 - police * 16 - parks * 4 + Math.max(0, st.pop - 60) / 10, 0, 100);
  const health = clamp(
    36 + clinics * 16 + water * 0.28 - pollution * 0.22 + 12 * lawStrength(s, "clinicFund"),
    0,
    100,
  );
  const education = clamp(24 + 42 * lawStrength(s, "education") + clinics * 5, 0, 100);
  const land = clamp(30 + parks * 8 + coast * 4 + st.happy * 0.2, 0, 100);
  return {
    day: s.day,
    water,
    power,
    crime,
    pop: clamp((Math.log10(Math.max(1, st.residents)) / 6) * 100, 0, 100),
    funds: clamp(Math.max(0, s.coins) / 80, 0, 100),
    pollution,
    traffic,
    unemployment,
    industry: clamp(industryN * 18, 0, 100),
    approval: st.happy,
    size: clamp(s.buildings.length * 3, 0, 100),
    commerce: clamp(shops * 12 + towers * 8, 0, 100),
    land,
    health,
    education,
  };
}

export function takeSample(s: Sim): Sample {
  return metrics(s);
}

export function demand(s: Sim, st = stats(s)) {
  const houses = s.buildings.filter((b) => CATALOG[b.kind].pop > 0).length;
  const shops = countKind(s, "shop") + countKind(s, "tower");
  const plants = countKind(s, "power") + countKind(s, "water");
  const r = clamp(
    (shops * 28 - st.pop) * 0.7 + (st.happy - 55) + (st.short ? -35 : 18) + (houses < 2 ? 20 : 0),
    -100,
    100,
  );
  const c = clamp((st.pop - shops * 32) * 0.85 + (st.happy > 60 ? 12 : -8), -100, 100);
  const i = clamp(st.pop / 3 - plants * 22 - (st.short ? 10 : 0), -100, 100);
  return { r, c, i };
}

/** Monthly running cost of each building type (staff, power, maintenance). */
const UPKEEP: Partial<Record<Kind, number>> = {
  villa: 1,
  modern: 2,
  apartments: 3,
  shop: 2,
  tower: 6,
  power: 14,
  water: 12,
  police: 10,
  clinic: 10,
  school: 9,
  fire: 9,
  park: 2,
};

/** Pre-tax monthly income the "percent" mode is measured against. */
let measuringLawBase = false;

function lawIncomeBase(s: Sim) {
  // Income itself depends on the laws' effects; measure it with the laws neutral.
  measuringLawBase = true;
  try {
    return Math.max(0, monthlyIncome(s) + feeRevenue(s));
  } finally {
    measuringLawBase = false;
  }
}

/** One payment of a law at its current setting (per month, or per year if yearly). */
export function lawPayment(s: Sim, key: keyof Ordinances) {
  const b = s.lawBudget[key];
  return b.mode === "amount" ? b.value : (lawIncomeBase(s) * b.value) / 100;
}

/** Monthly equivalent of a law's spending. */
export function lawMonthly(s: Sim, key: keyof Ordinances) {
  if (!s.ordinances[key]) return 0;
  const pay = lawPayment(s, key);
  return s.lawBudget[key].period === "year" ? pay / 12 : pay;
}

/**
 * How strong a law is: 1 = the normal effect when funded at its reference level
 * (the old fixed price, scaled up with the city), more money gives more effect with
 * diminishing returns, capped at 3×.
 */
export function lawStrength(s: Sim, key: keyof Ordinances) {
  if (!s.ordinances[key] || measuringLawBase) return 0;
  const reference = ORDINANCE_COST[key] * Math.max(1, stats0(s).residents / 10_000);
  return Math.min(3, Math.sqrt(lawMonthly(s, key) / reference));
}

/** Residents without recursion into happiness (laws feed into stats). */
function stats0(s: Sim) {
  let pop = 0;
  for (const b of s.buildings) pop += CATALOG[b.kind].pop * homesPerLevel(b.level) * 2;
  return { residents: Math.round(pop * clamp(s.occupancy ?? 1, OCCUPANCY_MIN, 1)) * RESIDENTS_PER_UNIT };
}

export const ORDINANCE_COST: Record<keyof Ordinances, number> = {
  education: 20,
  recycling: 10,
  carpool: 6,
  clinicFund: 14,
  smokeBan: 8,
};

export function monthlyUpkeep(s: Sim) {
  let n = 0;
  for (const b of s.buildings) n += (UPKEEP[b.kind] ?? 5) * (1 + (b.level - 1) * 0.5);
  // The municipality maintains a neighborhood's planned streets; yours cost a little.
  for (const k of s.roads) if (!roadIsSchematic(s.district, k)) n += 0.3;
  for (const key of Object.keys(ORDINANCE_COST) as (keyof Ordinances)[])
    if (s.ordinances[key] && s.lawBudget[key].period === "month") n += lawPayment(s, key);
  if (consulting(s)) n *= 0.85;
  // Civil defense during a regional war.
  if (crisisOf(s) === "war") n += 40 + s.buildings.length * 2;
  return priceOf(n, s);
}

/** Game days per real second at speed 1 (see the frame loop): one month ≈ 5 s of income. */
const SECONDS_PER_MONTH = 30 / 6;

export function monthlyIncome(s: Sim) {
  const st = stats(s);
  return Math.round(
    s.buildings.reduce((n, b) => n + incomePerSec(b, s, st) * SECONDS_PER_MONTH, 0),
  );
}

function pushLog(s: Sim, text: string) {
  if (s.log[0] === text) return;
  s.log.unshift(text);
  s.log = s.log.slice(0, 8);
}

export function advanceDays(s: Sim, days: number) {
  if (days <= 0) return;
  const before = Math.floor(s.day / 30);
  s.day += days;
  const after = Math.floor(s.day / 30);
  if (s.disaster && s.day >= s.disaster.until) {
    pushLog(s, msg("انتهت الكارثة. المدينة تلمّ جراحها"));
    s.disaster = null;
  }
  if (after <= before) {
    endEvent(s);
    return;
  }
  const brokeBefore = s.coins < 0;
  let rolled = false;
  for (let m = before + 1; m <= after; m += 1) {
    const st = stats(s);
    const fees = feeRevenue(s, st);
    const upkeep = monthlyUpkeep(s) + housingAidCost(s, st);
    s.coins += fees;
    s.coins -= upkeep;
    s.ytd.income += fees;
    s.ytd.spend += upkeep;
    const due = loanInstallment(s);
    if (due > 0) {
      // When the treasury can't cover it, an insured city's installment is paid by the insurer.
      if (s.finance.insured && s.coins < due) {
        s.finance.claims += due;
        s.coins += due;
      }
      s.coins -= due;
      s.ytd.spend += due;
      s.loan = Math.max(0, s.loan - due);
      if (s.loan === 0) {
        pushLog(s, msg("سدّدت القرض كاملاً"));
        if (!s.flags.includes("repaid")) s.flags.push("repaid");
      }
    }
    const crisis = crisisOf(s);
    financeMonth(s, {
      log: (msg) => pushLog(s, msg),
      handover: () => placePackage(s, "homes", 0),
      economicCrisis: crisis === "economic",
      war: crisis === "war",
      random: Math.random,
    });
    developmentMonth(s);
    const works = builderMonth(s);
    if (works) pushLog(s, msg("مستشار البناء: {works}", { works }));
    for (const line of npcMonth(s)) pushLog(s, line);
    s.coins = Math.max(-5_000_000, s.coins);
    // People move in when they are happy and served, and leave when they are not.
    const ev = activeEvent(s);
    const target = clamp(
      0.35 +
        (st.happy / 100) * 0.75 +
        (ev?.draw ?? 0) -
        (crisis ? CRISES[crisis].leave : 0) -
        // Extreme living costs empty the city no matter how happy it was.
        Math.min(0.45, Math.max(0, costIndex(s) - 300) / 2000),
      OCCUPANCY_MIN,
      1,
    );
    const before2 = s.occupancy;
    s.occupancy = clamp(s.occupancy + (target - s.occupancy) * 0.35, OCCUPANCY_MIN, 1);
    if (st.capacity >= 60 && before2 - s.occupancy > 0.04)
      pushLog(s, msg("ناس تطلع من المنطقة: الرضا نازل"));
    s.history.push(takeSample(s));
    if (!rolled && s.randomDisasters && s.buildings.length > 3 && Math.random() < 0.035) {
      rolled = true;
      const roll = Math.random();
      triggerDisaster(
        s,
        roll < 0.28 ? "fire" : roll < 0.56 ? "storm" : roll < 0.8 ? "blackout" : "flood",
      );
    }
    if (s.randomDisasters && !crisisOf(s) && s.buildings.length > 12 && Math.random() < 0.012) {
      const roll = Math.random();
      startCrisis(s, roll < 0.45 ? "economic" : roll < 0.75 ? "pandemic" : "war");
    }
    if (s.crisis && s.day >= s.crisis.until) {
      pushLog(s, msg("انتهت {name}. الحمد لله على السلامة", { name: CRISES[s.crisis.kind].name }));
      if (!s.flags.includes("crisis-survived")) s.flags.push("crisis-survived");
      s.crisis = null;
    }
    // Year end: measure, then apply the automatic yearly raise.
    if (m % 12 === 0) closeYear(s);
  }
  s.fx = s.fx.filter((f) => s.day < f.until);
  endEvent(s);
  if (s.history.length > 1200) s.history.splice(0, s.history.length - 1200);
  if (!brokeBefore && s.coins < 0) pushLog(s, msg("عجز: مصروف الشهر أكبر من الصندوق"));
}

function closeYear(s: Sim) {
  // Yearly-funded laws are paid in one go at the end of the year.
  for (const key of Object.keys(ORDINANCE_COST) as (keyof Ordinances)[])
    if (s.ordinances[key] && s.lawBudget[key].period === "year") {
      const pay = lawPayment(s, key);
      s.coins -= pay;
      s.ytd.spend += pay;
    }
  const st = stats(s);
  const year = new Date(EPOCH + Math.floor(s.day) * 86400000).getUTCFullYear() - 1;
  s.years.push({
    year,
    residents: st.residents,
    happy: st.happy,
    costIndex: costIndex(s),
    income: Math.round(s.ytd.income),
    spend: Math.round(s.ytd.spend),
    coins: Math.round(s.coins),
  });
  if (s.years.length > 60) s.years.splice(0, s.years.length - 60);
  s.ytd = { income: 0, spend: 0, residents0: st.residents };
  if (s.autoRaise > 0)
    for (const k of COST_KEYS)
      s.costs[k] = clamp(Math.round(s.costs[k] * (1 + s.autoRaise / 100)), 0, COST_MAX);
  pushLog(s, msg("التقرير السنوي {year} جاهز", { year: String(year) }));
}

function endEvent(s: Sim) {
  if (!s.event || s.day < s.event.until) return;
  const def = EVENTS[s.event.kind];
  s.fame = Math.min(12, (s.fame ?? 0) + def.fame);
  pushLog(s, msg("انتهت {name}. سمعة المنطقة ارتفعت", { name: def.name }));
  s.event = null;
}

/** Money a disaster takes from the treasury right away. */
export function disasterBill(s: Sim, kind: DisasterKind) {
  const size = s.buildings.length * 8;
  const share = Math.max(0, s.coins) * (kind === "fire" ? 0.03 : 0.06);
  const base = { fire: 150, storm: 250, blackout: 180, flood: 300 }[kind];
  return Math.round(base + size + share);
}

export function triggerDisaster(
  s: Sim,
  kind: DisasterKind,
): { ok: true; msg: string } | { ok: false; msg: string } {
  if (s.disaster && s.day < s.disaster.until) {
    return { ok: false, msg: t("في كارثة جارية. استنى تخلص") };
  }
  if (kind === "fire") {
    const targets = s.buildings.filter(
      (b) => !isLandmark(b.kind),
    );
    if (!targets.length) return { ok: false, msg: t("ما في مبنى يطاله الحريق") };
    const b = targets[Math.floor(Math.random() * targets.length)]!;
    const name = CATALOG[b.kind].name;
    s.fx.push({ kind: "fire", c: b.c, r: b.r, until: s.day + 14 });
    s.fx.push({ kind: "smoke", c: b.c, r: b.r, until: s.day + 30 });
    if (b.level > 1) b.level -= 1;
    else {
      const i = s.buildings.findIndex((x) => x.id === b.id);
      if (i >= 0) s.buildings.splice(i, 1);
    }
    const bill = disasterBill(s, "fire");
    s.coins -= bill;
    const entry = msg("حريق ضرب {name} · خسارة {amount} د.ك", { name, amount: bill });
    pushLog(s, entry);
    return { ok: true, msg: tx(entry) };
  }
  if (kind === "storm") {
    s.disaster = { kind: "storm", until: s.day + 50 };
    const bill = disasterBill(s, "storm");
    s.coins -= bill;
    const entry = msg("عاصفة رملية تغطي الكويت · تنظيف {amount} د.ك", { amount: bill });
    pushLog(s, entry);
    return { ok: true, msg: tx(entry) };
  }
  if (kind === "flood") {
    s.disaster = { kind: "flood", until: s.day + 30 };
    const bill = disasterBill(s, "flood");
    s.coins -= bill;
    const entry = msg("أمطار وسيول تغرق الشوارع · تصريف {amount} د.ك", { amount: bill });
    pushLog(s, entry);
    return { ok: true, msg: tx(entry) };
  }
  s.disaster = { kind: "blackout", until: s.day + 36 };
  const bill = disasterBill(s, "blackout");
  s.coins -= bill;
  const entry = msg("انقطاع كهرباء على الأحياء · إصلاح {amount} د.ك", { amount: bill });
  pushLog(s, entry);
  return { ok: true, msg: tx(entry) };
}

export function bulletin(s: Sim, st = stats(s)) {
  const m = metrics(s, st);
  // Stored log entries plus live advice, all shown in the current language.
  const lines = s.log.map((entry) => tx(entry));
  const add = (key: string, params?: Parameters<typeof t>[1]) => lines.push(t(key, params));
  if (s.speed === 0 && s.started) add("الزمن واقف. اضغط تشغيل");
  if (m.pollution >= 42) add("شيء في الهواء: التلوث متوسط");
  else add("الهواء على الكورنيش صافٍ");
  if (m.power < 85 && st.pop >= 20) add("مستشار الكهرباء: الإنتاج ما يغطي");
  if (m.water < 85 && st.pop >= 20) add("التحلية ناقصة والأحياء تعطش");
  if (m.crime > 48) add("الجريمة ترتفع. ابنِ مركز شرطة");
  if (m.unemployment > 38) add("البطالة عالية. افتح محلات وأبراج");
  if (m.approval >= 72) add("الرضا عالٍ. أهل الكويت مبسوطين");
  if (s.tax >= 80) add("الضريبة عالية والناس تتذمر");
  if (s.coins < 0) add("صندوق البلدية في عجز. خذ قرضاً من الميزانية");
  if (st.capacity >= 60 && st.service < 0.6) add("الخدمات ناقصة والناس متضايقة");
  if (costIndex(s) > 125) add("غلاء المعيشة: السكن والتعليم غالية والناس تشتكي");
  const crisis = crisisOf(s);
  if (crisis)
    lines.unshift(
      t("{name} لين {date}", { name: CRISES[crisis].name, date: formatCityDate(s.crisis!.until) }),
    );
  const mood = calendarMood(s);
  if (mood.national) add("العيد الوطني وعيد التحرير: الأعلام في كل مكان");
  if (mood.ramadan)
    add(
      s.buildings.some((b) => b.kind === "mosque")
        ? "رمضان كريم: إفطار جماعي في المسجد الكبير"
        : "رمضان كريم: ابنِ المسجد الكبير للإفطار الجماعي",
    );
  if (mood.eid) add("عيدكم مبارك");
  if (s.loan > 0) add("دين البنك {amount} د.ك", { amount: Math.round(s.loan) });
  const ev = activeEvent(s);
  if (ev) add("فعالية جارية: {name}", { name: ev.name });
  const q = QUESTS[s.quest];
  if (q) add("مهمة: {quest}", { quest: q.text });
  if (!lines.length) add("مدينة الكويت تنتظر قرارك");
  return lines.slice(0, 8);
}

export function rollLuck(s: Sim, now: number) {
  const wait = 7000;
  const left = s.luckAt + wait - now;
  if (left > 0) {
    return { ok: false as const, amount: 0, msg: t("الحظ يرجع بعد {n} ث", { n: Math.ceil(left / 1000) }) };
  }
  const bag = [120, 180, 220, 260, 320, 400, 450, 700, 1100];
  const amount = bag[Math.floor(Math.random() * bag.length)] ?? 200;
  s.coins += amount;
  s.luckAt = now;
  return { ok: true as const, amount, msg: t("حظك +{amount} د.ك", { amount }) };
}

export function advanceQuest(s: Sim) {
  const gained: { text: string; reward: number }[] = [];
  while (QUESTS[s.quest]?.done(s)) {
    const q = QUESTS[s.quest]!;
    s.coins += q.reward;
    s.quest += 1;
    gained.push({ text: q.text, reward: q.reward });
  }
  return gained;
}

/**
 * A fresh neighborhood. With `seed`, it comes with a small starter town so the
 * first minute shows a living place: homes, a co-op, a school, a park, power and water.
 */
export function createInitialDistrict(district: DistrictId, seed = true): Sim {
  const s = createInitial();
  s.district = district;
  s.roads = districtRoads(districtById(district)!);
  if (seed) seedStarter(s);
  return s;
}

const STARTER: Kind[] = ["villa", "villa", "villa", "modern", "shop", "school", "park", "power", "water"];

function seedStarter(s: Sim) {
  const roads = roadSet(s);
  prepaid = true;
  try {
    const district = districtById(s.district);
    const sector = district?.sectors[0];
    if (sector) {
      // Lots that front the planned streets first, nearest the sector's corner.
      const lots = [...sector.cells].sort(
        (a, b) =>
          Number(!besideRoad(a.c, a.r, roads)) - Number(!besideRoad(b.c, b.r, roads)) ||
          a.r - b.r ||
          a.c - b.c,
      );
      let i = 0;
      for (const kind of STARTER) {
        while (i < lots.length) {
          const lot = lots[i++]!;
          if (placeBuilding(s, kind, lot.c, lot.r, 0).ok) break;
        }
      }
    } else {
      placePackage(s, "homes", 0);
      const plant = findModelSite(s, 2, 1);
      if (plant) {
        placeBuilding(s, "power", plant.c, plant.r, 0);
        placeBuilding(s, "water", plant.c + 1, plant.r, 0);
      }
    }
  } finally {
    prepaid = false;
  }
  s.occupancy = 0.9;
}

export const roadIsSchematic = (district: DistrictId | null | undefined, key: string) =>
  isSchematicRoad(district, key);

export function loadSim(district?: DistrictId | null): Sim {
  if (typeof localStorage === "undefined")
    return district ? createInitialDistrict(district) : createInitial();
  try {
    const raw = localStorage.getItem(district ? districtSaveKey(district) : SAVE_KEY);
    if (!raw) return district ? createInitialDistrict(district) : createInitial();
    const p = JSON.parse(raw) as Partial<Sim> & { v?: number; grid?: number };
    if (p.v !== 1 && p.v !== 2) return district ? createInitialDistrict(district) : createInitial();
    // Saved cities bring their own buildings; never add the starter town on top.
    const s = district ? createInitialDistrict(district, false) : createInitial();
    s.history = [];
    s.coins = Math.max(-8000, Math.floor(Number(p.coins) || 0));
    s.quest = clamp(Number(p.quest) || 0, 0, QUESTS.length);
    s.mute = Boolean(p.mute);
    s.started = Boolean(p.started);
    s.day = clamp(Number(p.day) || 0, 0, 365 * 400);
    s.speed = clamp(Number(p.speed ?? 1), 0, 3) as Sim["speed"];
    s.tax = clamp(Number(p.tax ?? 7), 0, 300);
    s.randomDisasters = Boolean(p.randomDisasters);
    s.difficulty = "easy";
    s.luckAt = Math.max(0, Number(p.luckAt) || 0);
    if (p.randomDisasters === undefined) s.randomDisasters = true;
    const legacyFees = (p as { fees?: number }).fees;
    const rawCosts = (p.costs ?? {}) as Partial<Costs>;
    for (const k of COST_KEYS)
      s.costs[k] = clamp(Number(rawCosts[k] ?? legacyFees ?? 100), 0, COST_MAX);
    s.autoRaise = clamp(Number(p.autoRaise) || 0, 0, COST_MAX);
    s.housingAid = clamp(Number(p.housingAid) || 0, 0, COST_MAX);
    s.aidUntil = Math.max(0, Number(p.aidUntil) || 0);
    s.aidHappy = clamp(Number(p.aidHappy) || 0, 0, 30);
    if (Array.isArray(p.years)) s.years = p.years.filter((y) => y && typeof y === "object").slice(-60);
    if (p.ytd && typeof p.ytd === "object")
      s.ytd = {
        income: Number(p.ytd.income) || 0,
        spend: Number(p.ytd.spend) || 0,
        residents0: Number(p.ytd.residents0) || 0,
      };
    s.finance = loadFinance(p.finance);
    s.builder = loadBuilder(p.builder);
    s.sites = loadSites(p.sites);
    s.npcs = loadNpcs(p.npcs);
    s.flags = Array.isArray(p.flags) ? p.flags.filter((x) => typeof x === "string") : [];
    s.achievements = Array.isArray(p.achievements)
      ? p.achievements.filter((x) => typeof x === "string")
      : [];
    s.collected = Math.max(0, Number(p.collected) || 0);
    s.lastSeen = Math.max(0, Number(p.lastSeen) || 0);
    s.dailyDay = typeof p.dailyDay === "string" ? p.dailyDay : "";
    s.streak = clamp(Number(p.streak) || 0, 0, 30);
    const cr = p.crisis;
    if (cr && typeof cr === "object" && cr.kind in CRISES)
      s.crisis = { kind: cr.kind, until: Number(cr.until) || 0 };
    if (Array.isArray(p.fx))
      s.fx = p.fx
        .filter((f) => f && typeof f === "object" && (f.kind === "fire" || f.kind === "smoke"))
        .map((f) => ({ kind: f.kind, c: Number(f.c) || 0, r: Number(f.r) || 0, until: Number(f.until) || 0 }));
    s.occupancy = clamp(Number(p.occupancy ?? 0.85), OCCUPANCY_MIN, 1);
    s.loan = Math.max(0, Number(p.loan) || 0);
    s.loanRate = Math.max(0, Number(p.loanRate ?? LOAN_RATE) || 0);
    s.fame = clamp(Number(p.fame) || 0, 0, 12);
    s.rank = clamp(Number(p.rank) || 0, 0, RANKS.length - 1);
    const e = p.event;
    if (e && typeof e === "object" && e.kind in EVENTS)
      s.event = { kind: e.kind, until: Number(e.until) || 0 };
    // Old v2 saves retain the original map even if an extension added unrelated fields.
    // The independently owned key, not arbitrary save content, decides layout identity.
    const requestedDistrict = district ?? null;
    s.district = districtById(requestedDistrict)?.id ?? null;
    if (p.grid !== GRID_GEN) {
      if (!s.history.length) s.history.push(takeSample(s));
      return s;
    }
    const o = p.ordinances;
    if (o && typeof o === "object") {
      s.ordinances = {
        education: Boolean(o.education),
        recycling: Boolean(o.recycling),
        carpool: Boolean(o.carpool),
        clinicFund: Boolean(o.clinicFund),
        smokeBan: Boolean(o.smokeBan),
      };
    }
    const lb = p.lawBudget;
    if (lb && typeof lb === "object")
      for (const key of Object.keys(s.lawBudget) as (keyof Ordinances)[]) {
        const v = (lb as Partial<LawBudgets>)[key];
        if (!v || typeof v !== "object") continue;
        s.lawBudget[key] = {
          mode: v.mode === "percent" ? "percent" : "amount",
          value: Math.max(0, Number(v.value) || 0),
          period: v.period === "year" ? "year" : "month",
        };
      }
    const d = p.disaster;
    if (
      d &&
      typeof d === "object" &&
      (d.kind === "fire" || d.kind === "storm" || d.kind === "blackout" || d.kind === "flood")
    ) {
      s.disaster = { kind: d.kind, until: Number(d.until) || 0 };
    }
    if (Array.isArray(p.log)) {
      s.log = p.log.filter((x) => typeof x === "string").slice(0, 8);
    }
    const roads = Array.isArray(p.roads) ? [...p.roads] : [];

    const roadCells: string[] = [];
    for (const k of roads) {
      if (typeof k !== "string") continue;
      const [c, r] = k.split(",").map(Number);
      if (isLand(c, r)) roadCells.push(cellKey(c, r));
    }
    if (s.district) roadCells.push(...districtRoads(districtById(s.district)!));
    s.roads = [...new Set(roadCells)];
    const taken = new Set(s.roads);
    const buildings = Array.isArray(p.buildings) ? p.buildings : [];
    for (const rawB of buildings) {
      if (!rawB || typeof rawB !== "object") continue;
      const b = rawB as Partial<Building>;
      if (typeof b.kind !== "string" || !(b.kind in CATALOG)) continue;
      const c0 = Number(b.c);
      const r0 = Number(b.r);
      const c = c0;
      const r = r0;
      if (!isLand(c, r) || taken.has(cellKey(c, r))) continue;
      taken.add(cellKey(c, r));
      s.buildings.push({
        id: String(b.id ?? cellKey(c, r)),
        kind: b.kind as Kind,
        c,
        r,
        level: clamp(Number(b.level) || 1, 1, maxLevelOf(b.kind as Kind)),
        stored: Math.max(0, Number(b.stored) || 0),
        born: 0,
      });
    }
    if (Array.isArray(p.history)) {
      for (const rawH of p.history.slice(-1200)) {
        if (!rawH || typeof rawH !== "object") continue;
        const h = rawH as Partial<Sample>;
        s.history.push({
          day: Number(h.day) || 0,
          water: num(h.water),
          power: num(h.power),
          crime: num(h.crime),
          pop: num(h.pop),
          funds: num(h.funds),
          pollution: num(h.pollution),
          traffic: num(h.traffic),
          unemployment: num(h.unemployment),
          industry: num(h.industry),
          approval: num(h.approval),
          size: num(h.size),
          commerce: num(h.commerce),
          land: num(h.land),
          health: num(h.health),
          education: num(h.education),
        });
      }
    }
    if (!s.history.length) s.history.push(takeSample(s));
    return s;
  } catch {
    return district ? createInitialDistrict(district) : createInitial();
  }
}

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function saveSim(s: Sim) {
  if (typeof localStorage === "undefined") return;
  const data = {
    v: 2,
    coins: s.coins,
    roads: s.roads,
    buildings: s.buildings.map(({ born: _born, ...b }) => b),
    quest: s.quest,
    mute: s.mute,
    started: s.started,
    day: s.day,
    speed: s.speed,
    tax: s.tax,
    ordinances: s.ordinances,
    lawBudget: s.lawBudget,
    disaster: s.disaster,
    randomDisasters: s.randomDisasters,
    log: s.log.slice(0, 8),
    history: s.history.slice(-1200),
    difficulty: s.difficulty,
    luckAt: s.luckAt,
    costs: s.costs,
    autoRaise: s.autoRaise,
    housingAid: s.housingAid,
    aidUntil: s.aidUntil,
    aidHappy: s.aidHappy,
    years: s.years,
    ytd: s.ytd,
    finance: s.finance,
    builder: s.builder,
    sites: s.sites,
    npcs: s.npcs,
    flags: s.flags,
    achievements: s.achievements,
    collected: s.collected,
    lastSeen: s.lastSeen,
    dailyDay: s.dailyDay,
    streak: s.streak,
    crisis: s.crisis,
    fx: s.fx,
    occupancy: s.occupancy,
    loan: s.loan,
    loanRate: s.loanRate,
    event: s.event,
    fame: s.fame,
    rank: s.rank,
    grid: GRID_GEN,
    ...(s.district ? { district: s.district } : {}),
  };
  localStorage.setItem(s.district ? districtSaveKey(s.district) : SAVE_KEY, JSON.stringify(data));
}
