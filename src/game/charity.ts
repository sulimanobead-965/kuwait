/**
 * Charity: the governor gives from the treasury, as waqf (an endowment whose good
 * lasts), zakat (2.5٪ of wealth, a duty) or sadaqa (voluntary), to a cause. There is
 * no ceiling on the amount. Building causes put real buildings in the city; the
 * others lift people's mood for a while (waqf for good, a little).
 */
import type { Kind } from "./catalog";

export type CharityKind = "waqf" | "zakat" | "sadaqa";
export type CharityCause = "mosque" | "school" | "clinic" | "housing" | "aid" | "food" | "orphans" | "water";

export const CHARITY_KINDS: { id: CharityKind; name: string; blurb: string }[] = [
  { id: "waqf", name: "وقف", blurb: "يبقى خيره دائماً: يرفع رضا الناس قليلاً بشكل دائم" },
  { id: "zakat", name: "زكاة", blurb: "٢٫٥٪ من الأموال: أثرها على الرضا سنة كاملة" },
  { id: "sadaqa", name: "صدقة", blurb: "تطوعية بأي مبلغ: أثرها على الرضا ٦ أشهر" },
];

export const CHARITY_CAUSES: {
  id: CharityCause;
  name: string;
  blurb: string;
  /** A building the gift puts up (one per its price, up to 25 at a time). */
  build?: Kind;
}[] = [
  { id: "mosque", name: "بناء مساجد", blurb: "مسجد في الحي لكل مبلغ يكفي بناءه", build: "mosque" },
  { id: "school", name: "بناء مدارس", blurb: "مدارس جديدة ترفع التعليم", build: "school" },
  { id: "clinic", name: "بناء مستوصفات", blurb: "مستوصفات ترفع الصحة", build: "clinic" },
  { id: "housing", name: "مساكن للمحتاجين", blurb: "عمارات سكنية للأسر المحتاجة", build: "apartments" },
  { id: "aid", name: "توزيع مساعدات", blurb: "مساعدات نقدية للأسر المحتاجة" },
  { id: "food", name: "سلال غذائية", blurb: "سلال غذائية وإفطار صائم" },
  { id: "orphans", name: "كفالة أيتام", blurb: "كفالة الأيتام وتعليمهم" },
  { id: "water", name: "سقيا الماء", blurb: "برادات ماء وآبار في المناطق" },
];

export type CharityState = {
  given: Record<CharityKind, number>;
  byCause: Partial<Record<CharityCause, number>>;
  /** Temporary mood lift from zakat and sadaqa, until the given game day. */
  mood: number;
  until: number;
  /** Everything given as waqf: its small mood lift never ends. */
  waqf: number;
  /** The lasting mood lift of all waqf given (fixed when given). */
  waqfMood?: number;
  buildings: number;
};

export const emptyCharity = (): CharityState => ({
  given: { waqf: 0, zakat: 0, sadaqa: 0 },
  byCause: {},
  mood: 0,
  until: 0,
  waqf: 0,
  buildings: 0,
});

export function loadCharity(raw: unknown): CharityState {
  const c = emptyCharity();
  if (!raw || typeof raw !== "object") return c;
  const p = raw as Partial<CharityState>;
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0);
  for (const k of ["waqf", "zakat", "sadaqa"] as const) c.given[k] = n(p.given?.[k]);
  for (const cause of CHARITY_CAUSES) if (p.byCause?.[cause.id]) c.byCause[cause.id] = n(p.byCause[cause.id]);
  c.mood = Math.min(12, n(p.mood));
  c.until = n(p.until);
  c.waqf = n(p.waqf);
  c.waqfMood = Math.min(6, n(p.waqfMood));
  c.buildings = n(p.buildings);
  return c;
}
