/**
 * The investment ledger: what each kind of investment earned or lost, year by year
 * (the last ten years are kept), for the investment report.
 *
 * `gain` is the profit (+) or loss (−) booked in the year; `base` is the most money
 * that was put into that kind of investment during the year, so gain / base is the
 * year's return.
 */
import type { Sim } from "./sim";

export type LedgerKey =
  | "deposit"
  | "mudaraba"
  | "bonds"
  | "sukuk"
  | "devProjects"
  | "sites"
  | "stocks"
  | "board"
  | "bankruptcy"
  | "insurance";

export const LEDGER_KEYS: LedgerKey[] = [
  "deposit",
  "mudaraba",
  "bonds",
  "sukuk",
  "devProjects",
  "sites",
  "stocks",
  "board",
  "bankruptcy",
  "insurance",
];

export const LEDGER_LABELS: Record<LedgerKey, string> = {
  deposit: "ودائع البنك",
  mudaraba: "ودائع المضاربة الإسلامية",
  bonds: "السندات",
  sukuk: "الصكوك",
  devProjects: "الاستثمارات العقارية مع المطور",
  sites: "مشاريع التطوير العقاري في المدينة",
  stocks: "سوق الأسهم",
  board: "مشاريع مجلس الإدارة",
  bankruptcy: "خسائر إفلاس الشركات",
  insurance: "التأمين (التعويضات ناقص الأقساط)",
};

export type LedgerRow = { gain: number; base: number };
export type LedgerRows = Partial<Record<LedgerKey, LedgerRow>>;
export type LedgerYear = { year: number; rows: LedgerRows };
export type Ledger = { now: LedgerRows; years: LedgerYear[] };

export const emptyLedger = (): Ledger => ({ now: {}, years: [] });

function ledgerOf(s: Sim) {
  const f = s.finance as { ledger?: Ledger };
  if (!f.ledger) f.ledger = emptyLedger();
  return f.ledger;
}

/** Book a profit (+) or loss (−) on an investment of `base` this year. */
export function book(s: Sim, key: LedgerKey, gain: number, base = 0) {
  if (!Number.isFinite(gain) || (gain === 0 && base <= 0)) return;
  const row = (ledgerOf(s).now[key] ??= { gain: 0, base: 0 });
  row.gain += gain;
  if (Number.isFinite(base)) row.base = Math.max(row.base, base);
}

/** Year end: the year's rows join the history (ten years kept). */
export function closeLedgerYear(s: Sim, year: number) {
  const l = ledgerOf(s);
  l.years = [...l.years, { year, rows: l.now }].slice(-10);
  l.now = {};
}

export function loadLedger(raw: unknown): Ledger {
  const out = emptyLedger();
  if (!raw || typeof raw !== "object") return out;
  const p = raw as { now?: unknown; years?: unknown };
  const rows = (r: unknown): LedgerRows => {
    const o: LedgerRows = {};
    if (!r || typeof r !== "object") return o;
    for (const k of LEDGER_KEYS) {
      const v = (r as Record<string, unknown>)[k] as Partial<LedgerRow> | undefined;
      if (!v || typeof v !== "object") continue;
      const gain = Number(v.gain);
      const base = Number(v.base);
      if (Number.isFinite(gain)) o[k] = { gain, base: Number.isFinite(base) ? Math.max(0, base) : 0 };
    }
    return o;
  };
  out.now = rows(p.now);
  if (Array.isArray(p.years))
    out.years = p.years
      .filter((y) => y && typeof y === "object" && Number.isFinite(Number((y as LedgerYear).year)))
      .map((y) => ({ year: Number((y as LedgerYear).year), rows: rows((y as LedgerYear).rows) }))
      .slice(-10);
  return out;
}

/**
 * The report: each kind of investment over the kept years plus the year so far — its
 * total profit or loss, the most money it ever held, and the return on that money.
 */
export function ledgerSummary(s: Sim) {
  const l = ledgerOf(s);
  const periods = [...l.years, { year: -1, rows: l.now }];
  const lines = LEDGER_KEYS.map((key) => {
    let gain = 0;
    let base = 0;
    for (const p of periods) {
      const r = p.rows[key];
      if (!r) continue;
      gain += r.gain;
      base = Math.max(base, r.base);
    }
    return { key, label: LEDGER_LABELS[key], gain, base, pct: base > 0 ? gain / base : null };
  }).filter((x) => x.gain !== 0 || x.base > 0);
  const byYear = l.years.map((y) => ({
    year: y.year,
    gain: Object.values(y.rows).reduce((n, r) => n + (r?.gain ?? 0), 0),
  }));
  const total = lines.reduce((n, x) => n + x.gain, 0);
  const capital = lines.filter((x) => x.key !== "bankruptcy" && x.key !== "insurance").reduce((n, x) => n + x.base, 0);
  return { lines, byYear, total, capital, years: l.years.length };
}
