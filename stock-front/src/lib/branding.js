import { useEffect } from "react";

// Identité visuelle de chaque entreprise cliente : sa couleur remplace la palette
// « brand » de Tailwind (variables CSS --color-brand-*), son logo l'icône de l'onglet.

export const DEFAULT_BRAND_COLOR = "#2554eb";

export const BRAND_PRESETS = ["#2554eb", "#0f766e", "#16a34a", "#9333ea", "#db2777", "#dc2626", "#ea580c", "#0f172a"];

export const isHexColor = (value) => /^#[0-9a-f]{6}$/i.test(value || "");

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Une couleur trop claire rendrait le texte blanc des boutons illisible. */
export const isTooLight = (hex) => isHexColor(hex) && luminance(hex) > 0.4;

/** Couleur de base (hex) pour les boutons, graphiques et factures — assombrie si trop claire. */
export function brandBase(hex) {
  const color = isHexColor(hex) ? hex : DEFAULT_BRAND_COLOR;
  if (!isTooLight(color)) return color;
  return `#${[1, 3, 5].map((i) => Math.round(parseInt(color.slice(i, i + 2), 16) * 0.6).toString(16).padStart(2, "0")).join("")}`;
}

const SHADES = { 50: 7, 100: 14, 200: 26, 300: 42, 400: 64, 500: 84 };
const DARK_SHADES = { 700: 84, 800: 70, 900: 56 };

/**
 * Palette brand-50 … brand-900 à partir de la couleur de l'entreprise.
 * En mode sombre, les teintes claires (fonds) se mélangent au fond sombre
 * et les teintes foncées (textes) s'éclaircissent.
 */
export function brandPalette(hex, theme = "light") {
  const base = brandBase(hex);
  const dark = theme === "dark";
  const vars = { "--color-brand-600": base };
  for (const [shade, pct] of Object.entries(SHADES)) {
    vars[`--color-brand-${shade}`] = dark && Number(shade) <= 200 ? `color-mix(in oklab, ${base} ${pct + 8}%, #0b1120)` : `color-mix(in oklab, ${base} ${pct}%, white)`;
  }
  for (const [shade, pct] of Object.entries(DARK_SHADES)) {
    vars[`--color-brand-${shade}`] = dark ? `color-mix(in oklab, ${base} ${pct - 20}%, white)` : `color-mix(in oklab, ${base} ${pct}%, black)`;
  }
  return vars;
}

/** Applique l'identité de l'entreprise tant que le composant est monté (espace connecté). */
export function useBranding({ brandColor, logo }, theme = "light") {
  useEffect(() => {
    const root = document.documentElement;
    const vars = brandPalette(brandColor, theme);
    Object.entries(vars).forEach(([name, value]) => root.style.setProperty(name, value));
    return () => Object.keys(vars).forEach((name) => root.style.removeProperty(name));
  }, [brandColor, theme]);

  useEffect(() => {
    const icon = document.querySelector('link[rel="icon"]');
    if (!icon || !logo) return undefined;
    const previous = { href: icon.getAttribute("href"), type: icon.getAttribute("type") };
    icon.setAttribute("href", logo);
    icon.removeAttribute("type");
    return () => {
      icon.setAttribute("href", previous.href);
      if (previous.type) icon.setAttribute("type", previous.type);
    };
  }, [logo]);
}
