import { useSyncExternalStore } from "react";

// Thème d'affichage : clair, sombre ou automatique (suit le réglage de l'appareil).
// Préférence propre à l'appareil (localStorage) ; appliquée par la classe « dark » sur <html>.

const KEY = "dymTheme";
export const THEME_PREFERENCES = ["light", "dark", "system"];

const listeners = new Set();
const media = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

function readPreference() {
  try {
    const value = localStorage.getItem(KEY);
    return THEME_PREFERENCES.includes(value) ? value : "system";
  } catch {
    return "system";
  }
}

let preference = readPreference();

const resolve = (pref) => (pref === "system" ? (media?.matches ? "dark" : "light") : pref);

function apply() {
  const dark = resolve(preference) === "dark";
  document.documentElement.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0b1120" : "#0b1020");
  listeners.forEach((listener) => listener());
}

export function setThemePreference(next) {
  preference = THEME_PREFERENCES.includes(next) ? next : "system";
  try {
    localStorage.setItem(KEY, preference);
  } catch {
    // stockage indisponible : le choix vaut pour la session
  }
  apply();
}

/** À appeler au démarrage (avant le premier rendu). */
export function initTheme() {
  apply();
  media?.addEventListener?.("change", () => preference === "system" && apply());
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => `${preference}|${resolve(preference)}`;

/** Thème courant : { preference, theme ("light" | "dark"), setPreference }. */
export function useTheme() {
  const [pref, theme] = useSyncExternalStore(subscribe, snapshot).split("|");
  return { preference: pref, theme, setPreference: setThemePreference };
}
