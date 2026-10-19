import { FaDesktop, FaMoon, FaSun } from "react-icons/fa";
import { t, useLanguage } from "../../i18n/index.js";
import { useTheme } from "../../lib/theme";

const THEME_CYCLE = { light: "dark", dark: "system", system: "light" };
const THEME_ICONS = { light: FaSun, dark: FaMoon, system: FaDesktop };
const THEME_LABELS = { light: "Thème clair", dark: "Thème sombre", system: "Thème du système" };

const buttonClass = "flex h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900";

/** Bascule de langue : FR ↔ EN. */
export function LanguageSwitch({ className = "" }) {
  const { language, setLanguage, languages } = useLanguage();
  const next = languages.find((l) => l.code !== language);
  return (
    <button type="button" onClick={() => setLanguage(next.code)} className={`${buttonClass} min-w-9 ${className}`} title={t("Passer en {0}", [next.label])} aria-label={t("Passer en {0}", [next.label])}>
      {languages.find((l) => l.code === language).short}
    </button>
  );
}

/** Bascule de thème : clair → sombre → système. */
export function ThemeSwitch({ className = "" }) {
  const { preference, setPreference } = useTheme();
  const Icon = THEME_ICONS[preference];
  const label = `${t(THEME_LABELS[preference])} — ${t("cliquer pour changer")}`;
  return (
    <button type="button" onClick={() => setPreference(THEME_CYCLE[preference])} className={`${buttonClass} w-9 ${className}`} title={label} aria-label={label}>
      <Icon size={14} />
    </button>
  );
}

/** Réglages complets (page profil) : langue et thème au choix. */
export function PreferenceChoices() {
  const { language, setLanguage, languages } = useLanguage();
  const { preference, setPreference } = useTheme();
  const option = (active) => `flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${active ? "bg-white text-slate-900 shadow-card" : "text-slate-500 hover:text-slate-900"}`;
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-[13px] font-medium text-slate-700">{t("Langue")}</p>
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {languages.map((l) => (
            <button key={l.code} type="button" className={option(language === l.code)} onClick={() => setLanguage(l.code)}>
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-[13px] font-medium text-slate-700">{t("Affichage")}</p>
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {["light", "dark", "system"].map((value) => {
            const Icon = THEME_ICONS[value];
            return (
              <button key={value} type="button" className={`${option(preference === value)} inline-flex items-center justify-center gap-2`} onClick={() => setPreference(value)}>
                <Icon size={12} /> {t({ light: "Clair", dark: "Sombre", system: "Système" }[value])}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
