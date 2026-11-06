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

export type StockId =
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

export const STOCKS: Record<StockId, StockDef> = {
  bank: { name: COMPANIES.bank.name, sector: "بنوك", cap: 80_000_000, yield: 0.05, vol: 0.04 },
  islamic: { name: COMPANIES.islamic.name, sector: "بنوك", cap: 60_000_000, yield: 0.055, vol: 0.035 },
  insurer: { name: INSURER, sector: "تأمين", cap: 25_000_000, yield: 0.06, vol: 0.03 },
  consultant: { name: COMPANIES.consultant.name, sector: "خدمات", cap: 5_000_000, yield: 0.04, vol: 0.05 },
  marsa: { name: DEVELOPERS.marsa.name, sector: "عقار", cap: 40_000_000, yield: 0.05, vol: 0.06 },
  khaleej: { name: DEVELOPERS.khaleej.name, sector: "عقار", cap: 30_000_000, yield: 0.07, vol: 0.09 },
  jazeera: { name: DEVELOPERS.jazeera.name, sector: "عقار", cap: 35_000_000, yield: 0.045, vol: 0.03 },
  dar: { name: DEVELOPERS.dar.name, sector: "عقار", cap: 15_000_000, yield: 0.05, vol: 0.06 },
};

export const STOCK_IDS = Object.keys(STOCKS) as StockId[];

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
  };
}

export function loadStocks(raw: unknown): StockState {
  const st = emptyStocks();
  if (!raw || typeof raw !== "object") return st;
  const p = raw as Partial<StockState>;
  const n = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
  for (const id of STOCK_IDS) {
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
  const f = s.finance;
  if (id === "bank" || id === "islamic" || id === "consultant") return (f.down[id] ?? 0) > s.day;
  if (id === "marsa") return (f.down.developer ?? 0) > s.day;
  if (id === "insurer") return false;
  return (f.devDown[id] ?? 0) > s.day;
}

/** Value of a stake of `pct` (0–1) at today's price. */
export function stakeValue(s: Sim, id: StockId, pct: number) {
  return STOCKS[id].cap * s.stocks.price[id] * pct;
}

export function portfolio(s: Sim) {
  let value = 0,
    paid = 0;
  for (const id of STOCK_IDS) {
    value += stakeValue(s, id, s.stocks.own[id]);
    paid += s.stocks.paid[id];
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
  if (s.stocks.own[id] + frac > 1 + 1e-9) return { ok: false, msg: t("لا يمكن تملك أكثر من ١٠٠٪ من الشركة") };
  const cost = stakeValue(s, id, frac);
  if (s.coins < cost) return { ok: false, msg: t("تحتاج {amount} د.ك لهذه الحصة", { amount: fmt(cost) }) };
  s.coins -= cost;
  s.stocks.own[id] += frac;
  s.stocks.paid[id] += cost;
  return {
    ok: true,
    msg: t("اشتريت {pct}٪ من {name} بـ {amount} د.ك", { pct: pctText(frac), name: STOCKS[id].name, amount: fmt(cost) }),
  };
}

/** Sell `pct` percent of a company from the stake held. */
export function sellStock(s: Sim, id: StockId, pct: number) {
  const own = s.stocks.own[id];
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
  return {
    ok: true,
    msg:
      gain >= 0
        ? t("بعت {pct}٪ من {name} بـ {amount} د.ك (ربح {gain})", { pct: pctText(frac), name: STOCKS[id].name, amount: fmt(value), gain: fmt(gain) })
        : t("بعت {pct}٪ من {name} بـ {amount} د.ك (خسارة {gain})", { pct: pctText(frac), name: STOCKS[id].name, amount: fmt(value), gain: fmt(-gain) }),
  };
}

export type MarketMood = { economic: boolean; war: boolean; pandemic: boolean };

/** One month of trading: prices drift with the economy and each company's health. */
export function stockMonth(s: Sim, mood: MarketMood, random: () => number = Math.random) {
  const st = s.stocks;
  for (const id of STOCK_IDS) {
    const def = STOCKS[id];
    let p = st.price[id];
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
    st.history[id] = [...st.history[id], st.price[id]].slice(-24);
  }
}

/** Year end: dividends on every stake in a solvent company. */
export function stockYear(s: Sim) {
  let total = 0;
  for (const id of STOCK_IDS) {
    if (s.stocks.own[id] <= 0 || stockDown(s, id)) continue;
    total += stakeValue(s, id, s.stocks.own[id]) * STOCKS[id].yield;
  }
  if (total <= 0) return null;
  s.coins += total;
  s.ytd.income += total;
  s.stocks.dividends += total;
  return msg("أرباح الأسهم السنوية: {amount} د.ك", { amount: fmt(total) });
}
