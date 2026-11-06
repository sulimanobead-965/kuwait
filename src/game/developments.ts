/**
 * Real-estate developments built inside the city by the developer company.
 *
 * The player invests, picks (or lets the developer pick) a site, and the site is
 * fenced off: nobody but the developer may build, pave or demolish there until it is
 * finished. Construction progresses month by month (the renderer shows fences, cranes
 * and rising frames), and on completion a distinctive, fully planned neighbourhood
 * appears and belongs to the city. If the developer goes bankrupt the site is
 * abandoned, the fence comes down and most of the money is lost.
 */
import type { Kind } from "./catalog";

export type DevelopmentKind =
  | "towers"
  | "compound"
  | "business"
  | "waterfront"
  | "smartcity"
  | "airport"
  | "railway"
  | "intlPower"
  | "megaPort"
  | "megaRefinery"
  | "silkCity"
  | "techCity"
  | "medicalCity"
  | "resort";

export type DeveloperId = "marsa" | "khaleej" | "jazeera" | "dar" | "national";

/**
 * Real-estate developers (fictional). Each fails on its own; the national
 * development authority is state-backed and never fails, so there is always someone
 * to carry out upgrades. Private firms build faster; the authority is slower.
 */
export const DEVELOPERS: Record<
  DeveloperId,
  { name: string; blurb: string; speed: number; risk: number; state?: boolean }
> = {
  marsa: {
    name: "شركة المرسى العقارية",
    blurb: "مطور كبير بخبرة طويلة، ومخاطرة متوسطة.",
    speed: 1,
    risk: 1,
  },
  khaleej: {
    name: "مجموعة الخليج للتطوير",
    blurb: "أسرع في البناء، لكنها أكثر مغامرة.",
    speed: 0.85,
    risk: 1.6,
  },
  jazeera: {
    name: "الجزيرة القابضة",
    blurb: "متحفظة وثابتة، ومخاطرها منخفضة.",
    speed: 1.1,
    risk: 0.5,
  },
  dar: {
    name: "دار البناء الكويتية",
    blurb: "شركة عائلية متوسطة الحجم.",
    speed: 1,
    risk: 1,
  },
  national: {
    name: "هيئة التطوير الوطنية",
    blurb: "جهة حكومية لا تفلس أبداً، لكنها أبطأ.",
    speed: 1.35,
    risk: 0,
    state: true,
  },
};

export const DEVELOPER_IDS = Object.keys(DEVELOPERS) as DeveloperId[];

export type Site = {
  id: string;
  /** Who builds it; older saves had only Al Marsa. */
  developer: DeveloperId;
  kind: DevelopmentKind;
  /** Top-left cell and size. */
  c: number;
  r: number;
  w: number;
  h: number;
  amount: number;
  started: number;
  completes: number;
};

/** One planned lot: building kind and level, by offset inside the site. */
type Lot = { dc: number; dr: number; kind: Kind; level: number };

export type DevelopmentDef = {
  name: string;
  blurb: string;
  w: number;
  h: number;
  cost: number;
  months: number;
  /** Builds roads and lots for a site of this kind. */
  plan: (w: number, h: number) => { roads: [number, number][]; lots: Lot[] };
  /** Needs at least one cell touching the sea. */
  coast?: boolean;
  /** A state mega project, built at its real place in Kuwait (longitude, latitude). */
  mega?: { lon: number; lat: number };
};

const ring = (w: number, h: number) => {
  const roads: [number, number][] = [];
  for (let c = 0; c < w; c += 1) roads.push([c, 0], [c, h - 1]);
  for (let r = 1; r < h - 1; r += 1) roads.push([0, r], [w - 1, r]);
  return roads;
};

/** Fill every non-road interior cell from a pattern function. */
function fill(
  w: number,
  h: number,
  roads: [number, number][],
  pick: (c: number, r: number) => [Kind, number],
) {
  const taken = new Set(roads.map(([c, r]) => `${c},${r}`));
  const lots: Lot[] = [];
  for (let r = 0; r < h; r += 1)
    for (let c = 0; c < w; c += 1) {
      if (taken.has(`${c},${r}`)) continue;
      const [kind, level] = pick(c, r);
      lots.push({ dc: c, dr: r, kind, level });
    }
  return lots;
}

export const DEVELOPMENTS: Record<DevelopmentKind, DevelopmentDef> = {
  towers: {
    name: "أبراج سكنية فاخرة",
    blurb: "تسعة أبراج سكنية شاهقة حول ساحة خضراء.",
    w: 5,
    h: 5,
    cost: 300_000,
    months: 18,
    plan: (w, h) => {
      const roads = ring(w, h);
      return {
        roads,
        lots: fill(w, h, roads, (c, r) => (c === 2 && r === 2 ? ["park", 3] : ["apartments", 5])),
      };
    },
  },
  compound: {
    name: "مجمع سكني متكامل",
    blurb: "عمارات عالية ومدرسة ومستوصف وسوق وحدائق بشارع داخلي.",
    w: 9,
    h: 7,
    cost: 800_000,
    months: 24,
    plan: (w, h) => {
      const roads = ring(w, h);
      for (let c = 1; c < w - 1; c += 1) roads.push([c, 3]);
      return {
        roads,
        lots: fill(w, h, roads, (c, r) => {
          if (c === 4 && r === 2) return ["school", 3];
          if (c === 4 && r === 4) return ["clinic", 3];
          if (c === 1 && r === 1) return ["shop", 4];
          if ((c + r) % 5 === 0) return ["park", 3];
          return ["apartments", c % 2 ? 5 : 4];
        }),
      };
    },
  },
  business: {
    name: "حي المال والأعمال",
    blurb: "ناطحات مكاتب وأبراج تجارية حول شارع رئيسي، وظائف ودخل ضخم.",
    w: 7,
    h: 7,
    cost: 1_500_000,
    months: 30,
    plan: (w, h) => {
      const roads = ring(w, h);
      for (let r = 1; r < h - 1; r += 1) roads.push([3, r]);
      return {
        roads,
        lots: fill(w, h, roads, (c, r) => {
          if (r === 3) return ["park", 3];
          if (c === 1 || c === 5) return ["tower", 5];
          return ["shop", 5];
        }),
      };
    },
  },
  waterfront: {
    name: "واجهة بحرية",
    blurb: "شاليهات وأبراج سكنية على البحر مع ممشى وحدائق.",
    w: 9,
    h: 5,
    cost: 1_200_000,
    months: 28,
    coast: true,
    plan: (w, h) => {
      const roads: [number, number][] = [];
      for (let c = 0; c < w; c += 1) roads.push([c, 2]);
      return {
        roads,
        lots: fill(w, h, roads, (c, r) => {
          if (r === 0 || r === h - 1) return c % 3 === 1 ? ["park", 3] : ["chalet", 3];
          return c % 2 ? ["apartments", 5] : ["shop", 4];
        }),
      };
    },
  },
  smartcity: {
    name: "مدينة ذكية",
    blurb: "مدينة كاملة: عشرات الأبراج السكنية ومراكز أعمال وخدمات وحدائق بشبكة شوارع.",
    w: 13,
    h: 11,
    cost: 5_000_000,
    months: 48,
    plan: (w, h) => {
      const roads = ring(w, h);
      for (let c = 1; c < w - 1; c += 1) roads.push([c, 5]);
      for (let r = 1; r < h - 1; r += 1) {
        if (r === 5) continue;
        roads.push([4, r], [8, r]);
      }
      return {
        roads,
        lots: fill(w, h, roads, (c, r) => {
          if (c === 6 && (r === 2 || r === 8)) return ["park", 3];
          if (c === 6 && r === 3) return ["school", 3];
          if (c === 6 && r === 7) return ["clinic", 3];
          if (c === 6 && r === 4) return ["police", 3];
          if (c === 6 && r === 6) return ["fire", 3];
          if (c === 6) return ["park", 3];
          if (c > 8 && r < 5) return ["tower", 5];
          if (c > 8) return ["shop", 5];
          return ["apartments", 5];
        }),
      };
    },
  },

  // State mega projects (see board.ts): fenced at their real place, then handed over.
  airport: {
    name: "مطار الكويت الدولي الجديد",
    blurb: "مدرجان ومبنى ركاب ومواقف وفندق.",
    w: 14,
    h: 7,
    cost: 0,
    months: 36,
    mega: { lon: 47.975, lat: 29.235 },
    plan: (w, h) => {
      const roads: [number, number][] = [];
      for (let c = 0; c < w; c += 1) roads.push([c, 2], [c, h - 2]);
      const lots: Lot[] = [];
      for (let c = 0; c < w; c += 1) lots.push({ dc: c, dr: 0, kind: "runway", level: 1 });
      for (let c = 0; c < w; c += 1) lots.push({ dc: c, dr: 1, kind: "runway", level: 1 });
      for (let c = 2; c < w - 2; c += 1)
        for (const r of [3, 4]) lots.push({ dc: c, dr: r, kind: "terminal", level: 1 });
      for (const c of [0, 1, w - 2, w - 1]) for (const r of [3, 4]) lots.push({ dc: c, dr: r, kind: "park", level: 3 });
      for (let c = 0; c < w; c += 1)
        lots.push({ dc: c, dr: h - 1, kind: c % 4 === 1 ? "tower" : c % 4 === 3 ? "shop" : "park", level: 4 });
      return { roads, lots };
    },
  },
  railway: {
    name: "سكة حديد الخليج",
    blurb: "خط قطار من الجهراء إلى مدينة الكويت بثلاث محطات.",
    w: 34,
    h: 3,
    cost: 0,
    months: 40,
    mega: { lon: 47.83, lat: 29.33 },
    plan: (w) => {
      const roads: [number, number][] = [];
      for (let c = 0; c < w; c += 1) roads.push([c, 2]);
      const lots: Lot[] = [];
      const stops = [0, Math.floor(w / 2), w - 1];
      for (let c = 0; c < w; c += 1) {
        lots.push({ dc: c, dr: 1, kind: stops.includes(c) ? "station" : "rail", level: 1 });
        if (c % 3 === 1) lots.push({ dc: c, dr: 0, kind: "park", level: 2 });
      }
      return { roads, lots };
    },
  },
  intlPower: {
    name: "محطة الطاقة الدولية",
    blurb: "محطات كهرباء وتحلية عملاقة على البحر.",
    w: 8,
    h: 5,
    cost: 0,
    months: 30,
    coast: true,
    mega: { lon: 47.8, lat: 29.37 },
    plan: (w, h) => {
      const roads = ring(w, h);
      return { roads, lots: fill(w, h, roads, (c) => (c % 3 === 0 ? ["water", 3] : ["power", 3])) };
    },
  },
  megaPort: {
    name: "ميناء مبارك الكبير",
    blurb: "أرصفة حاويات ورافعات ومستودعات على البحر.",
    w: 10,
    h: 4,
    cost: 0,
    months: 36,
    coast: true,
    mega: { lon: 48.24, lat: 29.84 },
    plan: (w, h) => {
      const roads: [number, number][] = [];
      for (let c = 0; c < w; c += 1) roads.push([c, 1]);
      return {
        roads,
        lots: fill(w, h, roads, (c, r) => (r === 0 ? ["port", 3] : c % 3 === 0 ? ["port", 3] : ["factory", 3])),
      };
    },
  },
  megaRefinery: {
    name: "مصفاة الزور العملاقة",
    blurb: "أبراج تقطير وخزانات ومصانع بتروكيماويات.",
    w: 9,
    h: 6,
    cost: 0,
    months: 40,
    mega: { lon: 48.35, lat: 28.73 },
    plan: (w, h) => {
      const roads = ring(w, h);
      for (let c = 1; c < w - 1; c += 1) roads.push([c, 3]);
      return { roads, lots: fill(w, h, roads, (c) => (c % 4 === 0 ? ["factory", 3] : ["refinery", 3])) };
    },
  },
  silkCity: {
    name: "مدينة الحرير",
    blurb: "مدينة أبراج وأعمال شمال الجون في الصبية.",
    w: 13,
    h: 9,
    cost: 0,
    months: 48,
    mega: { lon: 47.93, lat: 29.6 },
    plan: (w, h) => {
      const roads = ring(w, h);
      for (let c = 1; c < w - 1; c += 1) roads.push([c, 4]);
      for (let r = 1; r < h - 1; r += 1) if (r !== 4) roads.push([6, r]);
      return {
        roads,
        lots: fill(w, h, roads, (c, r) => {
          if ((c === 3 || c === 9) && (r === 2 || r === 6)) return ["park", 3];
          if (r < 4) return ["tower", 5];
          return c % 2 ? ["apartments", 5] : ["shop", 5];
        }),
      };
    },
  },
  techCity: {
    name: "مدينة التقنية والذكاء الاصطناعي",
    blurb: "أبراج شركات ومراكز بيانات وجامعة تقنية.",
    w: 9,
    h: 7,
    cost: 0,
    months: 36,
    mega: { lon: 47.89, lat: 29.26 },
    plan: (w, h) => {
      const roads = ring(w, h);
      for (let c = 1; c < w - 1; c += 1) roads.push([c, 3]);
      return {
        roads,
        lots: fill(w, h, roads, (c, r) => {
          if (c === 4 && r === 2) return ["school", 3];
          if (c === 4) return ["park", 3];
          if (r < 3) return ["tower", 5];
          return c % 3 === 0 ? ["factory", 3] : ["shop", 5];
        }),
      };
    },
  },
  medicalCity: {
    name: "مدينة طبية متكاملة",
    blurb: "مستشفيات تخصصية حول حدائق.",
    w: 7,
    h: 5,
    cost: 0,
    months: 30,
    mega: { lon: 47.955, lat: 29.345 },
    plan: (w, h) => {
      const roads = ring(w, h);
      return { roads, lots: fill(w, h, roads, (c, r) => (c === 3 && r === 2 ? ["park", 3] : ["clinic", 3])) };
    },
  },
  resort: {
    name: "منتجع سياحي عالمي",
    blurb: "فنادق وشاليهات وحدائق على شاطئ الخيران.",
    w: 10,
    h: 4,
    cost: 0,
    months: 30,
    coast: true,
    mega: { lon: 48.37, lat: 28.65 },
    plan: (w, h) => {
      const roads: [number, number][] = [];
      for (let c = 0; c < w; c += 1) roads.push([c, 2]);
      return {
        roads,
        lots: fill(w, h, roads, (c, r) => {
          if (r !== 2 && (r === 0 || r === h - 1)) return c % 3 === 1 ? ["park", 3] : ["chalet", 3];
          return c % 2 ? ["tower", 4] : ["shop", 4];
        }),
      };
    },
  },
};

/** Developer projects the governor can buy (mega projects come from the board). */
export const DEVELOPMENT_KINDS = (Object.keys(DEVELOPMENTS) as DevelopmentKind[]).filter(
  (k) => !DEVELOPMENTS[k].mega,
);

/** Is this cell inside a fenced development site? */
export function siteAt(sites: readonly Site[], c: number, r: number) {
  for (const site of sites)
    if (c >= site.c && c < site.c + site.w && r >= site.r && r < site.r + site.h) return site;
  return null;
}

export function progressOf(day: number, site: Site) {
  const span = Math.max(1, site.completes - site.started);
  return Math.max(0, Math.min(1, (day - site.started) / span));
}

export function loadSites(raw: unknown): Site[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x) => x && typeof x === "object" && (x as Site).kind in DEVELOPMENTS)
    .map((x) => {
      const p = x as Site;
      const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
      return {
        id: String(p.id),
        developer: p.developer in DEVELOPERS ? p.developer : "marsa",
        kind: p.kind,
        c: n(p.c),
        r: n(p.r),
        w: Math.max(1, n(p.w)),
        h: Math.max(1, n(p.h)),
        amount: n(p.amount),
        started: n(p.started),
        completes: n(p.completes),
      };
    });
}
