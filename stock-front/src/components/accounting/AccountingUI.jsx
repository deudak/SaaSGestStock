/* eslint-disable react-refresh/only-export-components */
import { useMemo, useState } from "react";
import { useStore } from "../../store/StoreContext";
import { buildJournal } from "../../lib/accounting/engine";
import { ACCOUNT_OPTIONS, accountName } from "../../lib/accounting/chart";
import { Input, Select } from "../ui/Form";
import { toDateInput } from "../../lib/format";

import { locale, t } from "../../i18n/index.js";

const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

export const PERIOD_PRESETS = [
  { value: "month", label: "Ce mois" },
  { value: "lastMonth", label: "Mois dernier" },
  { value: "quarter", label: "Ce trimestre" },
  { value: "year", label: "Cette année" },
  { value: "lastYear", label: "Année dernière" },
  { value: "custom", label: "Personnalisée" },
];

function presetRange(preset, now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case "month":
      return [new Date(y, m, 1), endOfDay(new Date(y, m + 1, 0))];
    case "lastMonth":
      return [new Date(y, m - 1, 1), endOfDay(new Date(y, m, 0))];
    case "quarter": {
      const q = Math.floor(m / 3) * 3;
      return [new Date(y, q, 1), endOfDay(new Date(y, q + 3, 0))];
    }
    case "lastYear":
      return [new Date(y - 1, 0, 1), endOfDay(new Date(y - 1, 11, 31))];
    default:
      return [new Date(y, 0, 1), endOfDay(new Date(y, 11, 31))];
  }
}

/** Période choisie par l'utilisateur ({ from, to } en dates locales). */
export function usePeriod(initial = "year") {
  const [preset, setPreset] = useState(initial);
  const [custom, setCustom] = useState(() => {
    const [from, to] = presetRange("year");
    return { from: toDateInput(from), to: toDateInput(to) };
  });
  const range = useMemo(() => {
    if (preset !== "custom") return presetRange(preset);
    const from = new Date(`${custom.from}T00:00:00`);
    const to = endOfDay(new Date(`${custom.to}T00:00:00`));
    return Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to ? presetRange("year") : [from, to];
  }, [preset, custom]);
  const label = preset === "custom" ? `du ${range[0].toLocaleDateString(locale())} au ${range[1].toLocaleDateString(locale())}` : t(PERIOD_PRESETS.find((p) => p.value === preset).label).toLowerCase();
  return { preset, setPreset, custom, setCustom, from: range[0], to: range[1], label };
}

export function PeriodPicker({ period }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={period.preset} onChange={(e) => period.setPreset(e.target.value)} className="w-44 py-2 text-sm" aria-label={t("Période")}>
        {PERIOD_PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {t(p.label)}
          </option>
        ))}
      </Select>
      {period.preset === "custom" && (
        <>
          <Input type="date" value={period.custom.from} onChange={(e) => period.setCustom((c) => ({ ...c, from: e.target.value }))} className="w-40 py-2 text-sm" aria-label={t("Du")} />
          <span className="text-xs text-slate-400">{t("au")}</span>
          <Input type="date" value={period.custom.to} onChange={(e) => period.setCustom((c) => ({ ...c, to: e.target.value }))} className="w-40 py-2 text-sm" aria-label={t("Au")} />
        </>
      )}
    </div>
  );
}

/** Journal général calculé à partir des données de l'entreprise, jusqu'à la fin de la période. */
export function useJournal(from, to) {
  const { state } = useStore();
  const fromTime = from?.getTime();
  const toTime = to?.getTime();
  return useMemo(
    () => buildJournal(state, state.settings, { from: fromTime ? new Date(fromTime) : undefined, to: toTime ? new Date(toTime) : undefined }),
    [state, fromTime, toTime]
  );
}

/** Liste déroulante du plan de comptes, avec saisie libre d'un numéro de compte. */
export function AccountInput({ value, onChange, id, className = "", placeholder = t("Ex : 571") }) {
  return (
    <>
      <Input list="accounting-chart" value={value} onChange={(e) => onChange(e.target.value.trim())} placeholder={placeholder} className={className} id={id} inputMode="numeric" />
      <datalist id="accounting-chart">
        {ACCOUNT_OPTIONS.map((a) => (
          <option key={a.code} value={a.code}>
            {a.name}
          </option>
        ))}
      </datalist>
    </>
  );
}

export function AccountLabel({ code }) {
  return (
    <span className="min-w-0">
      <span className="tabular font-semibold text-slate-900">{code}</span> <span className="text-slate-500">{accountName(code)}</span>
    </span>
  );
}

/** Montant en F sans décimales ; vide si nul (tableaux comptables). */
export const amount = (value, { blankZero = true } = {}) => (blankZero && !value ? "" : `${Math.round(value).toLocaleString(locale())}`);

/** Racine des pages comptables : espace administrateur ou espace comptable. */
export function useAccountingBase() {
  const { currentUser } = useStore();
  return currentUser?.role === "accountant" ? "/accountant" : "/admin/accounting";
}
