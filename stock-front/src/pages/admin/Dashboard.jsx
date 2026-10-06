import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaBoxes, FaChartLine, FaClipboardList, FaCoins, FaCreditCard, FaMoneyBillWave, FaTools, FaTrophy, FaUserPlus, FaWarehouse } from "react-icons/fa";
import { useStore } from "../../store/StoreContext";
import { Card, CardHeader, EmptyState } from "../../components/ui/Card";
import StatCard from "../../components/ui/StatCard";
import Tabs from "../../components/ui/Tabs";
import Button from "../../components/ui/Button";
import Badge, { Avatar } from "../../components/ui/Badge";
import { BarList, DonutChart, RevenueChart } from "../../components/dashboard/Charts";
import { ReceivablesCard, RecentSalesCard, StockAlertsCard } from "../../components/dashboard/Widgets";
import { formatMoney, formatNumber, percentChange } from "../../lib/format";
import {
  MAINTENANCE_STATUS,
  dailySeries,
  installmentStatus,
  lowStockProducts,
  openMaintenance,
  paymentBreakdown,
  periodSummary,
  stockValue,
  sumBy,
  topProducts,
  totalReceivables,
} from "../../store/selectors";

const periods = [
  { value: 7, label: "7 jours" },
  { value: 30, label: "30 jours" },
  { value: 90, label: "90 jours" },
];

export default function AdminDashboard() {
  const { state, currentUser } = useStore();
  const [days, setDays] = useState(30);

  const summary = useMemo(() => periodSummary(state.sales, days), [state.sales, days]);
  const series = useMemo(() => dailySeries(state.sales, days), [state.sales, days]);
  const payments = useMemo(() => paymentBreakdown(summary.list), [summary]);
  const best = useMemo(() => topProducts(summary.list, 5), [summary]);
  const receivables = totalReceivables(state.installments);
  const lateCount = state.installments.filter((i) => installmentStatus(i) === "late").length;
  const stock = stockValue(state.products);
  const alerts = lowStockProducts(state.products).length;
  const maintenance = openMaintenance(state.maintenanceTasks);

  const vendorRanking = useMemo(() => {
    return state.users
      .filter((user) => user.role === "seller")
      .map((user) => {
        const sales = summary.list.filter((sale) => sale.sellerId === user.id);
        return { ...user, revenue: sumBy(sales, (s) => s.total), count: sales.length };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [state.users, summary]);

  const marginRate = summary.revenue ? Math.round((summary.margin / summary.revenue) * 100) : 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">
            {greeting}, {currentUser.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Voici la situation de votre activité sur les {days} derniers jours.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={days} onChange={setDays} options={periods} size="sm" />
          <Button to="/admin/purchases" variant="secondary" size="sm" icon={FaClipboardList}>
            Commander
          </Button>
          <Button to="/admin/products" size="sm" icon={FaBoxes}>
            Gérer le stock
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard title="Chiffre d'affaires" value={formatMoney(summary.revenue)} icon={FaMoneyBillWave} tone="blue" trend={percentChange(summary.revenue, summary.prevRevenue)} />
        <StatCard title="Marge brute" value={formatMoney(summary.margin)} icon={FaCoins} tone="green" trend={percentChange(summary.margin, summary.prevMargin)} trendLabel={`taux ${marginRate} %`} />
        <StatCard title="Créances en cours" value={formatMoney(receivables)} icon={FaCreditCard} tone="red" hint={lateCount ? `${lateCount} dossier(s) en retard` : "Aucun retard"} />
        <StatCard title="Valeur du stock" value={formatMoney(stock.cost)} icon={FaWarehouse} tone="amber" hint={alerts ? `${alerts} alerte(s) de stock` : "Stock sain"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Évolution des ventes"
            subtitle={`${formatNumber(summary.count)} ventes · ${formatNumber(summary.units)} articles vendus`}
            icon={FaChartLine}
            action={
              <div className="hidden items-center gap-4 text-xs text-slate-500 sm:flex">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-brand-600" /> CA
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" /> Marge
                </span>
              </div>
            }
          />
          <RevenueChart data={series} />
        </Card>
        <Card>
          <CardHeader title="Modes de paiement" subtitle="Montants encaissés sur la période" icon={FaMoneyBillWave} tone="green" />
          {payments.length ? <DonutChart data={payments} centerLabel="Encaissé" /> : <EmptyState title="Aucun encaissement" />}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Meilleures ventes" subtitle="Par chiffre d'affaires" icon={FaTrophy} tone="amber" action={<Link to="/admin/analytics" className="text-xs font-semibold text-brand-600">Analyse</Link>} />
          {best.length ? <BarList data={best} valueKey="revenue" sublabel={(entry) => `${entry.qty} u.`} /> : <EmptyState title="Pas encore de ventes" />}
        </Card>
        <StockAlertsCard products={state.products} to="/admin/products?status=alert" />
        <ReceivablesCard installments={state.installments} to="/admin/installments" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentSalesCard sales={state.sales} to="/admin/sales" />
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Performance vendeurs" subtitle={`Sur ${days} jours`} icon={FaUserPlus} tone="violet" action={<Link to="/admin/vendors" className="text-xs font-semibold text-brand-600">Gérer</Link>} />
            <ul className="space-y-3">
              {vendorRanking.map((vendor, index) => (
                <li key={vendor.id} className="flex items-center gap-3">
                  <Avatar name={vendor.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-slate-800">
                      {vendor.name}
                      {index === 0 && vendor.revenue > 0 && <FaTrophy size={10} className="text-amber-500" />}
                    </p>
                    <p className="text-xs text-slate-500">
                      {vendor.count} vente{vendor.count > 1 ? "s" : ""}
                      {vendor.status !== "actif" && " · inactif"}
                    </p>
                  </div>
                  <span className="tabular text-[13px] font-semibold text-slate-900">{formatMoney(vendor.revenue)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Maintenance" subtitle={`${maintenance.length} intervention(s) ouverte(s)`} icon={FaTools} tone="slate" action={<Link to="/admin/maintenance" className="text-xs font-semibold text-brand-600">Ouvrir</Link>} />
            {maintenance.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune intervention en attente.</p>
            ) : (
              <ul className="space-y-2.5">
                {maintenance.slice(0, 4).map((task) => (
                  <li key={task.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-slate-800">{task.product}</p>
                      <p className="truncate text-xs text-slate-500">{task.task}</p>
                    </div>
                    <Badge tone={MAINTENANCE_STATUS[task.status]?.tone}>{task.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
