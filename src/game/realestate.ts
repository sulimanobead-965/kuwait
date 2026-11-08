/**
 * Real estate: every lot in the city is either public land (roads, services, state
 * landmarks — never traded) or private property (homes, shops, towers, factories),
 * owned by individuals, by the city's merchants, or by the state itself.
 *
 * Private property changes hands for real: merchants and individuals trade every
 * month, the governor can buy, sell, grant or lease, and the state can hand land to a
 * merchant on a temporary allocation contract to build a project, which comes back to
 * the state with what was built when the contract ends. Every deal is recorded in the
 * real-estate trades list, and the ownership map colours each lot by who holds it.
 *
 * Owners are not stored for every building: each building has a default owner worked
 * out from its id, and only changes of hands are kept (`owners`), so a city of 100k
 * buildings costs nothing extra to save.
 */
import { CATALOG, type Kind } from "./catalog";
import { NPCS, type NpcId } from "./npcs";
import { msg, t } from "@/i18n";
import {
  findModelSite,
  placePackage,
  placeBuilding,
  pushLog,
  stats,
  priceOf,
  openLot,
  type Building,
  type Sim,
} from "./sim";

export type OwnerId = NpcId | "state" | "people";

export type Trade = {
  day: number;
  /** Building id and its kind when the deal happened. */
  id: string;
  kind: Kind;
  from: OwnerId;
  to: OwnerId;
  price: number;
  type: "sale" | "grant" | "lease" | "allocation" | "return";
};

export type Lease = { id: string; tenant: OwnerId; rent: number; until: number };

export type Allocation = {
  id: number;
  holder: NpcId;
  use: AllocationUse;
  c: number;
  r: number;
  w: number;
  h: number;
  /** Yearly fee paid to the state. */
  fee: number;
  start: number;
  until: number;
  buildings: string[];
};

export type AllocationUse = "commercial" | "residential" | "services";

/** A property offered for sale: by its owner, or by the state. */
export type Listing = { id: number; lot: string; kind: Kind; seller: OwnerId; ask: number; until: number; countered?: boolean };

/** A state property in auction: merchants and individuals bid at the month's end. */
export type Auction = { id: number; lot: string; kind: Kind; min: number; until: number };

/** One month of the market, for the price chart. */
export type MarketMonth = { day: number; index: number; volume: number; count: number };

export type Estate = {
  /** Owner of each building that changed hands (default owner otherwise). */
  owners: Record<string, OwnerId>;
  /** The property market: 1 = normal prices. */
  index: number;
  trades: Trade[];
  leases: Lease[];
  allocations: Allocation[];
  nextId: number;
  listings: Listing[];
  auctions: Auction[];
  /** Registration fee on every sale, % of the price, paid to the state. */
  fee: number;
  feeTotal: number;
  history: MarketMonth[];
  /** This month so far (moved into history at the month's end). */
  volume: number;
  count: number;
};

export const emptyEstate = (): Estate => ({
  owners: {},
  index: 1,
  trades: [],
  leases: [],
  allocations: [],
  nextId: 1,
  listings: [],
  auctions: [],
  fee: 2,
  feeTotal: 0,
  history: [],
  volume: 0,
  count: 0,
});

/** Kinds that are always public land: services, utilities, state landmarks, transport. */
const PUBLIC_KINDS = new Set<Kind>([
  "power",
  "water",
  "police",
  "clinic",
  "school",
  "fire",
  "park",
  "kuwait",
  "mosque",
  "liberation",
  "palace",
  "opera",
  "mubarakiya",
  "stadium",
  "shaheed",
  "port",
  "refinery",
  "runway",
  "terminal",
  "rail",
  "station",
]);

export const isPublic = (kind: Kind) => PUBLIC_KINDS.has(kind);

export const OWNER_NAMES: Record<"state" | "people", string> = {
  state: "أملاك الدولة",
  people: "الأفراد",
};

export function ownerName(o: OwnerId) {
  if (o === "state" || o === "people") return OWNER_NAMES[o];
  return NPCS.find((n) => n.id === o)?.name ?? o;
}

/** Colours of the ownership map. */
export const OWNER_COLORS: Record<string, string> = {
  public: "#3b82f6",
  state: "#14b8a6",
  people: "#f59e0b",
  merchant: "#a855f7",
  allocation: "#ec4899",
};

export function estateOf(s: Sim): Estate {
  const x = s as Sim & { estate?: Estate };
  if (!x.estate) x.estate = emptyEstate();
  return x.estate;
}

/** Ownership belongs to the land: a lot is known by its cell, which survives reloads. */
export const lotKey = (b: Building) => `${b.c},${b.r}`;

function hash(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

/** Merchants' share of the market by default, weighted by how rich each one is. */
const MERCHANTS = NPCS.map((n) => ({ id: n.id, weight: n.holdings.reduce((a, h) => a + h.value, 0) + n.cash }));
const MERCHANT_TOTAL = MERCHANTS.reduce((a, m) => a + m.weight, 0);

function defaultOwner(b: Building): OwnerId {
  const h = hash(lotKey(b));
  const cat = CATALOG[b.kind].cat;
  // Merchants own most commerce and industry, some apartment blocks, few villas.
  const merchantShare = cat === "commerce" || cat === "industry" || cat === "landmarks" ? 0.7 : b.kind === "apartments" ? 0.35 : 0.08;
  if (h >= merchantShare) return "people";
  let pick = (h / merchantShare) * MERCHANT_TOTAL;
  for (const m of MERCHANTS) {
    pick -= m.weight;
    if (pick <= 0) return m.id;
  }
  return MERCHANTS[0]!.id;
}

/** Who holds a building: null for public land. */
export function ownerOf(s: Sim, b: Building): OwnerId | null {
  if (isPublic(b.kind)) return null;
  return estateOf(s).owners[lotKey(b)] ?? defaultOwner(b);
}

/** Market value of a property in KD. */
export function propertyValue(s: Sim, b: Building) {
  const base = CATALOG[b.kind].cost;
  const levels = 1 + (b.level - 1) * 0.8;
  const mood = 0.8 + stats(s).happy / 250;
  return Math.round(base * 40 * levels * mood * estateOf(s).index);
}

/** Monthly rent a property earns: 0.6% of its value. */
export const rentOf = (s: Sim, b: Building) => Math.round(propertyValue(s, b) * 0.006);

function record(s: Sim, tr: Omit<Trade, "day">) {
  const e = estateOf(s);
  e.trades = [...e.trades, { day: s.day, ...tr }].slice(-80);
}

function npcState(s: Sim, id: OwnerId) {
  return id === "state" || id === "people" ? null : s.npcs.find((n) => n.id === id) ?? null;
}

function pay(s: Sim, from: OwnerId, to: OwnerId, amount: number) {
  if (from === "state") {
    s.coins -= amount;
    s.ytd.spend += amount;
  } else {
    const n = npcState(s, from);
    if (n) n.cash -= amount;
  }
  if (to === "state") {
    s.coins += amount;
    s.ytd.income += amount;
  } else {
    const n = npcState(s, to);
    if (n) n.cash += amount;
  }
}

function setOwner(s: Sim, b: Building, to: OwnerId) {
  const e = estateOf(s);
  const k = lotKey(b);
  e.owners = { ...e.owners, [k]: to };
  e.leases = e.leases.filter((l) => l.id !== k);
}

const findBuilding = (s: Sim, id: string) => s.buildings.find((b) => b.id === id || lotKey(b) === id) ?? null;

export type EstateAct = { ok: true; msg?: string } | { ok: false; msg: string };

/** The state buys a private property at market value plus 5%. */
export function buyProperty(s: Sim, id: string): EstateAct {
  const b = findBuilding(s, id);
  if (!b) return { ok: false, msg: t("العقار غير موجود") };
  const owner = ownerOf(s, b);
  if (!owner) return { ok: false, msg: t("هذه أرض عامة لا تُباع ولا تُشترى") };
  if (owner === "state") return { ok: false, msg: t("العقار من أملاك الدولة أصلاً") };
  const price = Math.round(propertyValue(s, b) * 1.05);
  if (s.coins < price) return { ok: false, msg: t("الرصيد ما يكفي") };
  pay(s, "state", owner, price);
  setOwner(s, b, "state");
  record(s, { id: lotKey(b), kind: b.kind, from: owner, to: "state", price, type: "sale" });
  const entry = msg("الدولة اشترت {kind} من {owner} بـ {amount} د.ك", { kind: CATALOG[b.kind].name, owner: ownerName(owner), amount: price });
  pushLog(s, entry);
  return { ok: true, msg: entry };
}

/** The state sells one of its private properties to a merchant or to an individual. */
export function sellProperty(s: Sim, id: string, to: OwnerId, price?: number): EstateAct {
  const b = findBuilding(s, id);
  if (!b) return { ok: false, msg: t("العقار غير موجود") };
  if (ownerOf(s, b) !== "state") return { ok: false, msg: t("تقدر تبيع أملاك الدولة فقط") };
  if (to === "state") return { ok: false, msg: t("اختر المشتري") };
  const value = propertyValue(s, b);
  const ask = Math.round(price ?? value);
  // Buyers walk away from a price far above the market.
  if (ask > value * 1.3) return { ok: false, msg: t("السعر أعلى من السوق بكثير، رفض المشتري") };
  const n = npcState(s, to);
  if (n && n.cash < ask) return { ok: false, msg: t("{name} ما عنده سيولة تكفي", { name: ownerName(to) }) };
  pay(s, to, "state", ask);
  setOwner(s, b, to);
  record(s, { id: lotKey(b), kind: b.kind, from: "state", to, price: ask, type: "sale" });
  const entry = msg("الدولة باعت {kind} إلى {owner} بـ {amount} د.ك", { kind: CATALOG[b.kind].name, owner: ownerName(to), amount: ask });
  pushLog(s, entry);
  return { ok: true, msg: entry };
}

/** The state gives a property away: to individuals (a housing grant) or a merchant. */
export function grantProperty(s: Sim, id: string, to: OwnerId): EstateAct {
  const b = findBuilding(s, id);
  if (!b) return { ok: false, msg: t("العقار غير موجود") };
  if (ownerOf(s, b) !== "state") return { ok: false, msg: t("تقدر تمنح أملاك الدولة فقط") };
  if (to === "state") return { ok: false, msg: t("اختر من تمنحه") };
  setOwner(s, b, to);
  record(s, { id: lotKey(b), kind: b.kind, from: "state", to, price: 0, type: "grant" });
  if (to === "people") s.fame = Math.min(12, (s.fame ?? 0) + 0.2);
  const entry = msg("منحة: {kind} من أملاك الدولة إلى {owner}", { kind: CATALOG[b.kind].name, owner: ownerName(to) });
  pushLog(s, entry);
  return { ok: true, msg: entry };
}

/** The state leases one of its properties for a number of months. */
export function leaseProperty(s: Sim, id: string, tenant: OwnerId, months: number): EstateAct {
  const b = findBuilding(s, id);
  if (!b) return { ok: false, msg: t("العقار غير موجود") };
  if (ownerOf(s, b) !== "state") return { ok: false, msg: t("تقدر تؤجّر أملاك الدولة فقط") };
  if (tenant === "state") return { ok: false, msg: t("اختر المستأجر") };
  const e = estateOf(s);
  if (e.leases.some((l) => l.id === lotKey(b))) return { ok: false, msg: t("العقار مؤجَّر حالياً") };
  const rent = rentOf(s, b);
  months = Math.max(1, Math.min(120, Math.round(months)));
  e.leases = [...e.leases, { id: lotKey(b), tenant, rent, until: s.day + months * 30 }];
  record(s, { id: lotKey(b), kind: b.kind, from: "state", to: tenant, price: rent, type: "lease" });
  const entry = msg("تأجير {kind} إلى {owner}: {amount} د.ك شهرياً لمدة {months} شهر", { kind: CATALOG[b.kind].name, owner: ownerName(tenant), amount: rent, months });
  pushLog(s, entry);
  return { ok: true, msg: entry };
}

/** Land grants: individuals receive plots from state land and build homes on them. */
export function grantPlots(s: Sim, count: number): EstateAct {
  count = Math.max(1, Math.min(50, Math.round(count)));
  let done = 0;
  for (let i = 0; i < count; i += 1) {
    const lot = openLot(s);
    if (!lot) break;
    const price = priceOf(CATALOG.villa.cost, s);
    // The family builds its own home: the state gives the land only.
    s.coins += price;
    const before = s.buildings.length;
    if (!placeBuilding(s, "villa", lot.c, lot.r, 0).ok) {
      s.coins -= price;
      break;
    }
    const b = s.buildings[before]!;
    setOwner(s, b, "people");
    record(s, { id: lotKey(b), kind: b.kind, from: "state", to: "people", price: 0, type: "grant" });
    done += 1;
  }
  if (!done) return { ok: false, msg: t("ما في أرض فاضية بجانب الطرق") };
  s.fame = Math.min(12, (s.fame ?? 0) + done * 0.05);
  const entry = msg("منح {n} قسيمة سكنية للمواطنين من أراضي الدولة", { n: done });
  pushLog(s, entry);
  return { ok: true, msg: entry };
}

export const ALLOCATION_USES: { id: AllocationUse; name: string; blurb: string; w: number; h: number; pkg: "market" | "homes" | "services" }[] = [
  { id: "commercial", name: "مشروع تجاري", blurb: "محلات وأبراج مكاتب", w: 7, h: 5, pkg: "market" },
  { id: "residential", name: "مشروع سكني", blurb: "فلل وعمارات", w: 9, h: 7, pkg: "homes" },
  { id: "services", name: "مشروع خدمات", blurb: "مدارس ومستوصفات بإدارة خاصة", w: 7, h: 5, pkg: "services" },
];

/** The yearly fee the state can ask for a plot: a share of what the project earns. */
export function allocationFee(s: Sim, use: AllocationUse) {
  const u = ALLOCATION_USES.find((x) => x.id === use)!;
  return Math.round(u.w * u.h * 900 * estateOf(s).index * (0.8 + stats(s).happy / 250));
}

/**
 * A temporary allocation contract: the state hands a merchant a plot for some years;
 * the merchant builds the project and pays a yearly fee, and when the contract ends
 * the land and everything on it come back to the state.
 */
export function allocate(s: Sim, holder: NpcId, use: AllocationUse, years: number, fee: number): EstateAct {
  const u = ALLOCATION_USES.find((x) => x.id === use);
  if (!u) return { ok: false, msg: t("اختر نوع المشروع") };
  const n = npcState(s, holder);
  if (!n) return { ok: false, msg: t("اختر التاجر") };
  years = Math.max(1, Math.min(50, Math.round(years)));
  fee = Math.round(fee);
  const fair = allocationFee(s, use);
  if (fee > fair * 1.5) return { ok: false, msg: t("{name} رفض: الرسوم أعلى من قيمة الأرض", { name: ownerName(holder) }) };
  const build = u.w * u.h * 400;
  if (n.cash < fee + build) return { ok: false, msg: t("{name} ما عنده سيولة تكفي للمشروع", { name: ownerName(holder) }) };
  const site = findModelSite(s, u.w, u.h);
  if (!site) return { ok: false, msg: t("ما في أرض دولة فاضية تكفي المشروع") };
  const before = s.buildings.length;
  placePackage(s, u.pkg, s.day, site);
  const built = s.buildings.slice(before);
  if (!built.length) return { ok: false, msg: t("ما قدر يبني على الموقع") };
  n.cash -= build + fee;
  s.coins += fee;
  s.ytd.income += fee;
  const e = estateOf(s);
  const owners = { ...e.owners };
  for (const b of built) if (!isPublic(b.kind)) owners[lotKey(b)] = holder;
  e.owners = owners;
  const a: Allocation = {
    id: e.nextId++,
    holder,
    use,
    c: site.c,
    r: site.r,
    w: u.w,
    h: u.h,
    fee,
    start: s.day,
    until: s.day + years * 360,
    buildings: built.map(lotKey),
  };
  e.allocations = [...e.allocations, a];
  record(s, { id: lotKey(built[0]!), kind: built[0]!.kind, from: "state", to: holder, price: fee, type: "allocation" });
  const entry = msg("عقد تخصيص مؤقت: {name} يقيم {use} لمدة {years} سنة برسوم {amount} د.ك سنوياً", { name: ownerName(holder), use: u.name, years, amount: fee });
  pushLog(s, entry);
  return { ok: true, msg: entry };
}

/** End an allocation early: the state pays back the rest of this year's fee. */
export function endAllocation(s: Sim, id: number): EstateAct {
  const e = estateOf(s);
  const a = e.allocations.find((x) => x.id === id);
  if (!a) return { ok: false, msg: t("العقد غير موجود") };
  returnAllocation(s, a);
  return { ok: true };
}

function returnAllocation(s: Sim, a: Allocation) {
  const e = estateOf(s);
  const owners = { ...e.owners };
  const live = new Set(s.buildings.map(lotKey));
  for (const id of a.buildings) if (live.has(id)) owners[id] = "state";
  e.owners = owners;
  e.allocations = e.allocations.filter((x) => x.id !== a.id);
  const first = s.buildings.find((b) => lotKey(b) === a.buildings[0]);
  if (first) record(s, { id: lotKey(first), kind: first.kind, from: a.holder, to: "state", price: 0, type: "return" });
  pushLog(s, msg("انتهى عقد التخصيص مع {name}: رجعت الأرض ومبانيها لأملاك الدولة", { name: ownerName(a.holder) }));
}

/**
 * Month end: prices move with the mood and crises, merchants and individuals trade,
 * tenants pay their rent, allocation fees come in and finished contracts return.
 */
export function estateMonth(s: Sim, random = Math.random) {
  const e = estateOf(s);
  const st = stats(s);
  const crisis = s.crisis && s.day < s.crisis.until ? s.crisis.kind : null;
  // Mood and crises push prices; over time they drift back toward normal.
  const drift =
    (random() - 0.5) * 0.04 + (st.happy - 50) / 5000 + (crisis === "economic" ? -0.03 : 0) + (1 - e.index) * 0.02;
  e.index = Math.min(4, Math.max(0.4, e.index * (1 + drift)));
  // Rent from the state's tenants.
  // Lots that still have a building: made only when a month needs them (a big
  // city has tens of thousands, and most months have no leases to check).
  let liveSet: Set<string> | null = null;
  const live = { has: (k: string) => (liveSet ??= new Set(s.buildings.map(lotKey))).has(k) };
  let rent = 0;
  const leases: Lease[] = [];
  for (const l of e.leases) {
    if (!live.has(l.id) || l.until <= s.day) continue;
    const n = npcState(s, l.tenant);
    if (n) n.cash -= l.rent;
    rent += l.rent;
    leases.push(l);
  }
  e.leases = leases;
  if (rent > 0) {
    s.coins += rent;
    s.ytd.income += rent;
  }
  // Allocation fees, monthly, and contracts that have run out.
  for (const a of [...e.allocations]) {
    if (a.until <= s.day) {
      returnAllocation(s, a);
      continue;
    }
    const due = Math.round(a.fee / 12);
    const n = npcState(s, a.holder);
    if (n) n.cash -= due;
    s.coins += due;
    s.ytd.income += due;
  }
  marketMonth(s, random);
  // Forget owners of demolished buildings now and then.
  if (random() < 0.03 && Object.keys(e.owners).length > 0) {
    const owners: Record<string, OwnerId> = {};
    for (const [id, o] of Object.entries(e.owners)) if (live.has(id)) owners[id] = o;
    e.owners = owners;
  }
}

/**
 * The platform: every owner with how many properties they hold, their value and
 * their share of all private property. O(buildings), kept per month.
 */
const summaryMemo = new WeakMap<Estate, { key: string; out: OwnerSummary[] }>();
export type OwnerSummary = { owner: OwnerId; count: number; value: number; share: number; rent: number };

export function ownersSummary(s: Sim): OwnerSummary[] {
  const e = estateOf(s);
  const key = `${Math.floor(s.day / 30)}:${s.buildings.length}:${e.trades.length}:${e.trades[e.trades.length - 1]?.day ?? 0}:${e.index}`;
  const hit = summaryMemo.get(e);
  if (hit && hit.key === key) return hit.out;
  const by = new Map<OwnerId, OwnerSummary>();
  let total = 0;
  const mood = 0.8 + stats(s).happy / 250;
  for (const b of s.buildings) {
    const o = ownerOf(s, b);
    if (!o) continue;
    const v = CATALOG[b.kind].cost * 40 * (1 + (b.level - 1) * 0.8) * mood * e.index;
    const row = by.get(o) ?? { owner: o, count: 0, value: 0, share: 0, rent: 0 };
    row.count += 1;
    row.value += v;
    row.rent += v * 0.006;
    by.set(o, row);
    total += v;
  }
  const out = [...by.values()]
    .map((r) => ({ ...r, value: Math.round(r.value), rent: Math.round(r.rent), share: total > 0 ? r.value / total : 0 }))
    .sort((a, b) => b.value - a.value);
  summaryMemo.set(e, { key, out });
  return out;
}

/** An owner's properties, most valuable first (for the platform's detail view). */
export function propertiesOf(s: Sim, owner: OwnerId, limit = 40) {
  const out: { b: Building; value: number; leased: boolean }[] = [];
  const e = estateOf(s);
  const leased = new Set(e.leases.map((l) => l.id));
  for (const b of s.buildings) if (ownerOf(s, b) === owner) out.push({ b, value: 0, leased: leased.has(lotKey(b)) });
  out.sort((a, b) => CATALOG[b.b.kind].cost * b.b.level - CATALOG[a.b.kind].cost * a.b.level);
  return out.slice(0, limit).map((x) => ({ ...x, value: propertyValue(s, x.b) }));
}

/** Public lots and private lots, for the report. */
export function landSplit(s: Sim) {
  let pub = 0;
  let priv = 0;
  for (const b of s.buildings) if (isPublic(b.kind)) pub += 1;
  else priv += 1;
  return { pub, priv, roads: s.roads.length };
}

/** The ownership map: one colour per building lot (allocation plots stand out). */
export function ownershipColors(s: Sim): Map<string, string> {
  const e = estateOf(s);
  const allotted = new Set(e.allocations.flatMap((a) => a.buildings));
  const out = new Map<string, string>();
  for (const b of s.buildings) {
    const o = ownerOf(s, b);
    out.set(
      b.id,
      !o
        ? OWNER_COLORS.public!
        : allotted.has(lotKey(b))
          ? OWNER_COLORS.allocation!
          : o === "state"
            ? OWNER_COLORS.state!
            : o === "people"
              ? OWNER_COLORS.people!
              : OWNER_COLORS.merchant!,
    );
  }
  return out;
}

export function loadEstate(raw: unknown): Estate {
  const e = emptyEstate();
  if (!raw || typeof raw !== "object") return e;
  const p = raw as Partial<Estate>;
  const valid = (o: unknown): o is OwnerId =>
    o === "state" || o === "people" || NPCS.some((n) => n.id === o);
  if (p.owners && typeof p.owners === "object")
    for (const [id, o] of Object.entries(p.owners)) if (valid(o)) e.owners[id] = o;
  const idx = Number(p.index);
  e.index = Number.isFinite(idx) ? Math.min(4, Math.max(0.4, idx)) : 1;
  if (Array.isArray(p.trades))
    e.trades = p.trades
      .filter((x) => x && typeof x === "object" && valid(x.from) && valid(x.to) && x.kind in CATALOG)
      .map((x) => ({ day: Number(x.day) || 0, id: String(x.id), kind: x.kind, from: x.from, to: x.to, price: Math.max(0, Number(x.price) || 0), type: x.type }))
      .slice(-80);
  if (Array.isArray(p.leases))
    e.leases = p.leases
      .filter((x) => x && valid(x.tenant))
      .map((x) => ({ id: String(x.id), tenant: x.tenant, rent: Math.max(0, Number(x.rent) || 0), until: Number(x.until) || 0 }));
  if (Array.isArray(p.allocations))
    e.allocations = p.allocations
      .filter((x) => x && NPCS.some((n) => n.id === x.holder) && Array.isArray(x.buildings))
      .map((x) => ({ ...x, buildings: x.buildings.map(String) }));
  const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
  if (Array.isArray(p.listings))
    e.listings = p.listings
      .filter((x) => x && valid(x.seller) && x.kind in CATALOG)
      .map((x) => ({ id: num(x.id), lot: String(x.lot), kind: x.kind, seller: x.seller, ask: Math.max(1, num(x.ask)), until: num(x.until), countered: !!x.countered }));
  if (Array.isArray(p.auctions))
    e.auctions = p.auctions
      .filter((x) => x && x.kind in CATALOG)
      .map((x) => ({ id: num(x.id), lot: String(x.lot), kind: x.kind, min: Math.max(0, num(x.min)), until: num(x.until) }));
  e.fee = Math.min(20, Math.max(0, num(p.fee, 2)));
  e.feeTotal = Math.max(0, num(p.feeTotal));
  if (Array.isArray(p.history))
    e.history = p.history
      .filter((x) => x && Number.isFinite(Number(x.day)))
      .map((x) => ({ day: num(x.day), index: num(x.index, 1), volume: Math.max(0, num(x.volume)), count: Math.max(0, num(x.count)) }))
      .slice(-120);
  e.volume = Math.max(0, num(p.volume));
  e.count = Math.max(0, num(p.count));
  e.nextId = Math.max(
    1,
    Number(p.nextId) || 1,
    ...e.allocations.map((a) => a.id + 1),
    ...e.listings.map((l) => l.id + 1),
    ...e.auctions.map((l) => l.id + 1),
  );
  return e;
}

export const cloneEstate = (e: Estate | undefined): Estate | undefined =>
  e
    ? {
        ...e,
        trades: [...e.trades],
        leases: [...e.leases],
        allocations: e.allocations.map((a) => ({ ...a })),
        listings: (e.listings ?? []).map((l) => ({ ...l })),
        auctions: (e.auctions ?? []).map((l) => ({ ...l })),
        history: [...(e.history ?? [])],
      }
    : undefined;

// ---------------------------------------------------------------- the market

/** Building on a lot; the index is rebuilt only when the city has changed. */
const lotIndex = new WeakMap<Sim, { n: number; first: Building | undefined; map: Map<string, Building> }>();
function lotOf(s: Sim, lot: string) {
  let ix = lotIndex.get(s);
  if (!ix || ix.n !== s.buildings.length || ix.first !== s.buildings[0]) {
    ix = { n: s.buildings.length, first: s.buildings[0], map: new Map(s.buildings.map((b) => [lotKey(b), b])) };
    lotIndex.set(s, ix);
  }
  return ix.map.get(lot) ?? null;
}

/** Fewer deals the higher the registration fee: none lost at 0%, a third at 5%, most at 15%. */
const activity = (e: Estate) => Math.max(0.15, 1 - e.fee / 15);

/**
 * A sale on the market: the buyer pays the seller, and the registration fee on top
 * to the state (the state itself pays no fee to itself).
 */
function executeSale(s: Sim, b: Building, from: OwnerId, to: OwnerId, price: number, type: Trade["type"] = "sale") {
  const e = estateOf(s);
  pay(s, to, from, price);
  if (from !== "state" && to !== "state" && e.fee > 0) {
    const fee = Math.round((price * e.fee) / 100);
    pay(s, to, "state", fee);
    e.feeTotal += fee;
  }
  setOwner(s, b, to);
  record(s, { id: lotKey(b), kind: b.kind, from, to, price, type });
  e.volume += price;
  e.count += 1;
  e.listings = e.listings.filter((l) => l.lot !== lotKey(b));
}

const BIDDERS = (): OwnerId[] => ["people", ...NPCS.map((n) => n.id)];

function canPay(s: Sim, who: OwnerId, amount: number) {
  const n = npcState(s, who);
  return !n || n.cash >= amount;
}

function marketMonth(s: Sim, random: () => number) {
  const e = estateOf(s);
  const act = activity(e);
  const listed = new Set(e.listings.map((l) => l.lot));
  const allotted = new Set(e.allocations.flatMap((a) => a.buildings));
  // Owners put properties up for sale.
  const pool = s.buildings;
  const fresh = pool.length ? Math.round((2 + random() * 4) * act) : 0;
  for (let i = 0; i < fresh; i += 1) {
    const b = pool[Math.floor(random() * pool.length)]!;
    const seller = ownerOf(s, b);
    const k = lotKey(b);
    if (!seller || seller === "state" || listed.has(k) || allotted.has(k)) continue;
    listed.add(k);
    e.listings.push({
      id: e.nextId++,
      lot: k,
      kind: b.kind,
      seller,
      ask: Math.round(propertyValue(s, b) * (0.95 + random() * 0.3)),
      until: s.day + 90,
    });
  }
  // Buyers take the fairly priced ones.
  for (const l of [...e.listings]) {
    const b = lotOf(s, l.lot);
    if (!b || ownerOf(s, b) !== l.seller) {
      e.listings = e.listings.filter((x) => x.id !== l.id);
      continue;
    }
    const value = propertyValue(s, b);
    const odds = 0.35 * act * Math.min(2, (value / l.ask) ** 3);
    if (random() < odds) {
      const buyers = BIDDERS().filter((x) => x !== l.seller && canPay(s, x, l.ask * (1 + e.fee / 100)));
      if (buyers.length) {
        const to = buyers[Math.floor(random() * buyers.length)]!;
        executeSale(s, b, l.seller, to, l.ask);
        if (l.seller === "state")
          pushLog(s, msg("بيع عقار الدولة المعروض ({kind}) إلى {owner} بـ {amount} د.ك", { kind: CATALOG[b.kind].name, owner: ownerName(to), amount: l.ask }));
        continue;
      }
    }
    if (l.until <= s.day) e.listings = e.listings.filter((x) => x.id !== l.id);
  }
  // Auctions that have run their month.
  for (const a of [...e.auctions]) if (a.until <= s.day) resolveAuction(s, a, random);
  // The month joins the price history.
  e.history = [...e.history, { day: s.day, index: e.index, volume: e.volume, count: e.count }].slice(-120);
  e.volume = 0;
  e.count = 0;
}

/** The state buys a listed property at the asking price. */
export function buyListing(s: Sim, id: number): EstateAct {
  const e = estateOf(s);
  const l = e.listings.find((x) => x.id === id);
  if (!l) return { ok: false, msg: t("العرض انتهى") };
  if (l.seller === "state") return { ok: false, msg: t("هذا عرض من أملاك الدولة") };
  const b = lotOf(s, l.lot);
  if (!b) return { ok: false, msg: t("العقار غير موجود") };
  if (s.coins < l.ask) return { ok: false, msg: t("الرصيد ما يكفي") };
  executeSale(s, b, l.seller, "state", l.ask);
  const entry = msg("الدولة اشترت {kind} من {owner} بـ {amount} د.ك", { kind: CATALOG[b.kind].name, owner: ownerName(l.seller), amount: l.ask });
  pushLog(s, entry);
  return { ok: true, msg: entry };
}

/**
 * The state offers a price for a listed property. Individuals take 90% of their
 * asking price and merchants 95%; a lower but serious offer (80% of the value or
 * more) gets a counter-offer halfway; anything less is turned down.
 */
export function makeOffer(s: Sim, id: number, price: number): EstateAct {
  const e = estateOf(s);
  const l = e.listings.find((x) => x.id === id);
  if (!l) return { ok: false, msg: t("العرض انتهى") };
  if (l.seller === "state") return { ok: false, msg: t("هذا عرض من أملاك الدولة") };
  const b = lotOf(s, l.lot);
  if (!b) return { ok: false, msg: t("العقار غير موجود") };
  price = Math.round(price);
  if (!(price > 0)) return { ok: false, msg: t("اكتب السعر") };
  if (s.coins < price) return { ok: false, msg: t("الرصيد ما يكفي") };
  const accept = l.seller === "people" ? 0.9 : 0.95;
  if (price >= l.ask * accept) {
    executeSale(s, b, l.seller, "state", price);
    const entry = msg("قبل {owner} عرضك: الدولة اشترت {kind} بـ {amount} د.ك", { owner: ownerName(l.seller), kind: CATALOG[b.kind].name, amount: price });
    pushLog(s, entry);
    return { ok: true, msg: entry };
  }
  if (price >= propertyValue(s, b) * 0.8 && !l.countered) {
    const counter = Math.round((l.ask + price) / 2);
    e.listings = e.listings.map((x) => (x.id === id ? { ...x, ask: counter, countered: true } : x));
    return { ok: true, msg: msg("{owner} رد بعرض مقابل: {amount} د.ك", { owner: ownerName(l.seller), amount: counter }) };
  }
  return { ok: false, msg: t("{name} رفض عرضك", { name: ownerName(l.seller) }) };
}

/** The state puts one of its properties on the market at its own price. */
export function listForSale(s: Sim, buildingId: string, ask: number): EstateAct {
  const b = findBuilding(s, buildingId);
  if (!b) return { ok: false, msg: t("العقار غير موجود") };
  if (ownerOf(s, b) !== "state") return { ok: false, msg: t("تقدر تبيع أملاك الدولة فقط") };
  const e = estateOf(s);
  const k = lotKey(b);
  if (e.listings.some((l) => l.lot === k) || e.auctions.some((a) => a.lot === k)) return { ok: false, msg: t("العقار معروض أصلاً") };
  ask = Math.round(ask);
  if (!(ask > 0)) return { ok: false, msg: t("اكتب السعر") };
  e.listings = [...e.listings, { id: e.nextId++, lot: k, kind: b.kind, seller: "state", ask, until: s.day + 180 }];
  return { ok: true, msg: msg("عرضت {kind} للبيع بـ {amount} د.ك", { kind: CATALOG[b.kind].name, amount: ask }) };
}

export function cancelListing(s: Sim, id: number): EstateAct {
  const e = estateOf(s);
  const l = e.listings.find((x) => x.id === id);
  if (!l || l.seller !== "state") return { ok: false, msg: t("تقدر تسحب عروض الدولة فقط") };
  e.listings = e.listings.filter((x) => x.id !== id);
  return { ok: true, msg: t("سحبت العرض من السوق") };
}

/** A state property goes to auction for a month, with a minimum price. */
export function startAuction(s: Sim, buildingId: string, min: number): EstateAct {
  const b = findBuilding(s, buildingId);
  if (!b) return { ok: false, msg: t("العقار غير موجود") };
  if (ownerOf(s, b) !== "state") return { ok: false, msg: t("المزاد لأملاك الدولة فقط") };
  const e = estateOf(s);
  const k = lotKey(b);
  if (e.auctions.some((a) => a.lot === k) || e.listings.some((l) => l.lot === k)) return { ok: false, msg: t("العقار معروض أصلاً") };
  e.auctions = [...e.auctions, { id: e.nextId++, lot: k, kind: b.kind, min: Math.max(0, Math.round(min)), until: s.day + 30 }];
  const entry = msg("طرح {kind} في مزاد علني بحد أدنى {amount} د.ك", { kind: CATALOG[b.kind].name, amount: Math.round(min) });
  pushLog(s, entry);
  return { ok: true, msg: entry };
}

function resolveAuction(s: Sim, a: Auction, random: () => number) {
  const e = estateOf(s);
  e.auctions = e.auctions.filter((x) => x.id !== a.id);
  const b = lotOf(s, a.lot);
  if (!b || ownerOf(s, b) !== "state") return;
  const value = propertyValue(s, b);
  let best: { who: OwnerId; bid: number } | null = null;
  let bidders = 0;
  for (const who of BIDDERS()) {
    if (random() > 0.75) continue;
    let bid = Math.round(value * (0.85 + random() * 0.45));
    const n = npcState(s, who);
    if (n) bid = Math.min(bid, Math.floor(n.cash));
    if (bid < a.min) continue;
    bidders += 1;
    if (!best || bid > best.bid) best = { who, bid };
  }
  if (!best) {
    pushLog(s, msg("المزاد على {kind} انتهى بدون بيع: ما وصل أحد للحد الأدنى", { kind: CATALOG[b.kind].name }));
    return;
  }
  executeSale(s, b, "state", best.who, best.bid);
  pushLog(
    s,
    msg("رسى المزاد على {owner}: {kind} بـ {amount} د.ك ({n} مزايدين)", { owner: ownerName(best.who), kind: CATALOG[b.kind].name, amount: best.bid, n: bidders }),
  );
}

export function setRegistrationFee(s: Sim, pct: number) {
  estateOf(s).fee = Math.min(20, Math.max(0, Math.round(pct * 10) / 10));
}

/** Renew an allocation contract: more years, at today's fair fee if that is higher. */
export function renewAllocation(s: Sim, id: number, years: number): EstateAct {
  const e = estateOf(s);
  const a = e.allocations.find((x) => x.id === id);
  if (!a) return { ok: false, msg: t("العقد غير موجود") };
  const n = npcState(s, a.holder);
  const fee = Math.max(a.fee, allocationFee(s, a.use));
  if (n && n.cash < fee) return { ok: false, msg: t("{name} ما عنده سيولة تكفي", { name: ownerName(a.holder) }) };
  years = Math.max(1, Math.min(50, Math.round(years)));
  e.allocations = e.allocations.map((x) => (x.id === id ? { ...x, fee, until: x.until + years * 360 } : x));
  const entry = msg("تجديد عقد التخصيص مع {name} {years} سنة برسوم {amount} د.ك سنوياً", { name: ownerName(a.holder), years, amount: fee });
  pushLog(s, entry);
  return { ok: true, msg: entry };
}

/** Typical prices now, for the market screen. */
export function typicalPrices(s: Sim) {
  const e = estateOf(s);
  const mood = 0.8 + stats(s).happy / 250;
  return (["villa", "apartments", "shop", "tower"] as Kind[]).map((k) => ({ kind: k, price: Math.round(CATALOG[k].cost * 40 * mood * e.index) }));
}
