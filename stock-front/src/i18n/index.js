import { useSyncExternalStore } from "react";
import en from "./en.js";

// Traduction de l'interface. Le texte français sert de clé : t("Tableau de bord").
// Une phrase absente du dictionnaire s'affiche en français (jamais de clé brute à l'écran).
// Variables : t("Compte créé pour {0}", [nom]) ou t("Bonjour {name}", { name }).
// Préférence propre à l'appareil (localStorage).

export const LANGUAGES = [
  { code: "fr", label: "Français", short: "FR", locale: "fr-FR" },
  { code: "en", label: "English", short: "EN", locale: "en-GB" },
];

const DICTIONARIES = { en };
const KEY = "dymLang";
const listeners = new Set();

function initialLanguage() {
  try {
    const saved = localStorage.getItem(KEY);
    if (LANGUAGES.some((l) => l.code === saved)) return saved;
  } catch {
    // stockage indisponible
  }
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("en") ? "en" : "fr";
}

let current = initialLanguage();
if (typeof document !== "undefined") document.documentElement.lang = current;

export function t(text, params) {
  if (typeof text !== "string") return text;
  const translated = DICTIONARIES[current]?.[text] ?? text;
  if (!params) return translated;
  return translated.replace(/\{(\w+)\}/g, (match, key) => (params[key] ?? match));
}

/**
 * Table de libellés traduite à la lecture : localized({ cash: "Espèces" }).cash → « Cash » en anglais.
 * Les objets imbriqués ({ label, tone }) sont traduits de la même façon.
 * À réserver aux tables d'affichage : une valeur de donnée (statut enregistré) ne doit pas y passer.
 */
export function localized(table) {
  return new Proxy(table, {
    get(target, key) {
      const value = target[key];
      if (typeof value === "string") return t(value);
      if (value && typeof value === "object" && !Array.isArray(value)) return localized(value);
      return value;
    },
  });
}

export const getLanguage = () => current;

/** Locale pour les dates et les nombres (« fr-FR » / « en-GB »). */
export const locale = () => LANGUAGES.find((l) => l.code === current)?.locale || "fr-FR";

export function setLanguage(code) {
  if (!LANGUAGES.some((l) => l.code === code) || code === current) return;
  current = code;
  document.documentElement.lang = code;
  try {
    localStorage.setItem(KEY, code);
  } catch {
    // le choix vaut pour la session
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Langue courante ; le composant qui l'utilise se réaffiche quand elle change. */
export function useLanguage() {
  const language = useSyncExternalStore(subscribe, getLanguage);
  return { language, setLanguage, languages: LANGUAGES };
}
