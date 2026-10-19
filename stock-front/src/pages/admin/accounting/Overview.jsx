import { useMemo } from "react";
import { Link } from "react-router-dom";
import { FaArrowRight, FaBalanceScale, FaCog, FaExclamationTriangle, FaFileInvoiceDollar, FaHandHoldingUsd, FaPercent, FaReceipt, FaTools, FaTruck, FaWallet } from "react-icons/fa";
import { useStore } from "../../../store/StoreContext";
import { Card, CardHeader, PageHeader } from "../../../components/ui/Card";
import StatCard from "../../../components/ui/StatCard";
import { ColumnChart } from "../../../components/dashboard/Charts";
import { PeriodPicker, useAccountingBase, useJournal, usePeriod } from "../../../components/accounting/AccountingUI";
import { accountBalance, incomeStatement, monthlyResults, vatReport } from "../../../lib/accounting/engine";
import { TREASURY_ACCOUNTS } from "../../../lib/accounting/chart";
import { formatMoney } from "../../../lib/format";

import { locale, t } from "../../../i18n/index.js";

const monthName = (index) => new Date(2026, index, 1).toLocaleDateString(locale(), { month: "short" });

/** Synthèse comptable : résultat, trésorerie, tiers, TVA et points à régulariser. */
export default function AccountingOverview() {
  const { state } = useStore();
  const base = useAccountingBase();
  const period = usePeriod("year");
  const { entries, start } = useJournal(period.from, period.to);

  const income = useMemo(() => incomeStatement(entries, period.from, period.to), [entries, period.from, period.to]);
  const vat = useMemo(() => vatReport(entries, period.from, period.to), [entries, period.from, period.to]);
  const months = useMemo(
    () => monthlyResults(entries, period.from, period.to).map((m) => ({ label: monthName(Number(m.month.slice(5)) - 1), result: m.result })),
    [entries, period.from, period.to]
  );

  const treasury = TREASURY_ACCOUNTS.map((item) => ({ ...item, balance: accountBalance(entries, item.account, period.to) }));
  const totalTreasury = treasury.reduce((sum, item) => sum + item.balance, 0);
  const receivables = accountBalance(entries, "411", period.to);
  const payables = -accountBalance(entries, "401", period.to);

  const postedMaintenance = new Set((state.expenses || []).map((e) => e.maintenanceHistoryId).filter(Boolean));
  const unpostedMaintenance = state.maintenanceHistory.filter((h) => h.cost > 0 && !postedMaintenance.has(h.id));
  const todo = [
    !state.settings.accountingStart && { icon: FaCog, text: t("Définissez la date d'ouverture et les soldes de départ (caisse, banque, dettes)."), to: `${base}/settings` },
    unpostedMaintenance.length > 0 && { icon: FaTools, text: t("{0} intervention(s) de maintenance payée(s) à comptabiliser.", [unpostedMaintenance.length]), to: `${base}/expenses?tab=maintenance` },
    payables > 0 && { icon: FaTruck, text: t("{0} restent dus aux fournisseurs.", [formatMoney(payables)]), to: `${base}/expenses?tab=suppliers` },
    vat.total.due > 0 && { icon: FaPercent, text: t("{0} de TVA à reverser sur la période.", [formatMoney(vat.total.due)]), to: `${base}/statements?tab=vat` },
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t("Comptabilité")} title={t("Synthèse comptable")} description={t("Comptes ouverts le {0} · plan comptable OHADA · période : {1}.", [start.toLocaleDateString(locale()), period.label])} actions={<PeriodPicker period={period} />} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard title={t("Chiffre d'affaires HT")} value={formatMoney(income.values.TA + income.values.TB)} icon={FaReceipt} hint={t("Ventes et services, TVA déduite")} />
        <StatCard title={t("Charges")} value={formatMoney(income.charges)} icon={FaFileInvoiceDollar} tone="amber" hint={t("Achats consommés et frais")} />
        <StatCard title={t("Résultat net")} value={formatMoney(income.result)} icon={FaBalanceScale} tone={income.result >= 0 ? "green" : "red"} hint={income.result >= 0 ? t("Bénéfice") : t("Perte")} />
        <StatCard title={t("TVA à reverser")} value={formatMoney(Math.max(0, vat.total.due))} icon={FaPercent} tone="violet" hint={t("Collectée {0}", [formatMoney(vat.total.collected)])} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader title={t("Résultat mois par mois")} subtitle={t("Produits moins charges")} icon={FaBalanceScale} />
          {months.length ? <ColumnChart data={months} dataKey="result" name={t("Résultat")} height={240} /> : <p className="py-10 text-center text-sm text-slate-500">{t("Aucune écriture sur la période.")}</p>}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title={t("Trésorerie")} subtitle={t("Au {0}", [period.to.toLocaleDateString(locale())])} icon={FaWallet} tone="green" />
            <ul className="space-y-2 text-sm">
              {treasury.map((item) => (
                <li key={item.account} className="flex justify-between">
                  <Link to={`${base}/ledger?account=${item.account}`} className="text-slate-600 hover:text-brand-600">
                    {t(item.label)} <span className="text-xs text-slate-400">({item.account})</span>
                  </Link>
                  <span className={`tabular font-semibold ${item.balance < 0 ? "text-rose-600" : "text-slate-900"}`}>{formatMoney(item.balance)}</span>
                </li>
              ))}
              <li className="flex justify-between border-t border-slate-100 pt-2 font-bold">
                <span>{t("Total")}</span>
                <span className="tabular">{formatMoney(totalTreasury)}</span>
              </li>
            </ul>
          </Card>
          <Card>
            <CardHeader title={t("Tiers")} icon={FaHandHoldingUsd} tone="violet" />
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <Link to={`${base}/ledger?account=411`} className="text-slate-600 hover:text-brand-600">{t("Créances clients (411)")}</Link>
                <span className="tabular font-semibold text-slate-900">{formatMoney(receivables)}</span>
              </li>
              <li className="flex justify-between">
                <Link to={`${base}/ledger?account=401`} className="text-slate-600 hover:text-brand-600">{t("Dettes fournisseurs (401)")}</Link>
                <span className="tabular font-semibold text-slate-900">{formatMoney(payables)}</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>

      {todo.length > 0 && (
        <Card>
          <CardHeader title={t("À régulariser")} icon={FaExclamationTriangle} tone="amber" />
          <ul className="divide-y divide-slate-100">
            {todo.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="flex items-center gap-3 py-3 text-sm text-slate-700 hover:text-brand-600">
                  <item.icon className="shrink-0 text-slate-400" size={13} />
                  <span className="flex-1">{t(item.text)}</span>
                  <FaArrowRight size={11} className="text-slate-300" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
