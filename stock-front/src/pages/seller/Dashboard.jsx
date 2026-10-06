import { useMemo } from "react";
import { Link } from "react-router-dom";
import { FaBoxOpen, FaCashRegister, FaChartLine, FaCreditCard, FaMoneyBillWave, FaReceipt, FaShoppingBasket, FaUserPlus } from "react-icons/fa";
import { useStore } from "../../store/StoreContext";
import { Card, CardHeader } from "../../components/ui/Card";
import StatCard from "../../components/ui/StatCard";
import Button from "../../components/ui/Button";
import { RevenueChart } from "../../components/dashboard/Charts";
import { ReceivablesCard, RecentSalesCard, StockAlertsCard } from "../../components/dashboard/Widgets";
import { addDays, formatMoney, isSameDay, percentChange } from "../../lib/format";
import { activeSales, dailySeries, installmentRemaining, sumBy } from "../../store/selectors";

const shortcuts = [
  { to: "/seller/pos", label: "Nouvelle vente", icon: FaCashRegister, tone: "bg-brand-600 text-white hover:bg-brand-700" },
  { to: "/seller/customers", label: "Ajouter un client", icon: FaUserPlus, tone: "bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300" },
  { to: "/seller/installments", label: "Encaisser une tranche", icon: FaCreditCard, tone: "bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300" },
  { to: "/seller/sales", label: "Mes ventes", icon: FaReceipt, tone: "bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300" },
];

export default function SellerDashboard() {
  const { state, currentUser } = useStore();

  const data = useMemo(() => {
    const mine = state.sales.filter((s) => s.sellerId === currentUser.id);
    const valid = activeSales(mine);
    const today = valid.filter((s) => isSameDay(s.date, new Date()));
    const yesterday = valid.filter((s) => isSameDay(s.date, addDays(new Date(), -1)));
    const myInstallments = state.installments.filter((i) => i.sellerId === currentUser.id && !i.cancelled);
    const todayCollected =
      sumBy(today.filter((s) => s.mode === "cash"), (s) => s.total) +
      sumBy(
        myInstallments.flatMap((i) => i.payments).filter((p) => isSameDay(p.date, new Date())),
        (p) => p.amount
      );
    return {
      mine,
      today,
      revenue: sumBy(today, (s) => s.total),
      prevRevenue: sumBy(yesterday, (s) => s.total),
      count: today.length,
      prevCount: yesterday.length,
      basket: today.length ? sumBy(today, (s) => s.total) / today.length : 0,
      collected: todayCollected,
      receivables: sumBy(myInstallments, installmentRemaining),
      myInstallments,
      series: dailySeries(mine, 14),
    };
  }, [state.sales, state.installments, currentUser.id]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">
            {greeting}, {currentUser.name.split(" ")[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {data.count ? `Déjà ${data.count} vente${data.count > 1 ? "s" : ""} aujourd'hui, continuez comme ça !` : "Aucune vente pour l'instant aujourd'hui. À vous de jouer !"}
          </p>
        </div>
        <Button to="/seller/pos" size="lg" icon={FaCashRegister} className="hidden sm:inline-flex">
          Ouvrir la caisse
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard title="Ventes du jour" value={formatMoney(data.revenue)} icon={FaMoneyBillWave} trend={percentChange(data.revenue, data.prevRevenue)} trendLabel="vs hier" />
        <StatCard title="Nombre de ventes" value={data.count} icon={FaReceipt} tone="violet" trend={percentChange(data.count, data.prevCount)} trendLabel="vs hier" />
        <StatCard title="Encaissé aujourd'hui" value={formatMoney(data.collected)} icon={FaShoppingBasket} tone="green" hint={`Panier moyen ${formatMoney(data.basket)}`} />
        <StatCard title="Mes créances" value={formatMoney(data.receivables)} icon={FaCreditCard} tone="amber" hint={`${data.myInstallments.filter((i) => installmentRemaining(i) > 0).length} dossier(s) ouvert(s)`} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {shortcuts.map((s) => (
          <Link key={s.to} to={s.to} className={`flex flex-col items-center justify-center gap-2 rounded-2xl px-2 py-4 text-center text-[13px] font-semibold shadow-card transition ${s.tone}`}>
            <s.icon size={18} />
            {s.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Mes ventes des 14 derniers jours" subtitle="Chiffre d'affaires quotidien" icon={FaChartLine} />
          <RevenueChart data={data.series} height={250} showMargin={false} />
        </Card>
        <ReceivablesCard installments={data.myInstallments} to="/seller/installments" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentSalesCard sales={data.mine} to="/seller/sales" title="Mes dernières ventes" />
        </div>
        <StockAlertsCard products={state.products} />
      </div>

      <p className="flex items-center justify-center gap-2 text-xs text-slate-400">
        <FaBoxOpen size={11} /> Les alertes de stock sont transmises automatiquement à l'administrateur.
      </p>
    </div>
  );
}
