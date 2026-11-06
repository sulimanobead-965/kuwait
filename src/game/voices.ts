/**
 * What residents say about the city: complaints, thanks and ideas from fictional
 * people, a few every month, driven by what is actually happening (traffic,
 * pollution, prices, outages, new landmarks, the island bridge…). The newest show
 * in the bottom ticker and the whole list can be read from the More menu.
 *
 * Names and texts are Arabic source keys; texts are stored encoded (see i18n `msg`)
 * so they show in the player's current language.
 */
import { msg } from "../i18n/index.ts";
import { PLACES } from "./places.ts";
import type { Sim } from "./sim";

export type VoiceMood = "complaint" | "praise" | "idea";

export type Voice = {
  id: string;
  /** Fictional resident's name (Arabic key). */
  name: string;
  /** Where they live (Arabic place key). */
  area: string;
  /** Encoded message. */
  text: string;
  mood: VoiceMood;
  day: number;
};

/** Made-up residents; any resemblance to real people is coincidental. */
export const VOICE_NAMES = [
  "أم ناصر",
  "بو عبدالله",
  "نورة",
  "فيصل",
  "مريم",
  "أبو يوسف",
  "دانة",
  "حمد",
  "أم بدر",
  "سالم",
  "هيا",
  "بدر",
  "جاسم",
  "لطيفة",
  "عبدالعزيز",
  "شيخة",
  "أم مشاري",
  "بو سعود",
  "ريم",
  "خالد",
] as const;

/** What the city looks like this month, as far as residents notice. */
export type VoiceContext = {
  pop: number;
  happy: number;
  traffic: number;
  pollution: number;
  crime: number;
  power: number;
  water: number;
  unemployment: number;
  health: number;
  education: number;
  costIndex: number;
  tax: number;
  service: number;
  coins: number;
  crisis: boolean;
  disaster: boolean;
  event: boolean;
  parks: number;
  landmarks: number;
  industry: number;
  refinery: boolean;
  port: boolean;
  islandLinked: boolean;
  islandBuilt: number;
};

type Line = { mood: VoiceMood; text: string; weight: number };

export const VOICE_LINES = {
  traffic: "الزحمة خانقة، أحتاج ساعة عشان أوصل الدوام",
  pollution: "الهواء صاير ثقيل، ريحة المصانع توصل البيت",
  refinery: "المصفاة قريبة منا والدخان يضايق العيال",
  crime: "سرقوا سيارة جارنا، وين دوريات الشرطة؟",
  power: "الكهرباء تنقطع والحر ما يرحم",
  water: "الماي ينقطع عنا كل يومين",
  jobs: "تخرجت من سنتين وللحين بدون وظيفة",
  rent: "الإيجارات نار، نص راتبي يروح للسكن",
  tax: "الضرايب زادت وايد، ما عاد يكفي الراتب",
  health: "المستوصف زحمة، انتظرت ثلاث ساعات",
  school: "عيالي ما لقوا مقعد في المدرسة القريبة",
  services: "الخدمات ناقصة في منطقتنا",
  debt: "سمعنا إن البلدية عليها ديون، خايفين على المشاريع",
  crisis: "الأزمة أثرت علينا، الله يعدّيها على خير",
  disaster: "الكارثة خربت بيوت، نبي تعويض سريع",
  unhappy: "ما أحس إن أحد يسمعنا، نبي تغيير",
  bridgeIdea: "ليش ما تبنون جسر للجزيرة؟ نبي نروح نتمشى هناك",
  happy: "الحمد لله، الديرة تتطور وأنا مبسوط",
  parks: "الحدائق الجديدة حلوة، نطلع فيها كل مساء",
  bridge: "جسر الجزيرة رهيب، المنظر من فوقه يجنن",
  island: "سكنت في الجزيرة، هدوء وبحر وكل شي قريب",
  portJobs: "اشتغلت في الميناء الجديد، الله يوفق المحافظ",
  factoryJobs: "المصنع فتح وظايف لشباب المنطقة، شكراً",
  landmark: "رحت للمعلم الجديد مع أهلي، فخر للكويت",
  lowTax: "الضرايب معقولة، الله يجزاكم خير",
  event: "الفعالية كانت روعة، نبي مثلها كل شهر",
  calm: "الأمور طيبة والشوارع نظيفة",
  ideaWalk: "نبي ممشى على البحر للعوايل",
  ideaLibrary: "ودنا بمكتبة عامة في الحي للشباب",
  ideaParking: "لو تزيدون المواقف عند الجمعية",
  ideaMetro: "متى بيوصل المترو لمنطقتنا؟",
  ideaFactory: "لو تفتحون مصنع، شبابنا يبون شغل",
} as const;

function candidates(x: VoiceContext): Line[] {
  const L = VOICE_LINES;
  const out: Line[] = [];
  const add = (mood: VoiceMood, text: string, weight: number) => out.push({ mood, text, weight });
  if (x.traffic > 45) add("complaint", L.traffic, x.traffic);
  if (x.pollution > 40) add("complaint", x.refinery ? L.refinery : L.pollution, x.pollution);
  if (x.crime > 48) add("complaint", L.crime, x.crime);
  if (x.power < 90 && x.pop > 20) add("complaint", L.power, 120 - x.power);
  if (x.water < 90 && x.pop > 20) add("complaint", L.water, 120 - x.water);
  if (x.unemployment > 30) add("complaint", L.jobs, x.unemployment);
  if (x.costIndex > 115) add("complaint", L.rent, x.costIndex - 60);
  if (x.tax >= 60) add("complaint", L.tax, x.tax / 2);
  if (x.health < 50) add("complaint", L.health, 80 - x.health);
  if (x.education < 45) add("complaint", L.school, 70 - x.education);
  if (x.service < 0.7 && x.pop > 50) add("complaint", L.services, 50);
  if (x.coins < 0) add("complaint", L.debt, 50);
  if (x.crisis) add("complaint", L.crisis, 70);
  if (x.disaster) add("complaint", L.disaster, 80);
  if (x.happy < 40) add("complaint", L.unhappy, 60 - x.happy);
  if (x.happy >= 70) add("praise", L.happy, x.happy - 40);
  if (x.parks >= 3) add("praise", L.parks, 25);
  if (x.islandLinked) add("praise", L.bridge, 30);
  if (x.islandBuilt > 0) add("praise", L.island, 25);
  if (x.port && x.unemployment < 30) add("praise", L.portJobs, 30);
  if (x.industry > 0 && x.unemployment < 35) add("praise", L.factoryJobs, 20);
  if (x.landmarks > 0) add("praise", L.landmark, 20);
  if (x.tax <= 10) add("praise", L.lowTax, 20);
  if (x.event) add("praise", L.event, 40);
  if (!out.some((l) => l.mood === "praise")) add("praise", L.calm, 15);
  if (!x.islandLinked && x.pop > 500) add("idea", L.bridgeIdea, 25);
  if (x.industry === 0 && x.unemployment > 20) add("idea", L.ideaFactory, 25);
  add("idea", L.ideaWalk, 8);
  add("idea", L.ideaLibrary, 8);
  add("idea", L.ideaParking, 8);
  if (x.pop > 5000) add("idea", L.ideaMetro, 8);
  return out;
}

/** Residents speak up: 2–3 new voices, newest first, at most 80 kept. */
export function voicesMonth(s: Sim, x: VoiceContext, random: () => number = Math.random) {
  const pool = candidates(x);
  const count = 2 + (random() < 0.5 ? 1 : 0);
  const recent = new Set((s.voices ?? []).slice(0, 6).map((v) => v.text));
  const fresh: Voice[] = [];
  for (let i = 0; i < count && pool.length; i += 1) {
    const total = pool.reduce((a, l) => a + l.weight, 0);
    let roll = random() * total;
    let at = 0;
    for (; at < pool.length - 1; at += 1) {
      roll -= pool[at]!.weight;
      if (roll <= 0) break;
    }
    const line = pool.splice(at, 1)[0]!;
    const text = msg(line.text);
    if (recent.has(text) && pool.length) continue;
    const place = PLACES[1 + Math.floor(random() * (PLACES.length - 1))]!;
    fresh.push({
      id: `${s.day.toString(36)}-${i}-${Math.floor(random() * 1e6).toString(36)}`,
      name: VOICE_NAMES[Math.floor(random() * VOICE_NAMES.length)]!,
      area: place.name,
      text,
      mood: line.mood,
      day: s.day,
    });
  }
  s.voices = [...fresh, ...(s.voices ?? [])].slice(0, 80);
  return fresh;
}

export function loadVoices(raw: unknown): Voice[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v) => v && typeof v === "object" && typeof (v as Voice).text === "string")
    .slice(0, 80)
    .map((v) => {
      const x = v as Voice;
      return {
        id: String(x.id),
        name: String(x.name ?? ""),
        area: String(x.area ?? ""),
        text: x.text,
        mood: x.mood === "praise" || x.mood === "idea" ? x.mood : "complaint",
        day: Number(x.day) || 0,
      };
    });
}

export function unreadVoices(s: Sim) {
  return (s.voices ?? []).filter((v) => v.day > (s.voicesSeen ?? -1)).length;
}
