/**
 * Administrative regions: the land is split into 100 regions of equal land area —
 * ten strips west to east with the same amount of land each, every strip cut into
 * ten pieces north to south the same way — so each region is a rectangle of the grid.
 * Each is named after the nearest real place on the map.
 *
 * Per region the city counts residents, buildings, the value of private property and
 * who holds how much of it; the owner with the most is the region's dominant owner,
 * and the region takes that owner's colour on the map.
 *
 * The state can value-buy a whole region («تثمين»: every private property bought at
 * a premium over market value), expropriate it (at a compensation it chooses), or
 * evacuate it (value-buy what is still private, then clear every private building,
 * leaving roads and public services).
 */
import { CATALOG } from "./catalog";
import { COLS, ROWS } from "./land";
import { lonLatToCell, PLACES } from "./places";
import { msg, t } from "@/i18n";
import {
  estateOf,
  forgetLots,
  isMerchant,
  isPerson,
  isPublic,
  MERCHANT_COLORS,
  OWNER_COLORS,
  ownerName,
  ownerOf,
  propertyValue,
  type EstateAct,
  type OwnerId,
} from "./realestate";
import { homesPerLevel, isLand, pushLog, RESIDENTS_PER_UNIT, stats, type Building, type Sim } from "./sim";

export type Region = { id: number; name: string; c0: number; c1: number; r0: number; r1: number; land: number };

let built: { regions: Region[]; colStrip: Int16Array; stripRows: Int32Array[] } | null = null;

/** The 100 regions (worked out once from the land map). */
export function regions(): Region[] {
  return layout().regions;
}

function layout() {
  if (built) return built;
  // Land per column, then ten strips of equal land.
  const perCol = new Int32Array(COLS);
  let total = 0;
  for (let c = 0; c < COLS; c += 1)
    for (let r = 0; r < ROWS; r += 1)
      if (isLand(c, r)) {
        perCol[c] += 1;
        total += 1;
      }
  const strips: [number, number][] = [];
  let start = 0;
  let acc = 0;
  for (let c = 0; c < COLS; c += 1) {
    acc += perCol[c]!;
    const want = (total * (strips.length + 1)) / 10;
    if ((acc >= want && strips.length < 9) || c === COLS - 1) {
      strips.push([start, c]);
      start = c + 1;
    }
  }
  const colStrip = new Int16Array(COLS);
  const stripRows: Int32Array[] = [];
  const out: Region[] = [];
  strips.forEach(([c0, c1], si) => {
    for (let c = c0; c <= c1; c += 1) colStrip[c] = si;
    // Land per row inside the strip, then ten pieces of equal land.
    const perRow = new Int32Array(ROWS);
    let land = 0;
    for (let r = 0; r < ROWS; r += 1)
      for (let c = c0; c <= c1; c += 1)
        if (isLand(c, r)) {
          perRow[r] += 1;
          land += 1;
        }
    const cuts = new Int32Array(10);
    let from = 0;
    let sum = 0;
    let pieces = 0;
    for (let r = 0; r < ROWS; r += 1) {
      sum += perRow[r]!;
      const want = (land * (pieces + 1)) / 10;
      if ((sum >= want && pieces < 9) || r === ROWS - 1) {
        let here = 0;
        for (let y = from; y <= r; y += 1) here += perRow[y]!;
        out.push({ id: out.length + 1, name: "", c0, c1, r0: from, r1: r, land: here });
        cuts[pieces] = r;
        pieces += 1;
        from = r + 1;
      }
    }
    stripRows.push(cuts);
  });
  // Names: the nearest real place, "٢" etc. when a name is used twice.
  const anchors = PLACES.filter((p) => !p.major || p.name === "مدينة الكويت" || p.name === "جزيرة بوبيان").map((p) => ({ name: p.name, ...lonLatToCell(p.lon, p.lat) }));
  const used = new Map<string, number>();
  for (const g of out) {
    const mc = (g.c0 + g.c1) / 2;
    const mr = (g.r0 + g.r1) / 2;
    let best = anchors[0]!;
    let bd = Infinity;
    for (const a of anchors) {
      const inside = a.c >= g.c0 && a.c <= g.c1 && a.r >= g.r0 && a.r <= g.r1;
      const d = Math.hypot(a.c - mc, a.r - mr) - (inside ? 1e6 : 0);
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    const n = (used.get(best.name) ?? 0) + 1;
    used.set(best.name, n);
    g.name = n === 1 ? best.name : `${best.name} ${n}`;
  }
  built = { regions: out, colStrip, stripRows };
  return built;
}

/** The region (1–100) a cell belongs to. */
export function regionAt(c: number, r: number) {
  const L = layout();
  const cc = Math.max(0, Math.min(COLS - 1, Math.floor(c)));
  const si = L.colStrip[cc]!;
  const cuts = L.stripRows[si]!;
  let p = 0;
  while (p < 9 && r > cuts[p]!) p += 1;
  return si * 10 + p + 1;
}

export type RegionStats = {
  id: number;
  name: string;
  residents: number;
  buildings: number;
  value: number;
  /** Value held by each owner (private property only). */
  by: Map<OwnerId, number>;
  /** The merchant with the most property here (the region's colour on the map). */
  top: OwnerId | null;
  topShare: number;
  /** Individuals' and the state's shares of the region's private property. */
  peopleShare: number;
  stateShare: number;
  /** Private properties not yet the state's. */
  privateCount: number;
  stateCount: number;
};

const statsMemo = new WeakMap<object, { key: string; out: RegionStats[] }>();

/** Residents, buildings, property value and who dominates, for every region. */
export function regionStats(s: Sim): RegionStats[] {
  const e = estateOf(s);
  const key = `${Math.floor(s.day / 30)}:${s.buildings.length}:${e.trades.length}:${e.trades[e.trades.length - 1]?.day ?? 0}:${e.index}`;
  const hit = statsMemo.get(e);
  if (hit && hit.key === key) return hit.out;
  const rs = regions();
  const out: RegionStats[] = rs.map((g) => ({
    id: g.id,
    name: g.name,
    residents: 0,
    buildings: 0,
    value: 0,
    by: new Map(),
    top: null,
    topShare: 0,
    peopleShare: 0,
    stateShare: 0,
    privateCount: 0,
    stateCount: 0,
  }));
  const occ = Math.max(0, Math.min(1, s.occupancy ?? 1));
  const mood = 0.8 + stats(s).happy / 250;
  for (const b of s.buildings) {
    const row = out[regionAt(b.c, b.r) - 1]!;
    const d = CATALOG[b.kind];
    row.buildings += 1;
    row.residents += d.pop * homesPerLevel(b.level) * 2 * occ * RESIDENTS_PER_UNIT;
    const o = ownerOf(s, b);
    if (!o) continue;
    const v = d.cost * 40 * (1 + (b.level - 1) * 0.8) * mood * e.index;
    row.value += v;
    row.by.set(o, (row.by.get(o) ?? 0) + v);
    if (o === "state") row.stateCount += 1;
    else row.privateCount += 1;
  }
  for (const row of out) {
    row.residents = Math.round(row.residents);
    row.value = Math.round(row.value);
    // The strongest merchant colours the region; with no merchant here, whoever
    // holds the most (individuals or the state).
    let best: OwnerId | null = null;
    for (const [o, v] of row.by) {
      if (!isMerchant(o)) continue;
      if (!best || v > (row.by.get(best) ?? 0)) best = o;
    }
    if (!best) for (const [o, v] of row.by) if (!best || v > (row.by.get(best) ?? 0)) best = o;
    row.top = best;
    row.topShare = best && row.value > 0 ? (row.by.get(best) ?? 0) / row.value : 0;
    let people = 0;
    for (const [o, v] of row.by) if (o === "people" || isPerson(o)) people += v;
    row.peopleShare = row.value > 0 ? people / row.value : 0;
    row.stateShare = row.value > 0 ? (row.by.get("state") ?? 0) / row.value : 0;
  }
  statsMemo.set(e, { key, out });
  return out;
}

/** The colour of an owner on the regions map. */
export function ownerColor(o: OwnerId | null) {
  if (!o) return "#9ca3af";
  if (o === "state") return OWNER_COLORS.state!;
  if (o === "people" || isPerson(o)) return OWNER_COLORS.people!;
  return MERCHANT_COLORS[o];
}

/** Every building coloured by its region's dominant owner. */
export function regionColors(s: Sim) {
  const rows = regionStats(s);
  const out = new Map<string, string>();
  for (const b of s.buildings) out.set(b.id, ownerColor(rows[regionAt(b.c, b.r) - 1]!.top));
  return out;
}

function privateIn(s: Sim, ids: number[], stateToo = false) {
  const want = new Set(ids);
  const out: Building[] = [];
  for (const b of s.buildings) {
    if (!want.has(regionAt(b.c, b.r))) continue;
    const o = ownerOf(s, b);
    if (!o || (!stateToo && o === "state")) continue;
    out.push(b);
  }
  return out;
}

/** What value-buying the regions would cost (premium over market value, in %). */
export function regionCost(s: Sim, ids: number[], pct: number) {
  let v = 0;
  for (const b of privateIn(s, ids)) v += propertyValue(s, b);
  return Math.round((v * pct) / 100);
}

const names = (ids: number[]) => {
  const rs = regions();
  return ids.map((id) => rs[id - 1]?.name ?? String(id));
};

/**
 * «تثمين»: the state buys every private property in the regions at market value plus
 * a premium (owners are paid generously, so nobody is angry; it lifts fame).
 */
export function valueBuyRegions(s: Sim, ids: number[], pct = 110): EstateAct {
  if (!ids.length) return { ok: false, msg: t("اختر منطقة") };
  const list = privateIn(s, ids);
  if (!list.length) return { ok: false, msg: t("كل عقارات المنطقة للدولة أصلاً") };
  const cost = regionCost(s, ids, pct);
  if (s.coins < cost) return { ok: false, msg: t("الرصيد ما يكفي: تحتاج {amount} د.ك", { amount: cost }) };
  const e = estateOf(s);
  for (const b of list) {
    const o = ownerOf(s, b)!;
    const price = Math.round((propertyValue(s, b) * pct) / 100);
    s.coins -= price;
    s.ytd.spend += price;
    const n = s.npcs.find((x) => x.id === o);
    if (n) n.cash += price;
    e.owners[`${b.c},${b.r}`] = "state";
  }
  e.trades = [...e.trades, { day: s.day, id: `${list[0]!.c},${list[0]!.r}`, kind: list[0]!.kind, from: "people" as OwnerId, to: "state" as OwnerId, price: cost, type: "sale" as const }].slice(-80);
  s.fame = Math.min(12, (s.fame ?? 0) + 0.5);
  const entry = msg("تثمين {regions}: الدولة اشترت {n} عقار بـ {amount} د.ك ({pct}٪ من القيمة)", { regions: names(ids), n: list.length, amount: cost, pct });
  pushLog(s, entry);
  return { ok: true, msg: entry };
}

/**
 * Expropriation of whole regions at a chosen compensation. Under full value, the
 * anger is that of one expropriation, scaled by how many properties were taken.
 */
export function expropriateRegions(s: Sim, ids: number[], pct: number): EstateAct {
  if (!ids.length) return { ok: false, msg: t("اختر منطقة") };
  pct = Math.max(0, Math.min(150, Math.round(pct)));
  const list = privateIn(s, ids);
  if (!list.length) return { ok: false, msg: t("كل عقارات المنطقة للدولة أصلاً") };
  const cost = regionCost(s, ids, pct);
  if (s.coins < cost) return { ok: false, msg: t("الرصيد ما يكفي: تحتاج {amount} د.ك", { amount: cost }) };
  const e = estateOf(s);
  for (const b of list) {
    const o = ownerOf(s, b)!;
    const price = Math.round((propertyValue(s, b) * pct) / 100);
    s.coins -= price;
    s.ytd.spend += price;
    const n = s.npcs.find((x) => x.id === o);
    if (n) {
      n.cash += price;
      if (pct < 100) n.trust = Math.max(0, n.trust - 2);
    }
    e.owners[`${b.c},${b.r}`] = "state";
  }
  if (pct < 100) {
    const hurt = Math.min(15, Math.ceil(((100 - pct) / 12) * (1 + Math.log10(1 + list.length / 50))));
    const g = e.grievance ?? (e.grievance = { mood: 0, until: 0 });
    g.mood = Math.min(20, (g.until > s.day ? g.mood : 0) + hurt);
    g.until = s.day + 360;
  }
  const entry = msg("نزع ملكية {regions} بالكامل: {n} عقار بتعويض {amount} د.ك ({pct}٪)", { regions: names(ids), n: list.length, amount: cost, pct });
  pushLog(s, entry);
  return { ok: true, msg: entry };
}

/**
 * Evacuation: what is still private is value-bought first (at market value), then
 * every private building in the regions is cleared; roads, services and state
 * landmarks stay. The residents move out; the land is free for new projects.
 */
export function evacuateRegions(s: Sim, ids: number[]): EstateAct {
  if (!ids.length) return { ok: false, msg: t("اختر منطقة") };
  const left = privateIn(s, ids);
  const cost = regionCost(s, ids, 100);
  if (s.coins < cost) return { ok: false, msg: t("الرصيد ما يكفي: تحتاج {amount} د.ك", { amount: cost }) };
  if (left.length) {
    const r = valueBuyRegions(s, ids, 100);
    if (!r.ok) return r;
  }
  const want = new Set(ids);
  const gone = s.buildings.filter((b) => want.has(regionAt(b.c, b.r)) && !isPublic(b.kind));
  if (!gone.length) return { ok: false, msg: t("ما في مبانٍ خاصة في المنطقة") };
  const goneSet = new Set(gone);
  s.buildings = s.buildings.filter((b) => !goneSet.has(b));
  forgetLots(s, gone);
  const entry = msg("إخلاء {regions}: أُزيل {n} مبنى خاص وانتقل السكان، وبقيت الطرق والخدمات", { regions: names(ids), n: gone.length });
  pushLog(s, entry);
  return { ok: true, msg: entry };
}

/** Dominant owners across all regions: how many regions each one leads. */
export function regionLeaders(s: Sim) {
  const count = new Map<OwnerId, number>();
  for (const r of regionStats(s)) if (r.top) count.set(r.top, (count.get(r.top) ?? 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1]).map(([owner, n]) => ({ owner, n, name: ownerName(owner) }));
}

