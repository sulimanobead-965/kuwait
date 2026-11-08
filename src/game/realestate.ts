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

export type Estate = {
  /** Owner of each building that changed hands (default owner otherwise). */
  owners: Record<string, OwnerId>;
  /** The property market: 1 = normal prices. */
  index: number;
  trades: Trade[];
  leases: Lease[];
  allocations: Allocation[];
  nextId: number;
};

export const emptyEstate = (): Estate => ({ owners: {}, index: 1, trades: [], leases: [], allocations: [], nextId: 1 });

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
  const drift = (random() - 0.5) * 0.04 + (st.happy - 50) / 5000 + (crisis === "economic" ? -0.03 : 0);
  e.index = Math.min(4, Math.max(0.4, e.index * (1 + drift)));
  // Rent from the state's tenants.
  const live = new Map(s.buildings.map((b) => [lotKey(b), b]));
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
  // The market: a few private properties change hands between owners every month.
  const pool = s.buildings;
  if (pool.length > 0) {
    const deals = 1 + Math.floor(random() * 3);
    for (let i = 0; i < deals; i += 1) {
      const b = pool[Math.floor(random() * pool.length)]!;
      const from = ownerOf(s, b);
      if (!from || from === "state") continue;
      if (e.allocations.some((a) => a.buildings.includes(lotKey(b)))) continue;
      const buyers: OwnerId[] = ["people", ...NPCS.map((n) => n.id)].filter((x) => x !== from) as OwnerId[];
      const to = buyers[Math.floor(random() * buyers.length)]!;
      const price = Math.round(propertyValue(s, b) * (0.9 + random() * 0.25));
      const buyer = npcState(s, to);
      if (buyer && buyer.cash < price) continue;
      pay(s, to, from, price);
      setOwner(s, b, to);
      record(s, { id: lotKey(b), kind: b.kind, from, to, price, type: "sale" });
    }
  }
  // Forget owners of demolished buildings now and then.
  if (random() < 0.1) {
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
  e.nextId = Math.max(1, Number(p.nextId) || 1, ...e.allocations.map((a) => a.id + 1));
  return e;
}

export const cloneEstate = (e: Estate | undefined): Estate | undefined =>
  e ? { ...e, trades: [...e.trades], leases: [...e.leases], allocations: e.allocations.map((a) => ({ ...a })) } : undefined;
