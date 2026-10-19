import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { FaBalanceScale, FaBook, FaPrint } from "react-icons/fa";
import { useStore } from "../../../store/StoreContext";
import { Card, EmptyState, PageHeader } from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Tabs from "../../../components/ui/Tabs";
import { Field } from "../../../components/ui/Form";
import { AccountInput, PeriodPicker, amount, useJournal, usePeriod } from "../../../components/accounting/AccountingUI";
import { accountLedger, trialBalance } from "../../../lib/accounting/engine";
import { accountName } from "../../../lib/accounting/chart";
import { downloadCSV, todayStamp } from "../../../lib/csv";
import { escapeHtml, printAccountingReport } from "../../../lib/print";
import { formatDate, formatMoney } from "../../../lib/format";

import { locale, t } from "../../../i18n/index.js";

const side = (value) => (value > 0 ? { debit: value, credit: 0 } : { debit: 0, credit: -value });

export default function AccountingLedger() {
  const { state } = useStore();
  const [params, setParams] = useSearchParams();
  const account = params.get("account") || "";
  const tab = account ? "ledger" : params.get("tab") || "balance";
  const period = usePeriod("year");
  const { entries } = useJournal(period.from, period.to);

  const balance = useMemo(() => trialBalance(entries, period.from, period.to), [entries, period.from, period.to]);
  const ledger = useMemo(() => (account ? accountLedger(entries, account, period.from, period.to) : null), [entries, account, period.from, period.to]);
  const closingTotals = balance.rows.reduce((item, r) => ({ debit: item.debit + side(r.closing).debit, credit: item.credit + side(r.closing).credit }), { debit: 0, credit: 0 });

  const openAccount = (code) => setParams(code ? { account: code } : { tab: "ledger" });

  const printBalance = () => {
    const rows = balance.rows
      .map((r) => {
        const o = side(r.opening);
        const c = side(r.closing);
        return `<tr><td>${r.account}</td><td>${escapeHtml(r.name)}</td><td class="r">${amount(o.debit)}</td><td class="r">${amount(o.credit)}</td><td class="r">${amount(r.debit)}</td><td class="r">${amount(r.credit)}</td><td class="r">${amount(c.debit)}</td><td class="r">${amount(c.credit)}</td></tr>`;
      })
      .join("");
    printAccountingReport(
      "Balance générale",
      t("Période : {0}", [period.label]),
      `<table><thead><tr><th>Compte</th><th>Intitulé</th><th class="r">Ouv. débit</th><th class="r">Ouv. crédit</th><th class="r">Mvt débit</th><th class="r">Mvt crédit</th><th class="r">Solde débit</th><th class="r">Solde crédit</th></tr></thead>
       <tbody>${rows}</tbody><tfoot><tr class="total"><td colspan="4">Totaux</td><td class="r">${amount(balance.totals.debit)}</td><td class="r">${amount(balance.totals.credit)}</td><td class="r">${amount(closingTotals.debit)}</td><td class="r">${amount(closingTotals.credit)}</td></tr></tfoot></table>`,
      state.settings
    );
  };

  const printLedger = () => {
    const rows = ledger.rows
      .map((r) => `<tr><td>${formatDate(r.entry.date)}</td><td>${r.entry.number}</td><td>${escapeHtml(r.label)}</td><td class="r">${amount(r.debit)}</td><td class="r">${amount(r.credit)}</td><td class="r">${amount(r.balance, { blankZero: false })}</td></tr>`)
      .join("");
    printAccountingReport(
      t("Grand livre — {0}", [account]),
      `${accountName(account)} · ${period.label}`,
      `<table><thead><tr><th>Date</th><th>N°</th><th>Libellé</th><th class="r">Débit</th><th class="r">Crédit</th><th class="r">Solde</th></tr></thead>
       <tbody><tr class="sub"><td colspan="5">Solde d'ouverture</td><td class="r">${amount(ledger.opening, { blankZero: false })}</td></tr>${rows}</tbody>
       <tfoot><tr class="total"><td colspan="3">Totaux et solde final</td><td class="r">${amount(ledger.debit)}</td><td class="r">${amount(ledger.credit)}</td><td class="r">${amount(ledger.closing, { blankZero: false })}</td></tr></tfoot></table>`,
      state.settings
    );
  };

  const exportBalance = () =>
    downloadCSV(`balance-${todayStamp()}`, balance.rows, [
      { label: t("Compte"), value: (r) => r.account },
      { label: t("Intitulé"), value: (r) => r.name },
      { label: t("Solde d'ouverture"), value: (r) => r.opening },
      { label: t("Débit"), value: (r) => r.debit },
      { label: t("Crédit"), value: (r) => r.credit },
      { label: t("Solde final"), value: (r) => r.closing },
    ]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t("Comptabilité")} title={t("Grand livre et balance")} description={t("Soldes de tous les comptes et détail des mouvements compte par compte.")} actions={<PeriodPicker period={period} />} />

      <Tabs
        value={tab}
        onChange={(value) => setParams(value === "balance" ? {} : { tab: value })}
        options={[
          { value: "balance", label: t("Balance"), icon: FaBalanceScale },
          { value: "ledger", label: t("Grand livre"), icon: FaBook },
        ]}
      />

      {tab === "balance" && (
        <Card padded={false}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
            <p className={`text-sm font-medium ${balance.totals.debit === balance.totals.credit ? "text-emerald-600" : "text-rose-600"}`}>
              {balance.totals.debit === balance.totals.credit ? t("Balance équilibrée : total des débits = total des crédits.") : t("Attention : balance déséquilibrée.")}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" icon={FaPrint} onClick={printBalance} disabled={!balance.rows.length}>{t("Imprimer")}</Button>
              <Button size="sm" variant="secondary" onClick={exportBalance} disabled={!balance.rows.length}>{t("Excel")}</Button>
            </div>
          </div>
          {balance.rows.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={FaBalanceScale} title={t("Aucun mouvement")} description={t("Aucune écriture jusqu'à la fin de la période.")} />
            </div>
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-180 text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">{t("Compte")}</th>
                    <th className="px-4 py-3 text-right">{t("Solde d'ouverture")}</th>
                    <th className="px-4 py-3 text-right">{t("Débit")}</th>
                    <th className="px-4 py-3 text-right">{t("Crédit")}</th>
                    <th className="px-4 py-3 text-right">{t("Solde final")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {balance.rows.map((r) => (
                    <tr key={r.account} className="cursor-pointer hover:bg-slate-50/60" onClick={() => openAccount(r.account)}>
                      <td className="px-4 py-2.5">
                        <span className="tabular font-semibold text-slate-900">{r.account}</span> <span className="text-slate-600">{r.name}</span>
                      </td>
                      <td className="tabular px-4 py-2.5 text-right text-slate-500">{r.opening ? `${amount(Math.abs(r.opening))} ${r.opening > 0 ? "D" : "C"}` : ""}</td>
                      <td className="tabular px-4 py-2.5 text-right">{amount(r.debit)}</td>
                      <td className="tabular px-4 py-2.5 text-right">{amount(r.credit)}</td>
                      <td className="tabular px-4 py-2.5 text-right font-semibold text-slate-900">{r.closing ? `${amount(Math.abs(r.closing))} ${r.closing > 0 ? "D" : "C"}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 font-bold">
                    <td className="px-4 py-3">{t("Totaux des mouvements")}</td>
                    <td />
                    <td className="tabular px-4 py-3 text-right">{amount(balance.totals.debit)}</td>
                    <td className="tabular px-4 py-3 text-right">{amount(balance.totals.credit)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "ledger" && (
        <Card padded={false}>
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-end sm:justify-between">
            <Field label={t("Compte")} hint={account ? accountName(account) : t("Un numéro complet (571) ou une racine (57 = toute la trésorerie)")} className="sm:w-80">
              <AccountInput value={account} onChange={openAccount} placeholder={t("Ex : 571, 411, 6…")} />
            </Field>
            {ledger && (
              <Button size="sm" variant="secondary" icon={FaPrint} onClick={printLedger}>{t("Imprimer")}</Button>
            )}
          </div>
          {!ledger ? (
            <div className="p-5">
              <EmptyState icon={FaBook} title={t("Choisissez un compte")} description={t("Ou cliquez sur une ligne de la balance.")} />
            </div>
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-160 text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">{t("Date")}</th>
                    <th className="px-4 py-3">{t("N°")}</th>
                    <th className="px-4 py-3">{t("Libellé")}</th>
                    <th className="px-4 py-3 text-right">{t("Débit")}</th>
                    <th className="px-4 py-3 text-right">{t("Crédit")}</th>
                    <th className="px-4 py-3 text-right">{t("Solde")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-slate-50 text-xs font-semibold text-slate-600">
                    <td className="px-4 py-2" colSpan={5}>{t("Solde au")}{" "}{period.from.toLocaleDateString(locale())}
                    </td>
                    <td className="tabular px-4 py-2 text-right">{formatMoney(ledger.opening)}</td>
                  </tr>
                  {ledger.rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{formatDate(r.entry.date)}</td>
                      <td className="tabular whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">{r.entry.number}</td>
                      <td className="px-4 py-2.5 text-slate-800">
                        {t(r.label)}
                        {r.account !== account && <span className="ml-1 text-xs text-slate-400">({r.account})</span>}
                      </td>
                      <td className="tabular px-4 py-2.5 text-right">{amount(r.debit)}</td>
                      <td className="tabular px-4 py-2.5 text-right">{amount(r.credit)}</td>
                      <td className={`tabular px-4 py-2.5 text-right font-semibold ${r.balance < 0 ? "text-rose-600" : "text-slate-900"}`}>{amount(r.balance, { blankZero: false })}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 font-bold">
                    <td className="px-4 py-3" colSpan={3}>{t("Totaux et solde au")}{" "}{period.to.toLocaleDateString(locale())}
                    </td>
                    <td className="tabular px-4 py-3 text-right">{amount(ledger.debit)}</td>
                    <td className="tabular px-4 py-3 text-right">{amount(ledger.credit)}</td>
                    <td className="tabular px-4 py-3 text-right">{formatMoney(ledger.closing)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
