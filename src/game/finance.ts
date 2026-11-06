/**
 * Companies the player deals with: a bank (deposits, bonds, loans), a real-estate
 * developer (projects and higher-yield bonds) and a consultancy (efficiency and
 * early warning). Every investment can be lost when a company goes bankrupt,
 * which is far more likely during a global economic crisis.
 *
 * Pure functions over `Sim`; `sim.ts` calls `financeMonth` once per game month.
 */
import type { Sim } from "./sim";

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

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const uid = (s: Sim) => `${Math.floor(s.day)}-${Math.random().toString(36).slice(2, 7)}`;

type Act = { ok: true; msg: string } | { ok: false; msg: string };

/** Shows a yearly rate like 10٪ or 12,500٪. */
export const pct = (rate: number) => `${(Math.round(rate * 1000) / 10).toLocaleString("en-US")}٪`;

/**
 * Extra monthly bankruptcy chance from promising more than a healthy return. Asking a
 * bank for 10٪ is safe; 50٪ makes it gamble with your money; 10,000٪ breaks it at once.
 */
export function promiseRisk(rate: number, healthy: number) {
  return Math.min(0.97, Math.max(0, rate - healthy) * 0.6);
}

export function deposit(s: Sim, amount: number, rate = DEPOSIT_RATE): Act {
  if (!isOpen(s, "bank")) return { ok: false, msg: "البنك مغلق بعد إفلاسه" };
  if (!(amount > 0) || s.coins < amount) return { ok: false, msg: "الرصيد ما يكفي للإيداع" };
  if (!(rate >= 0)) return { ok: false, msg: "نسبة غير صحيحة" };
  const f = s.finance;
  // One deposit account: the rate is the money-weighted average of what was agreed.
  f.depositRate = (f.deposit * f.depositRate + amount * rate) / (f.deposit + amount);
  s.coins -= amount;
  f.deposit += amount;
  return {
    ok: true,
    msg: `أودعت ${fmt(amount)} د.ك في ${COMPANIES.bank.name} بفائدة ${pct(rate)}`,
  };
}

export function withdraw(s: Sim, amount: number): Act {
  if (!isOpen(s, "bank")) return { ok: false, msg: "البنك مغلق بعد إفلاسه" };
  const take = Math.min(amount, s.finance.deposit);
  if (take <= 0) return { ok: false, msg: "ما عندك وديعة" };
  s.finance.deposit -= take;
  s.coins += take;
  return { ok: true, msg: `سحبت ${fmt(take)} د.ك` };
}

export type BondOrder = { issuer: Bond["issuer"]; amount: number; rate: number; years: number };

export function buyBond(s: Sim, index: number | BondOrder): Act {
  const offer = typeof index === "number" ? BOND_OFFERS[index] : index;
  if (!offer) return { ok: false, msg: "عرض غير موجود" };
  if (!isOpen(s, offer.issuer)) return { ok: false, msg: "الشركة مغلقة بعد إفلاسها" };
  if (!(offer.amount > 0) || !(offer.rate >= 0) || !(offer.years > 0))
    return { ok: false, msg: "أرقام السند غير صحيحة" };
  if (s.coins < offer.amount) return { ok: false, msg: `تحتاج ${fmt(offer.amount)} د.ك` };
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
    msg: `اشتريت سندات بقيمة ${fmt(offer.amount)} د.ك بفائدة ${pct(offer.rate)}`,
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
  if (!offer) return { ok: false, msg: "عرض غير موجود" };
  if (!isOpen(s, "developer")) return { ok: false, msg: "الشركة مغلقة بعد إفلاسها" };
  if (!(offer.amount > 0) || !(offer.payback >= 0) || !(offer.months > 0))
    return { ok: false, msg: "أرقام المشروع غير صحيحة" };
  if (s.coins < offer.amount) return { ok: false, msg: `تحتاج ${fmt(offer.amount)} د.ك` };
  s.coins -= offer.amount;
  s.finance.projects.push({
    id: uid(s),
    name: offer.name,
    amount: offer.amount,
    payback: offer.payback,
    handover: offer.handover,
    completes: s.day + offer.months * 30,
  });
  return { ok: true, msg: `بدأ مشروع ${offer.name} مع ${COMPANIES.developer.name}` };
}

// ------------------------------------------------------------- Islamic finance

/**
 * Murabaha: the Islamic bank buys what the city needs and sells it to the city for a
 * markup agreed today, paid in equal installments. The debt never grows: a late month
 * costs a small fixed charity fee, not compounding interest.
 */
export function takeMurabaha(s: Sim, amount: number, profit: number, months: number): Act {
  if (!isOpen(s, "islamic")) return { ok: false, msg: "المصرف الإسلامي مغلق" };
  if (!(amount > 0) || !(profit >= 0) || !(months >= 1))
    return { ok: false, msg: "أرقام التمويل غير صحيحة" };
  const owed = s.finance.murabaha.reduce((t, m) => t + m.left, 0);
  const limit = Math.max(40_000, Math.max(0, s.coins) * 0.5 + 200_000);
  if (owed + amount * (1 + profit) > limit)
    return { ok: false, msg: "المصرف رفض: تجاوزت حد التمويل" };
  const floor = 0.04 * (months / 12);
  if (profit < floor) return { ok: false, msg: `أقل ربح يقبله المصرف لهذه المدة ${pct(floor)}` };
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
  return { ok: true, msg: `تمويل مرابحة ${fmt(amount)} د.ك بربح ${pct(profit)}` };
}

export function murabahaInstallment(s: Sim) {
  return s.finance.murabaha.reduce((t, m) => t + Math.min(m.installment, m.left), 0);
}

/** Mudaraba deposit: the bank invests it and shares the real profit (or loss). */
export function depositMudaraba(s: Sim, amount: number, expected: number): Act {
  if (!isOpen(s, "islamic")) return { ok: false, msg: "المصرف الإسلامي مغلق" };
  if (!(amount > 0) || s.coins < amount) return { ok: false, msg: "الرصيد ما يكفي" };
  if (!(expected >= 0)) return { ok: false, msg: "نسبة غير صحيحة" };
  const f = s.finance;
  f.mudarabaRate = (f.mudaraba * f.mudarabaRate + amount * expected) / (f.mudaraba + amount);
  f.mudaraba += amount;
  s.coins -= amount;
  return { ok: true, msg: `أودعت ${fmt(amount)} د.ك وديعة مضاربة بربح متوقع ${pct(expected)}` };
}

export function withdrawMudaraba(s: Sim): Act {
  if (!isOpen(s, "islamic")) return { ok: false, msg: "المصرف الإسلامي مغلق" };
  const take = s.finance.mudaraba;
  if (take <= 0) return { ok: false, msg: "ما عندك وديعة مضاربة" };
  s.finance.mudaraba = 0;
  s.coins += take;
  return { ok: true, msg: `سحبت ${fmt(take)} د.ك` };
}

/** Sukuk: like a bond, but the return is a share of an asset's income and may vary. */
export function buySukuk(
  s: Sim,
  issuer: "islamic" | "developer",
  amount: number,
  expected: number,
  years: number,
): Act {
  if (!isOpen(s, issuer)) return { ok: false, msg: "الجهة المصدرة مغلقة" };
  if (!(amount > 0) || !(expected >= 0) || !(years > 0))
    return { ok: false, msg: "أرقام الصك غير صحيحة" };
  if (s.coins < amount) return { ok: false, msg: `تحتاج ${fmt(amount)} د.ك` };
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
  return { ok: true, msg: `اشتريت صكوكاً بقيمة ${fmt(amount)} د.ك بربح متوقع ${pct(expected)}` };
}

export function hireConsultant(s: Sim): Act {
  if (!isOpen(s, "consultant")) return { ok: false, msg: "الشركة مغلقة بعد إفلاسها" };
  if (s.finance.consultUntil > s.day) return { ok: false, msg: "العقد ساري" };
  if (s.coins < CONSULT_COST) return { ok: false, msg: `تحتاج ${fmt(CONSULT_COST)} د.ك` };
  s.coins -= CONSULT_COST;
  s.finance.consultUntil = s.day + CONSULT_MONTHS * 30;
  return { ok: true, msg: `وقّعت عقداً مع ${COMPANIES.consultant.name}` };
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
    f.projects.reduce((n, p) => n + p.amount, 0)
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

export type FinanceContext = {
  log: (msg: string) => void;
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
    f.mudaraba = 0;
    f.bonds = f.bonds.filter((b) => b.issuer !== "islamic");
    f.down.islamic = s.day + 24 * 30;
    ctx.log(
      `تعثّر ${COMPANIES.islamic.name}! خسرت ${fmt(exposed - recovered)} د.ك واسترجعت ${fmt(recovered)} من الأصول`,
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
    f.deposit = 0;
    f.bonds = f.bonds.filter((b) => b.issuer !== "bank");
    f.down.bank = s.day + 24 * 30;
    ctx.log(
      `إفلاس ${COMPANIES.bank.name}! خسرت ${fmt(exposed - recovered)} د.ك واسترجعت ${fmt(recovered)}`,
    );
  }
  if (isOpen(s, "developer") && ctx.random() < devRisk) {
    const bonds = f.bonds.filter((b) => b.issuer === "developer");
    const exposed =
      f.projects.reduce((n, p) => n + p.amount, 0) + bonds.reduce((n, b) => n + b.amount, 0);
    const recovered = exposed * (0.2 + 0.8 * shield);
    s.coins += recovered;
    f.lost += exposed - recovered;
    f.projects = [];
    f.bonds = f.bonds.filter((b) => b.issuer !== "developer");
    f.down.developer = s.day + 18 * 30;
    ctx.log(`إفلاس ${COMPANIES.developer.name}! ضاع ${fmt(exposed - recovered)} د.ك من استثماراتك`);
  }
  if (isOpen(s, "consultant") && ctx.random() < consultRisk) {
    f.consultUntil = 0;
    f.down.consultant = s.day + 12 * 30;
    ctx.log(`إفلاس ${COMPANIES.consultant.name} وانتهى عقدك`);
  }
  // Mudaraba: the real result depends on how the bank's investments did this month.
  if (f.mudaraba > 0 && isOpen(s, "islamic")) {
    const performance = ctx.economicCrisis
      ? -0.4 + ctx.random() * 0.9
      : ctx.war
        ? 0.2 + ctx.random() * 0.8
        : 0.6 + ctx.random() * 0.8;
    const result = ((f.mudaraba * f.mudarabaRate) / 12) * performance;
    f.mudaraba = Math.max(0, f.mudaraba + result);
    if (result >= 0) f.earned += result;
    else f.lost -= result;
  }
  // Murabaha installments: a fixed amount; missing one costs a small charity fee only.
  for (const m of [...f.murabaha]) {
    const due = Math.min(m.installment, m.left);
    if (s.coins >= due) {
      s.coins -= due;
      m.left -= due;
      if (m.left <= 0.5) {
        f.murabaha = f.murabaha.filter((x) => x.id !== m.id);
        ctx.log("سدّدت تمويل المرابحة كاملاً");
      }
    } else {
      const charity = Math.min(500, due * 0.01);
      s.coins -= charity;
      ctx.log(`تأخر قسط المرابحة: تبرع خيري ${fmt(charity)} د.ك بلا فوائد إضافية`);
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
      ctx.log(`استُحقت ${bond.sukuk ? "الصكوك" : "السندات"} ${fmt(bond.amount)} د.ك ورجع المبلغ`);
    }
  }
  for (const project of [...f.projects]) {
    if (s.day < project.completes || !isOpen(s, "developer")) continue;
    const back = project.amount * project.payback;
    s.coins += back;
    f.earned += back - project.amount;
    f.projects = f.projects.filter((p) => p.id !== project.id);
    const homes = project.handover ? ctx.handover() : 0;
    ctx.log(`اكتمل ${project.name}: رجع ${fmt(back)} د.ك${homes ? ` وتسلّمت ${homes} مبنى` : ""}`);
  }
}
