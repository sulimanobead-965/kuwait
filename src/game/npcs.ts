/**
 * Virtual players: governors, merchants and investors from other parts of Kuwait.
 * The player can chat with them (scripted replies that react to the city, crises and
 * keywords), lend them money at any interest rate, or borrow from them. Higher rates
 * make borrowers more likely to default; every NPC remembers how you treated them.
 */
import type { Sim } from "./sim";
import { msg, percentSign, t, type Params } from "../i18n/index.ts";

export type NpcId = "abufahad" | "umsalem" | "bukhalid" | "sara" | "meshal";

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
  }
  return base;
}

export const npcDef = (id: NpcId) => NPCS.find((n) => n.id === id)!;
const npcOf = (s: Sim, id: NpcId) => s.npcs.find((n) => n.id === id)!;
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
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

/** Pay back early everything you owe this person, if you can. */
export function repayNpc(s: Sim, id: NpcId) {
  const n = npcOf(s, id);
  const total = n.iOwe.reduce((t, l) => t + l.left, 0);
  if (total <= 0) return { ok: false, msg: t("ما عليك له شي") };
  if (s.coins < total) return { ok: false, msg: t("تحتاج {amount} د.ك", { amount: fmt(total) }) };
  s.coins -= total;
  n.cash += total;
  n.iOwe = [];
  n.trust = Math.min(100, n.trust + 8);
  say(n, "them", t("وصلت، الله يبارك لك. رجال وكفو"));
  return { ok: true, msg: t("سدّدت دينك كاملاً") };
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
export function npcMonth(s: Sim, random = Math.random) {
  const news: string[] = [];
  const crisis = s.crisis && s.day < s.crisis.until ? s.crisis.kind : null;
  for (const n of s.npcs) {
    const d = npcDef(n.id);
    n.cash *= 1 + (crisis === "economic" ? -0.01 : d.growth / 12);
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
        continue;
      }
      const pay = Math.min(loan.installment, loan.left);
      s.coins += pay;
      n.cash -= pay;
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
      if (s.coins >= pay) {
        s.coins -= pay;
        n.cash += pay;
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
