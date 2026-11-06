import { CATALOG, ROAD_COST, type Kind } from "./catalog";
import { COLS, GRID_GEN, LAND, ROWS } from "./land";
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
  disaster: Disaster | null;
  randomDisasters: boolean;
  log: string[];
  history: Sample[];
  difficulty: Difficulty;
  luckAt: number;
  /** Legacy v2 saves intentionally omit this optional top-level field. */
  district?: DistrictId | null;
  /** Service fees (electricity, water, permits) in percent of the normal tariff. */
  fees: number;
  /** Share of housing capacity that is lived in (0.25–1); drifts toward satisfaction. */
  occupancy: number;
  /** Outstanding loan, interest included. Repaid monthly. */
  loan: number;
  /** A running city event (tournament, festival…) and its end day. */
  event: CityEvent | null;
  /** Lasting reputation from past events (0–12), a small permanent satisfaction bonus. */
  fame: number;
  /** Highest title reached; used to announce promotions once. */
  rank: number;
};

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
  pop: number;
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

export function priceOf(base: number, _s: Sim) {
  return prepaid ? 0 : Math.round(base);
}

// ---------------------------------------------------------------- titles

export const RANKS: readonly { title: string; pop: number }[] = [
  { title: "مساعد المختار", pop: 0 },
  { title: "مختار المنطقة", pop: 800 },
  { title: "المحافظ", pop: 4000 },
];

export function rankOf(pop: number) {
  let i = 0;
  for (let n = 0; n < RANKS.length; n += 1) if (pop >= RANKS[n]!.pop) i = n;
  return i;
}

/** Announces a promotion once; returns the new title or null. */
export function checkPromotion(s: Sim, st = stats(s)) {
  const now = rankOf(st.pop);
  if (now <= s.rank) return null;
  s.rank = now;
  const title = RANKS[now]!.title;
  const bonus = now === 1 ? 1500 : 5000;
  s.coins += bonus;
  pushLog(s, `ترقية: صرت ${title}`);
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
  return s.event && s.day < s.event.until ? EVENTS[s.event.kind] : null;
}

export function startEvent(s: Sim, kind: EventKind): Act {
  if (activeEvent(s)) return { ok: false, msg: "في فعالية شغّالة. استنى تخلص" };
  const def = EVENTS[kind];
  if (s.coins < def.cost) return { ok: false, msg: `تحتاج ${def.cost.toLocaleString("en-US")} د.ك` };
  if (stats(s).pop < 40) return { ok: false, msg: "تحتاج ٤٠ ساكن على الأقل لتنظيم فعالية" };
  s.coins -= def.cost;
  s.event = { kind, until: s.day + def.days };
  pushLog(s, `انطلقت: ${def.name}`);
  return { ok: true };
}

// ---------------------------------------------------------------- loans

export const LOAN_RATE = 0.12;
export const LOAN_LIMIT = 40000;

export function takeLoan(s: Sim, amount: number): Act {
  if (amount <= 0) return { ok: false, msg: "مبلغ غير صحيح" };
  const debt = Math.round(amount * (1 + LOAN_RATE));
  if (s.loan + debt > LOAN_LIMIT)
    return { ok: false, msg: "البنك رفض: الديون وصلت الحد" };
  s.coins += amount;
  s.loan += debt;
  pushLog(s, `قرض ${amount.toLocaleString("en-US")} د.ك من البنك`);
  return { ok: true };
}

export function repayLoan(s: Sim, amount: number): Act {
  const pay = Math.min(amount, s.loan, Math.max(0, s.coins));
  if (pay <= 0) return { ok: false, msg: s.loan <= 0 ? "ما عليك دين" : "الرصيد ما يكفي للسداد" };
  s.coins -= pay;
  s.loan -= pay;
  if (s.loan <= 0) pushLog(s, "سدّدت القرض كاملاً");
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
  for (const b of s.buildings) pop += CATALOG[b.kind].pop * b.level * 2;
  return pop;
}

/** Monthly revenue from service fees paid by residents. */
export function feeRevenue(s: Sim, st = stats(s)) {
  return Math.round(st.pop * 0.25 * ((s.fees ?? 100) / 100));
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
    disaster: null,
    randomDisasters: true,
    log: [],
    history: [],
    difficulty: "easy",
    luckAt: 0,
    district: null,
    fees: 100,
    occupancy: 0.85,
    loan: 0,
    event: null,
    fame: 0,
    rank: 0,
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
    disaster: s.disaster ? { ...s.disaster } : null,
    event: s.event ? { ...s.event } : null,
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
      s.buildings.some((b) =>
        ["kuwait", "mosque", "liberation", "palace", "boubyan"].includes(b.kind),
      )
        ? 1
        : 0,
    done: (s) =>
      s.buildings.some((b) =>
        ["kuwait", "mosque", "liberation", "palace", "boubyan"].includes(b.kind),
      ),
  },
  {
    text: "أوصل السكان إلى ٢٠٠",
    reward: 2000,
    total: 200,
    progress: (s) => Math.min(200, stats(s).pop),
    done: (s) => stats(s).pop >= 200,
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
    pop += d.pop * lv * 2;
    powerUse += d.powerUse * lv;
    waterUse += d.waterUse * lv;
    powerGive += Math.round(d.powerGive * (1 + (lv - 1) * 0.45));
    waterGive += Math.round(d.waterGive * (1 + (lv - 1) * 0.45));
    happy += d.happy + Math.sign(d.happy) * (lv - 1) * 2;
    if (b.kind === "police") police += 1;
  }
  const capacity = pop;
  pop = Math.round(capacity * clamp(s.occupancy ?? 1, 0.25, 1));
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
  if (s.ordinances.education) happy += 3;
  if (s.ordinances.recycling) happy += 2;
  const hit = s.disaster && s.day < s.disaster.until ? s.disaster.kind : null;
  if (hit === "storm") happy -= 14;
  if (hit === "flood") happy -= 10;
  // Services: each missing one costs up to 9 points once the city is past a village.
  const cover = serviceCoverage(s, capacity);
  const service = Math.min(...Object.values(cover));
  // A village forgives a lot; a big district without services does not.
  const weight = clamp((capacity - 60) / 400, 0, 1) * 9;
  for (const v of Object.values(cover)) happy -= Math.round((1 - v) * weight);
  // Fees above the normal tariff anger people; below it pleases them.
  const fees = s.fees ?? 100;
  happy -= Math.round((fees - 100) / 7);
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
  const mult = (0.3 + (happy / 100) * 1.0) * utilFactor * (1 + (ev2?.income ?? 0));
  return {
    pop,
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

function roadSet(s: Sim) {
  return new Set(s.roads);
}

function besideRoad(c: number, r: number, roads: Set<string>) {
  return DIRS.some(([dc, dr]) => roads.has(cellKey(c + dc, r + dr)));
}

export function incomePerSec(b: Building, s: Sim, st = stats(s)) {
  const d = CATALOG[b.kind];
  if (d.income <= 0) return 0;
  if (d.needsRoad && !besideRoad(b.c, b.r, roadSet(s))) return 0;
  let v = d.income * (1 + (b.level - 1) * 0.62);
  if (d.needsPop > 0 && st.pop < d.needsPop) v *= 0.35;
  if (d.pop > 0) v *= 2 * clamp(s.occupancy ?? 1, 0.25, 1);
  if (d.coastBoost && coastal(b.c, b.r)) v *= 1.15;
  if (s.ordinances.smokeBan && (b.kind === "shop" || b.kind === "tower")) v *= 0.9;
  const tax = 0.55 + (clamp(s.tax, 0, 300) / 100) * 1.2;
  return v * st.mult * tax;
}

export function blockReason(b: Building, s: Sim, st = stats(s)) {
  const d = CATALOG[b.kind];
  if (d.income <= 0) return null;
  if (d.needsRoad && !besideRoad(b.c, b.r, roadSet(s))) return "ارصف طريقاً بجانبه عشان ينتج";
  if (st.short) return "الكهرباء أو الماء ناقص";
  if (d.needsPop > 0 && st.pop < d.needsPop) return `يحتاج ${d.needsPop} ساكن`;
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
  if (!isLand(c, r)) return { ok: false, msg: "ما ينفع الطريق في البحر" };
  if (s.district && s.district !== "free" && isDistrictLand(s.district, cellKey(c, r)))
    return { ok: false, msg: "المخطط يفصل القطع؛ ارصف الشارع الجانبي على حدود القطعة" };
  if (s.buildings.some((b) => b.c === c && b.r === r)) return { ok: false, msg: "في مبنى هنا" };
  const k = cellKey(c, r);
  if (s.roads.includes(k)) return { ok: true, fresh: false };
  const cost = priceOf(ROAD_COST, s);
  if (cost > 0 && s.coins < cost) return { ok: false, msg: "الرصيد ما يكفي للطريق" };
  s.coins -= cost;
  s.roads.push(k);
  return { ok: true, fresh: true };
}

export function placeBuilding(s: Sim, kind: Kind, c: number, r: number, now: number): Act {
  if (!isLand(c, r)) return { ok: false, msg: "ما ينفع البناء في البحر" };
  if (s.roads.includes(cellKey(c, r)) || s.buildings.some((b) => b.c === c && b.r === r)) {
    return { ok: false, msg: "الأرض مشغولة" };
  }
  const cost = priceOf(CATALOG[kind].cost, s);
  if (cost > 0 && s.coins < cost) return { ok: false, msg: "الرصيد ما يكفي" };
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
      if (s.roads.includes(key) || s.buildings.some((b) => b.c === cc && b.r === rr)) continue;
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
      !s.roads.includes(cellKey(c, r)) &&
      !s.buildings.some((b) => b.c === c && b.r === r),
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
  if (built === 0) return { ok: false, msg: "ما لقيت أرض فاضية في المنطقة" };
  return { ok: true, roads: 0, built };
}

const ZONE_CAP = 800;

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
      if (s.roads.includes(key) || s.buildings.some((b) => b.c === c && b.r === r)) continue;
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
  if (!cells.length) return { ok: false, msg: "ما لقيت أرض فاضية في المنطقة" };
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
    return { ok: false, msg: "اختر ماذا يُبنى في المنطقة" };
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
        : { ok: false, msg: "ما لقيت أرض فاضية في المنطقة" };
    }
    const act = zoneOpenLand(s, cA, rA, cB, rB, pick, now, parcelKeys);
    if (!act.ok) return built > 0 ? { ok: true, roads: 0, built } : act;
    return { ok: true, roads: act.roads, built: built + act.built };
  }
  if (cB - cA < 3 || rB - rA < 3) return { ok: false, msg: "حدّد منطقة أكبر" };
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
          if (s.roads.includes(cellKey(c, r))) continue;
          if (s.buildings.some((b) => b.c === c && b.r === r)) continue;
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
        if (s.roads.includes(cellKey(c, r))) continue;
        if (s.buildings.some((b) => b.c === c && b.r === r)) continue;
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
  if (roads === 0 && built === 0) return { ok: false, msg: "ما لقيت أرض فاضية في المنطقة" };
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
export function findModelSite(s: Sim, w: number, h: number) {
  const taken = new Set(s.roads);
  for (const b of s.buildings) taken.add(cellKey(b.c, b.r));
  const free = (c: number, r: number) => {
    const k = cellKey(c, r);
    if (!isLand(c, r) || taken.has(k)) return false;
    if (s.district && s.district !== "free" && isDistrictLand(s.district, k)) return false;
    return !roadIsSchematic(s.district, k);
  };
  const mid = cityCenter(s);
  let best: { c: number; r: number; d: number } | null = null;
  for (let r = 0; r + h <= ROWS; r += 1) {
    for (let c = 0; c + w <= COLS; c += 1) {
      const d = Math.abs(c + w / 2 - mid.c) + Math.abs(r + h / 2 - mid.r);
      if (best && d >= best.d) continue;
      let ok = true;
      for (let y = r; y < r + h && ok; y += 1)
        for (let x = c; x < c + w && ok; x += 1) ok = free(x, y);
      if (ok) best = { c, r, d };
    }
  }
  return best ? { c: best.c, r: best.r } : null;
}

export function buyModelArea(
  s: Sim,
  kind: ModelKind,
  now: number,
): { ok: true; c: number; r: number; built: number } | { ok: false; msg: string } {
  const def = MODEL_AREAS[kind];
  if (s.coins < def.cost)
    return { ok: false, msg: `تحتاج ${def.cost.toLocaleString("en-US")} د.ك` };
  const site = findModelSite(s, def.w, def.h);
  if (!site) return { ok: false, msg: "ما في أرض فاضية تكفي المشروع" };
  s.coins -= def.cost;
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
        if (!s.roads.includes(cellKey(c, r))) lots.push({ c, r });
    const plan = [...def.plan];
    let i = 0;
    for (const lot of lots) {
      const kind2 = plan.shift() ?? def.filler[i++ % def.filler.length]!;
      if (placeBuilding(s, kind2, lot.c, lot.r, now).ok) built += 1;
    }
  } finally {
    prepaid = false;
  }
  pushLog(s, `افتتاح ${def.name}`);
  return { ok: true, c: site.c + def.w / 2, r: site.r + def.h / 2, built };
}

export function bulldoze(s: Sim, c: number, r: number): Act {
  const i = s.buildings.findIndex((b) => b.c === c && b.r === r);
  if (i >= 0) {
    const b = s.buildings[i]!;
    s.coins += Math.round(priceOf(spent(b), s) * 0.5);
    s.buildings.splice(i, 1);
    return { ok: true };
  }
  const k = cellKey(c, r);
  if (roadIsSchematic(s.district, k)) return { ok: false, msg: "الشارع الرئيسي ثابت في مخطط الحي" };
  const ri = s.roads.indexOf(k);
  if (ri >= 0) {
    s.roads.splice(ri, 1);
    s.coins += Math.round(priceOf(ROAD_COST, s) * 0.5);
    return { ok: true };
  }
  return { ok: false, msg: "ما في شيء تهدّه هنا" };
}

export function upgrade(s: Sim, id: string, now: number): Act {
  const b = s.buildings.find((x) => x.id === id);
  if (!b) return { ok: false, msg: "المبنى مو موجود" };
  if (b.level >= 3) return { ok: false, msg: "وصل آخر مستوى" };
  const cost = priceOf(upgradeCost(b.kind, b.level), s);
  if (cost > 0 && s.coins < cost) return { ok: false, msg: "الرصيد ما يكفي للترقية" };
  s.coins -= cost;
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
  if (s.ordinances.recycling) pollution -= 14;
  if (s.ordinances.smokeBan) pollution -= 12;
  pollution = clamp(pollution, 0, 100);
  let traffic = clamp((s.buildings.length * 70) / Math.max(3, s.roads.length) - 20, 0, 100);
  if (s.ordinances.carpool) traffic = clamp(traffic - 18, 0, 100);
  const crime = clamp(62 - police * 16 - parks * 4 + Math.max(0, st.pop - 60) / 10, 0, 100);
  const health = clamp(
    36 + clinics * 16 + water * 0.28 - pollution * 0.22 + (s.ordinances.clinicFund ? 12 : 0),
    0,
    100,
  );
  const education = clamp(24 + (s.ordinances.education ? 42 : 0) + clinics * 5, 0, 100);
  const land = clamp(30 + parks * 8 + coast * 4 + st.happy * 0.2, 0, 100);
  return {
    day: s.day,
    water,
    power,
    crime,
    pop: clamp(st.pop / 4, 0, 100),
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
    if (s.ordinances[key]) n += ORDINANCE_COST[key];
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
    pushLog(s, "انتهت الكارثة. المدينة تلمّ جراحها");
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
    s.coins += feeRevenue(s, st);
    s.coins -= monthlyUpkeep(s);
    const due = loanInstallment(s);
    if (due > 0) {
      s.coins -= due;
      s.loan = Math.max(0, s.loan - due);
      if (s.loan === 0) pushLog(s, "سدّدت القرض كاملاً");
    }
    s.coins = Math.max(-20000, s.coins);
    // People move in when they are happy and served, and leave when they are not.
    const ev = activeEvent(s);
    const target = clamp(0.35 + (st.happy / 100) * 0.75 + (ev?.draw ?? 0), 0.25, 1);
    const before2 = s.occupancy;
    s.occupancy = clamp(s.occupancy + (target - s.occupancy) * 0.35, 0.25, 1);
    if (st.capacity >= 60 && before2 - s.occupancy > 0.04)
      pushLog(s, "ناس تطلع من المنطقة: الرضا نازل");
    s.history.push(takeSample(s));
    if (!rolled && s.randomDisasters && s.buildings.length > 3 && Math.random() < 0.035) {
      rolled = true;
      const roll = Math.random();
      triggerDisaster(
        s,
        roll < 0.28 ? "fire" : roll < 0.56 ? "storm" : roll < 0.8 ? "blackout" : "flood",
      );
    }
  }
  endEvent(s);
  if (s.history.length > 1200) s.history.splice(0, s.history.length - 1200);
  if (!brokeBefore && s.coins < 0) pushLog(s, "عجز: مصروف الشهر أكبر من الصندوق");
}

function endEvent(s: Sim) {
  if (!s.event || s.day < s.event.until) return;
  const def = EVENTS[s.event.kind];
  s.fame = Math.min(12, (s.fame ?? 0) + def.fame);
  pushLog(s, `انتهت ${def.name}. سمعة المنطقة ارتفعت`);
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
    return { ok: false, msg: "في كارثة جارية. استنى تخلص" };
  }
  if (kind === "fire") {
    const targets = s.buildings.filter(
      (b) => !["kuwait", "mosque", "liberation", "palace", "boubyan"].includes(b.kind),
    );
    if (!targets.length) return { ok: false, msg: "ما في مبنى يطاله الحريق" };
    const b = targets[Math.floor(Math.random() * targets.length)]!;
    const name = CATALOG[b.kind].name;
    if (b.level > 1) b.level -= 1;
    else {
      const i = s.buildings.findIndex((x) => x.id === b.id);
      if (i >= 0) s.buildings.splice(i, 1);
    }
    const bill = disasterBill(s, "fire");
    s.coins -= bill;
    const msg = `حريق ضرب ${name} · خسارة ${bill.toLocaleString("en-US")} د.ك`;
    pushLog(s, msg);
    return { ok: true, msg };
  }
  if (kind === "storm") {
    s.disaster = { kind: "storm", until: s.day + 50 };
    const bill = disasterBill(s, "storm");
    s.coins -= bill;
    const msg = `عاصفة رملية تغطي الكويت · تنظيف ${bill.toLocaleString("en-US")} د.ك`;
    pushLog(s, msg);
    return { ok: true, msg };
  }
  if (kind === "flood") {
    s.disaster = { kind: "flood", until: s.day + 30 };
    const bill = disasterBill(s, "flood");
    s.coins -= bill;
    const msg = `أمطار وسيول تغرق الشوارع · تصريف ${bill.toLocaleString("en-US")} د.ك`;
    pushLog(s, msg);
    return { ok: true, msg };
  }
  s.disaster = { kind: "blackout", until: s.day + 36 };
  const bill = disasterBill(s, "blackout");
  s.coins -= bill;
  const msg = `انقطاع كهرباء على الأحياء · إصلاح ${bill.toLocaleString("en-US")} د.ك`;
  pushLog(s, msg);
  return { ok: true, msg };
}

export function bulletin(s: Sim, st = stats(s)) {
  const m = metrics(s, st);
  const lines = [...s.log];
  if (s.speed === 0 && s.started) lines.push("الزمن واقف. اضغط تشغيل");
  if (m.pollution >= 42) lines.push("شيء في الهواء: التلوث متوسط");
  else lines.push("الهواء على الكورنيش صافٍ");
  if (m.power < 85 && st.pop >= 20) lines.push("مستشار الكهرباء: الإنتاج ما يغطي");
  if (m.water < 85 && st.pop >= 20) lines.push("التحلية ناقصة والأحياء تعطش");
  if (m.crime > 48) lines.push("الجريمة ترتفع. ابنِ مركز شرطة");
  if (m.unemployment > 38) lines.push("البطالة عالية. افتح محلات وأبراج");
  if (m.approval >= 72) lines.push("الرضا عالٍ. أهل الكويت مبسوطين");
  if (s.tax >= 80) lines.push("الضريبة عالية والناس تتذمر");
  if (s.coins < 0) lines.push("صندوق البلدية في عجز. خذ قرضاً من الميزانية");
  if (st.capacity >= 60 && st.service < 0.6) lines.push("الخدمات ناقصة والناس متضايقة");
  if ((s.fees ?? 100) > 130) lines.push("الرسوم غالية والسكان يشتكون");
  if (s.loan > 0) lines.push(`دين البنك ${Math.round(s.loan).toLocaleString("en-US")} د.ك`);
  const ev = activeEvent(s);
  if (ev) lines.push(`فعالية جارية: ${ev.name}`);
  const q = QUESTS[s.quest];
  if (q) lines.push(`مهمة: ${q.text}`);
  if (!lines.length) lines.push("مدينة الكويت تنتظر قرارك");
  return lines.slice(0, 8);
}

export function rollLuck(s: Sim, now: number) {
  const wait = 7000;
  const left = s.luckAt + wait - now;
  if (left > 0) {
    return { ok: false as const, amount: 0, msg: `الحظ يرجع بعد ${Math.ceil(left / 1000)} ث` };
  }
  const bag = [120, 180, 220, 260, 320, 400, 450, 700, 1100];
  const amount = bag[Math.floor(Math.random() * bag.length)] ?? 200;
  s.coins += amount;
  s.luckAt = now;
  return { ok: true as const, amount, msg: `حظك +${amount} د.ك` };
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

export function createInitialDistrict(district: DistrictId): Sim {
  const s = createInitial();
  s.district = district;
  s.roads = districtRoads(districtById(district)!);
  return s;
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
    const s = district ? createInitialDistrict(district) : createInitial();
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
    s.fees = clamp(Number(p.fees ?? 100), 50, 200);
    s.occupancy = clamp(Number(p.occupancy ?? 0.85), 0.25, 1);
    s.loan = Math.max(0, Number(p.loan) || 0);
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
        level: clamp(Number(b.level) || 1, 1, 3),
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
    disaster: s.disaster,
    randomDisasters: s.randomDisasters,
    log: s.log.slice(0, 8),
    history: s.history.slice(-1200),
    difficulty: s.difficulty,
    luckAt: s.luckAt,
    fees: s.fees,
    occupancy: s.occupancy,
    loan: s.loan,
    event: s.event,
    fame: s.fame,
    rank: s.rank,
    grid: GRID_GEN,
    ...(s.district ? { district: s.district } : {}),
  };
  localStorage.setItem(s.district ? districtSaveKey(s.district) : SAVE_KEY, JSON.stringify(data));
}
