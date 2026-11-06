import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { EN } from "./en.ts";
import { getLang, hasEnglish, msg, setLang, t, tx } from "./index.ts";
import {
  ACHIEVEMENTS,
  COST_ITEMS,
  CRISES,
  createInitial,
  ERAS,
  EVENTS,
  MODEL_AREAS,
  QUESTS,
  RANKS,
  SERVICE_NAMES,
} from "../game/sim.ts";
import { COMPANIES, PROJECT_OFFERS } from "../game/finance.ts";
import { BUILDER_NAME } from "../game/builder.ts";
import { chat, NPCS } from "../game/npcs.ts";
import { CATALOG, CATEGORIES } from "../game/catalog.ts";
import { DISTRICTS } from "../game/districts.ts";
import { PLACES } from "../game/places.ts";

const ARABIC = /[؀-ۿ]/;
const placeholders = (s: string) =>
  [...s.matchAll(/\{(\w+)\}/g)]
    .map((m) => m[1])
    .sort()
    .join(",");

/** Run `fn` in English, then restore the previous language. */
function inEnglish<T>(fn: () => T): T {
  const before = getLang();
  setLang("en");
  try {
    return fn();
  } finally {
    setLang(before);
  }
}

test("every exported data table has English", () => {
  const texts: string[] = [
    ...RANKS.map((r) => r.title),
    ...ERAS,
    ...Object.values(EVENTS).flatMap((e) => [e.name, e.blurb]),
    ...Object.values(CRISES).flatMap((c) => [c.name, c.blurb]),
    ...Object.values(COST_ITEMS).flatMap((c) => [c.name, c.blurb]),
    ...ACHIEVEMENTS.flatMap((a) => [a.name, a.detail].filter(Boolean)),
    ...QUESTS.map((q) => q.text),
    ...Object.values(MODEL_AREAS).flatMap((m) => [m.name, m.blurb]),
    ...Object.values(SERVICE_NAMES),
    ...Object.values(COMPANIES).flatMap((c) => [c.name, c.blurb]),
    ...PROJECT_OFFERS.map((p) => p.name),
    BUILDER_NAME,
    ...NPCS.flatMap((n) => [n.name, n.role, ...n.greet]),
    ...Object.values(CATALOG).flatMap((d) => [d.name, d.blurb]),
    ...CATEGORIES.map((c) => c.label),
    ...DISTRICTS.flatMap((d) => [d.name, d.description]),
    ...PLACES.map((p) => p.name),
  ];
  const missing = texts.filter((s) => !hasEnglish(s));
  assert.deepEqual(missing, [], "untranslated data");
  for (const s of texts) assert.doesNotMatch(EN[s]!, ARABIC, `English for «${s}» has Arabic`);
});

test("key English names read as expected", () => {
  inEnglish(() => {
    assert.deepEqual(
      RANKS.map((r) => t(r.title)),
      ["Assistant Mukhtar", "Area Mukhtar", "The Governor"],
    );
    assert.equal(t("جون الكويت"), "Kuwait Bay");
    assert.equal(t("أبو فهد"), "Abu Fahad");
    assert.equal(t("محافظ الجهراء"), "Governor of Jahra");
  });
});

/**
 * Every Arabic string literal in the game and the UI is a translation key, so each
 * must have English; Arabic must never be baked into a template literal, where no key
 * could find it. Also catches non-Arabic `t("…")`/`msg("…")` keys such as "{n} {label}".
 */
test("every key used in the source has an English translation", () => {
  const root = join(import.meta.dirname, "..");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(name) && !name.endsWith(".test.ts")) files.push(path);
    }
  };
  walk(join(root, "game"));
  walk(join(root, "components"));
  // Not translation keys: the digit table for Arabic-Indic numbers, the language
  // picker's own labels, and the dinar coin's face (artwork, always Arabic).
  const allowed = new Set(["٠١٢٣٤٥٦٧٨٩", "العربية", "اللغة / Language"]);
  const missing: string[] = [];
  const baked: string[] = [];
  for (const file of files) {
    if (file.endsWith("coin-face.ts")) continue;
    const code = readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    for (const m of code.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) {
      const key = m[1]!;
      if (ARABIC.test(key) && !allowed.has(key) && !hasEnglish(key)) missing.push(key);
    }
    for (const m of code.matchAll(/\b(?:t|msg)\(\s*"((?:[^"\\\n]|\\.)*)"/g))
      if (!hasEnglish(m[1]!) && !allowed.has(m[1]!)) missing.push(m[1]!);
    for (const m of code.matchAll(/`(?:[^`\\]|\\.)*`/g)) {
      const outside = m[0].replace(/\$\{[^}]*\}/g, "");
      if (ARABIC.test(outside)) baked.push(`${file}: ${m[0].slice(0, 60)}`);
    }
  }
  assert.deepEqual([...new Set(missing)], [], "keys without English");
  assert.deepEqual(baked, [], "Arabic inside template literals");
});

test("placeholders match between Arabic keys and English templates", () => {
  for (const [key, value] of Object.entries(EN)) {
    assert.equal(placeholders(value), placeholders(key), `placeholders differ for «${key}»`);
    assert.doesNotMatch(value, ARABIC, `English for «${key}» contains Arabic`);
  }
});

test("t() falls back to the source and fills placeholders", () => {
  assert.equal(getLang(), "ar");
  assert.equal(t("نص غير مترجم"), "نص غير مترجم");
  assert.equal(t("سحبت {amount} د.ك", { amount: 1500 }), "سحبت 1,500 د.ك");
  // A context prefix picks a different English rendering and never shows in Arabic.
  assert.equal(t("panel::مستثمر"), "مستثمر");
  assert.equal(t("panel::مستثمر", undefined, "en"), "Invested");
  assert.equal(t("مستثمر", undefined, "en"), "Investor");
  inEnglish(() => {
    assert.equal(t("نص غير مترجم"), "نص غير مترجم");
    assert.equal(t("unknown {x}", { x: 2 }), "unknown 2");
    assert.equal(t("سحبت {amount} د.ك", { amount: 1500 }), "Withdrew 1,500 KD");
    // String params that are keys are translated too (building and company names).
    assert.equal(
      t("حريق ضرب {name} · خسارة {amount} د.ك", { name: "فيلا", amount: 300 }),
      "Fire hit: Villa · 300 KD lost",
    );
  });
});

test("stored messages are language-independent and old saves still show", () => {
  const entry = msg("انطلقت: {name}", { name: "بطولة كرة قدم" });
  assert.equal(tx(entry), "انطلقت: بطولة كرة قدم");
  assert.equal(tx(entry, "en"), "Started: Football Tournament");
  // Nested and listed messages (the construction advisor's report).
  const report = msg("{works} · {spent} د.ك + أتعاب {fee}", {
    works: [
      msg("{n} {label}", { n: 2, label: "حديقة" }),
      msg("{n} {label}", { n: 1, label: "مدرسة" }),
    ],
    spent: "4,000",
    fee: "320",
  });
  assert.equal(tx(report, "en"), "Park ×2, School ×1 · 4,000 KD + 320 fee");
  assert.equal(tx(report, "ar"), "2 حديقة، 1 مدرسة · 4,000 د.ك + أتعاب 320");
  // Plain strings from older saves: known lines translate, anything else shows as is.
  assert.equal(tx("سدّدت القرض كاملاً", "en"), "Loan fully repaid");
  assert.equal(tx("قرض 5,000 د.ك من البنك", "en"), "قرض 5,000 د.ك من البنك");
});

test("NPCs understand English and chat history keeps its language", () => {
  const s = createInitial();
  inEnglish(() => {
    chat(s, "abufahad", "hello, can I get a loan?");
    const reply = s.npcs.find((n) => n.id === "abufahad")!.chat.at(-1)!;
    assert.equal(reply.from, "them");
    assert.match(reply.text, /loan/i);
    assert.doesNotMatch(reply.text, ARABIC);
    chat(s, "abufahad", "thanks!");
    assert.match(s.npcs[0]!.chat.at(-1)!.text, /welcome/i);
    chat(s, "abufahad", "any news about the war?");
    assert.match(s.npcs[0]!.chat.at(-1)!.text, /crises|calm|get us through/i);
  });
  // Arabic still works, and history keeps the language it was written in.
  chat(s, "abufahad", "شكراً");
  assert.equal(s.npcs[0]!.chat.at(-1)!.text, "العفو، واجبنا. الكويت بيتنا كلنا");
  assert.doesNotMatch(s.npcs[0]!.chat[1]!.text, ARABIC);
});

test("large amounts read as billions and trillions, not thousands of millions", async () => {
  const { bigNum, t, msg, tx } = await import("./index.ts");
  assert.equal(bigNum(999_999_999), "999,999,999");
  assert.equal(bigNum(1_000_000_000), "1 مليار");
  assert.equal(bigNum(2_500_000_000), "2.5 مليار");
  assert.equal(bigNum(1_250_000_000_000), "1.25 ترليون");
  assert.equal(bigNum(2_500_000_000, "en"), "2.5B");
  assert.equal(bigNum(3_400_000_000_000, "en"), "3.4T");
  // Stored with Arabic words, shown with English suffixes in English.
  const stored = msg("تحتاج {amount} د.ك", { amount: bigNum(7_000_000_000) });
  assert.equal(tx(stored, "ar"), "تحتاج 7 مليار د.ك");
  assert.equal(tx(stored, "en").includes("7B"), true);
  assert.equal(t("تحتاج {amount} د.ك", { amount: 4_200_000_000 }, "ar"), "تحتاج 4.2 مليار د.ك");
});
