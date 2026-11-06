/**
 * Cloud saves: the player signs in with an 8-digit phone number and an 8-digit
 * PIN, and their whole game (every "omdat-" key in browser storage) is kept in the
 * artifact's shared database, so it can be restored on another device.
 *
 * Layout: `cloud/<account>` holds the PIN hash and save info; the save itself is
 * gzip+base64 text split over `cloud/<account>/parts/<n>` (documents are capped at
 * 256 KiB). The account id is a hash of the phone number, and the PIN is stored only
 * as a salted PBKDF2 hash.
 *
 * Only works where the page runs inside Claude with the `db` capability; elsewhere
 * (the App Store build, a saved copy) `cloudDb()` resolves null and the feature hides.
 */

const PART = 200_000;
const SESSION_KEY = "omdat-cloud";
/** Device settings that stay on each device. */
const LOCAL_ONLY = [SESSION_KEY, "omdat-graphics", "omdat-graphics-level"];

type DocSnap = { exists: boolean; data(): Record<string, unknown> | undefined };
type DocRef = {
  get(): Promise<DocSnap>;
  set(data: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
};
export type CloudDb = { doc(path: string): DocRef };

export type CloudInfo = { savedAt: number; residents: number; day: number; size: number };
export type CloudSession = { phone: string; id: string; key: string };
export type CloudError =
  | "unavailable"
  | "bad-phone"
  | "bad-pin"
  | "no-account"
  | "taken"
  | "wrong-pin"
  | "no-write"
  | "full"
  | "network";

export class CloudFail extends Error {
  constructor(public code: CloudError) {
    super(code);
  }
}

let dbPromise: Promise<CloudDb | null> | null = null;

/** The artifact database, or null when this page is not running inside Claude. */
export function cloudDb(): Promise<CloudDb | null> {
  if (dbPromise) return dbPromise;
  const host = typeof window === "undefined" ? undefined : (window as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
  dbPromise =
    host && typeof host.use === "function"
      ? host.use("db").then((d) => (d as CloudDb | null) ?? null, () => null)
      : Promise.resolve(null);
  return dbPromise;
}

export const validPhone = (s: string) => /^[0-9]{8}$/.test(s);
export const validPin = (s: string) => /^[0-9]{8}$/.test(s);

const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function accountId(phone: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`almohafez:${phone}`));
  return hex(digest).slice(0, 40);
}

async function pinHash(pin: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 150_000 },
    key,
    256,
  );
  return hex(bits);
}

// ------------------------------------------------------------- snapshot encoding

/** Every game key in browser storage (device settings excluded). */
export function snapshotLocal(store: Storage = localStorage) {
  const out: Record<string, string> = {};
  for (let i = 0; i < store.length; i += 1) {
    const k = store.key(i);
    if (!k || !k.startsWith("omdat-") || LOCAL_ONLY.includes(k)) continue;
    const v = store.getItem(k);
    if (v !== null) out[k] = v;
  }
  return out;
}

/** Replace the game keys in browser storage with a snapshot. */
export function restoreLocal(snap: Record<string, string>, store: Storage = localStorage) {
  const old: string[] = [];
  for (let i = 0; i < store.length; i += 1) {
    const k = store.key(i);
    if (k && k.startsWith("omdat-") && !LOCAL_ONLY.includes(k)) old.push(k);
  }
  for (const k of old) store.removeItem(k);
  for (const [k, v] of Object.entries(snap))
    if (k.startsWith("omdat-") && !LOCAL_ONLY.includes(k) && typeof v === "string") store.setItem(k, v);
}

const toB64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Text → "z:" gzip base64 when the browser can compress, else "j:" plain. */
export async function encodeSave(text: string) {
  if (typeof CompressionStream === "function")
    return `z:${toB64(await pipe(new TextEncoder().encode(text), new CompressionStream("gzip")))}`;
  return `j:${text}`;
}

export async function decodeSave(packed: string) {
  if (packed.startsWith("j:")) return packed.slice(2);
  if (!packed.startsWith("z:") || typeof DecompressionStream !== "function") throw new CloudFail("network");
  return new TextDecoder().decode(await pipe(fromB64(packed.slice(2)), new DecompressionStream("gzip")));
}

// ------------------------------------------------------------------- the account

export function loadSession(): CloudSession | null {
  try {
    const raw = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as CloudSession | null;
    return raw && validPhone(raw.phone) && typeof raw.id === "string" && typeof raw.key === "string" ? raw : null;
  } catch {
    return null;
  }
}

export function signOut() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage blocked */
  }
}

function keep(session: CloudSession) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* storage blocked: the session lasts this visit only */
  }
}

async function need() {
  const db = await cloudDb();
  if (!db) throw new CloudFail("unavailable");
  return db;
}

/** Store errors → what the player is told. */
function storeFail(e: unknown): never {
  if (e instanceof CloudFail) throw e;
  const code = (e as { code?: string })?.code;
  if (code === "invalid_argument" || code === "not_granted") throw new CloudFail("no-write");
  if (code === "quota_exceeded") throw new CloudFail("full");
  throw new CloudFail("network");
}

function infoOf(d: Record<string, unknown> | undefined): CloudInfo | null {
  if (!d || !Number(d.parts)) return null;
  return {
    savedAt: Number(d.savedAt) || 0,
    residents: Number(d.residents) || 0,
    day: Number(d.day) || 0,
    size: Number(d.size) || 0,
  };
}

/** Sign in to an existing account; returns the saved game's info, if any. */
export async function signIn(phone: string, pin: string) {
  if (!validPhone(phone)) throw new CloudFail("bad-phone");
  if (!validPin(pin)) throw new CloudFail("bad-pin");
  const db = await need();
  const id = await accountId(phone);
  try {
    const meta = await db.doc(`cloud/${id}`).get();
    const d = meta.data();
    if (!meta.exists || !d) throw new CloudFail("no-account");
    if ((await pinHash(pin, String(d.salt))) !== d.hash) throw new CloudFail("wrong-pin");
    const session = { phone, id, key: String(d.hash) };
    keep(session);
    return { session, info: infoOf(d) };
  } catch (e) {
    return storeFail(e);
  }
}

/** Create an account for a new phone number (the current game is not saved yet). */
export async function signUp(phone: string, pin: string) {
  if (!validPhone(phone)) throw new CloudFail("bad-phone");
  if (!validPin(pin)) throw new CloudFail("bad-pin");
  const db = await need();
  const id = await accountId(phone);
  try {
    const meta = await db.doc(`cloud/${id}`).get();
    if (meta.exists) throw new CloudFail("taken");
    const salt = toB64(crypto.getRandomValues(new Uint8Array(12)));
    const hash = await pinHash(pin, salt);
    await db.doc(`cloud/${id}`).set({ salt, hash, parts: 0, savedAt: 0 });
    const session = { phone, id, key: hash };
    keep(session);
    return session;
  } catch (e) {
    return storeFail(e);
  }
}

/** Upload this device's game to the account. */
export async function pushSave(session: CloudSession, about: { residents: number; day: number }) {
  const db = await need();
  try {
    const meta = await db.doc(`cloud/${session.id}`).get();
    const d = meta.data();
    if (!meta.exists || !d) throw new CloudFail("no-account");
    if (d.hash !== session.key) throw new CloudFail("wrong-pin");
    const packed = await encodeSave(JSON.stringify(snapshotLocal()));
    const parts = Math.max(1, Math.ceil(packed.length / PART));
    for (let i = 0; i < parts; i += 1)
      await db.doc(`cloud/${session.id}/parts/${i}`).set({ text: packed.slice(i * PART, (i + 1) * PART) });
    const savedAt = Date.now();
    await db.doc(`cloud/${session.id}`).set({
      salt: d.salt,
      hash: d.hash,
      parts,
      savedAt,
      residents: about.residents,
      day: about.day,
      size: packed.length,
    });
    // Drop parts left over from a bigger earlier save.
    for (let i = parts; i < Number(d.parts) || 0; i += 1)
      await db.doc(`cloud/${session.id}/parts/${i}`).delete().catch(() => undefined);
    return { savedAt, residents: about.residents, day: about.day, size: packed.length } as CloudInfo;
  } catch (e) {
    return storeFail(e);
  }
}

/** Download the account's game into browser storage (the page reloads after). */
export async function pullSave(session: CloudSession) {
  const db = await need();
  try {
    const meta = await db.doc(`cloud/${session.id}`).get();
    const d = meta.data();
    if (!meta.exists || !d) throw new CloudFail("no-account");
    if (d.hash !== session.key) throw new CloudFail("wrong-pin");
    const parts = Number(d.parts) || 0;
    if (!parts) return false;
    let packed = "";
    for (let i = 0; i < parts; i += 1) {
      const part = await db.doc(`cloud/${session.id}/parts/${i}`).get();
      const text = part.data()?.text;
      if (typeof text !== "string") throw new CloudFail("network");
      packed += text;
    }
    const snap = JSON.parse(await decodeSave(packed)) as Record<string, string>;
    restoreLocal(snap);
    return true;
  } catch (e) {
    return storeFail(e);
  }
}

/** Account info without signing in again (null when signed out or missing). */
export async function cloudInfo(session: CloudSession) {
  const db = await cloudDb();
  if (!db) return null;
  try {
    const d = (await db.doc(`cloud/${session.id}`).get()).data();
    return d && d.hash === session.key ? infoOf(d) : null;
  } catch {
    return null;
  }
}
