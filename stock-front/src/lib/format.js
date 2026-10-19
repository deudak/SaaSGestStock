import { locale } from "../i18n/index.js";
const numberFormatter = new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 });

/** 125000 -> "125 000 F" */
export function formatMoney(value, suffix = "F") {
  const amount = Number(value) || 0;
  return `${numberFormatter.format(amount)} ${suffix}`.trim();
}

/** 1250000 -> "1,3 M" ; 45000 -> "45 k" */
export function formatCompact(value) {
  const amount = Number(value) || 0;
  if (Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace(".", ",")} M`;
  if (Math.abs(amount) >= 1_000) return `${Math.round(amount / 1_000)} k`;
  return numberFormatter.format(amount);
}

export function formatNumber(value) {
  return numberFormatter.format(Number(value) || 0);
}

export function formatDate(value, options = {}) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(locale(), { day: "2-digit", month: "short", year: "numeric", ...options });
}

export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${date.toLocaleDateString(locale(), { day: "2-digit", month: "short", year: "numeric" })} · ${date.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" })}`;
}

export function formatTime(value) {
  const date = new Date(value);
  return date.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
}

/** "il y a 3 h", "hier", "dans 2 j" */
export function formatRelative(value) {
  const date = new Date(value);
  const diffMs = date.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  const diffHours = Math.round(diffMin / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, "hour");
  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 30) return rtf.format(diffDays, "day");
  return formatDate(value);
}

/** Valeur pour <input type="date"> */
export function toDateInput(value) {
  const date = value ? new Date(value) : new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export function initials(name = "") {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isSameDay(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

/** Recherche insensible à la casse et aux accents */
export function normalize(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function matches(query, ...fields) {
  const q = normalize(query).trim();
  if (!q) return true;
  return fields.some((field) => normalize(field).includes(q));
}

export function percentChange(current, previous) {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}
