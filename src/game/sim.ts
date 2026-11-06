import { CATALOG, ROAD_COST, type Kind } from "./catalog";
import { COLS, GRID_GEN, LAND, ROWS } from "./land";
export { districtById, isDistrictLand } from "./districts";
import {
  districtById,
  districtRoads,
  districtSaveKey,
  isDistrictLand,
  sectorAt,
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
};

export type Difficulty = "easy" | "medium" | "hard";

export type Ordinances = {
  education: boolean;
  recycling: boolean;
  carpool: boolean;
  clinicFund: boolean;
  smokeBan: boolean;
};

export type DisasterKind = "fire" | "storm" | "blackout";

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

export function priceOf(_base: number, _s: Sim) {
  return 0;
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
    coins: 3200,
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
    randomDisasters: false,
    log: [],
    history: [],
    difficulty: "easy",
    luckAt: 0,
    district: null,
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
  if (s.disaster?.kind === "storm" && s.day < s.disaster.until) happy -= 14;
  happy = clamp(Math.round(happy), 6, 100);
  const utilP = powerUse === 0 || grace ? 1 : Math.min(1, powerGive / powerUse);
  const utilW = waterUse === 0 || grace ? 1 : Math.min(1, waterGive / waterUse);
  const util = Math.min(utilP, utilW);
  const utilFactor = util >= 0.999 ? 1 : 0.22 + util * 0.78;
  const mult = (0.64 + (happy / 100) * 0.66) * utilFactor;
  return {
    pop,
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
  if (d.pop > 0) v *= 2;
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
  if (s.district && isDistrictLand(s.district, cellKey(c, r)))
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
  if (!isDistrictLand(s.district ?? null, cellKey(c, r)))
    return { ok: false, msg: "اختر أرضًا داخل إحدى القطع المرقّمة" };
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

export type ZonePick = {
  streets: boolean;
  schools: boolean;
  fire: boolean;
  landmarks: boolean;
  parks: boolean;
};

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
  if (cB - cA < 3 || rB - rA < 3) return { ok: false, msg: "حدّد منطقة أكبر" };
  if (!pick.streets && !pick.schools && !pick.fire && !pick.landmarks && !pick.parks) {
    return { ok: false, msg: "اختر ماذا يُبنى في المنطقة" };
  }
  let roads = 0;
  let built = 0;
  if (s.district) {
    const number = sectorAt(s.district, cellKey(cA, rA));
    const parcel = districtById(s.district)?.sectors.find((sector) => sector.number === number);
    if (!parcel) return { ok: false, msg: "ابدأ التحديد على أرض داخل قطعة مرقّمة" };
    let left: number = COLS,
      right = 0,
      top: number = ROWS,
      bottom = 0;
    for (const { c, r } of parcel.cells) {
      left = Math.min(left, c);
      right = Math.max(right, c);
      top = Math.min(top, r);
      bottom = Math.max(bottom, r);
    }
    cA = left;
    cB = right;
    rA = top;
    rB = bottom;
    /* The tool plans the indicated sector, never through another sector. */
  }
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

export function monthlyUpkeep(s: Sim) {
  let n = s.roads.length * 2 + s.buildings.length * 6;
  if (s.ordinances.education) n += 80;
  if (s.ordinances.recycling) n += 40;
  if (s.ordinances.carpool) n += 25;
  if (s.ordinances.clinicFund) n += 55;
  if (s.ordinances.smokeBan) n += 30;
  return priceOf(n, s);
}

export function monthlyIncome(s: Sim) {
  const st = stats(s);
  return Math.round(s.buildings.reduce((n, b) => n + incomePerSec(b, s, st) * 30, 0));
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
  if (after <= before) return;
  const brokeBefore = s.coins < 0;
  let rolled = false;
  for (let m = before + 1; m <= after; m += 1) {
    s.coins = Math.max(-8000, s.coins - monthlyUpkeep(s));
    s.history.push(takeSample(s));
    if (!rolled && s.randomDisasters && s.buildings.length > 3 && Math.random() < 0.06) {
      rolled = true;
      const roll = Math.random();
      triggerDisaster(s, roll < 0.34 ? "fire" : roll < 0.67 ? "storm" : "blackout");
    }
  }
  if (s.history.length > 1200) s.history.splice(0, s.history.length - 1200);
  if (!brokeBefore && s.coins < 0) pushLog(s, "عجز: مصروف الشهر أكبر من الصندوق");
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
    const msg = `حريق ضرب ${name}`;
    pushLog(s, msg);
    return { ok: true, msg };
  }
  if (kind === "storm") {
    s.disaster = { kind: "storm", until: s.day + 50 };
    const msg = "عاصفة رملية تغطي الكويت";
    pushLog(s, msg);
    return { ok: true, msg };
  }
  s.disaster = { kind: "blackout", until: s.day + 36 };
  const msg = "انقطاع كهرباء على الأحياء";
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
  if (s.coins < 0) lines.push("صندوق البلدية في عجز");
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

export const roadIsSchematic = (district: DistrictId | null | undefined, key: string) => {
  const d = districtById(district);
  return Boolean(d && districtRoads(d).includes(key));
};

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
    // Old v2 saves retain the original map even if an extension added unrelated fields.
    // The independently owned key, not arbitrary save content, decides layout identity.
    const requestedDistrict = district ?? null;
    s.district = districtById(requestedDistrict)?.id ?? null;
    const fine = p.grid === GRID_GEN;
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
      (d.kind === "fire" || d.kind === "storm" || d.kind === "blackout")
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
      if (fine) {
        if (isLand(c, r)) roadCells.push(cellKey(c, r));
        continue;
      }
      for (const dc of [0, 1]) {
        for (const dr of [0, 1]) {
          const nc = c * 2 + dc;
          const nr = r * 2 + dr;
          if (isLand(nc, nr)) roadCells.push(cellKey(nc, nr));
        }
      }
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
      let c = c0;
      let r = r0;
      if (!fine) {
        const spots = [
          [c0 * 2, r0 * 2],
          [c0 * 2 + 1, r0 * 2],
          [c0 * 2, r0 * 2 + 1],
          [c0 * 2 + 1, r0 * 2 + 1],
        ];
        const roadSet = new Set(s.roads);
        const hit = spots.find(
          ([nc, nr]) =>
            isLand(nc, nr) &&
            !roadSet.has(cellKey(nc, nr)) &&
            DIRS.some(([dc, dr]) => roadSet.has(cellKey(nc + dc, nr + dr))),
        );
        const open = spots.find(([nc, nr]) => isLand(nc, nr) && !roadSet.has(cellKey(nc, nr)));
        const pick = hit ?? open;
        if (!pick) continue;
        c = pick[0];
        r = pick[1];
      }
      if (
        !isLand(c, r) ||
        !isDistrictLand(s.district ?? null, cellKey(c, r)) ||
        taken.has(cellKey(c, r))
      )
        continue;
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
    grid: GRID_GEN,
    ...(s.district ? { district: s.district } : {}),
  };
  localStorage.setItem(s.district ? districtSaveKey(s.district) : SAVE_KEY, JSON.stringify(data));
}
