/**
 * Companies the player deals with: a bank (deposits, bonds, loans), a real-estate
 * developer (projects and higher-yield bonds) and a consultancy (efficiency and
 * early warning). Every investment can be lost when a company goes bankrupt,
 * which is far more likely during a global economic crisis.
 *
 * Pure functions over `Sim`; `sim.ts` calls `financeMonth` once per game month.
 */
import type { Sim } from "./sim";

export type CompanyId = "bank" | "developer" | "consultant";

export type Bond = {
  id: string;
  issuer: "bank" | "developer";
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
  bonds: Bond[];
  projects: Project[];
  /** Consultancy contract end day (0 = none). */
  consultUntil: number;
  /** Day until which a bankrupt company is closed (0 = open). */
  down: Record<CompanyId, number>;
  /** Lifetime numbers for the report and achievements. */
  earned: number;
  lost: number;
};

export const COMPANIES: Record<CompanyId, { name: string; blurb: string }> = {
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
    bonds: [],
    projects: [],
    consultUntil: 0,
    down: { bank: 0, developer: 0, consultant: 0 },
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
  f.consultUntil = Math.max(0, n(p.consultUntil));
  f.earned = n(p.earned);
  f.lost = n(p.lost);
  if (p.down && typeof p.down === "object")
    for (const id of ["bank", "developer", "consultant"] as const) f.down[id] = n(p.down[id]);
  if (Array.isArray(p.bonds))
    f.bonds = p.bonds
      .filter((b) => b && typeof b === "object")
      .map((b) => ({
        id: String(b.id),
        issuer: b.issuer === "developer" ? "developer" : "bank",
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

export function deposit(s: Sim, amount: number): Act {
  if (!isOpen(s, "bank")) return { ok: false, msg: "البنك مغلق بعد إفلاسه" };
  if (amount <= 0 || s.coins < amount) return { ok: false, msg: "الرصيد ما يكفي للإيداع" };
  s.coins -= amount;
  s.finance.deposit += amount;
  return { ok: true, msg: `أودعت ${fmt(amount)} د.ك في ${COMPANIES.bank.name}` };
}

export function withdraw(s: Sim, amount: number): Act {
  if (!isOpen(s, "bank")) return { ok: false, msg: "البنك مغلق بعد إفلاسه" };
  const take = Math.min(amount, s.finance.deposit);
  if (take <= 0) return { ok: false, msg: "ما عندك وديعة" };
  s.finance.deposit -= take;
  s.coins += take;
  return { ok: true, msg: `سحبت ${fmt(take)} د.ك` };
}

export function buyBond(s: Sim, index: number): Act {
  const offer = BOND_OFFERS[index];
  if (!offer) return { ok: false, msg: "عرض غير موجود" };
  if (!isOpen(s, offer.issuer)) return { ok: false, msg: "الشركة مغلقة بعد إفلاسها" };
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
  return { ok: true, msg: `اشتريت سندات بقيمة ${fmt(offer.amount)} د.ك` };
}

export function startProject(s: Sim, index: number): Act {
  const offer = PROJECT_OFFERS[index];
  if (!offer) return { ok: false, msg: "عرض غير موجود" };
  if (!isOpen(s, "developer")) return { ok: false, msg: "الشركة مغلقة بعد إفلاسها" };
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
    f.bonds.reduce((n, b) => n + b.amount, 0) +
    f.projects.reduce((n, p) => n + p.amount, 0)
  );
}

/** Monthly interest and coupons the city is receiving right now. */
export function financeIncome(s: Sim) {
  const f = s.finance;
  return Math.round(
    (f.deposit * DEPOSIT_RATE) / 12 + f.bonds.reduce((n, b) => n + (b.amount * b.rate) / 12, 0),
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

/** One game month of interest, coupons, maturities, completions and bankruptcy risk. */
export function financeMonth(s: Sim, ctx: FinanceContext) {
  const f = s.finance;
  // Interest compounds inside the deposit; coupons are paid out.
  if (f.deposit > 0 && isOpen(s, "bank")) {
    const interest = (f.deposit * DEPOSIT_RATE) / 12;
    f.deposit += interest;
    f.earned += interest;
  }
  for (const bond of [...f.bonds]) {
    if (!isOpen(s, bond.issuer)) continue;
    const coupon = (bond.amount * bond.rate) / 12;
    s.coins += coupon;
    f.earned += coupon;
    if (s.day >= bond.matures) {
      s.coins += bond.amount;
      f.bonds = f.bonds.filter((b) => b.id !== bond.id);
      ctx.log(`استُحقت سندات ${fmt(bond.amount)} د.ك ورجع المبلغ`);
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

  // Bankruptcy risk. A consultancy contract warns early, so half the money is saved.
  const shield = consulting(s) ? 0.5 : 0;
  const bankRisk = ctx.economicCrisis ? 0.035 : ctx.war ? 0.012 : 0.0015;
  const devRisk = ctx.economicCrisis ? 0.05 : ctx.war ? 0.02 : 0.003;
  const consultRisk = ctx.economicCrisis ? 0.02 : 0.001;
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
}
