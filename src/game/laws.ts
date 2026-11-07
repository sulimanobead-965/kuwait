/**
 * City laws (ordinances). Each one is funded by the governor (an amount or a share of
 * income, monthly or yearly; see `lawStrength` in sim.ts) and its effects below are
 * multiplied by that strength (0 when off, 1 at the reference funding, up to 3).
 *
 * Effects:
 * - happy: approval points
 * - pollution / traffic / crime / unemployment: index points (negative = better)
 * - health / education: index points
 * - commerce / landmarks / coast / all: income multipliers (+0.08 = +8٪)
 * - draw: extra share of homes people want to live in (population pull)
 * - upkeep: cut to the city's running costs (0.05 = −5٪)
 * - disaster: cut to disaster bills; pandemic: cut to pandemic approval loss
 */
export type LawEffects = {
  happy?: number;
  pollution?: number;
  traffic?: number;
  crime?: number;
  unemployment?: number;
  health?: number;
  education?: number;
  commerce?: number;
  landmarks?: number;
  coast?: number;
  all?: number;
  draw?: number;
  upkeep?: number;
  disaster?: number;
  pandemic?: number;
};

export type LawDef = {
  title: string;
  detail: string;
  /** Monthly reference cost (KD) for full effect in a city of 10,000 residents. */
  cost: number;
  effects: LawEffects;
};

export const LAW_DEFS = {
  education: {
    title: "ميزانية التعليم",
    detail: "ترفع التعليم والرضا.",
    cost: 20,
    effects: { happy: 3, education: 42 },
  },
  recycling: {
    title: "إعادة التدوير",
    detail: "تقلل التلوث وترفع الرضا.",
    cost: 10,
    effects: { happy: 2, pollution: -14 },
  },
  carpool: {
    title: "مشاركة السيارات",
    detail: "تخفف الزحمة.",
    cost: 6,
    effects: { traffic: -18 },
  },
  clinicFund: {
    title: "دعم المستوصفات",
    detail: "ترفع الصحة.",
    cost: 14,
    effects: { health: 12 },
  },
  smokeBan: {
    title: "منع الدخان",
    detail: "هواء أنظف، وتجارة المحلات تهدأ شوي.",
    cost: 8,
    effects: { pollution: -12, commerce: -0.1 },
  },
  tourism: {
    title: "تنشيط السياحة",
    detail: "يرفع دخل المعالم والتجارة.",
    cost: 25,
    effects: { landmarks: 0.15, commerce: 0.05, happy: 1 },
  },
  sportsClubs: {
    title: "دعم الأندية الرياضية",
    detail: "رضا وصحة أعلى للشباب.",
    cost: 15,
    effects: { happy: 2, health: 5 },
  },
  publicTransit: {
    title: "النقل العام والمترو",
    detail: "زحمة وتلوث أقل.",
    cost: 30,
    effects: { traffic: -15, pollution: -5, happy: 1 },
  },
  solar: {
    title: "الطاقة الشمسية",
    detail: "هواء أنظف ومصاريف تشغيل أقل.",
    cost: 25,
    effects: { pollution: -10, upkeep: 0.04 },
  },
  waterSaving: {
    title: "ترشيد المياه",
    detail: "صحة أفضل ومصاريف أقل.",
    cost: 8,
    effects: { health: 3, upkeep: 0.02 },
  },
  greenBelt: {
    title: "التشجير والحزام الأخضر",
    detail: "يقلل التلوث وأثر العواصف.",
    cost: 12,
    effects: { pollution: -8, happy: 2, disaster: 0.15 },
  },
  civilDefense: {
    title: "اشتراطات الدفاع المدني",
    detail: "خسائر الكوارث أقل.",
    cost: 15,
    effects: { disaster: 0.3 },
  },
  communityWatch: {
    title: "الأمن المجتمعي",
    detail: "يخفض الجريمة.",
    cost: 12,
    effects: { crime: -15, happy: 1 },
  },
  scholarships: {
    title: "البعثات الدراسية",
    detail: "تعليم أعلى ورضا.",
    cost: 20,
    effects: { education: 20, happy: 1 },
  },
  elderlyCare: {
    title: "رعاية كبار السن",
    detail: "رضا وصحة.",
    cost: 15,
    effects: { happy: 3, health: 5 },
  },
  smallBusiness: {
    title: "دعم المشاريع الصغيرة",
    detail: "تجارة أكثر وبطالة أقل.",
    cost: 18,
    effects: { commerce: 0.08, unemployment: -10 },
  },
  eGovernment: {
    title: "الحكومة الإلكترونية",
    detail: "معاملات أسهل ومصاريف أقل.",
    cost: 12,
    effects: { happy: 2, upkeep: 0.05 },
  },
  heritage: {
    title: "حماية التراث",
    detail: "يرفع دخل المعالم والرضا.",
    cost: 10,
    effects: { landmarks: 0.1, happy: 2 },
  },
  libraries: {
    title: "المكتبات العامة",
    detail: "ترفع التعليم.",
    cost: 8,
    effects: { education: 10, happy: 1 },
  },
  vaccination: {
    title: "التطعيمات الوطنية",
    detail: "صحة أعلى وأثر أخف للأوبئة.",
    cost: 15,
    effects: { health: 10, pandemic: 0.5 },
  },
  roadMaintenance: {
    title: "صيانة الطرق",
    detail: "زحمة أقل.",
    cost: 10,
    effects: { traffic: -8, happy: 1 },
  },
  beachCleaning: {
    title: "تنظيف الشواطئ",
    detail: "شواطئ أنظف ودخل أعلى للكورنيش.",
    cost: 8,
    effects: { pollution: -4, coast: 0.05, happy: 1 },
  },
  employment: {
    title: "برنامج توظيف المواطنين",
    detail: "يخفض البطالة ويرفع الرضا.",
    cost: 25,
    effects: { unemployment: -15, happy: 2 },
  },
  marriageGrants: {
    title: "منح الزواج والسكن",
    detail: "يجذب سكاناً جدداً ويرفع الرضا.",
    cost: 30,
    effects: { draw: 0.04, happy: 3 },
  },
  integrity: {
    title: "هيئة النزاهة ومكافحة الفساد",
    detail: "دخل أعلى من كل المباني.",
    cost: 20,
    effects: { all: 0.05, happy: 1 },
  },
} satisfies Record<string, LawDef>;

export type LawKey = keyof typeof LAW_DEFS;
export const LAW_KEYS = Object.keys(LAW_DEFS) as LawKey[];
