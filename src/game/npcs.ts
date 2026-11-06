/**
 * Virtual players: governors, merchants and investors from other parts of Kuwait.
 * The player can chat with them (scripted replies that react to the city, crises and
 * keywords), lend them money at any interest rate, or borrow from them. Higher rates
 * make borrowers more likely to default; every NPC remembers how you treated them.
 */
import type { Sim } from "./sim";

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
const pctText = (rate: number) => `${(Math.round(rate * 1000) / 10).toLocaleString("en-US")}٪`;
const pick = <T>(list: readonly T[], random = Math.random) =>
  list[Math.floor(random() * list.length)]!;

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
  if (!(amount > 0) || !(rate >= 0)) return { ok: false, msg: "أرقام غير صحيحة" };
  if (s.coins < amount) return { ok: false, msg: "رصيدك ما يكفي" };
  say(n, "me", `أقرضك ${fmt(amount)} د.ك لمدة ${months} شهر بفائدة ${pctText(rate)} سنوياً؟`);
  // Acceptance falls as the rate climbs above what they could get elsewhere.
  const fair = d.lendRate;
  const accept = rate <= fair * 1.5 ? 0.95 : Math.max(0.05, 0.9 - (rate - fair * 1.5) * 1.2);
  if (random() > accept) {
    say(
      n,
      "them",
      pick(
        [
          "لا والله، الفائدة واجد. خلها لغيري",
          "مشكور، بس هالنسبة ما تمشي معي",
          "تبي تذبحني بالفوايد؟ لا شكراً",
        ],
        random,
      ),
    );
    n.trust = Math.max(0, n.trust - 2);
    return { ok: false, msg: `${d.name} رفض العرض` };
  }
  s.coins -= amount;
  n.cash += amount;
  n.owesMe.push(makeLoan(amount, rate, months));
  n.trust = Math.min(100, n.trust + (rate === 0 ? 15 : rate <= fair ? 6 : 2));
  if (rate === 0) {
    say(n, "them", "قرض حسن؟ الله يجزاك خير ويجعلها في ميزان حسناتك. ما أنساها لك");
    return { ok: true, msg: `أقرضت ${d.name} قرضاً حسناً` };
  }
  say(
    n,
    "them",
    rate <= fair
      ? "الله يجزاك خير، ما تقصر. بيوصلك القسط كل شهر"
      : "ماشي، اتفقنا. الفايدة ثقيلة بس بحاول ألتزم",
  );
  return { ok: true, msg: `أقرضت ${d.name} ${fmt(amount)} د.ك` };
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
  if (!(amount > 0) || !(rate >= 0)) return { ok: false, msg: "أرقام غير صحيحة" };
  say(n, "me", `تقدر تقرضني ${fmt(amount)} د.ك لمدة ${months} شهر بفائدة ${pctText(rate)}؟`);
  const asked = askRate(s, id);
  if (amount > n.cash * 0.8) {
    say(n, "them", `والله ما عندي هالمبلغ، أقصى شي ${fmt(n.cash * 0.8)} د.ك`);
    return { ok: false, msg: `${d.name} ما عنده المبلغ` };
  }
  // A qard hasan between friends (0٪, trust ≥ 75) skips the rate haggling.
  const qardHasan = rate === 0 && n.trust >= 75;
  if (!qardHasan && rate < asked) {
    const chance = Math.max(0, 1 - (asked - rate) * 12) * (n.trust / 100);
    if (random() > chance) {
      say(n, "them", `أقل شي أقدر عليه ${pctText(asked)} سنوياً`);
      return { ok: false, msg: `${d.name} يطلب ${pctText(asked)}` };
    }
  }
  if (n.trust < 20) {
    say(n, "them", "سامحني، ما عاد أثق أقرضك بعد اللي صار");
    return { ok: false, msg: `${d.name} ما يثق فيك` };
  }
  n.cash -= amount;
  s.coins += amount;
  n.iOwe.push(makeLoan(amount, rate, months));
  say(
    n,
    "them",
    pick(
      ["تفضل، والله يوفقك. لا تتأخر بالقسط", "حلالك، بس الوعد وعد", "ولا يهمك، بيننا ثقة"],
      random,
    ),
  );
  return { ok: true, msg: `اقترضت ${fmt(amount)} د.ك من ${d.name}` };
}

/** Pay back early everything you owe this person, if you can. */
export function repayNpc(s: Sim, id: NpcId) {
  const n = npcOf(s, id);
  const total = n.iOwe.reduce((t, l) => t + l.left, 0);
  if (total <= 0) return { ok: false, msg: "ما عليك له شي" };
  if (s.coins < total) return { ok: false, msg: `تحتاج ${fmt(total)} د.ك` };
  s.coins -= total;
  n.cash += total;
  n.iOwe = [];
  n.trust = Math.min(100, n.trust + 8);
  say(n, "them", "وصلت، الله يبارك لك. رجال وكفو");
  return { ok: true, msg: "سدّدت دينك كاملاً" };
}

const KEYWORDS: { match: RegExp; reply: (s: Sim, d: NpcDef, n: NpcState) => string }[] = [
  {
    match: /قرض|فلوس|اقرض|سلف|دين/,
    reply: (s, d, n) =>
      `إذا تبي قرض أقدر أعطيك لين ${fmt(n.cash * 0.8)} د.ك بفائدة ${pctText(askRate(s, d.id))}. وإذا تبي تقرضني قول النسبة`,
  },
  {
    match: /فايدة|فائدة|نسبة|فوائد/,
    reply: (s, d) =>
      `السوق اليوم يمشي على ${pctText(askRate(s, d.id))} سنوياً. أي شي فوق ٣٠٪ مخاطرة كبيرة على الطرفين`,
  },
  {
    match: /أزمة|ازمة|حرب|وباء|كورونا/,
    reply: (s) =>
      s.crisis && s.day < s.crisis.until
        ? "الله يعدّيها على خير. لا تحط كل فلوسك بمكان واحد، البنوك تطيح بهالأيام"
        : "الحمد لله الوضع هادي، بس خلك مستعد. الأزمات تجي فجأة",
  },
  {
    match: /سكان|ناس|سعادة|رضا/,
    reply: () => "الناس تبي سكن رخيص ومدارس ومستوصفات قريبة. لا ترفع الإيجارات واجد",
  },
  {
    match: /بناء|عمارة|ترقية|مقاول|ناطحة/,
    reply: () => "العمارات بدل الفلل تضاعف السكان. ومستشار البناء يوفر عليك وقت",
  },
  {
    match: /شكر|مشكور|تسلم|يعطيك/,
    reply: () => "العفو، واجبنا. الكويت بيتنا كلنا",
  },
  {
    match: /سلام|هلا|مرحبا|شلونك|صباح|مساء/,
    reply: (_s, d) => pick(d.greet),
  },
];

/** Free-text chat: scripted, keyword-driven replies in Kuwaiti dialect. */
export function chat(s: Sim, id: NpcId, text: string) {
  const d = npcDef(id);
  const n = npcOf(s, id);
  const clean = text.trim().slice(0, 200);
  if (!clean) return;
  say(n, "me", clean);
  const hit = KEYWORDS.find((k) => k.match.test(clean));
  const owed = n.owesMe.reduce((t, l) => t + l.left, 0);
  const reply = hit
    ? hit.reply(s, d, n)
    : owed > 0
      ? `ما نسيت دينك علي (${fmt(owed)} د.ك)، القسط واصلك كل شهر إن شاء الله`
      : pick(
          {
            formal: ["كلامك على عيني وراسي", "إن شاء الله خير، نتعاون فيها"],
            warm: ["الله يحفظك يا ولدي", "تدري إن الفحيحيل تحبك؟"],
            merchant: ["الكلام ما يأكل عيش، خلنا نتكلم أرقام", "السوق يبي جرأة"],
            young: ["فكرة حلوة! خلنا نشتغل عليها", "ترند هالأيام الشاليهات البحرية"],
            builder: ["عطني الأرض وأنا أبني لك", "الحديد غالي بس نتفاهم"],
          }[d.style],
        );
  say(n, "them", reply);
  n.trust = Math.min(100, n.trust + 0.5);
}

/** Opens a conversation: greeting plus one line of news. */
export function greet(s: Sim, id: NpcId) {
  const d = npcDef(id);
  const n = npcOf(s, id);
  if (n.chat.length) return;
  say(n, "them", `${pick(d.greet)}. أنا ${d.name}، ${d.role}.`);
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
        news.push(`${d.name} أعلن عجزه عن السداد! ضاع ${fmt(loan.left)} د.ك`);
        say(n, "them", "سامحني يا محافظ، خسرت كل شي وما أقدر أسدد");
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
        say(n, "them", "خلصت أقساطك كلها، مشكور على وقفتك");
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
          say(n, "them", "وصلني آخر قسط. كفو والله");
        }
      } else {
        // Missed installment: a penalty and lost trust.
        loan.left += pay * 0.1;
        n.trust = Math.max(0, n.trust - 10);
        say(n, "them", "القسط ما وصل! لا تخليني أتكلم مع الناس عنك");
        news.push(`تأخرت عن قسط ${d.name}`);
      }
    }
    // Now and then someone asks you for help or offers a deal.
    if (random() < 0.06 && n.chat.length > 0) {
      const need = Math.round((20_000 + random() * 200_000) / 1000) * 1000;
      say(
        n,
        "them",
        d.style === "young"
          ? `عندي مشروع يحتاج ${fmt(need)} د.ك، تقرضني؟ أرجعها بفائدة ${pctText(d.lendRate + 0.04)}`
          : d.style === "merchant"
            ? `عندي سيولة، إذا تبي قرض بفائدة ${pctText(askRate(s, d.id))} كلمني`
            : `تقدر تساعدنا بـ ${fmt(need)} د.ك؟ نرجعها مع فايدة`,
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
