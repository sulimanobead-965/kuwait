/**
 * Companies the player deals with: a bank (deposits, bonds, loans), a real-estate
 * developer (projects and higher-yield bonds) and a consultancy (efficiency and
 * early warning). Every investment can be lost when a company goes bankrupt,
 * which is far more likely during a global economic crisis.
 *
 * Pure functions over `Sim`; `sim.ts` calls `financeMonth` once per game month.
 */
import type { Sim } from "./sim";
import { msg, percentSign, t, bigNum } from "../i18n/index.ts";

export type CompanyId = "bank" | "islamic" | "developer" | "consultant";

export type Bond = {
  id: string;
  issuer: "bank" | "developer" | "islamic";
  /** Sukuk: asset-backed certificates paying a variable profit share instead of interest. */
  sukuk?: boolean;
  amount: number;
  /** Annual coupon, e.g. 0.08. */
  rate: number;
  matures: number;
};

export type Project = {
  id: string;
  name: string;
  amount: number;
  /** Total paid back at completion, as a multiple of `amount`. */
  payback: number;
  /** Extra residents' homes the developer hands over (model area kind) at completion. */
  handover: boolean;
  completes: number;
};

export type FinanceState = {
  /** Money parked at the bank, interest included. */
  deposit: number;
  /** Yearly rate the bank promised on the deposit (any value the player asks for). */
  depositRate: number;
  bonds: Bond[];
  projects: Project[];
  /** Consultancy contract end day (0 = none). */
  consultUntil: number;
  /** Day until which a bankrupt company is closed (0 = open). */
  down: Record<CompanyId, number>;
  /** Murabaha financing owed to the Islamic bank: a fixed agreed markup, no compounding. */
  murabaha: Murabaha[];
  /** Mudaraba (profit-sharing) investment deposit and its expected yearly profit. */
  mudaraba: number;
  mudarabaRate: number;
  /** What residents paid the treasury for developer-run upgrades, and the developer's 1٪. */
  upgradeIncome: number;
  developerFees: number;
  /** Per-developer: the 1٪ fees earned, and bankruptcy closure day (Al Marsa uses `down`). */
  devFees: Partial<Record<string, number>>;
  devDown: Partial<Record<string, number>>;
  /** Insurance against bankruptcies, defaults and missed installments. */
  insured: boolean;
  premiums: number;
  claims: number;
  /** Lifetime numbers for the report and achievements. */
  earned: number;
  lost: number;
};

export type Murabaha = {
  id: string;
  amount: number;
  /** Agreed total markup, e.g. 0.1 = the bank sells for 110٪ of the price. */
  profit: number;
  months: number;
  left: number;
  installment: number;
};

export const COMPANIES: Record<CompanyId, { name: string; blurb: string }> = {
  islamic: {
    name: "مصرف الأمان الإسلامي",
    blurb:
      "تمويل مرابحة بربح متفق عليه بدل الفائدة، ووديعة مضاربة تشاركك الربح والخسارة، وصكوك مدعومة بأصول.",
  },
  bank: {
    name: "بنك الديرة",
    blurb: "ودائع بفائدة ١٠٪ سنوياً، وسندات، وقروض. البنوك تفلس في الأزمات.",
  },
  developer: {
    name: "شركة المرسى العقارية",
    blurb: "مشاريع سكنية تعيد رأس المال بربح وتسلّمك بيوتاً جاهزة. مخاطرة أعلى.",
  },
  consultant: {
    name: "دار الرأي للاستشارات",
    blurb: "عقد سنوي يخفّض المصاريف ١٥٪ ويرفع الرضا، وينذرك قبل الأزمات فتقل خسائرك.",
  },
};

export const DEPOSIT_RATE = 0.1;
export const DEPOSIT_RECOVERY = 0.25;

export const BOND_OFFERS: readonly {
  issuer: Bond["issuer"];
  amount: number;
  rate: number;
  years: number;
}[] = [
  { issuer: "bank", amount: 250_000, rate: 0.07, years: 2 },
  { issuer: "bank", amount: 1_000_000, rate: 0.08, years: 3 },
  { issuer: "bank", amount: 2_000_000, rate: 0.085, years: 3 },
  { issuer: "developer", amount: 1_000_000, rate: 0.12, years: 3 },
];

export const PROJECT_OFFERS: readonly {
  name: string;
  amount: number;
  payback: number;
  months: number;
  handover: boolean;
}[] = [
  { name: "عمارات سكنية", amount: 50_000, payback: 1.3, months: 18, handover: false },
  { name: "ضاحية متكاملة", amount: 250_000, payback: 1.45, months: 24, handover: true },
  {
    name: "مدينة ذكية على الواجهة البحرية",
    amount: 1_000_000,
    payback: 1.6,
    months: 36,
    handover: true,
  },
];

export const CONSULT_COST = 20_000;
export const CONSULT_MONTHS = 12;

export function emptyFinance(): FinanceState {
  return {
    deposit: 0,
    depositRate: DEPOSIT_RATE,
    bonds: [],
    projects: [],
    consultUntil: 0,
    down: { bank: 0, islamic: 0, developer: 0, consultant: 0 },
    murabaha: [],
    upgradeIncome: 0,
    developerFees: 0,
    devFees: {},
    devDown: {},
    insured: false,
    premiums: 0,
    claims: 0,
    mudaraba: 0,
    mudarabaRate: 0.08,
    earned: 0,
    lost: 0,
  };
}

export function loadFinance(raw: unknown): FinanceState {
  const f = emptyFinance();
  if (!raw || typeof raw !== "object") return f;
  const p = raw as Partial<FinanceState>;
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  f.deposit = Math.max(0, n(p.deposit));
  f.depositRate = p.depositRate === undefined ? DEPOSIT_RATE : Math.max(0, n(p.depositRate));
  f.consultUntil = Math.max(0, n(p.consultUntil));
  f.earned = n(p.earned);
  f.lost = n(p.lost);
  if (p.down && typeof p.down === "object")
    for (const id of ["bank", "islamic", "developer", "consultant"] as const)
      f.down[id] = n(p.down[id]);
  f.mudaraba = Math.max(0, n(p.mudaraba));
  f.upgradeIncome = Math.max(0, n(p.upgradeIncome));
  f.developerFees = Math.max(0, n(p.developerFees));
  f.insured = Boolean(p.insured);
  f.premiums = Math.max(0, n(p.premiums));
  f.claims = Math.max(0, n(p.claims));
  for (const key of ["devFees", "devDown"] as const) {
    const raw = p[key];
    if (raw && typeof raw === "object")
      for (const [id, v] of Object.entries(raw)) f[key][id] = Math.max(0, n(v));
  }
  f.mudarabaRate = p.mudarabaRate === undefined ? 0.08 : Math.max(0, n(p.mudarabaRate));
  if (Array.isArray(p.murabaha))
    f.murabaha = p.murabaha
      .filter((m) => m && typeof m === "object")
      .map((m) => ({
        id: String(m.id),
        amount: n(m.amount),
        profit: n(m.profit),
        months: Math.max(1, n(m.months)),
        left: Math.max(0, n(m.left)),
        installment: Math.max(0, n(m.installment)),
      }));
  if (Array.isArray(p.bonds))
    f.bonds = p.bonds
      .filter((b) => b && typeof b === "object")
      .map((b) => ({
        id: String(b.id),
        issuer:
          b.issuer === "developer" ? "developer" : b.issuer === "islamic" ? "islamic" : "bank",
        sukuk: Boolean(b.sukuk),
        amount: n(b.amount),
        rate: n(b.rate),
        matures: n(b.matures),
      }));
  if (Array.isArray(p.projects))
    f.projects = p.projects
      .filter((x) => x && typeof x === "object")
      .map((x) => ({
        id: String(x.id),
        name: String(x.name ?? "مشروع"),
        amount: n(x.amount),
        payback: n(x.payback) || 1,
        handover: Boolean(x.handover),
        completes: n(x.completes),
      }));
  return f;
}

export function isOpen(s: Sim, id: CompanyId) {
  return s.finance.down[id] <= s.day;
}

const fmt = (n: number) => bigNum(n);
const uid = (s: Sim) => `${Math.floor(s.day)}-${Math.random().toString(36).slice(2, 7)}`;

type Act = { ok: true; msg: string } | { ok: false; msg: string };

/** Shows a yearly rate like 10٪ or 12,500٪ (10% in English). */
export const pct = (rate: number) =>
  `${(Math.round(rate * 1000) / 10).toLocaleString("en-US")}${percentSign()}`;

/**
 * Extra monthly bankruptcy chance from promising more than a healthy return. Asking a
 * bank for 10٪ is safe; 50٪ makes it gamble with your money; 10,000٪ breaks it at once.
 */
export function promiseRisk(rate: number, healthy: number) {
  return Math.min(0.5, Math.max(0, rate - healthy) * 0.1);
}

export function deposit(s: Sim, amount: number, rate = DEPOSIT_RATE): Act {
  if (!isOpen(s, "bank")) return { ok: false, msg: t("البنك مغلق بعد إفلاسه") };
  if (!(amount > 0) || s.coins < amount) return { ok: false, msg: t("الرصيد ما يكفي للإيداع") };
  if (!(rate >= 0)) return { ok: false, msg: t("نسبة غير صحيحة") };
  const f = s.finance;
  // One deposit account: the rate is the money-weighted average of what was agreed.
  f.depositRate = (f.deposit * f.depositRate + amount * rate) / (f.deposit + amount);
  s.coins -= amount;
  f.deposit += amount;
  return {
    ok: true,
    msg: t("أودعت {amount} د.ك في {company} بفائدة {rate}", {
      amount: fmt(amount),
      company: COMPANIES.bank.name,
      rate: pct(rate),
    }),
  };
}

export function withdraw(s: Sim, amount: number): Act {
  if (!isOpen(s, "bank")) return { ok: false, msg: t("البنك مغلق بعد إفلاسه") };
  const take = Math.min(amount, s.finance.deposit);
  if (take <= 0) return { ok: false, msg: t("ما عندك وديعة") };
  s.finance.deposit -= take;
  s.coins += take;
  return { ok: true, msg: t("سحبت {amount} د.ك", { amount: fmt(take) }) };
}

export type BondOrder = { issuer: Bond["issuer"]; amount: number; rate: number; years: number };

export function buyBond(s: Sim, index: number | BondOrder): Act {
  const offer = typeof index === "number" ? BOND_OFFERS[index] : index;
  if (!offer) return { ok: false, msg: t("عرض غير موجود") };
  if (!isOpen(s, offer.issuer)) return { ok: false, msg: t("الشركة مغلقة بعد إفلاسها") };
  if (!(offer.amount > 0) || !(offer.rate >= 0) || !(offer.years > 0))
    return { ok: false, msg: t("أرقام السند غير صحيحة") };
  if (s.coins < offer.amount)
    return { ok: false, msg: t("تحتاج {amount} د.ك", { amount: fmt(offer.amount) }) };
  s.coins -= offer.amount;
  s.finance.bonds.push({
    id: uid(s),
    issuer: offer.issuer,
    amount: offer.amount,
    rate: offer.rate,
    matures: s.day + offer.years * 360,
  });
  if (!s.flags.includes("bonds")) s.flags.push("bonds");
  return {
    ok: true,
    msg: t("اشتريت سندات بقيمة {amount} د.ك بفائدة {rate}", {
      amount: fmt(offer.amount),
      rate: pct(offer.rate),
    }),
  };
}

export type ProjectOrder = {
  name: string;
  amount: number;
  /** Total paid back at the end, e.g. 1.5 = +50٪. */
  payback: number;
  months: number;
  handover: boolean;
};

export function startProject(s: Sim, index: number | ProjectOrder): Act {
  const offer = typeof index === "number" ? PROJECT_OFFERS[index] : index;
  if (!offer) return { ok: false, msg: t("عرض غير موجود") };
  if (!isOpen(s, "developer")) return { ok: false, msg: t("الشركة مغلقة بعد إفلاسها") };
  if (!(offer.amount > 0) || !(offer.payback >= 0) || !(offer.months > 0))
    return { ok: false, msg: t("أرقام المشروع غير صحيحة") };
  if (s.coins < offer.amount)
    return { ok: false, msg: t("تحتاج {amount} د.ك", { amount: fmt(offer.amount) }) };
  s.coins -= offer.amount;
  s.finance.projects.push({
    id: uid(s),
    name: offer.name,
    amount: offer.amount,
    payback: offer.payback,
    handover: offer.handover,
    completes: s.day + offer.months * 30,
  });
  return {
    ok: true,
    msg: t("بدأ مشروع {name} مع {company}", {
      name: offer.name,
      company: COMPANIES.developer.name,
    }),
  };
}

// ------------------------------------------------------------- Islamic finance

/**
 * Murabaha: the Islamic bank buys what the city needs and sells it to the city for a
 * markup agreed today, paid in equal installments. The debt never grows: a late month
 * costs a small fixed charity fee, not compounding interest.
 */
export function takeMurabaha(s: Sim, amount: number, profit: number, months: number): Act {
  if (!isOpen(s, "islamic")) return { ok: false, msg: t("المصرف الإسلامي مغلق") };
  if (!(amount > 0) || !(profit >= 0) || !(months >= 1))
    return { ok: false, msg: t("أرقام التمويل غير صحيحة") };
  // No ceiling and no minimum markup: the city may finance any project it believes in.
  const total = amount * (1 + profit);
  s.finance.murabaha.push({
    id: uid(s),
    amount,
    profit,
    months: Math.round(months),
    left: total,
    installment: total / Math.round(months),
  });
  s.coins += amount;
  return {
    ok: true,
    msg: t("تمويل مرابحة {amount} د.ك بربح {rate}", { amount: fmt(amount), rate: pct(profit) }),
  };
}

export function murabahaInstallment(s: Sim) {
  return s.finance.murabaha.reduce((t, m) => t + Math.min(m.installment, m.left), 0);
}

/**
 * Pay a murabaha early: one contract (by id) or all of them, in full (no amount)
 * or in part. Early payment cuts what is left; installments stay the same, so the
 * contract simply ends sooner.
 */
export function repayMurabaha(s: Sim, id: string | null, amount?: number): Act {
  const list = s.finance.murabaha.filter((m) => id === null || m.id === id);
  const total = list.reduce((t, m) => t + m.left, 0);
  if (total <= 0.5) return { ok: false, msg: t("ما عليك تمويل مرابحة") };
  const want = amount === undefined ? total : Math.min(total, Math.max(0, amount));
  if (!(want > 0)) return { ok: false, msg: t("مبلغ غير صحيح") };
  let pay = Math.min(want, Math.max(0, s.coins));
  if (pay <= 0) return { ok: false, msg: t("الرصيد ما يكفي للسداد") };
  const paid = pay;
  s.coins -= pay;
  for (const m of list) {
    const part = Math.min(m.left, pay);
    m.left -= part;
    pay -= part;
    if (pay <= 0) break;
  }
  s.finance.murabaha = s.finance.murabaha.filter((m) => m.left > 0.5);
  return {
    ok: true,
    msg:
      paid >= total - 0.5
        ? t("سدّدت تمويل المرابحة كاملاً")
        : t("سدّدت {amount} د.ك من المرابحة", { amount: fmt(paid) }),
  };
}

/** Mudaraba deposit: the bank invests it and shares the real profit (or loss). */
export function depositMudaraba(s: Sim, amount: number, expected: number): Act {
  if (!isOpen(s, "islamic")) return { ok: false, msg: t("المصرف الإسلامي مغلق") };
  if (!(amount > 0) || s.coins < amount) return { ok: false, msg: t("الرصيد ما يكفي") };
  if (!(expected >= 0)) return { ok: false, msg: t("نسبة غير صحيحة") };
  const f = s.finance;
  f.mudarabaRate = (f.mudaraba * f.mudarabaRate + amount * expected) / (f.mudaraba + amount);
  f.mudaraba += amount;
  s.coins -= amount;
  return {
    ok: true,
    msg: t("أودعت {amount} د.ك وديعة مضاربة بربح متوقع {rate}", {
      amount: fmt(amount),
      rate: pct(expected),
    }),
  };
}

export function withdrawMudaraba(s: Sim): Act {
  if (!isOpen(s, "islamic")) return { ok: false, msg: t("المصرف الإسلامي مغلق") };
  const take = s.finance.mudaraba;
  if (take <= 0) return { ok: false, msg: t("ما عندك وديعة مضاربة") };
  s.finance.mudaraba = 0;
  s.coins += take;
  return { ok: true, msg: t("سحبت {amount} د.ك", { amount: fmt(take) }) };
}

/** Sukuk: like a bond, but the return is a share of an asset's income and may vary. */
export function buySukuk(
  s: Sim,
  issuer: "islamic" | "developer",
  amount: number,
  expected: number,
  years: number,
): Act {
  if (!isOpen(s, issuer)) return { ok: false, msg: t("الجهة المصدرة مغلقة") };
  if (!(amount > 0) || !(expected >= 0) || !(years > 0))
    return { ok: false, msg: t("أرقام الصك غير صحيحة") };
  if (s.coins < amount) return { ok: false, msg: t("تحتاج {amount} د.ك", { amount: fmt(amount) }) };
  s.coins -= amount;
  s.finance.bonds.push({
    id: uid(s),
    issuer,
    amount,
    rate: expected,
    matures: s.day + years * 360,
    sukuk: true,
  });
  if (!s.flags.includes("bonds")) s.flags.push("bonds");
  return {
    ok: true,
    msg: t("اشتريت صكوكاً بقيمة {amount} د.ك بربح متوقع {rate}", {
      amount: fmt(amount),
      rate: pct(expected),
    }),
  };
}

export function hireConsultant(s: Sim): Act {
  if (!isOpen(s, "consultant")) return { ok: false, msg: t("الشركة مغلقة بعد إفلاسها") };
  if (s.finance.consultUntil > s.day) return { ok: false, msg: t("العقد ساري") };
  if (s.coins < CONSULT_COST)
    return { ok: false, msg: t("تحتاج {amount} د.ك", { amount: fmt(CONSULT_COST) }) };
  s.coins -= CONSULT_COST;
  s.finance.consultUntil = s.day + CONSULT_MONTHS * 30;
  return { ok: true, msg: t("وقّعت عقداً مع {company}", { company: COMPANIES.consultant.name }) };
}

export function consulting(s: Sim) {
  return s.finance.consultUntil > s.day;
}

/** Total invested with companies (what could be lost). */
export function exposure(s: Sim) {
  const f = s.finance;
  return (
    f.deposit +
    f.mudaraba +
    f.bonds.reduce((n, b) => n + b.amount, 0) +
    f.projects.reduce((n, p) => n + p.amount, 0) +
    (s.sites ?? []).reduce((n, x) => n + x.amount, 0)
  );
}

/** Monthly interest and coupons the city is receiving right now. */
export function financeIncome(s: Sim) {
  const f = s.finance;
  return Math.round(
    (f.deposit * f.depositRate) / 12 +
      (f.mudaraba * f.mudarabaRate) / 12 +
      f.bonds.reduce((n, b) => n + (b.amount * b.rate) / 12, 0),
  );
}

// ------------------------------------------------------------- insurance

export const INSURER = "شركة الأمان للتأمين";

/**
 * Yearly premium rate for an amount promised at `rate`: 0.2٪ at normal rates,
 * rising ~0.47 points per 10 points of interest above 10٪ (3٪ at 70٪, ~23٪ at 500٪).
 */
export function premiumRate(rate: number) {
  return 0.002 + Math.max(0, rate - 0.1) * 0.0467;
}

/** Every insured amount with the rate it carries. */
export function insuredItems(s: Sim) {
  const f = s.finance;
  const items: { amount: number; rate: number }[] = [];
  if (f.deposit > 0) items.push({ amount: f.deposit, rate: f.depositRate });
  if (f.mudaraba > 0) items.push({ amount: f.mudaraba, rate: f.mudarabaRate });
  for (const b of f.bonds) items.push({ amount: b.amount, rate: b.rate });
  for (const p of f.projects) {
    const years = Math.max(0.5, (p.completes - s.day) / 360);
    items.push({ amount: p.amount, rate: (p.payback - 1) / years });
  }
  for (const site of s.sites ?? []) items.push({ amount: site.amount, rate: 0.1 });
  if (s.loan > 0) items.push({ amount: s.loan, rate: s.loanRate ?? 0.12 });
  for (const m of f.murabaha)
    items.push({ amount: m.left, rate: m.profit / Math.max(1 / 12, m.months / 12) });
  for (const n of s.npcs ?? [])
    for (const l of [...n.owesMe, ...n.iOwe]) items.push({ amount: l.left, rate: l.rate });
  return items;
}

/** This month's premium for everything insured. */
export function monthlyPremium(s: Sim) {
  return Math.round(
    insuredItems(s).reduce((t, i) => t + (i.amount * premiumRate(i.rate)) / 12, 0),
  );
}

export function setInsurance(s: Sim, on: boolean): Act {
  s.finance.insured = on;
  return {
    ok: true,
    msg: on
      ? t("أمّنت أموالك لدى {company}: أي إفلاس أو عجز يُعوَّض بالكامل", { company: INSURER })
      : t("ألغيت التأمين"),
  };
}

/** The insurer pays a loss in full; returns what it paid. */
export function claim(s: Sim, loss: number) {
  if (!s.finance.insured || loss <= 0) return 0;
  s.coins += loss;
  s.finance.claims += loss;
  s.finance.lost = Math.max(0, s.finance.lost - loss);
  return loss;
}

export type FinanceContext = {
  /** Receives encoded messages (see `msg` in i18n) for the city log. */
  log: (entry: string) => void;
  /** Hands over a completed developer project's homes; returns buildings placed. */
  handover: () => number;
  economicCrisis: boolean;
  war: boolean;
  random: () => number;
};

/**
 * One game month: bankruptcy risk first (a company that can't keep its promise fails
 * before paying), then interest, coupons, maturities and completed projects.
 */
export function financeMonth(s: Sim, ctx: FinanceContext) {
  const f = s.finance;
  if (f.insured) {
    const premium = monthlyPremium(s);
    s.coins -= premium;
    f.premiums += premium;
  }
  // Bankruptcy risk. A consultancy contract warns early, so half the money is saved.
  const shield = consulting(s) ? 0.5 : 0;
  // Promising more than a healthy return makes a company gamble with the money.
  const bankPromise = Math.max(
    f.deposit > 0 ? f.depositRate : 0,
    ...f.bonds.filter((b) => b.issuer === "bank").map((b) => b.rate),
  );
  const devPromise = Math.max(
    0,
    ...f.bonds.filter((b) => b.issuer === "developer").map((b) => b.rate),
    ...f.projects.map((p) => (p.payback - 1) / Math.max(0.5, (p.completes - s.day) / 360)),
  );
  const bankRisk =
    (ctx.economicCrisis ? 0.035 : ctx.war ? 0.012 : 0.0015) + promiseRisk(bankPromise, 0.12);
  const devRisk =
    (ctx.economicCrisis ? 0.05 : ctx.war ? 0.02 : 0.003) + promiseRisk(devPromise, 0.3);
  const consultRisk = ctx.economicCrisis ? 0.02 : 0.001;
  const islamicPromise = Math.max(
    f.mudaraba > 0 ? f.mudarabaRate : 0,
    ...f.bonds.filter((b) => b.issuer === "islamic").map((b) => b.rate),
  );
  const islamicRisk =
    (ctx.economicCrisis ? 0.025 : ctx.war ? 0.008 : 0.001) + promiseRisk(islamicPromise, 0.12);
  if (isOpen(s, "islamic") && ctx.random() < islamicRisk) {
    // Sukuk are backed by real assets, so more of the money comes back.
    const sukuk = f.bonds.filter((b) => b.issuer === "islamic");
    const exposed = f.mudaraba + sukuk.reduce((n, b) => n + b.amount, 0);
    const recovered =
      f.mudaraba * (0.35 + 0.65 * shield) +
      sukuk.reduce((n, b) => n + b.amount * (0.7 + 0.3 * shield), 0);
    s.coins += recovered;
    f.lost += exposed - recovered;
    if (claim(s, exposed - recovered) > 0)
      ctx.log(
        msg("{company} عوّضك عن الخسارة بالكامل: {amount} د.ك", {
          company: INSURER,
          amount: Math.round(exposed - recovered),
        }),
      );
    f.mudaraba = 0;
    f.bonds = f.bonds.filter((b) => b.issuer !== "islamic");
    f.down.islamic = s.day + 24 * 30;
    ctx.log(
      msg("تعثّر {company}! خسرت {lost} د.ك واسترجعت {back} من الأصول", {
        company: COMPANIES.islamic.name,
        lost: fmt(exposed - recovered),
        back: fmt(recovered),
      }),
    );
  }
  if (isOpen(s, "bank") && ctx.random() < bankRisk) {
    const bonds = f.bonds.filter((b) => b.issuer === "bank");
    const exposed = f.deposit + bonds.reduce((n, b) => n + b.amount, 0);
    const recovered =
      f.deposit * (DEPOSIT_RECOVERY + (1 - DEPOSIT_RECOVERY) * shield) +
      bonds.reduce((n, b) => n + b.amount * (0.4 + 0.6 * shield), 0);
    s.coins += recovered;
    f.lost += exposed - recovered;
    if (claim(s, exposed - recovered) > 0)
      ctx.log(
        msg("{company} عوّضك عن الخسارة بالكامل: {amount} د.ك", {
          company: INSURER,
          amount: Math.round(exposed - recovered),
        }),
      );
    f.deposit = 0;
    f.bonds = f.bonds.filter((b) => b.issuer !== "bank");
    f.down.bank = s.day + 24 * 30;
    ctx.log(
      msg("إفلاس {company}! خسرت {lost} د.ك واسترجعت {back}", {
        company: COMPANIES.bank.name,
        lost: fmt(exposed - recovered),
        back: fmt(recovered),
      }),
    );
  }
  if (isOpen(s, "developer") && ctx.random() < devRisk) {
    const bonds = f.bonds.filter((b) => b.issuer === "developer");
    const exposed =
      f.projects.reduce((n, p) => n + p.amount, 0) + bonds.reduce((n, b) => n + b.amount, 0);
    const recovered = exposed * (0.2 + 0.8 * shield);
    s.coins += recovered;
    f.lost += exposed - recovered;
    if (claim(s, exposed - recovered) > 0)
      ctx.log(
        msg("{company} عوّضك عن الخسارة بالكامل: {amount} د.ك", {
          company: INSURER,
          amount: Math.round(exposed - recovered),
        }),
      );
    f.projects = [];
    f.bonds = f.bonds.filter((b) => b.issuer !== "developer");
    f.down.developer = s.day + 18 * 30;
    ctx.log(
      msg("إفلاس {company}! ضاع {lost} د.ك من استثماراتك", {
        company: COMPANIES.developer.name,
        lost: fmt(exposed - recovered),
      }),
    );
  }
  if (isOpen(s, "consultant") && ctx.random() < consultRisk) {
    f.consultUntil = 0;
    f.down.consultant = s.day + 12 * 30;
    ctx.log(msg("إفلاس {company} وانتهى عقدك", { company: COMPANIES.consultant.name }));
  }
  // Mudaraba: the real result depends on how the bank's investments did this month.
  if (f.mudaraba > 0 && isOpen(s, "islamic")) {
    const performance = ctx.economicCrisis
      ? -0.4 + ctx.random() * 0.9
      : ctx.war
        ? 0.2 + ctx.random() * 0.8
        : 0.6 + ctx.random() * 0.8;
    const result = ((f.mudaraba * f.mudarabaRate) / 12) * performance;
    // An insured mudaraba never loses principal: the insurer covers a losing month.
    const covered = result < 0 && f.insured ? -result : 0;
    if (covered) {
      f.claims += covered;
      s.coins += 0;
    }
    f.mudaraba = Math.max(0, f.mudaraba + result + covered);
    if (result >= 0) f.earned += result;
    else if (!covered) f.lost -= result;
  }
  // Murabaha installments: a fixed amount; missing one costs a small charity fee only.
  for (const m of [...f.murabaha]) {
    const due = Math.min(m.installment, m.left);
    if (s.coins >= due) {
      s.coins -= due;
      m.left -= due;
      if (m.left <= 0.5) {
        f.murabaha = f.murabaha.filter((x) => x.id !== m.id);
        ctx.log(msg("سدّدت تمويل المرابحة كاملاً"));
      }
    } else if (f.insured) {
      // The insurer pays a missed installment for you.
      f.claims += due;
      m.left -= due;
      if (m.left <= 0.5) f.murabaha = f.murabaha.filter((x) => x.id !== m.id);
    } else {
      const charity = Math.min(500, due * 0.01);
      s.coins -= charity;
      ctx.log(
        msg("تأخر قسط المرابحة: تبرع خيري {amount} د.ك بلا فوائد إضافية", { amount: fmt(charity) }),
      );
    }
  }
  // Interest compounds inside the deposit; coupons are paid out.
  if (f.deposit > 0 && isOpen(s, "bank")) {
    const interest = (f.deposit * f.depositRate) / 12;
    f.deposit += interest;
    f.earned += interest;
  }
  for (const bond of [...f.bonds]) {
    if (!isOpen(s, bond.issuer)) continue;
    // Sukuk profit follows the asset's income: ±25٪ around the expected share.
    const coupon =
      ((bond.amount * bond.rate) / 12) *
      (bond.sukuk ? (ctx.economicCrisis ? 0.4 : 0.75) + ctx.random() * 0.5 : 1);
    s.coins += coupon;
    f.earned += coupon;
    if (s.day >= bond.matures) {
      s.coins += bond.amount;
      f.bonds = f.bonds.filter((b) => b.id !== bond.id);
      ctx.log(
        msg(
          bond.sukuk
            ? "استُحقت الصكوك {amount} د.ك ورجع المبلغ"
            : "استُحقت السندات {amount} د.ك ورجع المبلغ",
          { amount: fmt(bond.amount) },
        ),
      );
    }
  }
  for (const project of [...f.projects]) {
    if (s.day < project.completes || !isOpen(s, "developer")) continue;
    const back = project.amount * project.payback;
    s.coins += back;
    f.earned += back - project.amount;
    f.projects = f.projects.filter((p) => p.id !== project.id);
    const homes = project.handover ? ctx.handover() : 0;
    ctx.log(
      homes
        ? msg("اكتمل {name}: رجع {amount} د.ك وتسلّمت {homes} مبنى", {
            name: project.name,
            amount: fmt(back),
            homes,
          })
        : msg("اكتمل {name}: رجع {amount} د.ك", { name: project.name, amount: fmt(back) }),
    );
  }
}
