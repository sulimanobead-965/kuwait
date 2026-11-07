/**
 * A tiny, dependency-free i18n layer. Arabic is the source language: every
 * player-visible string in the code is written in Arabic and doubles as its own key.
 * `EN` (./en.ts) maps those keys to English. Missing keys fall back to the source.
 *
 * - `t(key, params)` translates now, in the current language.
 * - `msg(key, params)` encodes a message for storage (the city log, the builder's
 *   report) so saves stay language-independent; `tx(stored)` shows it later in
 *   whatever language is active. Plain strings from older saves still display.
 *
 * A key may carry a context prefix, `"context::نص"`, when the same Arabic needs two
 * English renderings; the prefix never shows in Arabic.
 *
 * Templates use `{name}` placeholders. Numbers are formatted with Western digits;
 * string params that are themselves keys (building, company or NPC names…) are
 * translated too.
 */
import { useSyncExternalStore } from "react";
import { EN } from "./en.ts";

export type Lang = "ar" | "en";
export type Param = string | number | Param[];
export type Params = Record<string, Param>;

export const LANG_KEY = "omdat-lang";
/** Prefix of an encoded message: an invisible separator nobody types. */
const MARK = "⁣";

// Every session starts in Arabic, matching the server render; `bootLang` switches to
// the saved or browser language right after hydration.
let current: Lang = "ar";
let booted = false;
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}

export const dirOf = (lang: Lang = current) => (lang === "ar" ? "rtl" : "ltr");

function applyDocument(lang: Lang) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang;
  document.documentElement.dir = dirOf(lang);
  document.title = lang === "ar" ? "المحافظ" : "The Governor";
}

export function setLang(lang: Lang) {
  booted = true;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* storage unavailable */
  }
  if (lang === current) return applyDocument(lang);
  current = lang;
  applyDocument(lang);
  for (const fn of listeners) fn();
}

/** The saved choice, else English for English browsers, else Arabic. */
export function preferredLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "ar" || saved === "en") return saved;
  } catch {
    /* storage unavailable */
  }
  const nav = typeof navigator !== "undefined" ? navigator.language : "";
  return typeof window !== "undefined" && /^en\b/i.test(nav ?? "") ? "en" : "ar";
}

/** Called once on the client after hydration. */
export function bootLang() {
  if (booted || typeof window === "undefined") return;
  booted = true;
  const lang = preferredLang();
  if (lang !== current) {
    current = lang;
    for (const fn of listeners) fn();
  }
  applyDocument(lang);
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Re-renders the caller whenever the language changes. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, () => "ar" as Lang);
}

/** Western digits with thousands separators, e.g. 12,500; billions and up in words. */
export function num(n: number) {
  return Math.abs(n) >= 1e9 ? bigNum(n) : n.toLocaleString("en-US");
}

const BIG: [number, string, string][] = [
  [1e24, "سبتليون", "Sp"],
  [1e21, "سكستليون", "Sx"],
  [1e18, "كوينتليون", "Qi"],
  [1e15, "كوادريليون", "Qa"],
  [1e12, "ترليون", "T"],
  [1e9, "مليار", "B"],
];

const short = (v: number) => {
  const a = Math.abs(v);
  const d = a >= 100 ? 0 : a >= 10 ? 1 : 2;
  return String(Number(v.toFixed(d)));
};

/**
 * Whole amounts in digits (12,500,000), and from a billion up in words:
 * «1.25 مليار» / "1.25B", «3.4 ترليون» / "3.4T". Stored messages use the Arabic
 * words; `t` turns them into English suffixes when shown in English.
 */
export function bigNum(n: number, lang: Lang = "ar") {
  for (const [size, ar, en] of BIG)
    if (Math.abs(n) >= size) return lang === "en" ? `${short(n / size)}${en}` : `${short(n / size)} ${ar}`;
  return Math.round(n).toLocaleString("en-US");
}

/** The currency after an amount: «د.ك» or "KD". */
export const currency = () => (current === "ar" ? "د.ك" : "KD");

/** Percent sign: «٪» in Arabic, "%" in English. */
export const percentSign = () => (current === "ar" ? "٪" : "%");

function param(v: Param, lang: Lang): string {
  if (Array.isArray(v)) return v.map((x) => param(x, lang)).join(lang === "ar" ? "، " : ", ");
  if (typeof v === "number") return Math.abs(v) >= 1e9 ? bigNum(v, lang) : num(v);
  // Amounts stored in words («1.2 مليار») read as "1.2B" in English.
  if (lang === "en") {
    const unit = BIG.find(([, ar]) => v.endsWith(` ${ar}`));
    if (unit) return v.slice(0, -unit[1].length - 1) + unit[2];
  }
  if (v.startsWith(MARK)) return tx(v, lang);
  return lang === "en" ? (EN[v] ?? v) : v;
}

/** Translates `key` into the current (or given) language and fills `{placeholders}`. */
export function t(key: string, params?: Params, lang: Lang = current): string {
  const cut = key.indexOf("::");
  const source = cut < 0 ? key : key.slice(cut + 2);
  const template = lang === "en" ? (EN[key] ?? source) : source;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (all, name: string) =>
    name in params ? param(params[name]!, lang) : all,
  );
}

/** Encodes a message for storage; display it with `tx`. */
export function msg(key: string, params?: Params): string {
  return MARK + JSON.stringify(params ? [key, params] : [key]);
}

/** Shows a stored string: an encoded message, a known Arabic key, or raw text. */
export function tx(stored: string, lang: Lang = current): string {
  if (typeof stored !== "string") return "";
  if (!stored.startsWith(MARK)) return t(stored, undefined, lang);
  try {
    const [key, params] = JSON.parse(stored.slice(MARK.length)) as [string, Params?];
    return t(key, params, lang);
  } catch {
    return stored.slice(MARK.length);
  }
}

/** Whether `key` has an English translation (used by tests). */
export const hasEnglish = (key: string) => Object.prototype.hasOwnProperty.call(EN, key);
