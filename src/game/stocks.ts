/**
 * The stock market: shares in the companies that operate in the game — the banks,
 * the developers, the insurer and the consultancy. Prices move every month with the
 * economy and each company's fortunes (a bankruptcy crashes its shares). The player
 * buys and sells stakes by percentage of the company (e.g. 5٪), and holders are paid
 * a yearly dividend (a share of the stake's value) while the company is solvent.
 */
import { msg, t, bigNum } from "../i18n/index.ts";
import { COMPANIES, INSURER } from "./finance";
import { DEVELOPERS } from "./developments";
import type { Sim } from "./sim";
import { NPCS, type NpcId } from "./npcs";
import { book } from "./ledger";

/** A built-in company, or a company listed later (an id like "c12"). */
export type StockId = BuiltinStock | (string & {});
type BuiltinStock =
  | "bank"
  | "islamic"
  | "insurer"
  | "consultant"
  | "marsa"
  | "khaleej"
  | "jazeera"
  | "dar";

export type StockDef = {
  name: string;
  sector: string;
  /** Market value of the whole company (KD) at price index 1. */
  cap: number;
  /** Yearly dividend as a share of the stake's value. */
  yield: number;
  /** Monthly price swing. */
  vol: number;
};

export const STOCKS: Record<BuiltinStock, StockDef> = {
  bank: { name: COMPANIES.bank.name, sector: "بنوك", cap: 80_000_000, yield: 0.05, vol: 0.04 },
  islamic: { name: COMPANIES.islamic.name, sector: "بنوك", cap: 60_000_000, yield: 0.055, vol: 0.035 },
  insurer: { name: INSURER, sector: "تأمين", cap: 25_000_000, yield: 0.06, vol: 0.03 },
  consultant: { name: COMPANIES.consultant.name, sector: "خدمات", cap: 5_000_000, yield: 0.04, vol: 0.05 },
  marsa: { name: DEVELOPERS.marsa.name, sector: "عقار", cap: 40_000_000, yield: 0.05, vol: 0.06 },
  khaleej: { name: DEVELOPERS.khaleej.name, sector: "عقار", cap: 30_000_000, yield: 0.07, vol: 0.09 },
  jazeera: { name: DEVELOPERS.jazeera.name, sector: "عقار", cap: 35_000_000, yield: 0.045, vol: 0.03 },
  dar: { name: DEVELOPERS.dar.name, sector: "عقار", cap: 15_000_000, yield: 0.05, vol: 0.06 },
};

export const STOCK_IDS = Object.keys(STOCKS) as BuiltinStock[];

/** A company listed on the market during the game (by a merchant's offering or by hand). */
export type ListedCompany = StockDef & { capital: number; founder: NpcId | "state" | "manual"; since: number };
/** A merchant asking to list a new company; the governor approves it first. */
export type IpoRequest = { id: string; name: string; sector: string; capital: number; cap: number; founder: NpcId; until: number };

/** Every company on the market now. */
export function stockIds(s: Sim): StockId[] {
  return [...STOCK_IDS, ...Object.keys(s.stocks.listed ?? {})];
}

export function stockDef(s: Sim, id: StockId): StockDef {
  return (STOCKS as Record<string, StockDef>)[id] ?? s.stocks.listed?.[id] ?? { name: id, sector: "", cap: 1, yield: 0, vol: 0 };
}

export type StockState = {
  /** Price index (1 = listing price). */
  price: Record<StockId, number>;
  /** Monthly prices, oldest first (up to 24). */
  history: Record<StockId, number[]>;
  /** Stake held, as a fraction of the company (0.05 = 5٪). */
  own: Record<StockId, number>;
  /** What the current stake cost. */
  paid: Record<StockId, number>;
  /** Dividends received over the whole game. */
  dividends: number;
  /** Whether each company was down last month (to price in its recovery). */
  wasDown: Record<StockId, boolean>;
  /** Companies listed during the game. */
  listed: Record<string, ListedCompany>;
  /** Merchants' listing requests waiting for approval. */
  ipos: IpoRequest[];
  nextId: number;
};

const each = <T>(f: (id: StockId) => T) => Object.fromEntries(STOCK_IDS.map((id) => [id, f(id)])) as Record<StockId, T>;

export function emptyStocks(): StockState {
  return {
    price: each(() => 1),
    history: each(() => [1]),
    own: each(() => 0),
    paid: each(() => 0),
    dividends: 0,
    wasDown: each(() => false),
    listed: {},
    ipos: [],
    nextId: 1,
  };
}

export function loadStocks(raw: unknown): StockState {
  const st = emptyStocks();
  if (!raw || typeof raw !== "object") return st;
  const p = raw as Partial<StockState>;
  const n = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
  if (p.listed && typeof p.listed === "object")
    for (const [id, c] of Object.entries(p.listed))
      if (c && typeof c.name === "string")
        st.listed[id] = {
          name: c.name.slice(0, 40),
          sector: String(c.sector ?? ""),
          cap: Math.max(1, n(c.cap, 1)),
          capital: Math.max(0, n(c.capital, 0)),
          yield: Math.min(0.3, Math.max(0, n(c.yield, 0.05))),
          vol: Math.min(0.3, Math.max(0, n(c.vol, 0.05))),
          founder: (c.founder ?? "manual") as ListedCompany["founder"],
          since: n(c.since, 0),
        };
  if (Array.isArray(p.ipos))
    st.ipos = p.ipos
      .filter((x) => x && typeof x.name === "string" && NPCS.some((m) => m.id === x.founder))
      .map((x) => ({ id: String(x.id), name: x.name, sector: String(x.sector), capital: n(x.capital, 0), cap: Math.max(1, n(x.cap, 1)), founder: x.founder, until: n(x.until, 0) }));
  st.nextId = Math.max(1, n(p.nextId, 1));
  for (const id of [...STOCK_IDS, ...Object.keys(st.listed)]) {
    st.price[id] = Math.max(0.01, n(p.price?.[id], 1));
    const h = p.history?.[id];
    st.history[id] = Array.isArray(h) ? h.map((x) => Math.max(0.01, n(x, 1))).slice(-24) : [st.price[id]];
    st.own[id] = Math.min(1, Math.max(0, n(p.own?.[id], 0)));
    st.paid[id] = Math.max(0, n(p.paid?.[id], 0));
    st.wasDown[id] = Boolean(p.wasDown?.[id]);
  }
  st.dividends = Math.max(0, n(p.dividends, 0));
  return st;
}

/** Is the company bankrupt and closed right now? */
export function stockDown(s: Sim, id: StockId) {
  if (s.stocks.listed?.[id]) return false;
  const f = s.finance;
  if (id === "bank" || id === "islamic" || id === "consultant") return (f.down[id as "bank"] ?? 0) > s.day;
  if (id === "marsa") return (f.down.developer ?? 0) > s.day;
  if (id === "insurer") return false;
  return (f.devDown[id] ?? 0) > s.day;
}

/** Value of a stake of `pct` (0–1) at today's price. */
export function stakeValue(s: Sim, id: StockId, pct: number) {
  return stockDef(s, id).cap * (s.stocks.price[id] ?? 1) * pct;
}

export function portfolio(s: Sim) {
  let value = 0,
    paid = 0;
  for (const id of stockIds(s)) {
    value += stakeValue(s, id, s.stocks.own[id] ?? 0);
    paid += s.stocks.paid[id] ?? 0;
  }
  return { value, paid, gain: value - paid };
}

const fmt = (n: number) => bigNum(n);
const pctText = (p: number) => `${Math.round(p * 10000) / 100}`;

/** Buy `pct` percent of a company (e.g. 5 = 5٪). */
export function buyStock(s: Sim, id: StockId, pct: number) {
  const frac = pct / 100;
  if (!(frac > 0)) return { ok: false, msg: t("نسبة غير صحيحة") };
  if (stockDown(s, id)) return { ok: false, msg: t("التداول موقوف: الشركة مفلسة") };
  if ((s.stocks.own[id] ?? 0) + frac > 1 + 1e-9) return { ok: false, msg: t("لا يمكن تملك أكثر من ١٠٠٪ من الشركة") };
  const cost = stakeValue(s, id, frac);
  if (s.coins < cost) return { ok: false, msg: t("تحتاج {amount} د.ك لهذه الحصة", { amount: fmt(cost) }) };
  s.coins -= cost;
  s.stocks.own[id] = (s.stocks.own[id] ?? 0) + frac;
  s.stocks.paid[id] = (s.stocks.paid[id] ?? 0) + cost;
  return {
    ok: true,
    msg: t("اشتريت {pct}٪ من {name} بـ {amount} د.ك", { pct: pctText(frac), name: stockDef(s, id).name, amount: fmt(cost) }),
  };
}

/** Sell `pct` percent of a company from the stake held. */
export function sellStock(s: Sim, id: StockId, pct: number) {
  const own = s.stocks.own[id] ?? 0;
  const frac = Math.min(own, pct / 100);
  if (!(frac > 0)) return { ok: false, msg: t("ما عندك أسهم في هذه الشركة") };
  if (stockDown(s, id)) return { ok: false, msg: t("التداول موقوف: الشركة مفلسة") };
  const value = stakeValue(s, id, frac);
  const basis = s.stocks.paid[id] * (frac / own);
  s.coins += value;
  s.stocks.own[id] = Math.max(0, own - frac);
  s.stocks.paid[id] = Math.max(0, s.stocks.paid[id] - basis);
  if (s.stocks.own[id] < 1e-9) {
    s.stocks.own[id] = 0;
    s.stocks.paid[id] = 0;
  }
  const gain = value - basis;
  book(s, "stocks", gain, basis);
  return {
    ok: true,
    msg:
      gain >= 0
        ? t("بعت {pct}٪ من {name} بـ {amount} د.ك (ربح {gain})", { pct: pctText(frac), name: stockDef(s, id).name, amount: fmt(value), gain: fmt(gain) })
        : t("بعت {pct}٪ من {name} بـ {amount} د.ك (خسارة {gain})", { pct: pctText(frac), name: stockDef(s, id).name, amount: fmt(value), gain: fmt(-gain) }),
  };
}

export type MarketMood = { economic: boolean; war: boolean; pandemic: boolean };

/** One month of trading: prices drift with the economy and each company's health. */
export function stockMonth(s: Sim, mood: MarketMood, random: () => number = Math.random) {
  const st = s.stocks;
  ipoMonth(s, Math.random);
  for (const id of stockIds(s)) {
    const def = stockDef(s, id);
    let p = st.price[id] ?? 1;
    const down = stockDown(s, id);
    if (down && !st.wasDown[id]) p *= 0.15; // bankruptcy wipes most of the value
    else if (!down && st.wasDown[id]) p *= 2.2; // relisted after recovery
    else if (!down) {
      let drift = 0.006 + (random() - 0.5) * 2 * def.vol;
      if (mood.economic) drift -= id === "bank" || id === "islamic" ? 0.07 : 0.05;
      if (mood.war) drift -= 0.04;
      if (mood.pandemic) drift -= id === "insurer" ? 0.04 : 0.015;
      // Developers do well when they have projects running in the city.
      if (def.sector === "عقار" && s.sites.some((x) => (x.developer ?? "marsa") === id)) drift += 0.01;
      p *= 1 + drift;
    }
    st.wasDown[id] = down;
    st.price[id] = Math.min(50, Math.max(0.02, p));
    st.history[id] = [...(st.history[id] ?? []), st.price[id]].slice(-24);
  }
}

/** Year end: dividends on every stake in a solvent company. */
export function stockYear(s: Sim) {
  let total = 0;
  for (const id of stockIds(s)) {
    if ((s.stocks.own[id] ?? 0) <= 0 || stockDown(s, id)) continue;
    total += stakeValue(s, id, s.stocks.own[id]!) * stockDef(s, id).yield;
  }
  if (total <= 0) return null;
  book(s, "stocks", total, stockIds(s).reduce((n, id) => n + (s.stocks.paid[id] ?? 0), 0));
  s.coins += total;
  s.ytd.income += total;
  s.stocks.dividends += total;
  return msg("أرباح الأسهم السنوية: {amount} د.ك", { amount: fmt(total) });
}

// ---------------------------------------------------------------- new listings

const SECTORS = ["عقار", "بنوك", "تجارة", "صناعة", "خدمات", "تقنية", "طاقة"];
const SUFFIX: Record<string, string> = {
  عقار: "العقارية",
  بنوك: "للتمويل",
  تجارة: "التجارية",
  صناعة: "الصناعية",
  خدمات: "للخدمات",
  تقنية: "للتقنية",
  طاقة: "للطاقة",
};

function addListing(s: Sim, c: ListedCompany) {
  const st = s.stocks;
  st.listed ??= {};
  const id = `c${st.nextId++}`;
  st.listed[id] = c;
  st.price[id] = 1;
  st.history[id] = [1];
  st.own[id] = 0;
  st.paid[id] = 0;
  st.wasDown[id] = false;
  return id;
}

/** Monthly: now and then a merchant asks to take a company public. */
function ipoMonth(s: Sim, random: () => number) {
  const st = s.stocks;
  st.ipos = (st.ipos ?? []).filter((x) => x.until > s.day);
  if (st.ipos.length >= 3 || random() > 0.12) return;
  const who = NPCS[Math.floor(random() * NPCS.length)]!;
  const n = s.npcs.find((x) => x.id === who.id);
  if (!n || n.cash <= 0) return;
  const sector = SECTORS[Math.floor(random() * SECTORS.length)]!;
  const capital = Math.round(n.cash * (0.1 + random() * 0.3));
  if (capital < 1000) return;
  const cap = Math.round(capital * (1.2 + random() * 1.8));
  const name = `${t("شركة")} ${t(who.name)} ${t(SUFFIX[sector] ?? "")}`.trim();
  st.ipos.push({ id: `ipo${st.nextId++}`, name, sector, capital, cap, founder: who.id, until: s.day + 120 });
  s.log.unshift(msg("{owner} يطلب إدراج {name} في السوق (القيمة {amount} د.ك)", { owner: who.name, name, amount: fmt(cap) }));
  s.log = s.log.slice(0, 8);
}

/** The governor's answer to a listing request. */
export function answerIpo(s: Sim, id: string, yes: boolean) {
  const st = s.stocks;
  const r = (st.ipos ?? []).find((x) => x.id === id);
  if (!r) return { ok: false, msg: t("الطلب انتهى") };
  st.ipos = st.ipos.filter((x) => x.id !== id);
  const n = s.npcs.find((x) => x.id === r.founder);
  if (!yes) {
    if (n) n.trust = Math.max(0, n.trust - 2);
    return { ok: true, msg: msg("رفضت إدراج {name}", { name: r.name }) };
  }
  addListing(s, { name: r.name, sector: r.sector, cap: r.cap, capital: r.capital, yield: 0.04 + Math.random() * 0.03, vol: 0.03 + Math.random() * 0.05, founder: r.founder, since: s.day });
  // A listing fee of 1٪ of the company's value goes to the treasury.
  const fee = Math.round(r.cap * 0.01);
  s.coins += fee;
  s.ytd.income += fee;
  if (n) n.trust = Math.min(100, n.trust + 3);
  return { ok: true, msg: msg("أُدرجت {name} في السوق · رسوم إدراج {amount} د.ك", { name: r.name, amount: fmt(fee) }) };
}

/** List a company by hand: its name, sector, capital and market value. */
export function addCompany(s: Sim, name: string, sector: string, capital: number, cap: number) {
  const clean = name.trim().slice(0, 40);
  if (clean.length < 2) return { ok: false, msg: t("اكتب اسم الشركة") };
  if (!(capital > 0) || !(cap > 0)) return { ok: false, msg: t("رأس المال والقيمة لازم أكبر من صفر") };
  if (stockIds(s).some((id) => stockDef(s, id).name === clean)) return { ok: false, msg: t("في شركة بنفس الاسم") };
  addListing(s, { name: clean, sector: sector || "خدمات", cap, capital, yield: 0.05, vol: 0.05, founder: "manual", since: s.day });
  return { ok: true, msg: msg("أُدرجت {name} في السوق برأس مال {capital} وقيمة {amount} د.ك", { name: clean, capital: fmt(capital), amount: fmt(cap) }) };
}

/** Take a listed company off the market (its holders are paid at today's price). */
export function delistCompany(s: Sim, id: string) {
  const c = s.stocks.listed?.[id];
  if (!c) return { ok: false, msg: t("الشركة غير موجودة") };
  const own = s.stocks.own[id] ?? 0;
  if (own > 0) s.coins += stakeValue(s, id, own);
  delete s.stocks.listed[id];
  for (const rec of [s.stocks.price, s.stocks.history, s.stocks.own, s.stocks.paid, s.stocks.wasDown] as Record<string, unknown>[]) delete rec[id];
  return { ok: true, msg: msg("شُطبت {name} من السوق", { name: c.name }) };
}

export const STOCK_SECTORS = SECTORS;
