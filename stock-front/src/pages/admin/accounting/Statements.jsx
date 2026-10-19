import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { FaBalanceScale, FaChartLine, FaCheckCircle, FaExclamationTriangle, FaPercent, FaPrint } from "react-icons/fa";
import { useStore } from "../../../store/StoreContext";
import { Card, EmptyState, PageHeader } from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Tabs from "../../../components/ui/Tabs";
import { PeriodPicker, amount, useJournal, usePeriod } from "../../../components/accounting/AccountingUI";
import { INCOME_LABELS, balanceSheet, incomeStatement, vatReport } from "../../../lib/accounting/engine";
import { downloadCSV, todayStamp } from "../../../lib/csv";
import { printAccountingReport } from "../../../lib/print";
import { formatMoney } from "../../../lib/format";

import { locale, t } from "../../../i18n/index.js";

const monthLabel = (key) => new Date(Number(key.slice(0, 4)), Number(key.slice(5)) - 1, 1).toLocaleDateString(locale(), { month: "long", year: "numeric" });

// Rubriques du compte de résultat dans l'ordre SYSCOHADA ; « total » = soldes intermédiaires
const INCOME_ROWS = [
  { code: "TA", sign: "+" },
  { code: "RA", sign: "−" },
  { code: "RB", sign: "−" },
  { code: "XA", total: true },
  { code: "TB", sign: "+" },
  { code: "TC", sign: "+" },
  { code: "RC", sign: "−" },
  { code: "RD", sign: "−" },
  { code: "RE", sign: "−" },
  { code: "RF", sign: "−" },
  { code: "RG", sign: "−" },
  { code: "XC", total: true },
  { code: "RH", sign: "−" },
  { code: "XD", total: true },
  { code: "RI", sign: "−" },
  { code: "XE", total: true },
  { code: "TF", sign: "+" },
  { code: "RJ", sign: "−" },
  { code: "XF", total: true },
  { code: "XG", total: true },
  { code: "XH", sign: "+" },
  { code: "RK", sign: "−" },
  { code: "XI", total: true, final: true },
];

const ACTIF_ROWS = [
  ["immobilisations", "Immobilisations nettes (21 à 29)"],
  ["stocks", "Stocks et encours (31 à 39)"],
  ["clients", "Clients nets de dépréciations (41, 49)"],
  ["autresCreances", "Autres créances, dont TVA récupérable (42 à 48)"],
  ["tresorerie", "Trésorerie actif : banque, Mobile Money, caisse (50 à 58)"],
];
const PASSIF_ROWS = [
  ["capital", "Capital et apports (10)"],
  ["reserves", "Réserves, subventions et provisions réglementées (11, 14, 15)"],
  ["report", "Report à nouveau (12)"],
  ["resultat", "Résultat net de l'exercice (13)"],
  ["provisions", "Provisions pour risques et charges (19)"],
  ["dettesFinancieres", "Emprunts et dettes financières (16 à 18)"],
  ["fournisseurs", "Fournisseurs d'exploitation (40)"],
  ["dettesFiscales", "Dettes fiscales et sociales, dont TVA due (42 à 44)"],
  ["autresDettes", "Autres dettes (45 à 48)"],
  ["tresoreriePassif", "Trésorerie passif : découverts, crédits de trésorerie (52, 56)"],
];

function Row({ label, value, strong, muted, code }) {
  return (
    <tr className={strong ? "bg-slate-50 font-bold text-slate-900" : ""}>
      <td className={`px-4 py-2.5 ${muted ? "text-slate-400" : "text-slate-700"}`}>
        {code && <span className="mr-2 text-[11px] font-semibold text-slate-400">{code}</span>}
        {t(label)}
      </td>
      <td className={`tabular px-4 py-2.5 text-right ${value < 0 ? "text-rose-600" : ""}`}>{formatMoney(value)}</td>
    </tr>
  );
}

export default function AccountingStatements() {
  const { state } = useStore();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "income";
  const period = usePeriod("year");
  const { entries } = useJournal(period.from, period.to);

  const income = useMemo(() => incomeStatement(entries, period.from, period.to), [entries, period.from, period.to]);
  const sheet = useMemo(() => balanceSheet(entries, period.to), [entries, period.to]);
  const vat = useMemo(() => vatReport(entries, period.from, period.to), [entries, period.from, period.to]);
  const visibleIncome = INCOME_ROWS.filter((r) => r.total || income.values[r.code] !== 0);

  const printIncome = () =>
    printAccountingReport(
      "Compte de résultat",
      t("Période : {0}", [period.label]),
      `<table><tbody>${visibleIncome
        .map((r) => `<tr class="${r.final ? "total" : r.total ? "sub" : ""}"><td>${r.code}</td><td>${r.sign ? `${r.sign} ` : ""}${INCOME_LABELS[r.code]}</td><td class="r">${amount(income.values[r.code], { blankZero: false })}</td></tr>`)
        .join("")}</tbody></table>`,
      state.settings
    );

  const printSheet = () => {
    const col = (title, rows, values, total) =>
      `<table><thead><tr><th>${t(title)}</th><th class="r">Montant</th></tr></thead><tbody>${rows
        .filter(([key]) => values[key])
        .map(([key, label]) => `<tr><td>${t(label)}</td><td class="r">${amount(values[key], { blankZero: false })}</td></tr>`)
        .join("")}</tbody><tfoot><tr class="total"><td>${t("Total {0}", [t(title).toLowerCase()])}</td><td class="r">${amount(total, { blankZero: false })}</td></tr></tfoot></table>`;
    printAccountingReport(
      "Bilan",
      t("Au {0}", [period.to.toLocaleDateString(locale())]),
      `<div class="cols">${col("Actif", ACTIF_ROWS, sheet.actif, sheet.totalActif)}${col("Passif", PASSIF_ROWS, sheet.passif, sheet.totalPassif)}</div>`,
      state.settings
    );
  };

  const printVat = () =>
    printAccountingReport(
      "Déclaration de TVA",
      t("Période : {0} · taux {1} %", [period.label, state.settings.taxRate || 0]),
      `<table><thead><tr><th>Mois</th><th class="r">TVA collectée</th><th class="r">TVA déductible</th><th class="r">TVA due</th></tr></thead><tbody>${vat.rows
        .map((r) => `<tr><td>${monthLabel(r.month)}</td><td class="r">${amount(r.collected)}</td><td class="r">${amount(r.deductible)}</td><td class="r">${amount(r.due, { blankZero: false })}</td></tr>`)
        .join("")}</tbody><tfoot><tr class="total"><td>Total</td><td class="r">${amount(vat.total.collected)}</td><td class="r">${amount(vat.total.deductible)}</td><td class="r">${amount(vat.total.due, { blankZero: false })}</td></tr></tfoot></table>`,
      state.settings
    );

  const print = { income: printIncome, balance: printSheet, vat: printVat }[tab];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("Comptabilité")}
        title={t("États financiers")}
        description={t("Compte de résultat et bilan selon le système comptable OHADA (SYSCOHADA révisé), déclaration de TVA.")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PeriodPicker period={period} />
            <Button variant="secondary" icon={FaPrint} onClick={print}>{t("Imprimer")}</Button>
          </div>
        }
      />

      <Tabs
        value={tab}
        onChange={(value) => setParams(value === "income" ? {} : { tab: value })}
        options={[
          { value: "income", label: t("Compte de résultat"), icon: FaChartLine },
          { value: "balance", label: t("Bilan"), icon: FaBalanceScale },
          { value: "vat", label: t("TVA"), icon: FaPercent },
        ]}
      />

      {tab === "income" && (
        <Card padded={false} className="max-w-3xl">
          <div className="border-b border-slate-100 p-4">
            <p className="font-semibold text-slate-900">{t("Compte de résultat —")}{" "}{t(period.label)}</p>
            <p className="text-xs text-slate-500">{t("Stocks valorisés au coût d'achat actuel des produits. Ventes hors taxe.")}</p>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {visibleIncome.map((r) => (
                <Row key={r.code} code={r.code} label={`${r.sign ? `${r.sign} ` : ""}${INCOME_LABELS[r.code]}`} value={income.values[r.code]} strong={r.total} />
              ))}
            </tbody>
          </table>
          <p className={`flex items-center gap-2 border-t border-slate-100 p-4 text-sm font-semibold ${income.result >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {income.result >= 0 ? <FaCheckCircle /> : <FaExclamationTriangle />}
            {income.result >= 0 ? t("Bénéfice de {0}", [formatMoney(income.result)]) : t("Perte de {0}", [formatMoney(-income.result)])}
          </p>
        </Card>
      )}

      {tab === "balance" && (
        <>
          <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm ${sheet.balanced ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
            {sheet.balanced ? <FaCheckCircle /> : <FaExclamationTriangle />}
            {sheet.balanced ? t("Bilan équilibré au {0} : actif = passif = {1}.", [period.to.toLocaleDateString(locale()), formatMoney(sheet.totalActif)]) : t("Bilan déséquilibré : vérifiez les écritures manuelles.")}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {[
              ["Actif", ACTIF_ROWS, sheet.actif, sheet.totalActif],
              ["Passif", PASSIF_ROWS, sheet.passif, sheet.totalPassif],
            ].map(([title, rows, values, total]) => (
              <Card key={title} padded={false}>
                <div className="border-b border-slate-100 p-4">
                  <p className="font-semibold text-slate-900">{t(title)}</p>
                </div>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {rows.map(([key, label]) => (
                      <Row key={key} label={label} value={values[key]} muted={!values[key]} />
                    ))}
                    <Row label={t("Total {0}", [title.toLowerCase()])} value={total} strong />
                  </tbody>
                </table>
              </Card>
            ))}
          </div>
          {sheet.treasury.length > 0 && (
            <Card>
              <p className="mb-2 text-sm font-semibold text-slate-900">{t("Détail de la trésorerie")}</p>
              <ul className="grid gap-2 text-sm sm:grid-cols-3">
                {sheet.treasury.map((item) => (
                  <li key={item.account} className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">
                      {item.account} · {item.name}
                    </p>
                    <p className={`tabular font-semibold ${item.balance < 0 ? "text-rose-600" : "text-slate-900"}`}>{formatMoney(item.balance)}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      {tab === "vat" && (
        <Card padded={false} className="max-w-3xl">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 p-4">
            <div>
              <p className="font-semibold text-slate-900">{t("TVA —")}{" "}{t(period.label)}</p>
              <p className="text-xs text-slate-500">{t("Taux paramétré :")}{" "}{state.settings.taxRate || 0}{" "}{t("% (prix TVA incluse).")}</p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={!vat.rows.length}
              onClick={() =>
                downloadCSV(`tva-${todayStamp()}`, vat.rows, [
                  { label: t("Mois"), value: (r) => monthLabel(r.month) },
                  { label: t("TVA collectée"), value: (r) => r.collected },
                  { label: t("TVA déductible"), value: (r) => r.deductible },
                  { label: t("TVA due"), value: (r) => r.due },
                ])
              }
            >{t("Excel")}</Button>
          </div>
          {!Number(state.settings.taxRate) && !vat.rows.length ? (
            <div className="p-5">
              <EmptyState icon={FaPercent} title={t("TVA non paramétrée")} description={t("Indiquez votre taux de TVA dans les paramètres de la boutique si vous y êtes assujetti.")} />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">{t("Mois")}</th>
                  <th className="px-4 py-3 text-right">{t("Collectée")}</th>
                  <th className="px-4 py-3 text-right">{t("Déductible")}</th>
                  <th className="px-4 py-3 text-right">{t("À reverser")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vat.rows.map((r) => (
                  <tr key={r.month}>
                    <td className="px-4 py-2.5 capitalize text-slate-700">{monthLabel(r.month)}</td>
                    <td className="tabular px-4 py-2.5 text-right">{formatMoney(r.collected)}</td>
                    <td className="tabular px-4 py-2.5 text-right">{formatMoney(r.deductible)}</td>
                    <td className={`tabular px-4 py-2.5 text-right font-semibold ${r.due < 0 ? "text-emerald-600" : "text-slate-900"}`}>{formatMoney(r.due)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold text-slate-900">
                  <td className="px-4 py-2.5">{t("Total de la période")}</td>
                  <td className="tabular px-4 py-2.5 text-right">{formatMoney(vat.total.collected)}</td>
                  <td className="tabular px-4 py-2.5 text-right">{formatMoney(vat.total.deductible)}</td>
                  <td className="tabular px-4 py-2.5 text-right">{formatMoney(vat.total.due)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
