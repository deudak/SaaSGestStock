import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompact, formatMoney } from "../../lib/format";
import { brandBase } from "../../lib/branding";
import { useStore } from "../../store/StoreContext";

const OTHER_COLORS = ["#059669", "#d97706", "#7c3aed", "#0284c7", "#e11d48", "#64748b"];

const axisProps = {
  axisLine: false,
  tickLine: false,
  tick: { fontSize: 11, fill: "#94a3b8" },
};

function ChartTooltip({ active, payload, label, formatter = formatMoney }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-pop">
      {label && <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>}
      {payload.map((entry) => (
        <p key={entry.dataKey ?? entry.name} className="flex items-center gap-2 text-[13px]">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.color || entry.payload?.fill }} />
          <span className="text-slate-500">{entry.name}</span>
          <span className="tabular ml-auto pl-3 font-semibold text-slate-900">{formatter(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

/** Chiffre d'affaires (aire) et marge (ligne) par jour ou par mois */
/** Couleur principale de l'entreprise, utilisée pour la première série des graphiques */
function useBrandColor() {
  return brandBase(useStore().state.settings.brandColor);
}

export function RevenueChart({ data, height = 280, showMargin = true }) {
  const brand = useBrandColor();
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={brand} stopOpacity={0.18} />
              <stop offset="100%" stopColor={brand} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#eef2f7" vertical={false} />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
          <YAxis {...axisProps} tickFormatter={formatCompact} width={52} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#cbd5e1", strokeDasharray: "4 4" }} />
          <Area type="monotone" dataKey="revenue" name="Chiffre d'affaires" stroke={brand} strokeWidth={2.25} fill="url(#revenueFill)" activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} />
          {showMargin && <Area type="monotone" dataKey="margin" name="Marge brute" stroke="#059669" strokeWidth={2} fill="none" activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} />}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ColumnChart({ data, dataKey = "revenue", name = "Chiffre d'affaires", height = 260, color, formatter = formatMoney }) {
  const brand = useBrandColor();
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid stroke="#eef2f7" vertical={false} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis {...axisProps} tickFormatter={formatCompact} width={52} />
          <Tooltip content={<ChartTooltip formatter={formatter} />} cursor={{ fill: "rgba(15,23,42,0.04)" }} />
          <Bar dataKey={dataKey} name={name} fill={color || brand} radius={[6, 6, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Anneau avec légende. data : [{ name, value }] */
export function DonutChart({ data, formatter = formatMoney, centerLabel = "Total" }) {
  const colors = [useBrandColor(), ...OTHER_COLORS];
  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col xl:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="100%" paddingAngle={2} stroke="none" startAngle={90} endAngle={-270}>
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip formatter={formatter} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] font-medium text-slate-400">{centerLabel}</span>
          <span className="tabular text-base font-bold text-slate-900">{formatCompact(total)}</span>
        </div>
      </div>
      <ul className="w-full space-y-2.5">
        {data.map((entry, index) => {
          const share = total ? Math.round((entry.value / total) * 100) : 0;
          return (
            <li key={entry.name} className="flex items-center gap-2.5 text-[13px]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: colors[index % colors.length] }} />
              <span className="min-w-0 flex-1 truncate text-slate-600">{entry.name}</span>
              <span className="tabular font-semibold text-slate-900">{share} %</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Classement horizontal en HTML (plus lisible qu'un graphique pour des libellés longs). */
export function BarList({ data, valueKey = "value", formatter = formatMoney, sublabel, color = "bg-brand-500" }) {
  const max = Math.max(...data.map((entry) => entry[valueKey]), 1);
  return (
    <ul className="space-y-3.5">
      {data.map((entry, index) => (
        <li key={entry.name ?? index}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="tabular w-4 shrink-0 text-xs font-semibold text-slate-400">{index + 1}</span>
              <span className="truncate font-medium text-slate-700">{entry.name}</span>
            </span>
            <span className="tabular shrink-0 font-semibold text-slate-900">{formatter(entry[valueKey])}</span>
          </div>
          <div className="ml-6 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(3, (entry[valueKey] / max) * 100)}%` }} />
            </div>
            {sublabel && <span className="tabular w-16 shrink-0 text-right text-[11px] text-slate-400">{sublabel(entry)}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}
