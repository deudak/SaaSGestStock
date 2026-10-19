import { useMemo, useState } from "react";
import { FaCalendarWeek, FaChartBar, FaCoins, FaCreditCard, FaFileExport, FaLayerGroup, FaMoneyBillWave, FaShoppingBasket, FaTrophy, FaUsers } from "react-icons/fa";
import { useStore } from "../../store/StoreContext";
import { Card, CardHeader, EmptyState, PageHeader } from "../../components/ui/Card";
import StatCard from "../../components/ui/StatCard";
import Tabs from "../../components/ui/Tabs";
import Button from "../../components/ui/Button";
import { Avatar } from "../../components/ui/Badge";
import { BarList, ColumnChart, DonutChart, RevenueChart } from "../../components/dashboard/Charts";
import { addDays, formatMoney, formatNumber, percentChange, startOfDay } from "../../lib/format";
import { downloadCSV, todayStamp } from "../../lib/csv";
import { activeSales, categoryBreakdown, dailySeries, monthlySeries, saleMargin, salesBetween, sumBy } from "../../store/selectors";

import { locale, t } from "../../i18n/index.js";

const periods = [
  { value: 30, label: "30 jours" },
  { value: 90, label: "90 jours" },
  { value: 180, label: "6 mois" },
  { value: 365, label: "12 mois" },
];

// Lundi → dimanche, dans la langue de l'interface (le 5 janvier 2026 est un lundi)
const weekdays = () => Array.from({ length: 7 }, (_, i) => new Date(2026, 0, 5 + i).toLocaleDateString(locale(), { weekday: "short" }));

export default function AdminAnalytics() {
  const { state } = useStore();
  const [days, setDays] = useState(90);

  const data = useMemo(() => {
    const end = addDays(startOfDay(), 1);
    const start = addDays(end, -days);
    const current = activeSales(salesBetween(state.sales, start, end));
    const previous = activeSales(salesBetween(state.sales, addDays(start, -days), start));

    const revenue = sumBy(current, (s) => s.total);
    const margin = sumBy(current, saleMargin);
    const credit = sumBy(current.filter((s) => s.mode === "credit"), (s) => s.total);
    const productMap = new Map();
    current.forEach((sale) =>
      sale.items.forEach((item) => {
        const entry = productMap.get(item.productId) || { name: item.name, qty: 0, revenue: 0, margin: 0 };
        entry.qty += item.qty;
        entry.revenue += item.qty * item.price;
        entry.margin += item.qty * (item.price - (item.cost || 0));
        productMap.set(item.productId, entry);
      })
    );

    const vendors = state.users
      .filter((u) => u.role === "seller")
      .map((u) => {
        const list = current.filter((s) => s.sellerId === u.id);
        return { name: u.name, value: sumBy(list, (s) => s.total), count: list.length };
      })
      .filter((v) => v.count)
      .sort((a, b) => b.value - a.value);

    const customerMap = new Map();
    current
      .filter((s) => s.customerId)
      .forEach((s) => {
        const entry = customerMap.get(s.customerId) || { name: s.customerName, value: 0, count: 0 };
        entry.value += s.total;
        entry.count += 1;
        customerMap.set(s.customerId, entry);
      });

    const byWeekday = weekdays().map((label, index) => {
      const list = current.filter((s) => (new Date(s.date).getDay() + 6) % 7 === index);
      return { label, revenue: sumBy(list, (s) => s.total), count: list.length };
    });

    return {
      current,
      revenue,
      prevRevenue: sumBy(previous, (s) => s.total),
      margin,
      prevMargin: sumBy(previous, saleMargin),
      count: current.length,
      prevCount: previous.length,
      basket: current.length ? revenue / current.length : 0,
      prevBasket: previous.length ? sumBy(previous, (s) => s.total) / previous.length : 0,
      creditShare: revenue ? Math.round((credit / revenue) * 100) : 0,
      products: [...productMap.values()].sort((a, b) => b.revenue - a.revenue),
      categories: categoryBreakdown(current, state.products),
      vendors,
      customers: [...customerMap.values()].sort((a, b) => b.value - a.value).slice(0, 5),
      byWeekday,
      series: days <= 90 ? dailySeries(state.sales, days) : monthlySeries(state.sales, Math.round(days / 30)),
    };
  }, [state.sales, state.users, state.products, days]);

  const exportProducts = () =>
    downloadCSV(`analyse-produits-${days}j-${todayStamp()}`, data.products, [
      { label: t("Produit"), value: (p) => p.name },
      { label: t("Quantité vendue"), value: (p) => p.qty },
      { label: t("Chiffre d'affaires"), value: (p) => p.revenue },
      { label: t("Marge brute"), value: (p) => p.margin },
      { label: t("Taux de marge %"), value: (p) => (p.revenue ? Math.round((p.margin / p.revenue) * 100) : 0) },
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("Pilotage")}
        title={t("Statistiques")}
        description={t("Analyse des ventes, des marges et de la performance commerciale.")}
        actions={
          <>
            <Tabs value={days} onChange={setDays} options={periods} size="sm" />
            <Button variant="secondary" size="sm" icon={FaFileExport} onClick={exportProducts}>{t("Exporter")}</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard title={t("Chiffre d'affaires")} value={formatMoney(data.revenue)} icon={FaMoneyBillWave} trend={percentChange(data.revenue, data.prevRevenue)} />
        <StatCard title={t("Marge brute")} value={formatMoney(data.margin)} icon={FaCoins} tone="green" trend={percentChange(data.margin, data.prevMargin)} />
        <StatCard title={t("Panier moyen")} value={formatMoney(data.basket)} icon={FaShoppingBasket} tone="violet" trend={percentChange(data.basket, data.prevBasket)} />
        <StatCard title={t("Ventes")} value={formatNumber(data.count)} icon={FaCreditCard} tone="amber" trend={percentChange(data.count, data.prevCount)} trendLabel={t("{0} % à crédit", [data.creditShare])} />
      </div>

      <Card>
        <CardHeader title={t("Évolution du chiffre d'affaires et de la marge")} subtitle={days <= 90 ? t("Par jour") : t("Par mois")} icon={FaChartBar} />
        <RevenueChart data={data.series} height={300} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("Ventes par catégorie")} subtitle={t("Répartition du chiffre d'affaires")} icon={FaLayerGroup} tone="violet" />
          {data.categories.length ? <DonutChart data={data.categories} centerLabel={t("CA")} /> : <EmptyState title={t("Aucune donnée")} />}
        </Card>
        <Card>
          <CardHeader title={t("Activité par jour de la semaine")} subtitle={t("Chiffre d'affaires cumulé")} icon={FaCalendarWeek} tone="green" />
          <ColumnChart data={data.byWeekday} height={220} color="#059669" />
        </Card>
      </div>

      <Card padded={false}>
        <div className="p-5 pb-0">
          <CardHeader title={t("Performance par produit")} subtitle={t("{0} produits vendus sur la période", [data.products.length])} icon={FaTrophy} tone="amber" />
        </div>
        {data.products.length === 0 ? (
          <div className="p-5 pt-0">
            <EmptyState title={t("Aucune vente sur la période")} />
          </div>
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-150 text-sm">
              <thead>
                <tr className="border-y border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">{t("Produit")}</th>
                  <th className="px-5 py-3 text-right">{t("Qté")}</th>
                  <th className="px-5 py-3 text-right">{t("CA")}</th>
                  <th className="px-5 py-3 text-right">{t("Marge")}</th>
                  <th className="px-5 py-3">{t("Part du CA")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.products.slice(0, 10).map((p) => {
                  const share = data.revenue ? (p.revenue / data.revenue) * 100 : 0;
                  const rate = p.revenue ? Math.round((p.margin / p.revenue) * 100) : 0;
                  return (
                    <tr key={p.name} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3 font-medium text-slate-800">{p.name}</td>
                      <td className="tabular px-5 py-3 text-right text-slate-600">{p.qty}</td>
                      <td className="tabular px-5 py-3 text-right font-semibold text-slate-900">{formatMoney(p.revenue)}</td>
                      <td className="tabular px-5 py-3 text-right text-slate-600">
                        {formatMoney(p.margin)} <span className="text-xs text-slate-400">({rate} %)</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(share, 2)}%` }} />
                          </div>
                          <span className="tabular text-xs text-slate-500">{share.toFixed(1)} %</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("Classement des vendeurs")} subtitle={t("Chiffre d'affaires sur la période")} icon={FaUsers} tone="violet" />
          {data.vendors.length ? <BarList data={data.vendors} sublabel={(v) => `${v.count} ventes`} color="bg-violet-500" /> : <EmptyState title={t("Aucune vente")} />}
        </Card>
        <Card>
          <CardHeader title={t("Meilleurs clients")} subtitle={t("Clients identifiés uniquement")} icon={FaTrophy} tone="amber" />
          {data.customers.length ? (
            <ul className="space-y-3">
              {data.customers.map((c, i) => (
                <li key={c.name} className="flex items-center gap-3">
                  <span className="tabular w-4 text-xs font-semibold text-slate-400">{i + 1}</span>
                  <Avatar name={c.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-slate-800">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.count}{" "}{t("achat(s)")}</p>
                  </div>
                  <span className="tabular text-[13px] font-semibold text-slate-900">{formatMoney(c.value)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={t("Aucun client identifié")} />
          )}
        </Card>
      </div>
    </div>
  );
}
