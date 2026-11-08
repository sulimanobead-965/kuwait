/**
 * Virtual players: governors, merchants and investors from other parts of Kuwait.
 * The player can chat with them (scripted replies that react to the city, crises and
 * keywords), lend them money at any interest rate, or borrow from them. Higher rates
 * make borrowers more likely to default; every NPC remembers how you treated them.
 */
import type { Sim } from "./sim";
import { msg, percentSign, t, type Params, bigNum } from "../i18n/index.ts";

export type NpcId =
  | "abufahad"
  | "umsalem"
  | "bukhalid"
  | "sara"
  | "meshal"
  | "bubader"
  | "umfaisal"
  | "nasser"
  | "hamad"
  | "abuyousef"
  | "noura"
  | "abuali"
  | "umkhaled"
  | "fahad"
  | "bunasser";

export type NpcDef = {
  id: NpcId;
  name: string;
  role: string;
  avatar: string;
  /** Starting cash and how fast it grows each month. */
  cash: number;
  growth: number;
  /** 0–1: chance-per-month scale of not paying back, before rate and crisis. */
  risk: number;
  /** Yearly rate this person normally asks when lending to you. */
  lendRate: number;
  greet: string[];
  style: "formal" | "warm" | "merchant" | "young" | "builder";
  /** Companies and stakes owned (value at the start; grows with their fortunes). */
  holdings: { name: string; pct: number; value: number }[];
  /** Bank debt at the start, paid off over five years. */
  bankDebt: number;
  /** Chance that a tender they win is overpriced at the city's expense. */
  integrity: number;
};

export const NPCS: readonly NpcDef[] = [
  {
    id: "abufahad",
    name: "أبو فهد",
    role: "محافظ الجهراء",
    avatar: "🧔🏽",
    cash: 400_000,
    growth: 0.02,
    risk: 0.004,
    lendRate: 0.08,
    greet: ["حيّاك الله يا جار", "هلا والله بالمحافظ", "مساء الخير، شلونك وشلون أهلك؟"],
    style: "formal",
    holdings: [
      { name: "شركة الجهراء للأغذية", pct: 60, value: 2_000_000 },
      { name: "حصة في بنك الخليج", pct: 2, value: 800_000 },
    ],
    bankDebt: 500_000,
    integrity: 0.05,
  },
  {
    id: "umsalem",
    name: "أم سالم",
    role: "مختارة الفحيحيل",
    avatar: "👩🏽‍💼",
    cash: 150_000,
    growth: 0.025,
    risk: 0.01,
    lendRate: 0.1,
    greet: ["أهلين يا ولدي", "هلا بك، شخبارك؟", "يا هلا، عسى أمورك طيبة"],
    style: "warm",
    holdings: [
      { name: "مشغل أم سالم للخياطة", pct: 100, value: 150_000 },
      { name: "حصة في تعاونية الفحيحيل", pct: 5, value: 300_000 },
    ],
    bankDebt: 50_000,
    integrity: 0.02,
  },
  {
    id: "bukhalid",
    name: "بو خالد",
    role: "تاجر في المباركية",
    avatar: "👨🏽‍🦳",
    cash: 900_000,
    growth: 0.03,
    risk: 0.02,
    lendRate: 0.18,
    greet: ["هلا هلا، عندي لك صفقة", "يا مرحبا، السوق اليوم حامي", "أهلاً يا محافظ، شنو عندك؟"],
    style: "merchant",
    holdings: [
      { name: "مجموعة بو خالد التجارية", pct: 80, value: 5_000_000 },
      { name: "عقارات المباركية", pct: 40, value: 3_000_000 },
    ],
    bankDebt: 2_000_000,
    integrity: 0.25,
  },
  {
    id: "sara",
    name: "سارة",
    role: "مستثمرة شابة في السالمية",
    avatar: "👩🏻‍💻",
    cash: 60_000,
    growth: 0.05,
    risk: 0.035,
    lendRate: 0.14,
    greet: ["هاي! عندي فكرة مشروع", "أهلاً، شفت أرقام السوق اليوم؟", "مرحبا! خلنا نسوي شي كبير"],
    style: "young",
    holdings: [
      { name: "تطبيق سارة للتوصيل", pct: 70, value: 400_000 },
      { name: "محفظة أسهم تقنية", pct: 100, value: 200_000 },
    ],
    bankDebt: 150_000,
    integrity: 0.1,
  },
  {
    id: "meshal",
    name: "مشعل",
    role: "مقاول في الأحمدي",
    avatar: "👷🏽‍♂️",
    cash: 250_000,
    growth: 0.02,
    risk: 0.015,
    lendRate: 0.12,
    greet: ["السلام عليكم يا طويل العمر", "هلا بالمحافظ، عندك شغل؟", "يا هلا، المعدات جاهزة"],
    style: "builder",
    holdings: [
      { name: "شركة مشعل للمقاولات", pct: 90, value: 1_500_000 },
      { name: "معدات الأحمدي الثقيلة", pct: 50, value: 600_000 },
    ],
    bankDebt: 900_000,
    integrity: 0.3,
  },
  {
    id: "bubader",
    name: "بو بدر",
    role: "وكيل سيارات في الري",
    avatar: "🧔🏻",
    cash: 1_200_000,
    growth: 0.025,
    risk: 0.012,
    lendRate: 0.15,
    greet: ["هلا بو فلان، عندي موديلات جديدة", "يا مرحبا، المعرض زحمة اليوم", "أهلاً يا محافظ، تبي سيارة للبلدية؟"],
    style: "merchant",
    holdings: [
      { name: "وكالة بو بدر للسيارات", pct: 75, value: 6_000_000 },
      { name: "معارض الري", pct: 60, value: 2_500_000 },
    ],
    bankDebt: 2_500_000,
    integrity: 0.15,
  },
  {
    id: "umfaisal",
    name: "أم فيصل",
    role: "سيدة أعمال عقار في الجابرية",
    avatar: "🧕🏻",
    cash: 800_000,
    growth: 0.022,
    risk: 0.008,
    lendRate: 0.09,
    greet: ["حياك الله يا ولدي", "هلا والله، شلون الديرة معاك؟", "أهلين، عندي عمارات للإيجار"],
    style: "warm",
    holdings: [
      { name: "عقارات أم فيصل", pct: 90, value: 4_000_000 },
      { name: "حصة في مجمع الجابرية", pct: 30, value: 1_200_000 },
    ],
    bankDebt: 600_000,
    integrity: 0.04,
  },
  {
    id: "nasser",
    name: "ناصر",
    role: "مطوّر عقاري في صباح الأحمد",
    avatar: "👨🏽‍💼",
    cash: 700_000,
    growth: 0.03,
    risk: 0.02,
    lendRate: 0.13,
    greet: ["السلام عليكم، عندنا مخطط جديد", "هلا بالمحافظ، الأرض جاهزة؟", "يا هلا، نبني لك مدينة كاملة"],
    style: "builder",
    holdings: [
      { name: "ناصر للتطوير العقاري", pct: 85, value: 5_500_000 },
      { name: "مخططات صباح الأحمد", pct: 40, value: 2_000_000 },
    ],
    bankDebt: 3_000_000,
    integrity: 0.2,
  },
  {
    id: "hamad",
    name: "حمد",
    role: "مستثمر شاب في المرقاب",
    avatar: "🧑🏽",
    cash: 120_000,
    growth: 0.06,
    risk: 0.04,
    lendRate: 0.16,
    greet: ["هلا! شفت السوق اليوم؟", "مرحبا، عندي ستارت أب واعد", "هاي، خلنا نتكلم أرقام"],
    style: "young",
    holdings: [
      { name: "منصة حمد للحجوزات", pct: 60, value: 700_000 },
      { name: "مكاتب مشتركة في المرقاب", pct: 50, value: 400_000 },
    ],
    bankDebt: 250_000,
    integrity: 0.12,
  },
  {
    id: "abuyousef",
    name: "أبو يوسف",
    role: "تاجر ذهب في المباركية",
    avatar: "👴🏽",
    cash: 2_000_000,
    growth: 0.018,
    risk: 0.006,
    lendRate: 0.11,
    greet: ["حياك الله، الذهب اليوم غالي", "هلا يا محافظ، تفضل قهوة", "يا مرحبا بك في السوق"],
    style: "merchant",
    holdings: [
      { name: "مجوهرات أبو يوسف", pct: 100, value: 3_500_000 },
      { name: "محلات في المباركية", pct: 70, value: 2_800_000 },
    ],
    bankDebt: 300_000,
    integrity: 0.08,
  },
  {
    id: "noura",
    name: "نورة",
    role: "صاحبة مجمعات تجارية في السالمية",
    avatar: "👩🏽‍💼",
    cash: 500_000,
    growth: 0.04,
    risk: 0.018,
    lendRate: 0.12,
    greet: ["هلا! المجمع زحمة الويكند", "مرحبا يا محافظ، عندي توسعة", "أهلاً، الإيجارات طايرة"],
    style: "young",
    holdings: [
      { name: "مجمعات نورة التجارية", pct: 70, value: 4_500_000 },
      { name: "مطاعم الواجهة البحرية", pct: 45, value: 900_000 },
    ],
    bankDebt: 1_800_000,
    integrity: 0.1,
  },
  {
    id: "abuali",
    name: "أبو علي",
    role: "صاحب مصانع في الشعيبة",
    avatar: "👨🏽‍🏭",
    cash: 1_000_000,
    growth: 0.02,
    risk: 0.015,
    lendRate: 0.12,
    greet: ["السلام عليكم، المصنع شغال ٢٤ ساعة", "هلا بالمحافظ، نبي كهرباء أكثر", "يا هلا، الإنتاج زاد"],
    style: "builder",
    holdings: [
      { name: "مصانع أبو علي للحديد", pct: 80, value: 5_000_000 },
      { name: "مستودعات الشعيبة", pct: 55, value: 1_500_000 },
    ],
    bankDebt: 2_200_000,
    integrity: 0.22,
  },
  {
    id: "umkhaled",
    name: "أم خالد",
    role: "مستثمرة فنادق في الشويخ",
    avatar: "👵🏽",
    cash: 900_000,
    growth: 0.02,
    risk: 0.01,
    lendRate: 0.1,
    greet: ["هلا يا ولدي، الفندق مليان", "يا هلا، شخبار الأهل؟", "أهلين، عندي ضيوف من برّا"],
    style: "warm",
    holdings: [
      { name: "فنادق أم خالد", pct: 65, value: 4_200_000 },
      { name: "شقق فندقية في الشويخ", pct: 50, value: 1_300_000 },
    ],
    bankDebt: 1_000_000,
    integrity: 0.05,
  },
  {
    id: "fahad",
    name: "فهد",
    role: "صاحب شركة نقل في الصليبية",
    avatar: "👨🏽‍✈️",
    cash: 400_000,
    growth: 0.025,
    risk: 0.02,
    lendRate: 0.14,
    greet: ["السلام عليكم، الشاحنات على الطريق", "هلا يا محافظ، الطرق تبي توسعة", "مرحبا، عندنا عقود نقل جديدة"],
    style: "formal",
    holdings: [
      { name: "فهد للنقل والخدمات اللوجستية", pct: 75, value: 2_400_000 },
      { name: "ساحات الصليبية", pct: 60, value: 800_000 },
    ],
    bankDebt: 900_000,
    integrity: 0.18,
  },
  {
    id: "bunasser",
    name: "بو ناصر",
    role: "شيخ تجار جبلة",
    avatar: "👳🏽‍♂️",
    cash: 3_500_000,
    growth: 0.015,
    risk: 0.004,
    lendRate: 0.08,
    greet: ["حياك الله يا ابن الديرة", "هلا والله بالمحافظ، نورت المجلس", "السلام عليكم، الديرة بخير إن شاء الله"],
    style: "formal",
    holdings: [
      { name: "مجموعة بو ناصر القابضة", pct: 60, value: 9_000_000 },
      { name: "أملاك جبلة القديمة", pct: 80, value: 4_000_000 },
    ],
    bankDebt: 1_500_000,
    integrity: 0.03,
  },
];

export type NpcLoan = {
  id: string;
  amount: number;
  /** Yearly rate agreed. */
  rate: number;
  months: number;
  /** What is still owed, interest included. */
  left: number;
  /** Fixed monthly installment. */
  installment: number;
};

export type NpcState = {
  id: NpcId;
  cash: number;
  /** 0–100: how much this person trusts you. */
  trust: number;
  /** Money they owe you / you owe them. */
  owesMe: NpcLoan[];
  iOwe: NpcLoan[];
  chat: { from: "me" | "them"; text: string }[];
  unread: number;
  /** How their companies have done since the start (1 = unchanged). */
  assets: number;
  /** Bank debt still owed. */
  bankDebt: number;
  /** Tenders won from the city (latest 20). */
  tenders: { title: string; amount: number; day: number }[];
  /** Their account statement (latest 30 entries; + in, − out). */
  statement: { day: number; text: string; amount: number }[];
  year: { income: number; expense: number };
  lastYear: { income: number; expense: number };
  /** Overcharges on tenders not yet found by an audit (hidden from the player). */
  irregular: number;
  /** Proven by the last audit and not yet settled. */
  flagged: number;
  audits: { day: number; found: number; recovered: number }[];
  /** Barred from tenders until this game day after being held to account. */
  bannedUntil: number;
};

export function emptyNpcs(): NpcState[] {
  return NPCS.map((d) => ({
    id: d.id,
    cash: d.cash,
    trust: 55,
    owesMe: [],
    iOwe: [],
    chat: [],
    unread: 0,
    assets: 1,
    bankDebt: d.bankDebt,
    tenders: [],
    statement: [],
    year: { income: 0, expense: 0 },
    lastYear: { income: 0, expense: 0 },
    irregular: 0,
    flagged: 0,
    audits: [],
    bannedUntil: 0,
  }));
}

export function loadNpcs(raw: unknown): NpcState[] {
  const base = emptyNpcs();
  if (!Array.isArray(raw)) return base;
  const loan = (l: Partial<NpcLoan>): NpcLoan => ({
    id: String(l.id ?? Math.random()),
    amount: Number(l.amount) || 0,
    rate: Number(l.rate) || 0,
    months: Math.max(1, Number(l.months) || 1),
    left: Math.max(0, Number(l.left) || 0),
    installment: Math.max(0, Number(l.installment) || 0),
  });
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const p = item as Partial<NpcState>;
    const target = base.find((n) => n.id === p.id);
    if (!target) continue;
    target.cash = Math.max(0, Number(p.cash) || 0);
    target.trust = Math.min(100, Math.max(0, Number(p.trust) || 0));
    target.owesMe = Array.isArray(p.owesMe) ? p.owesMe.map(loan) : [];
    target.iOwe = Array.isArray(p.iOwe) ? p.iOwe.map(loan) : [];
    target.chat = Array.isArray(p.chat)
      ? p.chat
          .filter((m) => m && typeof m.text === "string")
          .map((m) => ({
            from: m.from === "me" ? ("me" as const) : ("them" as const),
            text: m.text,
          }))
          .slice(-40)
      : [];
    target.unread = Math.max(0, Number(p.unread) || 0);
    const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
    const q = p as Partial<NpcState>;
    target.assets = Math.max(0.05, num(q.assets, 1));
    if (q.bankDebt !== undefined) target.bankDebt = Math.max(0, num(q.bankDebt));
    target.tenders = Array.isArray(q.tenders)
      ? q.tenders.filter((x) => x && typeof x.title === "string").map((x) => ({ title: x.title, amount: num(x.amount), day: num(x.day) })).slice(-20)
      : [];
    target.statement = Array.isArray(q.statement)
      ? q.statement.filter((x) => x && typeof x.text === "string").map((x) => ({ day: num(x.day), text: x.text, amount: num(x.amount) })).slice(-30)
      : [];
    target.year = { income: num(q.year?.income), expense: num(q.year?.expense) };
    target.lastYear = { income: num(q.lastYear?.income), expense: num(q.lastYear?.expense) };
    target.irregular = Math.max(0, num(q.irregular));
    target.flagged = Math.max(0, num(q.flagged));
    target.audits = Array.isArray(q.audits)
      ? q.audits.map((a) => ({ day: num(a?.day), found: num(a?.found), recovered: num(a?.recovered) })).slice(-10)
      : [];
    target.bannedUntil = num(q.bannedUntil);
  }
  return base;
}

export const npcDef = (id: NpcId) => NPCS.find((n) => n.id === id)!;
const npcOf = (s: Sim, id: NpcId) => s.npcs.find((n) => n.id === id)!;
const fmt = (n: number) => bigNum(n);
const pctText = (rate: number) =>
  `${(Math.round(rate * 1000) / 10).toLocaleString("en-US")}${percentSign()}`;
const pick = <T>(list: readonly T[], random = Math.random) =>
  list[Math.floor(random() * list.length)]!;

/**
 * Adds a chat line. Chat history is saved as plain text, so new lines are written in
 * the language active when they are said.
 */
function say(n: NpcState, from: "me" | "them", text: string) {
  n.chat.push({ from, text });
  if (n.chat.length > 40) n.chat.splice(0, n.chat.length - 40);
  if (from === "them") n.unread += 1;
}

function makeLoan(amount: number, rate: number, months: number): NpcLoan {
  const total = amount * (1 + (rate * months) / 12);
  return {
    id: Math.random().toString(36).slice(2, 9),
    amount,
    rate,
    months,
    left: total,
    installment: total / months,
  };
}

/** The rate this person asks from you today: trust lowers it, crises raise it. */
export function askRate(s: Sim, id: NpcId) {
  const d = npcDef(id);
  const n = npcOf(s, id);
  const crisis = s.crisis && s.day < s.crisis.until ? 0.06 : 0;
  return Math.max(0.02, d.lendRate + crisis + (55 - n.trust) / 400);
}

/**
 * Lend money to a virtual player at any yearly rate. They accept if they need it and
 * the rate isn't insulting; very high rates are accepted by the desperate, who then
 * often fail to pay.
 */
export function lendTo(
  s: Sim,
  id: NpcId,
  amount: number,
  rate: number,
  months = 12,
  random = Math.random,
) {
  const d = npcDef(id);
  const n = npcOf(s, id);
  if (!(amount > 0) || !(rate >= 0)) return { ok: false, msg: t("أرقام غير صحيحة") };
  if (s.coins < amount) return { ok: false, msg: t("رصيدك ما يكفي") };
  say(
    n,
    "me",
    t("أقرضك {amount} د.ك لمدة {months} شهر بفائدة {rate} سنوياً؟", {
      amount: fmt(amount),
      months,
      rate: pctText(rate),
    }),
  );
  // Acceptance falls as the rate climbs above what they could get elsewhere.
  const fair = d.lendRate;
  const accept = rate <= fair * 1.5 ? 0.95 : Math.max(0.05, 0.9 - (rate - fair * 1.5) * 1.2);
  if (random() > accept) {
    say(
      n,
      "them",
      t(
        pick(
          [
            "لا والله، الفائدة واجد. خلها لغيري",
            "مشكور، بس هالنسبة ما تمشي معي",
            "تبي تذبحني بالفوايد؟ لا شكراً",
          ],
          random,
        ),
      ),
    );
    n.trust = Math.max(0, n.trust - 2);
    return { ok: false, msg: t("{name} رفض العرض", { name: d.name }) };
  }
  s.coins -= amount;
  n.cash += amount;
  n.owesMe.push(makeLoan(amount, rate, months));
  n.trust = Math.min(100, n.trust + (rate === 0 ? 15 : rate <= fair ? 6 : 2));
  if (rate === 0) {
    say(n, "them", t("قرض حسن؟ الله يجزاك خير ويجعلها في ميزان حسناتك. ما أنساها لك"));
    return { ok: true, msg: t("أقرضت {name} قرضاً حسناً", { name: d.name }) };
  }
  say(
    n,
    "them",
    t(
      rate <= fair
        ? "الله يجزاك خير، ما تقصر. بيوصلك القسط كل شهر"
        : "ماشي، اتفقنا. الفايدة ثقيلة بس بحاول ألتزم",
    ),
  );
  return { ok: true, msg: t("أقرضت {name} {amount} د.ك", { name: d.name, amount: fmt(amount) }) };
}

/** Borrow from a virtual player at the rate they ask (or offer more to convince them). */
export function borrowFrom(
  s: Sim,
  id: NpcId,
  amount: number,
  rate: number,
  months = 12,
  random = Math.random,
) {
  const d = npcDef(id);
  const n = npcOf(s, id);
  if (!(amount > 0) || !(rate >= 0)) return { ok: false, msg: t("أرقام غير صحيحة") };
  say(
    n,
    "me",
    t("تقدر تقرضني {amount} د.ك لمدة {months} شهر بفائدة {rate}؟", {
      amount: fmt(amount),
      months,
      rate: pctText(rate),
    }),
  );
  const asked = askRate(s, id);
  if (amount > n.cash * 0.8) {
    say(n, "them", t("والله ما عندي هالمبلغ، أقصى شي {amount} د.ك", { amount: fmt(n.cash * 0.8) }));
    return { ok: false, msg: t("{name} ما عنده المبلغ", { name: d.name }) };
  }
  // A qard hasan between friends (0٪, trust ≥ 75) skips the rate haggling.
  const qardHasan = rate === 0 && n.trust >= 75;
  if (!qardHasan && rate < asked) {
    const chance = Math.max(0, 1 - (asked - rate) * 12) * (n.trust / 100);
    if (random() > chance) {
      say(n, "them", t("أقل شي أقدر عليه {rate} سنوياً", { rate: pctText(asked) }));
      return { ok: false, msg: t("{name} يطلب {rate}", { name: d.name, rate: pctText(asked) }) };
    }
  }
  if (n.trust < 20) {
    say(n, "them", t("سامحني، ما عاد أثق أقرضك بعد اللي صار"));
    return { ok: false, msg: t("{name} ما يثق فيك", { name: d.name }) };
  }
  n.cash -= amount;
  s.coins += amount;
  n.iOwe.push(makeLoan(amount, rate, months));
  say(
    n,
    "them",
    t(
      pick(
        ["تفضل، والله يوفقك. لا تتأخر بالقسط", "حلالك، بس الوعد وعد", "ولا يهمك، بيننا ثقة"],
        random,
      ),
    ),
  );
  return {
    ok: true,
    msg: t("اقترضت {amount} د.ك من {name}", { amount: fmt(amount), name: d.name }),
  };
}

/**
 * Pay back early what you owe this person: everything (no amount), or part of it.
 * A partial payment clears the oldest loans first.
 */
export function repayNpc(s: Sim, id: NpcId, amount?: number) {
  const n = npcOf(s, id);
  const total = n.iOwe.reduce((t, l) => t + l.left, 0);
  if (total <= 0) return { ok: false, msg: t("ما عليك له شي") };
  const want = amount === undefined ? total : Math.min(total, Math.max(0, amount));
  if (!(want > 0)) return { ok: false, msg: t("مبلغ غير صحيح") };
  if (amount === undefined && s.coins < total)
    return { ok: false, msg: t("تحتاج {amount} د.ك", { amount: fmt(total) }) };
  let pay = Math.min(want, Math.max(0, s.coins));
  if (pay <= 0) return { ok: false, msg: t("الرصيد ما يكفي للسداد") };
  const paid = pay;
  s.coins -= pay;
  n.cash += pay;
  for (const loan of n.iOwe) {
    const part = Math.min(loan.left, pay);
    loan.left -= part;
    pay -= part;
    if (loan.left > 0.5) loan.installment = Math.min(loan.installment, loan.left);
    if (pay <= 0) break;
  }
  n.iOwe = n.iOwe.filter((l) => l.left > 0.5);
  if (!n.iOwe.length) {
    n.trust = Math.min(100, n.trust + 8);
    say(n, "them", t("وصلت، الله يبارك لك. رجال وكفو"));
    return { ok: true, msg: t("سدّدت دينك كاملاً") };
  }
  n.trust = Math.min(100, n.trust + 2);
  say(n, "them", t("وصلني {amount} د.ك، مشكور", { amount: fmt(paid) }));
  return { ok: true, msg: t("سدّدت {amount} د.ك من دينك", { amount: fmt(paid) }) };
}

/** Everything you still owe this person. */
export function owedTo(s: Sim, id: NpcId) {
  return npcOf(s, id).iOwe.reduce((t, l) => t + l.left, 0);
}

/**
 * Keyword replies, first match wins. Keys are Arabic source text (see i18n); the
 * patterns understand both Arabic and English, so a player can chat in either.
 */
const KEYWORDS: {
  match: RegExp;
  reply: (s: Sim, d: NpcDef, n: NpcState) => [string, Params?];
}[] = [
  {
    match: /قرض|فلوس|اقرض|سلف|دين|\b(loans?|lend|borrow|money|cash|debts?|credit)\b/i,
    reply: (s, d, n) => [
      "إذا تبي قرض أقدر أعطيك لين {amount} د.ك بفائدة {rate}. وإذا تبي تقرضني قول النسبة",
      { amount: fmt(n.cash * 0.8), rate: pctText(askRate(s, d.id)) },
    ],
  },
  {
    match: /فايدة|فائدة|نسبة|فوائد|\b(interest|rates?|percent)\b/i,
    reply: (s, d) => [
      "السوق اليوم يمشي على {rate} سنوياً. أي شي فوق ٣٠٪ مخاطرة كبيرة على الطرفين",
      { rate: pctText(askRate(s, d.id)) },
    ],
  },
  {
    match: /أزمة|ازمة|حرب|وباء|كورونا|\b(crisis|crises|war|pandemic|covid|recession)\b/i,
    reply: (s) => [
      s.crisis && s.day < s.crisis.until
        ? "الله يعدّيها على خير. لا تحط كل فلوسك بمكان واحد، البنوك تطيح بهالأيام"
        : "الحمد لله الوضع هادي، بس خلك مستعد. الأزمات تجي فجأة",
    ],
  },
  {
    match: /سكان|ناس|سعادة|رضا|\b(people|residents?|happy|happiness|population)\b/i,
    reply: () => ["الناس تبي سكن رخيص ومدارس ومستوصفات قريبة. لا ترفع الإيجارات واجد"],
  },
  {
    match:
      /بناء|عمارة|ترقية|مقاول|ناطحة|\b(build|building|construction|upgrade|contractor|skyscraper|tower)\b/i,
    reply: () => ["العمارات بدل الفلل تضاعف السكان. ومستشار البناء يوفر عليك وقت"],
  },
  {
    match: /شكر|مشكور|تسلم|يعطيك|\b(thanks?|thank you|thx|cheers)\b/i,
    reply: () => ["العفو، واجبنا. الكويت بيتنا كلنا"],
  },
  {
    match: /سلام|هلا|مرحبا|شلونك|صباح|مساء|\b(hello|hi|hey|salam|ahlan|good (morning|evening))\b/i,
    reply: (_s, d) => [pick(d.greet)],
  },
];

/** Free-text chat: scripted, keyword-driven replies in Kuwaiti dialect (or English). */
export function chat(s: Sim, id: NpcId, text: string) {
  const d = npcDef(id);
  const n = npcOf(s, id);
  const clean = text.trim().slice(0, 200);
  if (!clean) return;
  say(n, "me", clean);
  const hit = KEYWORDS.find((k) => k.match.test(clean));
  const owed = n.owesMe.reduce((t, l) => t + l.left, 0);
  const [key, params]: [string, Params?] = hit
    ? hit.reply(s, d, n)
    : owed > 0
      ? ["ما نسيت دينك علي ({amount} د.ك)، القسط واصلك كل شهر إن شاء الله", { amount: fmt(owed) }]
      : [
          pick(
            {
              formal: ["كلامك على عيني وراسي", "إن شاء الله خير، نتعاون فيها"],
              warm: ["الله يحفظك يا ولدي", "تدري إن الفحيحيل تحبك؟"],
              merchant: ["الكلام ما يأكل عيش، خلنا نتكلم أرقام", "السوق يبي جرأة"],
              young: ["فكرة حلوة! خلنا نشتغل عليها", "ترند هالأيام الشاليهات البحرية"],
              builder: ["عطني الأرض وأنا أبني لك", "الحديد غالي بس نتفاهم"],
            }[d.style],
          ),
        ];
  say(n, "them", t(key, params));
  n.trust = Math.min(100, n.trust + 0.5);
}

/** Opens a conversation: greeting plus one line of news. */
export function greet(s: Sim, id: NpcId) {
  const d = npcDef(id);
  const n = npcOf(s, id);
  if (n.chat.length) return;
  say(
    n,
    "them",
    t("{greet}. أنا {name}، {role}.", { greet: pick(d.greet), name: d.name, role: d.role }),
  );
}

/**
 * One month for every virtual player: their cash grows, loans are paid both ways,
 * and borrowers may default (more likely at high rates and in a crisis). Returns
 * news lines for the city log.
 */
// ------------------------------------------------------------ their finances

const TENDERS = [
  "صيانة طرق",
  "بناء مدرسة",
  "توسعة مستوصف",
  "تمديد شبكة مياه",
  "إنارة الشوارع",
  "تجميل الواجهة البحرية",
  "توريد معدات بلدية",
  "تنظيف وصيانة الحدائق",
];

/** One line on their account statement (+ money in, − out), and the year's totals. */
function post(n: NpcState, day: number, text: string, amount: number) {
  if (!amount) return;
  n.statement.push({ day, text, amount });
  if (n.statement.length > 30) n.statement.splice(0, n.statement.length - 30);
  if (amount > 0) n.year.income += amount;
  else n.year.expense -= amount;
}

/** What their companies and stakes are worth today. */
export function holdingsOf(n: NpcState) {
  return npcDef(n.id).holdings.map((h) => ({ ...h, value: h.value * n.assets }));
}

/** Their balance sheet: cash, companies, debts, and what is owed between you. */
export function npcWorth(n: NpcState) {
  const companies = holdingsOf(n).reduce((t, h) => t + h.value, 0);
  const owesMe = n.owesMe.reduce((t, l) => t + l.left, 0);
  const iOwe = n.iOwe.reduce((t, l) => t + l.left, 0);
  const net = n.cash + companies + iOwe - n.bankDebt - owesMe;
  return { cash: n.cash, companies, bankDebt: n.bankDebt, owesMe, iOwe, net };
}

/** What an audit of this person costs: 0.2٪ of their wealth, at least 5,000 KD. */
export function auditCost(s: Sim, id: NpcId) {
  const w = npcWorth(npcOf(s, id));
  return Math.round(Math.max(5_000, (w.cash + w.companies) * 0.002));
}

/**
 * Audit their dealings with the city. Any overcharge on tenders is found and recorded;
 * an honest person is offended by the suspicion.
 */
export function auditNpc(s: Sim, id: NpcId) {
  const n = npcOf(s, id);
  const d = npcDef(id);
  const cost = auditCost(s, id);
  if (s.coins < cost) return { ok: false as const, msg: t("تحتاج {amount} د.ك لتكاليف التدقيق", { amount: fmt(cost) }) };
  s.coins -= cost;
  const found = n.irregular;
  n.irregular = 0;
  n.flagged += found;
  n.audits = [...n.audits, { day: s.day, found, recovered: 0 }].slice(-10);
  if (found > 0) {
    n.trust = Math.max(0, n.trust - 10);
    say(n, "them", t("هذي أخطاء محاسبية بسيطة… خلنا نتفاهم"));
    return { ok: true as const, msg: t("التدقيق على {name}: مخالفات بقيمة {amount} د.ك في المناقصات", { name: t(d.name), amount: fmt(found) }) };
  }
  n.trust = Math.max(0, n.trust - 12);
  say(n, "them", t("حساباتي نظيفة! ليش تشك فيني؟"));
  return { ok: true as const, msg: t("التدقيق على {name}: حساباته نظيفة", { name: t(d.name) }) };
}

/**
 * Hold them to account for what an audit proved: the overcharge back with a 20٪
 * penalty (as far as their cash goes) and five years without tenders.
 */
export function holdToAccount(s: Sim, id: NpcId) {
  const n = npcOf(s, id);
  const d = npcDef(id);
  if (n.flagged <= 0) return { ok: false as const, msg: t("ما في مخالفات ثابتة بالتدقيق") };
  const due = n.flagged * 1.2;
  const paid = Math.min(Math.max(0, n.cash), due);
  n.cash -= paid;
  s.coins += paid;
  post(n, s.day, t("غرامة واسترداد مخالفات للمدينة"), -paid);
  const last = n.audits[n.audits.length - 1];
  if (last) last.recovered += paid;
  n.flagged = 0;
  n.bannedUntil = s.day + 5 * 360;
  n.trust = Math.max(0, n.trust - 15);
  say(n, "them", t("دفعت اللي عليّ… بس ما توقعتها منك"));
  return {
    ok: true as const,
    msg: t("حاسبت {name}: استرددت {amount} د.ك وموقوف عن المناقصات ٥ سنوات", { name: t(d.name), amount: fmt(paid) }),
  };
}

/** Their companies, debts and tenders move on by a month. */
function npcFinanceMonth(s: Sim, n: NpcState, crisis: string | null, random: () => number) {
  const d = npcDef(n.id);
  // Companies grow with the economy (and shrink in a crisis); they pay out profits.
  n.assets = Math.max(0.05, n.assets * (1 + (crisis === "economic" ? -0.02 : d.growth / 12) + (random() - 0.5) * 0.02));
  const profit = holdingsOf(n).reduce((t, h) => t + h.value, 0) * 0.008 * (crisis ? 0.5 : 1);
  n.cash += profit;
  post(n, s.day, t("أرباح الشركات والحصص"), profit);
  if (n.bankDebt > 0) {
    const pay = Math.min(n.bankDebt, d.bankDebt / 60);
    n.bankDebt -= pay;
    n.cash -= pay;
    post(n, s.day, t("قسط تمويل البنك"), -pay);
  }
  const living = Math.max(500, n.cash * 0.002);
  n.cash -= living;
  post(n, s.day, t("مصاريف ومعيشة"), -living);
  // Now and then a tender from the city.
  if (n.bannedUntil <= s.day && random() < 0.15) {
    const title = pick(TENDERS, random);
    const amount = Math.round((20_000 + s.buildings.length * 300) * (0.5 + random() * 1.5));
    const margin = amount * (0.08 + random() * 0.12);
    n.tenders = [...n.tenders, { title, amount, day: s.day }].slice(-20);
    n.cash += margin;
    post(n, s.day, t("ربح مناقصة: {title}", { title: t(title) }), margin);
    // Some overcharge the city.
    if (random() < d.integrity && s.coins > amount * 20) {
      const extra = Math.round(amount * (0.1 + random() * 0.2));
      n.irregular += extra;
      n.cash += extra;
      s.coins -= extra;
    }
  }
  if (Math.floor(s.day / 30) % 12 === 0) {
    n.lastYear = n.year;
    n.year = { income: 0, expense: 0 };
  }
}

export function npcMonth(s: Sim, random = Math.random) {
  const news: string[] = [];
  const crisis = s.crisis && s.day < s.crisis.until ? s.crisis.kind : null;
  for (const n of s.npcs) {
    const d = npcDef(n.id);
    npcFinanceMonth(s, n, crisis, random);
    // They pay you.
    for (const loan of [...n.owesMe]) {
      const odds = d.risk * (1 + loan.rate * 4) * (crisis ? 3 : 1);
      if (random() < odds) {
        news.push(
          msg("{name} أعلن عجزه عن السداد! ضاع {amount} د.ك", {
            name: d.name,
            amount: fmt(loan.left),
          }),
        );
        say(n, "them", t("سامحني يا محافظ، خسرت كل شي وما أقدر أسدد"));
        n.owesMe = n.owesMe.filter((l) => l.id !== loan.id);
        n.trust = Math.max(0, n.trust - 5);
        if (s.finance.insured) {
          s.coins += loan.left;
          s.finance.claims += loan.left;
          news.push(msg("شركة الأمان للتأمين عوّضتك {amount} د.ك", { amount: Math.round(loan.left) }));
        }
        continue;
      }
      const pay = Math.min(loan.installment, loan.left);
      s.coins += pay;
      n.cash -= pay;
      post(n, s.day, t("قسط دين المحافظ"), -pay);
      loan.left -= pay;
      if (loan.left <= 0.5) {
        n.owesMe = n.owesMe.filter((l) => l.id !== loan.id);
        say(n, "them", t("خلصت أقساطك كلها، مشكور على وقفتك"));
        n.trust = Math.min(100, n.trust + 5);
      }
    }
    // You pay them.
    for (const loan of [...n.iOwe]) {
      const pay = Math.min(loan.installment, loan.left);
      if (s.coins < pay && s.finance.insured) {
        // The insurer covers your installment so you never miss one.
        s.coins += pay;
        s.finance.claims += pay;
      }
      if (s.coins >= pay) {
        s.coins -= pay;
        n.cash += pay;
        post(n, s.day, t("قسط من المحافظ"), pay);
        loan.left -= pay;
        if (loan.left <= 0.5) {
          n.iOwe = n.iOwe.filter((l) => l.id !== loan.id);
          n.trust = Math.min(100, n.trust + 6);
          say(n, "them", t("وصلني آخر قسط. كفو والله"));
        }
      } else {
        // Missed installment: a penalty and lost trust.
        loan.left += pay * 0.1;
        n.trust = Math.max(0, n.trust - 10);
        say(n, "them", t("القسط ما وصل! لا تخليني أتكلم مع الناس عنك"));
        news.push(msg("تأخرت عن قسط {name}", { name: d.name }));
      }
    }
    // Now and then someone asks you for help or offers a deal.
    if (random() < 0.06 && n.chat.length > 0) {
      const need = Math.round((20_000 + random() * 200_000) / 1000) * 1000;
      say(
        n,
        "them",
        d.style === "young"
          ? t("عندي مشروع يحتاج {amount} د.ك، تقرضني؟ أرجعها بفائدة {rate}", {
              amount: fmt(need),
              rate: pctText(d.lendRate + 0.04),
            })
          : d.style === "merchant"
            ? t("عندي سيولة، إذا تبي قرض بفائدة {rate} كلمني", { rate: pctText(askRate(s, d.id)) })
            : t("تقدر تساعدنا بـ {amount} د.ك؟ نرجعها مع فايدة", { amount: fmt(need) }),
      );
    }
  }
  return news;
}

export function unreadCount(s: Sim) {
  return s.npcs.reduce((t, n) => t + n.unread, 0);
}

export function markRead(s: Sim, id: NpcId) {
  npcOf(s, id).unread = 0;
}
