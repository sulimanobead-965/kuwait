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

export type DevelopmentKind = "towers" | "compound" | "business" | "waterfront" | "smartcity";

export type Site = {
  id: string;
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
};

export const DEVELOPMENT_KINDS = Object.keys(DEVELOPMENTS) as DevelopmentKind[];

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
