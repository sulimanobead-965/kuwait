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
import { msg, t, type Params, bigNum } from "../i18n/index.ts";
import { CATALOG, type Kind } from "./catalog";
import { freeLot, runPlans } from "./builder";
import { deposit, withdraw } from "./finance";
import { book } from "./ledger";
import { DEVELOPMENTS, type DevelopmentKind } from "./developments";
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
  startMegaSite,
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
  /** National-scale project (big cost, big return). */
  mega?: boolean;
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

/**
 * Mega projects: national-scale works with a large cost, years of building and a
 * large return. Shown in the Projects panel and under their departments.
 */
const MEGA: Record<string, DeptProject> = {
  airport: {
    dept: "works",
    name: "مطار الكويت الدولي الجديد",
    blurb: "مبنى ركاب ضخم ومدرجات جديدة: رحلات وسياحة ووظائف.",
    cost: 400_000,
    upkeep: 2_500,
    income: 14_000,
    months: 36,
    effects: { happy: 4, unemployment: -8 },
    mega: true,
  },
  railway: {
    dept: "works",
    name: "سكة حديد الخليج",
    blurb: "قطار سريع يربط المدن ويخفف الطرق.",
    cost: 500_000,
    upkeep: 3_000,
    income: 15_000,
    months: 40,
    effects: { traffic: -25, happy: 3 },
    mega: true,
  },
  intlPower: {
    dept: "energy",
    name: "محطة الطاقة الدولية",
    blurb: "محطة عملاقة تصدّر الكهرباء لدول الخليج.",
    cost: 300_000,
    upkeep: 2_000,
    income: 11_000,
    months: 30,
    effects: { pollution: -6 },
    build: { kind: "power", count: 6 },
    mega: true,
  },
  megaPort: {
    dept: "industry",
    name: "ميناء مبارك الكبير",
    blurb: "ميناء حاويات عملاق على طريق الحرير.",
    cost: 350_000,
    upkeep: 2_500,
    income: 13_000,
    months: 36,
    effects: { unemployment: -8 },
    build: { kind: "port", count: 3 },
    mega: true,
  },
  megaRefinery: {
    dept: "industry",
    name: "مصفاة الزور العملاقة",
    blurb: "من أكبر المصافي في العالم: عائد ضخم وتلوث.",
    cost: 600_000,
    upkeep: 4_000,
    income: 24_000,
    months: 40,
    effects: { pollution: 10, unemployment: -10 },
    build: { kind: "refinery", count: 3 },
    mega: true,
  },
  silkCity: {
    dept: "construction",
    name: "مدينة الحرير",
    blurb: "مدينة أعمال وأبراج شاهقة شمال الجون.",
    cost: 800_000,
    upkeep: 4_000,
    income: 26_000,
    months: 48,
    effects: { happy: 3, unemployment: -10 },
    build: { kind: "tower", count: 12 },
    mega: true,
  },
  techCity: {
    dept: "investment",
    name: "مدينة التقنية والذكاء الاصطناعي",
    blurb: "شركات تقنية عالمية ومراكز بيانات.",
    cost: 450_000,
    upkeep: 2_500,
    income: 16_000,
    months: 36,
    effects: { unemployment: -12, education: 10 },
    mega: true,
  },
  medicalCity: {
    dept: "health",
    name: "مدينة طبية متكاملة",
    blurb: "مستشفيات تخصصية تجذب المرضى من المنطقة.",
    cost: 250_000,
    upkeep: 2_500,
    income: 6_000,
    months: 30,
    effects: { health: 25, happy: 2 },
    build: { kind: "clinic", count: 6 },
    mega: true,
  },
  resort: {
    dept: "tourism",
    name: "منتجع سياحي عالمي",
    blurb: "فنادق وشاليهات ومرسى يخوت على البحر.",
    cost: 300_000,
    upkeep: 1_500,
    income: 10_000,
    months: 30,
    effects: { happy: 5 },
    build: { kind: "chalet", count: 6 },
    mega: true,
  },
};
Object.assign(PROJECTS, MEGA);

export const PROJECT_KEYS = Object.keys(PROJECTS);
export const MEGA_KEYS = Object.keys(MEGA);

/** A setting the governor can change for a director (thresholds, shares, rates). */
export type DeptParam = { key: string; label: string; unit: "%" | "n" | "x"; def: number; max?: number };

export const DEPT_PARAMS: Record<DeptId, DeptParam[]> = {
  tax: [
    { key: "min", label: "أدنى ضريبة", unit: "%", def: 3 },
    { key: "max", label: "أعلى ضريبة", unit: "%", def: 20 },
    { key: "raise", label: "يرفعها إذا الرضا فوق", unit: "%", def: 68, max: 100 },
    { key: "cut", label: "يخفضها إذا الرضا تحت", unit: "%", def: 50, max: 100 },
  ],
  finance: [
    { key: "reserve", label: "الاحتياطي بالأشهر", unit: "n", def: 3 },
    { key: "rate", label: "فائدة التمويل", unit: "%", def: 6 },
    { key: "repay", label: "يسدد إذا الرصيد أكثر من الاحتياطي بـ", unit: "x", def: 3 },
  ],
  construction: [
    { key: "share", label: "ميزانية البناء من الرصيد", unit: "%", def: 25, max: 100 },
    { key: "complex", label: "يطلق مجمعاً إذا السكان فوق", unit: "n", def: 30_000 },
  ],
  investment: [
    { key: "deposit", label: "نسبة الفائض المودعة", unit: "%", def: 30, max: 100 },
    { key: "keep", label: "يودع فوق الاحتياطي بـ", unit: "x", def: 4 },
  ],
  works: [{ key: "traffic", label: "يوسّع الطرق إذا الزحمة فوق", unit: "%", def: 50, max: 100 }],
  energy: [{ key: "margin", label: "فائض الكهرباء والماء المطلوب", unit: "%", def: 5 }],
  centralBank: [{ key: "rate", label: "أعلى فائدة مقبولة على الديون", unit: "%", def: 6 }],
  industry: [
    { key: "jobs", label: "يبني مصانع إذا البطالة فوق", unit: "%", def: 25, max: 100 },
    { key: "refinery", label: "مصفاة لكل عدد سكان", unit: "n", def: 60_000 },
  ],
  health: [{ key: "health", label: "يتدخل إذا الصحة تحت", unit: "%", def: 60, max: 100 }],
  education: [{ key: "education", label: "يتدخل إذا التعليم تحت", unit: "%", def: 50, max: 100 }],
  tourism: [{ key: "approval", label: "يطلق فعاليات إذا الرضا تحت", unit: "%", def: 60, max: 100 }],
};

/** Buildings each director can be ordered to build. */
export const ORDER_KINDS: Record<DeptId, Kind[]> = {
  tax: [],
  finance: [],
  construction: ["apartments", "villa", "modern", "shop", "tower", "park", "school", "clinic", "police", "fire"],
  investment: ["tower", "shop"],
  works: ["park", "police", "fire"],
  energy: ["power", "water"],
  centralBank: [],
  industry: ["factory", "refinery", "port"],
  health: ["clinic"],
  education: ["school"],
  tourism: ["chalet", "park", "avenues", "opera", "stadium"],
};

/** A direct order: "build N of this". Carried out month by month as money allows. */
export type BoardOrder = { id: string; dept: DeptId; kind: Kind; count: number; built: number };

/** One approved project: under way until `completes`, then running. */
export type BoardProject = {
  id: string;
  key: string;
  started: number;
  completes: number;
  scale: number;
  /** Finished and running (its buildings placed). */
  open: boolean;
  /** Mega projects: the fenced construction site on the map. */
  site?: string;
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
  /** The governor's settings for each director, by "dept.key". */
  params: Record<string, number>;
  /** Direct building orders. */
  orders: BoardOrder[];
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
    params: {},
    orders: [],
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
        ...(typeof x.site === "string" ? { site: x.site } : {}),
      }));
  if (Array.isArray(p.log)) b.log = p.log.filter((x) => typeof x === "string").slice(0, 40);
  if (p.params && typeof p.params === "object")
    for (const [k, v] of Object.entries(p.params)) if (Number.isFinite(Number(v))) b.params[k] = Math.max(0, Number(v));
  if (p.buildShare !== undefined && b.params["construction.share"] === undefined)
    b.params["construction.share"] = b.buildShare;
  if (Array.isArray(p.orders))
    b.orders = p.orders
      .filter((o) => o && typeof o === "object" && o.dept in DEPARTMENTS && o.kind in CATALOG)
      .map((o) => ({
        id: String(o.id),
        dept: o.dept,
        kind: o.kind,
        count: Math.max(1, Math.round(n(o.count, 1))),
        built: Math.max(0, Math.round(n(o.built, 0))),
      }));
  return b;
}

/** A director's setting, or its default. */
export function deptParam(s: Sim, dept: DeptId, key: string) {
  const v = s.board?.params?.[`${dept}.${key}`];
  if (v !== undefined) return v;
  return DEPT_PARAMS[dept].find((p) => p.key === key)?.def ?? 0;
}

export function setDeptParam(s: Sim, dept: DeptId, key: string, value: number) {
  const def = DEPT_PARAMS[dept].find((p) => p.key === key);
  if (!def || !Number.isFinite(value)) return;
  s.board.params = { ...s.board.params, [`${dept}.${key}`]: Math.max(0, def.max ? Math.min(def.max, value) : value) };
}

/** Give a director a building order. */
export function addOrder(s: Sim, dept: DeptId, kind: Kind, count: number) {
  if (!ORDER_KINDS[dept].includes(kind) || !(count >= 1))
    return { ok: false, msg: t("أمر غير صحيح") };
  s.board.orders.push({
    id: `${s.day.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    dept,
    kind,
    count: Math.round(count),
    built: 0,
  });
  note(
    s,
    msg("أمر للمدير {director}: بناء {n} × {kind}", {
      director: DEPARTMENTS[dept].director,
      n: Math.round(count),
      kind: CATALOG[kind].name,
    }),
  );
  return { ok: true, msg: t("وصل الأمر للمدير، وينفّذه كل شهر حسب الميزانية") };
}

export function cancelOrder(s: Sim, id: string) {
  s.board.orders = s.board.orders.filter((o) => o.id !== id);
}

/**
 * Orders are carried out every month by authorized directors, whether or not the
 * board runs the city, as far as the money above the reserve allows.
 */
function carryOutOrders(s: Sim) {
  for (const o of s.board.orders) {
    if (o.built >= o.count || !s.board.powers[o.dept]) continue;
    let built = 0;
    while (o.built < o.count) {
      if (s.coins - CATALOG[o.kind].cost < reserve(s)) break;
      if (!placeNear(s, o.kind)) break;
      o.built += 1;
      built += 1;
    }
    if (built)
      note(
        s,
        msg("{director}: بنى {n} × {kind} ({done} من {count})", {
          director: DEPARTMENTS[o.dept].director,
          n: built,
          kind: CATALOG[o.kind].name,
          done: o.built,
          count: o.count,
        }),
      );
  }
  s.board.orders = s.board.orders.filter((o) => o.built < o.count);
}

/** Projects are priced for a city of 10,000 residents and grow with the city. */
// Worked out once per game day: a full statistics pass on every project price made
// the board's monthly decisions slow in very big cities.
const scaleMemo = new WeakMap<Sim, { day: number; value: number }>();

export function projectScale(s: Sim) {
  const day = Math.floor(s.day);
  const hit = scaleMemo.get(s);
  if (hit && hit.day === day) return hit.value;
  const value = Math.max(1, stats(s).residents / 10_000);
  scaleMemo.set(s, { day, value });
  return value;
}

export function projectCost(s: Sim, key: string) {
  return Math.round(PROJECTS[key]!.cost * projectScale(s));
}

const note = (s: Sim, text: string) => {
  s.board.log.unshift(text);
  s.board.log = s.board.log.slice(0, 40);
};

const fmt = (n: number) => bigNum(n);

/** Approve a department project: pays its cost now; it finishes after some months. */
export function approveProject(s: Sim, key: string, by: "governor" | "board" = "governor") {
  const def = PROJECTS[key];
  if (!def) return { ok: false, msg: t("مشروع غير معروف") };
  const cost = projectCost(s, key);
  if (cost > 0 && s.coins < cost)
    return { ok: false, msg: t("تحتاج {amount} د.ك لهذا المشروع", { amount: fmt(cost) }) };
  s.coins -= cost;
  s.ytd.spend += cost;
  book(s, "board", -cost, cost);
  // Municipal bonds bring cash in now, against monthly interest.
  if (key === "bonds") {
    const cash = Math.round(25_000 * projectScale(s));
    s.coins += cash;
  }
  const project: BoardProject = {
    id: `${s.day.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    key,
    started: s.day,
    completes: s.day + def.months * 30,
    scale: projectScale(s),
    open: false,
  };
  // Mega projects are really built: a fenced site at their real place in Kuwait.
  if (def.mega && key in DEVELOPMENTS) {
    const site = startMegaSite(s, key as DevelopmentKind, project.completes);
    if (site) project.site = site.id;
  }
  s.board.projects.push(project);
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
  // Coastal kinds: a shore lot beside a road, from a list made once a month.
  for (const lot of coastLots(s)) {
    if (!cellTaken(s, lot.c, lot.r)) return placeBuilding(s, kind, lot.c, lot.r, 0).ok;
  }
  return false;
}

/**
 * Shore lots beside a road, kept for the month: scanning every road (tens of
 * thousands) for each coastal building ordered was most of a busy month's work.
 */
const coastMemo = new WeakMap<Sim, { sig: string; lots: { c: number; r: number }[] }>();
function coastLots(s: Sim) {
  // A quarter's list: taken lots are skipped on use, and new shore roads are rare.
  const sig = `${Math.floor(s.day / 90)}`;
  const hit = coastMemo.get(s);
  if (hit && hit.sig === sig) return hit.lots;
  const lots: { c: number; r: number }[] = [];
  const seen = new Set<string>();
  for (const key of roadSet(s)) {
    const comma = key.indexOf(",");
    const c = Number(key.slice(0, comma));
    const r = Number(key.slice(comma + 1));
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const x = c + dc;
      const y = r + dr;
      const k = `${x},${y}`;
      if (seen.has(k)) continue;
      seen.add(k);
      if (isLand(x, y) && coastal(x, y) && !cellTaken(s, x, y)) lots.push({ c: x, r: y });
    }
  }
  coastMemo.set(s, { sig, lots });
  return lots;
}

/** Finished projects place their buildings once (free: already paid for). */
/** Mega projects approved before they were built on the map get their site now. */
function siteOldMegas(s: Sim) {
  for (const p of s.board.projects) {
    if (p.site || !PROJECTS[p.key]?.mega || !(p.key in DEVELOPMENTS)) continue;
    const site = startMegaSite(s, p.key as DevelopmentKind, Math.max(p.completes, s.day + 30));
    p.site = site?.id ?? "none";
  }
}

function finishProjects(s: Sim) {
  for (const p of s.board.projects) {
    if (p.open || p.completes > s.day) continue;
    p.open = true;
    const def = PROJECTS[p.key]!;
    let built = 0;
    if (p.site && p.site !== "none") {
      note(s, msg("اكتمل «{name}» وافتُتح على الخريطة", { name: def.name }));
      continue;
    }
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

/** Keep some months of running costs in hand (the finance director's setting). */
function reserve(s: Sim) {
  return Math.max(2000, monthlyUpkeep(s) * deptParam(s, "finance", "reserve"));
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
    const cap = deptParam(s, "centralBank", "rate") / 100;
    if (s.loan > 0 && (s.loanRate ?? 0) > cap) {
      s.loanRate = cap;
      say("centralBank", "أعاد جدولة القرض بفائدة {rate}٪", { rate: Math.round(cap * 1000) / 10 });
    }
    tryProject("reserve", s.coins > reserve(s) * 8);
    tryProject("digitalPay", st.residents > 20_000);
  }
  // Finance: cover any deficit with a loan; repay when there is plenty.
  if (can("finance")) {
    if (s.coins < 0) {
      const need = Math.round(-s.coins + reserve(s));
      if (takeLoan(s, need, deptParam(s, "finance", "rate") / 100).ok) say("finance", "غطّت العجز بتمويل {amount} د.ك", { amount: fmt(need) });
    } else if (s.loan > 0 && s.coins > reserve(s) * deptParam(s, "finance", "repay")) {
      const pay = Math.min(s.loan, s.coins - reserve(s) * Math.max(1, deptParam(s, "finance", "repay") - 1));
      if (repayLoan(s, pay).ok) say("finance", "سدّدت {amount} د.ك من القرض", { amount: fmt(pay) });
    }
    tryProject("audit", monthlyUpkeep(s) > 500);
  }
  // Taxes: aim for a city that stays content.
  if (can("tax")) {
    const lo = deptParam(s, "tax", "min"),
      hi = deptParam(s, "tax", "max");
    if (s.tax < lo) {
      s.tax = lo;
      say("tax", "رفع الضريبة إلى {n}٪ والرضا مرتفع", { n: s.tax });
    } else if (s.tax > hi) {
      s.tax = hi;
      say("tax", "خفّض الضريبة إلى {n}٪ لرفع الرضا", { n: s.tax });
    } else if (st.happy >= deptParam(s, "tax", "raise") && s.tax < hi) {
      s.tax += 1;
      say("tax", "رفع الضريبة إلى {n}٪ والرضا مرتفع", { n: s.tax });
    } else if (st.happy < deptParam(s, "tax", "cut") && s.tax > lo) {
      s.tax -= 1;
      say("tax", "خفّض الضريبة إلى {n}٪ لرفع الرضا", { n: s.tax });
    }
    tryProject("eTax", st.residents > 5_000);
    tryProject("customs", countOf(s, "port") > 0);
  }
  // Energy: never let the lights or the taps go out.
  if (can("energy")) {
    const margin = 1 + deptParam(s, "energy", "margin") / 100;
    if (st.powerGive < st.powerUse * margin && s.coins > CATALOG.power.cost * 2 && placeNear(s, "power"))
      say("energy", "بنت محطة كهرباء", {});
    if (st.waterGive < st.waterUse * margin && s.coins > CATALOG.water.cost * 2 && placeNear(s, "water"))
      say("energy", "بنت محطة تحلية", {});
    tryProject("solarFarm", m.pollution > 35);
  }
  // Construction: homes, services and upgrades with a share of the balance.
  if (can("construction")) {
    const budget = Math.floor(Math.max(0, s.coins - reserve(s)) * (deptParam(s, "construction", "share") / 100));
    if (budget > 0) {
      const done = runPlans(s, budget);
      if (done.works) say("construction", "نفّذ {works} بتكلفة {amount} د.ك", { works: done.list, amount: fmt(done.spent) });
    }
    if (st.residents > deptParam(s, "construction", "complex") && s.sites.length === 0 && s.coins > 2_400_000) {
      const act = startDevelopment(s, "compound", undefined, "national");
      if (act.ok) say("construction", "أطلق مجمعاً سكنياً متكاملاً", {});
    }
    tryProject("housing", st.happy > 50 && s.occupancy > 0.9, 3);
    tryProject("mall", m.unemployment > 25, 2);
  }
  // Industry: refineries and factories when the treasury can carry them.
  if (can("industry")) {
    const refineries = countOf(s, "refinery");
    const every = Math.max(1, deptParam(s, "industry", "refinery"));
    const jobs = deptParam(s, "industry", "jobs");
    if (s.coins > CATALOG.refinery.cost * 4 && refineries < 1 + Math.floor(st.residents / every) && placeNear(s, "refinery"))
      say("industry", "بنى مصفاة نفط", {});
    else if (m.unemployment > jobs && s.coins > CATALOG.factory.cost * 4 && placeNear(s, "factory"))
      say("industry", "بنى مصنعاً لتوفير وظائف", {});
    tryProject("factories", m.unemployment > jobs + 5, 2);
  }
  // Works: roads and drainage.
  if (can("works")) {
    tryProject("ringRoad", m.traffic > deptParam(s, "works", "traffic"), 3);
    tryProject("drainage", st.residents > 15_000);
  }
  if (can("health")) {
    const h = deptParam(s, "health", "health");
    tryProject("vaccines", m.health < h);
    tryProject("hospital", m.health < h - 10, 3);
  }
  if (can("education")) {
    const e = deptParam(s, "education", "education");
    tryProject("schools", m.education < e, 3);
    tryProject("university", m.education < e - 10 && st.residents > 20_000);
  }
  if (can("tourism")) {
    tryProject("festival", st.happy < deptParam(s, "tourism", "approval"), 4);
    tryProject("waterfront", st.residents > 10_000, 2);
  }
  // Mega projects only when the treasury can carry them twice over.
  for (const key of MEGA_KEYS) {
    const def = PROJECTS[key]!;
    if (!can(def.dept)) continue;
    const cost = projectCost(s, key);
    tryProject(key, s.coins > cost * 2 && s.coins - cost > reserve(s) * 10);
  }
  // Investment last: put the true surplus to work.
  if (can("investment")) {
    const surplus = s.coins - reserve(s) * deptParam(s, "investment", "keep");
    if (surplus > 5_000) {
      const put = Math.round(surplus * (deptParam(s, "investment", "deposit") / 100));
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
  siteOldMegas(s);
  finishProjects(s);
  carryOutOrders(s);
  const money = projectMoney(s);
  s.coins += money.income - money.upkeep;
  book(s, "board", money.income - money.upkeep);
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
