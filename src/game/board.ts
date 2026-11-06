/**
 * The board of directors (مجلس الإدارة): a cabinet of department directors who can
 * run the city for the governor. Each department has its own projects, with a
 * one-off cost, a monthly running cost and a monthly return (plus effects on the
 * city), which the governor can approve by hand at any time.
 *
 * With automatic play on, the board decides every month within the powers the
 * governor leaves to each director: taxes, loans and repayments, deposits, building
 * homes and services, upgrades, refineries and complexes, and its own department
 * projects. The governor keeps every power and can act at any time. The board is
 * paid a monthly fee (a share of the month's income) and a yearly bonus (a share of
 * the year's profit), only while it is in charge.
 */
import { msg, t, type Params } from "../i18n/index.ts";
import { CATALOG, type Kind } from "./catalog";
import { freeLot, runPlans } from "./builder";
import { deposit, withdraw } from "./finance";
import {
  coastal,
  cellTaken,
  countOf,
  feeRevenue,
  isLand,
  metrics,
  monthlyIncome,
  monthlyUpkeep,
  placeBuilding,
  repayLoan,
  roadSet,
  startDevelopment,
  stats,
  takeLoan,
  type Sim,
} from "./sim";

export type DeptId =
  | "tax"
  | "finance"
  | "construction"
  | "investment"
  | "works"
  | "energy"
  | "centralBank"
  | "industry"
  | "health"
  | "education"
  | "tourism";

export type Department = {
  name: string;
  /** Fictional director. */
  director: string;
  /** What the director does when the board is in charge. */
  role: string;
};

export const DEPARTMENTS: Record<DeptId, Department> = {
  tax: {
    name: "إدارة الضرائب",
    director: "أ. ناصر الضريبي",
    role: "يضبط نسبة الضريبة حسب رضا الناس.",
  },
  finance: {
    name: "الإدارة المالية",
    director: "أ. منيرة الحسابي",
    role: "تغطي العجز بتمويل، وتسدد الديون حين يتوفر المال.",
  },
  construction: {
    name: "إدارة البناء",
    director: "م. خالد البنّاء",
    role: "يبني البيوت والخدمات ويرقّيها، ويطلق المجمعات السكنية.",
  },
  investment: {
    name: "إدارة الاستثمار",
    director: "أ. سارة المستثمر",
    role: "تودع الفائض في البنك ليعود بأرباح.",
  },
  works: {
    name: "إدارة الأشغال",
    director: "م. فيصل الأشغال",
    role: "يوسّع الطرق ويخفف الزحمة.",
  },
  energy: {
    name: "إدارة الطاقة",
    director: "م. هيا الطاقة",
    role: "تبني محطات الكهرباء والتحلية عند النقص.",
  },
  centralBank: {
    name: "البنك المركزي",
    director: "د. يوسف النقدي",
    role: "يحفظ احتياطياً نقدياً ويخفض فوائد الديون.",
  },
  industry: {
    name: "إدارة الصناعة",
    director: "م. بدر الصناعي",
    role: "يبني المصافي والمصانع والموانئ حين تسمح الميزانية.",
  },
  health: {
    name: "إدارة الصحة",
    director: "د. مريم الصحية",
    role: "ترفع الصحة بمشاريعها حين تنزل.",
  },
  education: {
    name: "إدارة التعليم",
    director: "د. عبدالله المعلّم",
    role: "يرفع التعليم بمشاريعه حين ينزل.",
  },
  tourism: {
    name: "إدارة السياحة",
    director: "أ. دانة السياحية",
    role: "تطلق مشاريع سياحية حين ينزل رضا الناس.",
  },
};

export const DEPT_IDS = Object.keys(DEPARTMENTS) as DeptId[];

export type ProjectEffects = {
  happy?: number;
  pollution?: number;
  traffic?: number;
  crime?: number;
  health?: number;
  education?: number;
  unemployment?: number;
};

export type DeptProject = {
  dept: DeptId;
  name: string;
  blurb: string;
  /** One-off cost, monthly running cost and monthly return, for a city of 10,000. */
  cost: number;
  upkeep: number;
  income: number;
  months: number;
  effects?: ProjectEffects;
  /** Buildings placed in the city when it is finished. */
  build?: { kind: Kind; count: number };
};

/** Department projects. Money scales with the city's size (see `projectScale`). */
export const PROJECTS: Record<string, DeptProject> = {
  eTax: {
    dept: "tax",
    name: "التحصيل الضريبي الإلكتروني",
    blurb: "يرفع التحصيل ويقلل التهرب.",
    cost: 3000,
    upkeep: 40,
    income: 260,
    months: 4,
  },
  customs: {
    dept: "tax",
    name: "تطوير المنافذ الجمركية",
    blurb: "رسوم جمركية أعلى من التجارة.",
    cost: 6000,
    upkeep: 80,
    income: 420,
    months: 6,
    effects: { happy: -1 },
  },
  bonds: {
    dept: "finance",
    name: "إصدار سندات بلدية",
    blurb: "سيولة فورية مقابل فوائد شهرية.",
    cost: 0,
    upkeep: 180,
    income: 0,
    months: 1,
  },
  audit: {
    dept: "finance",
    name: "التدقيق ومكافحة الهدر",
    blurb: "يخفض المصروفات الضائعة.",
    cost: 2500,
    upkeep: 30,
    income: 200,
    months: 3,
  },
  housing: {
    dept: "construction",
    name: "مشروع إسكان حكومي",
    blurb: "عمارات سكنية جديدة للأسر.",
    cost: 9000,
    upkeep: 60,
    income: 120,
    months: 8,
    effects: { happy: 2 },
    build: { kind: "apartments", count: 6 },
  },
  mall: {
    dept: "construction",
    name: "مجمع تجاري",
    blurb: "محلات وأبراج تجارية ووظائف.",
    cost: 12000,
    upkeep: 80,
    income: 300,
    months: 10,
    effects: { unemployment: -5 },
    build: { kind: "shop", count: 5 },
  },
  fund: {
    dept: "investment",
    name: "صندوق استثماري سيادي",
    blurb: "عائد شهري ثابت من استثمارات خارجية.",
    cost: 20000,
    upkeep: 50,
    income: 520,
    months: 12,
  },
  freeZone: {
    dept: "investment",
    name: "منطقة تجارية حرة",
    blurb: "تجذب الشركات وتخلق وظائف.",
    cost: 15000,
    upkeep: 120,
    income: 600,
    months: 14,
    effects: { unemployment: -8 },
  },
  ringRoad: {
    dept: "works",
    name: "توسعة الطرق الدائرية",
    blurb: "زحمة أقل بكثير.",
    cost: 8000,
    upkeep: 60,
    income: 0,
    months: 9,
    effects: { traffic: -18, happy: 2 },
  },
  drainage: {
    dept: "works",
    name: "شبكة تصريف الأمطار",
    blurb: "شوارع آمنة في الشتاء.",
    cost: 5000,
    upkeep: 40,
    income: 0,
    months: 6,
    effects: { happy: 2, health: 3 },
  },
  solarFarm: {
    dept: "energy",
    name: "مزرعة الطاقة الشمسية",
    blurb: "كهرباء نظيفة تباع للشبكة.",
    cost: 14000,
    upkeep: 60,
    income: 380,
    months: 12,
    effects: { pollution: -10 },
  },
  powerPlants: {
    dept: "energy",
    name: "محطات كهرباء وتحلية",
    blurb: "محطتا كهرباء ومحطة تحلية.",
    cost: 4000,
    upkeep: 30,
    income: 0,
    months: 3,
    build: { kind: "power", count: 2 },
  },
  reserve: {
    dept: "centralBank",
    name: "صندوق الاحتياطي",
    blurb: "يحمي المدينة من الأزمات ويعود بفائدة.",
    cost: 10000,
    upkeep: 0,
    income: 160,
    months: 2,
  },
  digitalPay: {
    dept: "centralBank",
    name: "نظام الدفع الرقمي",
    blurb: "تجارة أنشط ورسوم تحويل.",
    cost: 6000,
    upkeep: 50,
    income: 240,
    months: 5,
    effects: { happy: 1 },
  },
  refinery: {
    dept: "industry",
    name: "مصفاة نفط جديدة",
    blurb: "أكبر عائد، مع تلوث.",
    cost: 9000,
    upkeep: 100,
    income: 300,
    months: 10,
    effects: { pollution: 6, unemployment: -6 },
    build: { kind: "refinery", count: 1 },
  },
  factories: {
    dept: "industry",
    name: "مدينة صناعية",
    blurb: "مصانع ووظائف كثيرة.",
    cost: 7000,
    upkeep: 70,
    income: 180,
    months: 8,
    effects: { unemployment: -10, pollution: 4 },
    build: { kind: "factory", count: 3 },
  },
  hospital: {
    dept: "health",
    name: "مستشفى عام",
    blurb: "صحة أعلى ورضا.",
    cost: 8000,
    upkeep: 90,
    income: 40,
    months: 9,
    effects: { health: 15, happy: 2 },
    build: { kind: "clinic", count: 2 },
  },
  vaccines: {
    dept: "health",
    name: "حملة صحة وقائية",
    blurb: "أمراض أقل.",
    cost: 2000,
    upkeep: 20,
    income: 0,
    months: 2,
    effects: { health: 6 },
  },
  university: {
    dept: "education",
    name: "جامعة",
    blurb: "تعليم أعلى ووظائف.",
    cost: 12000,
    upkeep: 110,
    income: 120,
    months: 12,
    effects: { education: 20, unemployment: -3 },
    build: { kind: "school", count: 2 },
  },
  schools: {
    dept: "education",
    name: "مدارس نموذجية",
    blurb: "مقاعد دراسية أكثر.",
    cost: 4000,
    upkeep: 40,
    income: 0,
    months: 5,
    effects: { education: 8 },
    build: { kind: "school", count: 2 },
  },
  festival: {
    dept: "tourism",
    name: "مهرجان سياحي سنوي",
    blurb: "زوار ودخل ورضا.",
    cost: 3000,
    upkeep: 30,
    income: 220,
    months: 3,
    effects: { happy: 3 },
  },
  waterfront: {
    dept: "tourism",
    name: "واجهة بحرية وممشى",
    blurb: "شاليهات وحدائق على البحر.",
    cost: 9000,
    upkeep: 50,
    income: 260,
    months: 9,
    effects: { happy: 3 },
    build: { kind: "chalet", count: 3 },
  },
};

export const PROJECT_KEYS = Object.keys(PROJECTS);

/** One approved project: under way until `completes`, then running. */
export type BoardProject = {
  id: string;
  key: string;
  started: number;
  completes: number;
  scale: number;
  /** Finished and running (its buildings placed). */
  open: boolean;
};

export type BoardState = {
  /** Automatic play: the board runs the city each month. */
  auto: boolean;
  /** Which directors may act on their own (all on by default). */
  powers: Record<DeptId, boolean>;
  /** Share of the balance the construction director may spend each month, %. */
  buildShare: number;
  /** Monthly fee, % of the month's income; yearly bonus, % of the year's profit. */
  feePct: number;
  bonusPct: number;
  projects: BoardProject[];
  /** Lifetime money paid to the board, and paid this year. */
  paid: number;
  paidYear: number;
  /** Recent decisions, newest first (encoded messages). */
  log: string[];
};

export function emptyBoard(): BoardState {
  return {
    auto: false,
    powers: Object.fromEntries(DEPT_IDS.map((d) => [d, true])) as Record<DeptId, boolean>,
    buildShare: 25,
    feePct: 1,
    bonusPct: 5,
    projects: [],
    paid: 0,
    paidYear: 0,
    log: [],
  };
}

export function loadBoard(raw: unknown): BoardState {
  const b = emptyBoard();
  if (!raw || typeof raw !== "object") return b;
  const p = raw as Partial<BoardState>;
  const n = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
  b.auto = Boolean(p.auto);
  if (p.powers && typeof p.powers === "object")
    for (const d of DEPT_IDS) b.powers[d] = (p.powers as Record<string, unknown>)[d] !== false;
  b.buildShare = Math.min(100, Math.max(0, n(p.buildShare, 25)));
  b.feePct = Math.max(0, n(p.feePct, 1));
  b.bonusPct = Math.max(0, n(p.bonusPct, 5));
  b.paid = Math.max(0, n(p.paid, 0));
  b.paidYear = Math.max(0, n(p.paidYear, 0));
  if (Array.isArray(p.projects))
    b.projects = p.projects
      .filter((x) => x && typeof x === "object" && (x as BoardProject).key in PROJECTS)
      .map((x) => ({
        id: String(x.id),
        key: x.key,
        started: n(x.started, 0),
        completes: n(x.completes, 0),
        scale: Math.max(1, n(x.scale, 1)),
        open: Boolean(x.open),
      }));
  if (Array.isArray(p.log)) b.log = p.log.filter((x) => typeof x === "string").slice(0, 40);
  return b;
}

/** Projects are priced for a city of 10,000 residents and grow with the city. */
export function projectScale(s: Sim) {
  return Math.max(1, stats(s).residents / 10_000);
}

export function projectCost(s: Sim, key: string) {
  return Math.round(PROJECTS[key]!.cost * projectScale(s));
}

const note = (s: Sim, text: string) => {
  s.board.log.unshift(text);
  s.board.log = s.board.log.slice(0, 40);
};

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/** Approve a department project: pays its cost now; it finishes after some months. */
export function approveProject(s: Sim, key: string, by: "governor" | "board" = "governor") {
  const def = PROJECTS[key];
  if (!def) return { ok: false, msg: t("مشروع غير معروف") };
  const cost = projectCost(s, key);
  if (cost > 0 && s.coins < cost)
    return { ok: false, msg: t("تحتاج {amount} د.ك لهذا المشروع", { amount: fmt(cost) }) };
  s.coins -= cost;
  s.ytd.spend += cost;
  // Municipal bonds bring cash in now, against monthly interest.
  if (key === "bonds") {
    const cash = Math.round(25_000 * projectScale(s));
    s.coins += cash;
  }
  s.board.projects.push({
    id: `${s.day.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    key,
    started: s.day,
    completes: s.day + def.months * 30,
    scale: projectScale(s),
    open: false,
  });
  note(
    s,
    msg(by === "board" ? "{director}: اعتمد المجلس «{name}» بتكلفة {amount} د.ك" : "اعتمدت «{name}» بتكلفة {amount} د.ك", {
      director: DEPARTMENTS[def.dept].director,
      name: def.name,
      amount: fmt(cost),
    }),
  );
  return { ok: true, msg: t("بدأ مشروع «{name}»", { name: t(def.name) }) };
}

/** Effects of finished, running projects (like laws). */
export function boardEffect(s: Sim, key: keyof ProjectEffects) {
  let total = 0;
  for (const p of s.board?.projects ?? []) {
    if (!p.open) continue;
    const v = PROJECTS[p.key]?.effects?.[key];
    if (v) total += v;
  }
  return total;
}

/** Money the running projects bring in and cost each month. */
export function projectMoney(s: Sim) {
  let income = 0,
    upkeep = 0;
  for (const p of s.board?.projects ?? []) {
    const d = PROJECTS[p.key]!;
    if (p.key === "bonds") {
      // Interest runs from day one, for ten years.
      if (s.day < p.started + 3650) upkeep += d.upkeep * p.scale;
      continue;
    }
    if (!p.open) continue;
    income += d.income * p.scale;
    upkeep += d.upkeep * p.scale;
  }
  return { income, upkeep };
}

export function boardFee(s: Sim) {
  return s.board.auto ? Math.max(0, (monthlyIncome(s) + feeRevenue(s)) * (s.board.feePct / 100)) : 0;
}

function placeNear(s: Sim, kind: Kind) {
  const needsCoast = CATALOG[kind].needsCoast;
  if (!needsCoast) {
    const lot = freeLot(s);
    return lot ? placeBuilding(s, kind, lot.c, lot.r, 0).ok : false;
  }
  // Coastal kinds: a shore lot beside a road.
  const roads = roadSet(s);
  for (const key of roads) {
    const [c, r] = key.split(",").map(Number) as [number, number];
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const x = c + dc,
        y = r + dr;
      if (isLand(x, y) && coastal(x, y) && !cellTaken(s, x, y))
        return placeBuilding(s, kind, x, y, 0).ok;
    }
  }
  return false;
}

/** Finished projects place their buildings once (free: already paid for). */
function finishProjects(s: Sim) {
  for (const p of s.board.projects) {
    if (p.open || p.completes > s.day) continue;
    p.open = true;
    const def = PROJECTS[p.key]!;
    let built = 0;
    if (def.build) {
      const coins = s.coins;
      for (let i = 0; i < def.build.count; i += 1) if (placeNear(s, def.build.kind)) built += 1;
      // The project's cost already covered these buildings.
      s.coins = coins;
    }
    note(
      s,
      built
        ? msg("اكتمل «{name}»: {n} مبنى جديد", { name: def.name, n: built })
        : msg("اكتمل «{name}» وبدأ تشغيله", { name: def.name }),
    );
  }
}

/** Keep about three months of running costs in hand. */
function reserve(s: Sim) {
  return Math.max(2000, monthlyUpkeep(s) * 3);
}

/** The board's decisions for one month, director by director. */
function decide(s: Sim) {
  const b = s.board;
  const st = stats(s);
  const m = metrics(s, st);
  const can = (d: DeptId) => b.powers[d];
  const say = (d: DeptId, text: string, params: Params) =>
    note(s, msg("{director}: {text}", { director: DEPARTMENTS[d].director, text: msg(text, params) }));
  const running = (key: string) => b.projects.some((p) => p.key === key && p.completes > s.day);
  const count = (key: string) => b.projects.filter((p) => p.key === key).length;
  const tryProject = (key: string, need: boolean, max = 1) => {
    if (!need || running(key) || count(key) >= max) return false;
    const cost = projectCost(s, key);
    if (s.coins - cost < reserve(s) * 1.5) return false;
    return approveProject(s, key, "board").ok;
  };

  // Central bank: protect the reserve, then cheapen expensive debt.
  if (can("centralBank")) {
    if (s.coins < reserve(s) && s.finance.deposit > 0) {
      const take = Math.min(s.finance.deposit, reserve(s) - s.coins);
      if (withdraw(s, take).ok) say("centralBank", "سحب {amount} د.ك من الودائع للاحتياطي", { amount: fmt(take) });
    }
    if (s.loan > 0 && (s.loanRate ?? 0) > 0.06) {
      s.loanRate = 0.06;
      say("centralBank", "أعاد جدولة القرض بفائدة ٦٪", {});
    }
    tryProject("reserve", s.coins > reserve(s) * 8);
    tryProject("digitalPay", st.residents > 20_000);
  }
  // Finance: cover any deficit with a loan; repay when there is plenty.
  if (can("finance")) {
    if (s.coins < 0) {
      const need = Math.round(-s.coins + reserve(s));
      if (takeLoan(s, need, 0.06).ok) say("finance", "غطّت العجز بتمويل {amount} د.ك", { amount: fmt(need) });
    } else if (s.loan > 0 && s.coins > reserve(s) * 3) {
      const pay = Math.min(s.loan, s.coins - reserve(s) * 2);
      if (repayLoan(s, pay).ok) say("finance", "سدّدت {amount} د.ك من القرض", { amount: fmt(pay) });
    }
    tryProject("audit", monthlyUpkeep(s) > 500);
  }
  // Taxes: aim for a city that stays content.
  if (can("tax")) {
    if (st.happy >= 68 && s.tax < 20) {
      s.tax += 1;
      say("tax", "رفع الضريبة إلى {n}٪ والرضا مرتفع", { n: s.tax });
    } else if (st.happy < 50 && s.tax > 3) {
      s.tax -= 1;
      say("tax", "خفّض الضريبة إلى {n}٪ لرفع الرضا", { n: s.tax });
    }
    tryProject("eTax", st.residents > 5_000);
    tryProject("customs", countOf(s, "port") > 0);
  }
  // Energy: never let the lights or the taps go out.
  if (can("energy")) {
    if (st.powerGive < st.powerUse * 1.05 && s.coins > CATALOG.power.cost * 2 && placeNear(s, "power"))
      say("energy", "بنت محطة كهرباء", {});
    if (st.waterGive < st.waterUse * 1.05 && s.coins > CATALOG.water.cost * 2 && placeNear(s, "water"))
      say("energy", "بنت محطة تحلية", {});
    tryProject("solarFarm", m.pollution > 35);
  }
  // Construction: homes, services and upgrades with a share of the balance.
  if (can("construction")) {
    const budget = Math.floor(Math.max(0, s.coins - reserve(s)) * (b.buildShare / 100));
    if (budget > 0) {
      const done = runPlans(s, budget);
      if (done.works) say("construction", "نفّذ {works} بتكلفة {amount} د.ك", { works: done.list, amount: fmt(done.spent) });
    }
    if (st.residents > 30_000 && s.sites.length === 0 && s.coins > 2_400_000) {
      const act = startDevelopment(s, "compound", undefined, "national");
      if (act.ok) say("construction", "أطلق مجمعاً سكنياً متكاملاً", {});
    }
    tryProject("housing", st.happy > 50 && s.occupancy > 0.9, 3);
    tryProject("mall", m.unemployment > 25, 2);
  }
  // Industry: refineries and factories when the treasury can carry them.
  if (can("industry")) {
    const refineries = countOf(s, "refinery");
    if (s.coins > CATALOG.refinery.cost * 4 && refineries < 1 + Math.floor(st.residents / 60_000) && placeNear(s, "refinery"))
      say("industry", "بنى مصفاة نفط", {});
    else if (m.unemployment > 25 && s.coins > CATALOG.factory.cost * 4 && placeNear(s, "factory"))
      say("industry", "بنى مصنعاً لتوفير وظائف", {});
    tryProject("factories", m.unemployment > 30, 2);
  }
  // Works: roads and drainage.
  if (can("works")) {
    tryProject("ringRoad", m.traffic > 50, 3);
    tryProject("drainage", st.residents > 15_000);
  }
  if (can("health")) {
    tryProject("vaccines", m.health < 60);
    tryProject("hospital", m.health < 50, 3);
  }
  if (can("education")) {
    tryProject("schools", m.education < 50, 3);
    tryProject("university", m.education < 40 && st.residents > 20_000);
  }
  if (can("tourism")) {
    tryProject("festival", st.happy < 60, 4);
    tryProject("waterfront", st.residents > 10_000, 2);
  }
  // Investment last: put the true surplus to work.
  if (can("investment")) {
    const surplus = s.coins - reserve(s) * 4;
    if (surplus > 5_000) {
      const put = Math.round(surplus * 0.3);
      if (deposit(s, put).ok) say("investment", "أودعت {amount} د.ك في البنك", { amount: fmt(put) });
    }
    tryProject("fund", s.coins > reserve(s) * 10, 3);
    tryProject("freeZone", m.unemployment > 20, 2);
  }
}

/**
 * One month: finished projects open, running projects pay and cost, and, when the
 * board is in charge, it decides and takes its monthly fee.
 */
export function boardMonth(s: Sim) {
  const b = s.board;
  finishProjects(s);
  const money = projectMoney(s);
  s.coins += money.income - money.upkeep;
  s.ytd.income += money.income;
  s.ytd.spend += money.upkeep;
  if (!b.auto) return;
  decide(s);
  const fee = boardFee(s);
  if (fee > 0) {
    s.coins -= fee;
    s.ytd.spend += fee;
    b.paid += fee;
    b.paidYear += fee;
  }
}

/** Year end: the yearly bonus, a share of the year's profit, if there was one. */
export function boardYear(s: Sim, profit: number) {
  const b = s.board;
  if (b.auto && profit > 0 && b.bonusPct > 0) {
    const bonus = profit * (b.bonusPct / 100);
    s.coins -= bonus;
    b.paid += bonus;
    note(s, msg("مكافأة المجلس السنوية {amount} د.ك ({pct}٪ من ربح السنة)", { amount: fmt(bonus), pct: b.bonusPct }));
  }
  b.paidYear = 0;
}
