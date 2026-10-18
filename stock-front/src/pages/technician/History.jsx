import { useMemo, useState } from "react";
import { FaHistory, FaMoneyBillWave, FaTools, FaWrench } from "react-icons/fa";
import { useStore } from "../../store/StoreContext";
import { Card, EmptyState, PageHeader } from "../../components/ui/Card";
import StatCard from "../../components/ui/StatCard";
import Tabs from "../../components/ui/Tabs";
import { SearchInput } from "../../components/ui/Form";
import { formatDate, formatMoney, matches } from "../../lib/format";

const PERIODS = [
  { value: "month", label: "Ce mois" },
  { value: "quarter", label: "3 mois" },
  { value: "all", label: "Tout" },
];

/** Interventions archivées par le maintenancier connecté. */
export default function TechnicianHistory() {
  const { state, currentUser } = useStore();
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("month");
  const [now] = useState(() => new Date());

  const mine = useMemo(
    () =>
      state.maintenanceHistory
        .filter((h) => (h.technicianId ? h.technicianId === currentUser.id : h.technician?.trim().toLowerCase() === currentUser.name.trim().toLowerCase()))
        .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [state.maintenanceHistory, currentUser]
  );

  const since = period === "month" ? new Date(now.getFullYear(), now.getMonth(), 1) : period === "quarter" ? new Date(now.getFullYear(), now.getMonth() - 2, 1) : null;
  const rows = mine.filter((h) => (!since || new Date(h.date) >= since) && matches(search, h.product, h.action, h.note));
  const total = rows.reduce((sum, h) => sum + (h.cost || 0), 0);
  const equipmentCount = new Set(rows.map((h) => h.product.toLowerCase())).size;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Espace maintenancier" title="Historique" description="Les interventions que vous avez clôturées, avec leur compte rendu et leur coût." />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard title="Interventions" value={rows.length} icon={FaTools} hint={PERIODS.find((p) => p.value === period).label} />
        <StatCard title="Équipements traités" value={equipmentCount} icon={FaWrench} tone="violet" />
        <StatCard title="Coût total" value={formatMoney(total)} icon={FaMoneyBillWave} tone="amber" hint="Pièces et main d'œuvre" />
      </div>

      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={period} onChange={setPeriod} size="sm" options={PERIODS} />
          <SearchInput value={search} onChange={setSearch} placeholder="Équipement, action…" className="sm:max-w-xs" />
        </div>
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={FaHistory} title="Aucune intervention" description="Vos interventions clôturées apparaîtront ici." />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((h) => (
              <li key={h.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-start sm:gap-4">
                <p className="w-28 shrink-0 text-xs font-medium text-slate-500">{formatDate(h.date)}</p>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{h.product}</p>
                  <p className="text-sm text-slate-600">{h.action}</p>
                  {h.note && <p className="mt-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">{h.note}</p>}
                </div>
                <p className="tabular shrink-0 text-sm font-semibold text-slate-900">{formatMoney(h.cost)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
