/**
 * The governor's civic life around the property market:
 * - empty land grants that the grantee must build on in time, or lose;
 * - the housing waiting list;
 * - mukhtars for the administrative regions, and region bans;
 * - the merchants' standing with you and their land-for-project offers;
 * - a monthly market report, approval by group, and decisions with choices.
 */
import { CATALOG, type Kind } from "./catalog";
import { NPCS, type NpcId } from "./npcs";
import { regionAt, regions } from "./region-map";
import { msg, t } from "@/i18n";
import {
  estateOf,
  grantPlots,
  isMerchant,
  isPerson,
  npcState,
  ownerName,
  ownerOf,
  propertyValue,
  record,
  setOwner,
  type EstateAct,
  type GrantUse,
  type OwnerId,
} from "./realestate";
import { costIndex, placeBuilding, priceOf, pushLog, stats, type Sim } from "./sim";

// ---------------------------------------------------------------- empty plots

/** Monthly: grantees build on some of their land; land past its deadline goes back. */
function plotsMonth(s: Sim, random: () => number) {
  const e = estateOf(s);
  const plots = e.plots ?? (e.plots = {});
  let built = 0;
  let lost = 0;
  const lostBy = new Map<OwnerId, number>();
  for (const [k, p] of Object.entries(plots)) {
    if (p.until > 0 && s.day > p.until) {
      delete plots[k];
      lost += 1;
      lostBy.set(p.owner, (lostBy.get(p.owner) ?? 0) + 1);
      continue;
    }
    // Merchants build fast; families save up first.
    const chance = isMerchant(p.owner) ? 0.12 : 0.05;
    if (random() >= chance) continue;
    const comma = k.indexOf(",");
    const c = +k.slice(0, comma),
      r = +k.slice(comma + 1);
    delete plots[k];
    const price = priceOf(CATALOG[p.kind].cost, s);
    s.coins += price;
    const before = s.buildings.length;
    if (placeBuilding(s, p.kind, c, r, s.day).ok) {
      setOwner(s, s.buildings[before]!, p.owner);
      built += 1;
    } else {
      s.coins -= price;
      plots[k] = p;
    }
  }
  if (built) pushLog(s, msg("أصحاب المنح بنوا على {n} أرض هذا الشهر", { n: built }));
  if (lost) {
    const top = [...lostBy].sort((a, b) => b[1] - a[1])[0]!;
    pushLog(
      s,
      msg("رجعت {n} أرض ممنوحة للدولة لأن أصحابها ما بنوا في المهلة (أكثرهم {owner})", { n: lost, owner: ownerName(top[0]) }),
    );
  }
}

/** Empty plots held by an owner. */
export function plotsOf(s: Sim, owner: OwnerId) {
  let n = 0;
  for (const p of Object.values(estateOf(s).plots ?? {})) if (p.owner === owner) n += 1;
  return n;
}

/** A grantee's record: what they hold now and every grant on file. */
export function granteeRecord(s: Sim, owner: OwnerId) {
  const e = estateOf(s);
  let lots = 0;
  let value = 0;
  for (const b of s.buildings)
    if (ownerOf(s, b) === owner) {
      lots += 1;
      value += propertyValue(s, b);
    }
  const grants = e.trades.filter((tr) => tr.type === "grant" && tr.to === owner);
  return { lots, value, plots: plotsOf(s, owner), grants: grants.length, first: grants[0]?.day ?? null };
}

/** Take back everything granted to a person: their buildings and their empty land. */
export function revokeGrants(s: Sim, owner: OwnerId): EstateAct {
  if (!isPerson(owner) && !isMerchant(owner)) return { ok: false, msg: t("ما في منح لهذا المالك") };
  const e = estateOf(s);
  let n = 0;
  for (const [k, p] of Object.entries(e.plots ?? {}))
    if (p.owner === owner) {
      delete e.plots[k];
      n += 1;
    }
  for (const b of s.buildings)
    if (ownerOf(s, b) === owner) {
      setOwner(s, b, "state");
      n += 1;
    }
  if (!n) return { ok: false, msg: t("ما في منح لهذا المالك") };
  record(s, { id: "", kind: "villa", from: owner, to: "state", price: 0, type: "return" });
  // Taking land back without pay angers people (and the merchant, if one).
  const g = e.grievance ?? (e.grievance = { mood: 0, until: 0 });
  g.mood = Math.min(20, (g.until > s.day ? g.mood : 0) + Math.min(6, 1 + n / 50));
  g.until = s.day + 360;
  const st = npcState(s, owner);
  if (st) st.trust = Math.max(0, st.trust - 20);
  const entry = msg("سحب المنح من {owner}: رجع {n} عقار وأرض للدولة", { owner: ownerName(owner), n });
  pushLog(s, entry);
  return { ok: true, msg: entry };
}

// ---------------------------------------------------------------- housing queue

const HOME_KINDS = new Set<Kind>(["villa", "modern", "apartments"]);

function homesCount(s: Sim) {
  let n = 0;
  for (const b of s.buildings) if (HOME_KINDS.has(b.kind)) n += 1;
  return n;
}

/** Monthly: new families join the housing queue as the city grows. */
function waitlistMonth(s: Sim) {
  const e = estateOf(s);
  e.waitlist = (e.waitlist ?? 0) + Math.max(3, Math.round(homesCount(s) * 0.004));
}

/** How long the queue is against the homes there are, and what that costs in approval. */
export function waitlistPressure(s: Sim) {
  const e = estateOf(s);
  const homes = homesCount(s);
  const ratio = (e.waitlist ?? 0) / Math.max(60, homes * 0.05);
  return { waiting: e.waitlist ?? 0, homes, mood: ratio <= 0.5 ? 0 : -Math.min(8, Math.round(ratio * 2)) };
}

// ---------------------------------------------------------------- regions

/** Monthly pay of one mukhtar. */
export const mukhtarPay = (s: Sim) => priceOf(60, s);

export function appointMukhtar(s: Sim, region: number, name: string): EstateAct {
  const clean = name.trim().slice(0, 40);
  if (clean.length < 2) return { ok: false, msg: t("اكتب اسم المختار") };
  const e = estateOf(s);
  (e.mukhtars ??= {})[String(region)] = clean;
  const entry = msg("تعيين {name} مختاراً للمنطقة {n}", { name: clean, n: region });
  pushLog(s, entry);
  return { ok: true, msg: entry };
}

export function dismissMukhtar(s: Sim, region: number): EstateAct {
  const e = estateOf(s);
  if (!e.mukhtars?.[String(region)]) return { ok: false, msg: t("ما في مختار لهذه المنطقة") };
  delete e.mukhtars[String(region)];
  return { ok: true, msg: msg("إعفاء مختار المنطقة {n}", { n: region }) };
}

/** Ban or allow a kind of building in a region. */
export function toggleBan(s: Sim, region: number, kind: Kind): EstateAct {
  const e = estateOf(s);
  const bans = (e.bans ??= {});
  const list = bans[String(region)] ?? [];
  const on = !list.includes(kind);
  bans[String(region)] = on ? [...list, kind] : list.filter((k) => k !== kind);
  if (!bans[String(region)]!.length) delete bans[String(region)];
  return {
    ok: true,
    msg: on
      ? msg("منع {kind} في المنطقة {n}", { kind: CATALOG[kind].name, n: region })
      : msg("السماح بـ {kind} في المنطقة {n}", { kind: CATALOG[kind].name, n: region }),
  };
}

export const BANNABLE: Kind[] = ["tower", "factory", "apartments", "shop"];

const SERVICE_PER: Partial<Record<Kind, number>> = { school: 260, clinic: 300, police: 280, fire: 420, park: 140 };

/** Per region: how well services cover the people living there (0–1), and density. */
const svcMemo = new WeakMap<Sim, { sig: string; out: { id: number; services: number; density: number }[] }>();
export function regionServices(s: Sim) {
  const sig = `${Math.floor(s.day / 30)}:${s.buildings.length}`;
  const hit = svcMemo.get(s);
  if (hit && hit.sig === sig) return hit.out;
  const out = regionServicesOf(s);
  svcMemo.set(s, { sig, out });
  return out;
}

function regionServicesOf(s: Sim) {
  const rs = regions();
  const supply = new Float64Array(rs.length);
  const people = new Float64Array(rs.length);
  for (const b of s.buildings) {
    const i = regionAt(b.c, b.r) - 1;
    const per = SERVICE_PER[b.kind];
    if (per) supply[i] += per * b.level;
    people[i] += CATALOG[b.kind].pop * b.level;
  }
  return rs.map((g, i) => ({
    id: g.id,
    services: people[i]! <= 0 ? 1 : Math.min(1, supply[i]! / (people[i]! * 5)),
    density: people[i]! / Math.max(1, g.land),
  }));
}

/** A mukhtar's monthly note about their region: the weakest service, or all is well. */
export function mukhtarNote(s: Sim, region: number) {
  const row = regionServices(s)[region - 1];
  if (!row) return "";
  if (row.services >= 0.8) return t("الأمور طيبة والخدمات كافية");
  if (row.services >= 0.4) return t("الناس يطلبون خدمات أكثر (مدارس ومستوصفات وحدائق)");
  return t("الخدمات ناقصة واجد والناس متضايقين");
}

/** Monthly: mukhtars are paid; they lift approval a little where they serve. */
function mukhtarsMonth(s: Sim) {
  const n = Object.keys(estateOf(s).mukhtars ?? {}).length;
  if (!n) return;
  const cost = mukhtarPay(s) * n;
  s.coins -= cost;
  s.ytd.spend += cost;
}

// ---------------------------------------------------------------- merchants

/** A merchant's standing with you: 0–100 (their trust). */
export function merchantStanding(s: Sim, id: NpcId) {
  return npcState(s, id)?.trust ?? 50;
}

export const standingName = (v: number) => (v >= 70 ? "راضي" : v >= 40 ? "محايد" : v >= 20 ? "زعلان" : "غاضب");

const PROJECTS: { kind: Kind; use: GrantUse }[] = [
  { kind: "tower", use: "commercial" },
  { kind: "shop", use: "commercial" },
  { kind: "apartments", use: "investment" },
  { kind: "factory", use: "industrial" },
];

/** Monthly: a merchant who trusts you may offer to pay for state land for a project. */
function proposalsMonth(s: Sim, random: () => number) {
  const e = estateOf(s);
  e.proposals = (e.proposals ?? []).filter((p) => p.until > s.day);
  if (e.proposals.length >= 3 || random() > 0.25) return;
  const who = NPCS[Math.floor(random() * NPCS.length)]!;
  if (merchantStanding(s, who.id) < 40) return;
  const pr = PROJECTS[Math.floor(random() * PROJECTS.length)]!;
  const plots = 2 + Math.floor(random() * 10);
  const pay = Math.round(priceOf(CATALOG[pr.kind].cost, s) * 40 * plots * (0.6 + random() * 0.7) * (e.index ?? 1));
  e.proposals.push({ id: e.nextId++, merchant: who.id, project: pr.kind, plots, pay, until: s.day + 60 });
  pushLog(
    s,
    msg("{owner} يعرض {amount} د.ك مقابل {n} قسيمة لمشروع {kind}", { owner: ownerName(who.id), amount: pay, n: plots, kind: CATALOG[pr.kind].name }),
  );
}

export function answerProposal(s: Sim, id: number, yes: boolean): EstateAct {
  const e = estateOf(s);
  const p = (e.proposals ?? []).find((x) => x.id === id);
  if (!p) return { ok: false, msg: t("العرض انتهى") };
  e.proposals = e.proposals.filter((x) => x.id !== id);
  const st = npcState(s, p.merchant);
  if (!yes) {
    if (st) st.trust = Math.max(0, st.trust - 2);
    return { ok: true, msg: msg("رفضت عرض {owner}", { owner: ownerName(p.merchant) }) };
  }
  const use = PROJECTS.find((x) => x.kind === p.project)?.use ?? "commercial";
  const r = grantPlots(s, p.plots, p.merchant, use);
  if (!r.ok) return r;
  s.coins += p.pay;
  s.ytd.income += p.pay;
  if (st) {
    st.cash -= p.pay;
    st.trust = Math.min(100, st.trust + 4);
  }
  const entry = msg("قبلت عرض {owner}: {n} قسيمة مقابل {amount} د.ك", { owner: ownerName(p.merchant), n: p.plots, amount: p.pay });
  pushLog(s, entry);
  return { ok: true, msg: entry };
}

// ---------------------------------------------------------------- market report

/** The last 30 days of the property market: deals, money, biggest deal and players. */
export function marketReport(s: Sim) {
  const e = estateOf(s);
  const recent = e.trades.filter((tr) => tr.day > s.day - 30 && tr.type === "sale");
  const buys = new Map<OwnerId, number>();
  const sells = new Map<OwnerId, number>();
  let volume = 0;
  let biggest = recent[0] ?? null;
  for (const tr of recent) {
    volume += tr.price;
    buys.set(tr.to, (buys.get(tr.to) ?? 0) + tr.price);
    sells.set(tr.from, (sells.get(tr.from) ?? 0) + tr.price);
    if (!biggest || tr.price > biggest.price) biggest = tr;
  }
  const top = (m: Map<OwnerId, number>) => [...m].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { deals: recent.length, volume, biggest, buyer: top(buys), seller: top(sells), index: e.index };
}

// ---------------------------------------------------------------- approval by group

/** Approval of citizens, residents from abroad and merchants, 0–100, with reasons. */
export function approvalGroups(s: Sim) {
  const st = stats(s);
  const queue = waitlistPressure(s).mood;
  const citizens = Math.max(0, Math.min(100, Math.round(st.happy + queue)));
  // Residents from abroad mostly rent: dear living costs weigh on them most.
  const cost = costIndex(s);
  const expats = Math.max(0, Math.min(100, Math.round(st.happy - Math.max(0, cost - 100) / 10)));
  let trust = 0;
  for (const n of NPCS) trust += merchantStanding(s, n.id);
  const merchants = Math.round(trust / NPCS.length);
  return [
    { id: "citizens", name: "المواطنين", value: citizens, note: queue < 0 ? "طابور الإسكان طويل" : "" },
    { id: "expats", name: "المقيمين", value: expats, note: cost > 150 ? "غلاء المعيشة والإيجارات" : "" },
    { id: "merchants", name: "التجار", value: merchants, note: merchants < 40 ? "زعلانين من نزع الملكية والرفض" : "" },
  ];
}

/** Approval reasons from this module (added to the city's approval). */
export function civicMood(s: Sim): [string, number][] {
  const e = s.estate;
  if (!e) return [];
  const out: [string, number][] = [];
  const q = waitlistPressure(s).mood;
  if (q) out.push(["طابور الإسكان", q]);
  const mk = Object.keys(e.mukhtars ?? {}).length;
  if (mk) out.push(["المخاتير", Math.min(4, Math.round(mk / 10) + 1)]);
  let trust = 0;
  for (const n of NPCS) trust += merchantStanding(s, n.id);
  if (trust / NPCS.length < 30) out.push(["غضب التجار", -2]);
  // Left unanswered for half a year: people feel unheard.
  if (e.dilemma && e.dilemma.until - DILEMMA_DAYS < s.day - 180 && e.dilemma.until > s.day) out.push(["قرار معلّق", -1]);
  return out;
}

// ---------------------------------------------------------------- decisions

type Choice = { label: string; apply: (s: Sim) => string };
export type Dilemma = { id: string; title: string; text: string; choices: [Choice, Choice] };

const grieve = (s: Sim, n: number) => {
  const e = estateOf(s);
  const g = e.grievance ?? (e.grievance = { mood: 0, until: 0 });
  g.mood = Math.min(20, (g.until > s.day ? g.mood : 0) + n);
  g.until = s.day + 180;
};
const spend = (s: Sim, base: number) => {
  const c = priceOf(base, s);
  s.coins -= c;
  s.ytd.spend += c;
  return c;
};

export const DILEMMAS: Dilemma[] = [
  {
    id: "prices",
    title: "ارتفاع أسعار العقار",
    text: "الأسعار طارت والشباب ما يقدرون يشترون. تتدخل؟",
    choices: [
      {
        label: "أتدخل: رسوم على المضاربة",
        apply: (s) => {
          const e = estateOf(s);
          e.index = Math.max(0.4, e.index * 0.9);
          for (const n of s.npcs) n.trust = Math.max(0, n.trust - 4);
          return "نزلت الأسعار ١٠٪ وزعل التجار";
        },
      },
      {
        label: "أتركه للسوق",
        apply: (s) => {
          grieve(s, 3);
          return "الأسعار على حالها والناس متضايقين";
        },
      },
    ],
  },
  {
    id: "housing",
    title: "شباب ينتظرون السكن",
    text: "مجموعة شباب تطالب بتسريع توزيع القسائم.",
    choices: [
      {
        label: "أوزّع ٥٠ قسيمة الحين",
        apply: (s) => {
          const r = grantPlots(s, 50, "people", "homes");
          return r.ok ? "وُزعت القسائم وفرح الناس" : "ما في أرض كافية";
        },
      },
      {
        label: "أوعدهم بعدين",
        apply: (s) => {
          estateOf(s).waitlist += 100;
          return "طال طابور الإسكان";
        },
      },
    ],
  },
  {
    id: "merchant-tower",
    title: "تاجر يبي يبني برج في حي سكني",
    text: "تاجر كبير يعرض دعم مالي إذا سمحت له ببرج وسط البيوت.",
    choices: [
      {
        label: "أوافق وآخذ الدعم",
        apply: (s) => {
          const c = priceOf(5000, s);
          s.coins += c;
          s.ytd.income += c;
          grieve(s, 2);
          return "دخل الدعم للخزينة والجيران زعلانين";
        },
      },
      {
        label: "أرفض",
        apply: (s) => {
          const n = s.npcs[Math.floor(Math.random() * s.npcs.length)];
          if (n) n.trust = Math.max(0, n.trust - 6);
          return "الأهالي مرتاحين والتاجر زعلان";
        },
      },
    ],
  },
  {
    id: "old-market",
    title: "السوق القديم",
    text: "مستثمر يبي يهدم سوق قديم ويبني مجمع حديث.",
    choices: [
      {
        label: "أحافظ على التراث وأرممه",
        apply: (s) => {
          spend(s, 3000);
          s.fame = Math.min(12, (s.fame ?? 0) + 1);
          return "رُمم السوق وزادت شهرتك";
        },
      },
      {
        label: "أسمح بالمجمع",
        apply: (s) => {
          const c = priceOf(4000, s);
          s.coins += c;
          s.ytd.income += c;
          grieve(s, 2);
          return "دخل مال للخزينة وناس زعلت على التراث";
        },
      },
    ],
  },
  {
    id: "rent",
    title: "شكاوى الإيجارات",
    text: "المقيمين يشتكون من زيادة الإيجارات.",
    choices: [
      {
        label: "أحدد سقف للإيجار سنة",
        apply: (s) => {
          for (const n of s.npcs) n.trust = Math.max(0, n.trust - 3);
          s.fame = Math.min(12, (s.fame ?? 0) + 0.5);
          return "ارتاح المستأجرين وتضايق الملاك";
        },
      },
      {
        label: "ما أتدخل",
        apply: (s) => {
          grieve(s, 2);
          return "الإيجارات على حالها";
        },
      },
    ],
  },
  {
    id: "flood-drains",
    title: "تصريف الأمطار",
    text: "المهندسين يحذرون: شبكة التصريف ما تتحمل أمطار قوية.",
    choices: [
      {
        label: "أصلح الشبكة الحين",
        apply: (s) => {
          spend(s, 4000);
          return "تصلحت شبكة التصريف";
        },
      },
      {
        label: "أأجلها",
        apply: (s) => {
          grieve(s, 1);
          return "تأجل المشروع والناس قلقانين";
        },
      },
    ],
  },
];

export function dilemmaOf(s: Sim) {
  const d = s.estate?.dilemma;
  if (!d || d.until <= s.day) return null;
  return DILEMMAS.find((x) => x.id === d.id) ?? null;
}

export function answerDilemma(s: Sim, choice: 0 | 1): EstateAct {
  const d = dilemmaOf(s);
  if (!d) return { ok: false, msg: t("ما في قرار مطلوب") };
  estateOf(s).dilemma = null;
  const result = d.choices[choice].apply(s);
  const entry = msg("{title}: {result}", { title: d.title, result });
  pushLog(s, entry);
  return { ok: true, msg: entry };
}

const DILEMMA_DAYS = 3650;

function dilemmaMonth(s: Sim, random: () => number) {
  const e = estateOf(s);
  // A decision waits for the governor (at top speed months pass in seconds).
  if (e.dilemma && e.dilemma.until <= s.day) e.dilemma = null;
  if (e.dilemma || random() > 0.12) return;
  const d = DILEMMAS[Math.floor(random() * DILEMMAS.length)]!;
  e.dilemma = { id: d.id, until: s.day + DILEMMA_DAYS };
  pushLog(s, msg("قرار مطلوب: {title}", { title: d.title }));
}

// ---------------------------------------------------------------- the month

export function civicMonth(s: Sim, random = Math.random) {
  if (!s.estate) return;
  plotsMonth(s, random);
  waitlistMonth(s);
  mukhtarsMonth(s);
  proposalsMonth(s, random);
  if (s.started) dilemmaMonth(s, random);
}
