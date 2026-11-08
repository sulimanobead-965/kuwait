/**
 * The native iPhone/iPad shell (Capacitor). On the web every function here is a
 * no-op, so the same game code runs in Safari and in the App Store app.
 *
 * - Saves: the game keeps its state in localStorage. iOS may clear a web view's
 *   storage when the phone runs low on space, so every "omdat-" key is mirrored to
 *   the app's permanent preferences and restored before the game starts.
 * - Haptics: a light tap when building, a firmer one for rewards and errors.
 * - Status bar, splash screen, and live updates (when enabled in the config).
 */
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { App } from "@capacitor/app";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { setSoundHook } from "@/game/audio";

const PREFIX = "omdat-";

export const isNative = () => Capacitor.isNativePlatform();

/** Copy saved games from permanent storage back into localStorage if it was wiped. */
async function restoreSaves() {
  const { keys } = await Preferences.keys();
  for (const key of keys) {
    if (!key.startsWith(PREFIX) || localStorage.getItem(key) !== null) continue;
    const { value } = await Preferences.get({ key });
    if (value !== null) localStorage.setItem(key, value);
  }
  // Anything only in localStorage (first run after an update) goes to permanent storage too.
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) await Preferences.set({ key, value: localStorage.getItem(key) ?? "" });
  }
}

/** From now on, every game save is also written to permanent storage. */
function mirrorSaves() {
  const proto = Object.getPrototypeOf(localStorage) as Storage;
  const set = proto.setItem;
  const remove = proto.removeItem;
  proto.setItem = function (key: string, value: string) {
    set.call(this, key, value);
    if (key.startsWith(PREFIX)) void Preferences.set({ key, value });
  };
  proto.removeItem = function (key: string) {
    remove.call(this, key);
    if (key.startsWith(PREFIX)) void Preferences.remove({ key });
  };
}

function haptics() {
  setSoundHook((kind) => {
    if (kind === "place" || kind === "road") void Haptics.impact({ style: ImpactStyle.Light });
    else if (kind === "collect") void Haptics.impact({ style: ImpactStyle.Medium });
    else if (kind === "quest") void Haptics.notification({ type: NotificationType.Success });
    else if (kind === "error") void Haptics.notification({ type: NotificationType.Warning });
  });
}

/**
 * Prepare the native shell before the game renders. Safe to call on the web.
 */
export async function bootNative() {
  if (!isNative()) return;
  try {
    await restoreSaves();
  } catch {
    /* the game still runs on localStorage alone */
  }
  mirrorSaves();
  haptics();
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setOverlaysWebView({ overlay: true });
  } catch {
    /* iPad / older iOS */
  }
  // Tell the live-update plugin this version started fine (otherwise it rolls back).
  try {
    await CapacitorUpdater.notifyAppReady();
  } catch {
    /* live updates not configured */
  }
  // Leaving the app: make sure the last moves are saved (the game listens for this).
  void App.addListener("appStateChange", ({ isActive }) => {
    if (!isActive) window.dispatchEvent(new Event("pagehide"));
  });
}

/** Hide the splash screen once the first frame of the game is on screen. */
export function nativeReady() {
  if (!isNative()) return;
  requestAnimationFrame(() => void SplashScreen.hide({ fadeOutDuration: 250 }));
}
