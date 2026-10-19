import { t } from "../../i18n/index.js";
import { FaArrowDown, FaArrowUp } from "react-icons/fa";
import { IconBox } from "./Card";

/**
 * Indicateur clé. trend : variation en % (positive = bonne nouvelle par défaut).
 * invertTrend : pour les indicateurs où une baisse est positive (créances, ruptures…).
 */
export default function StatCard({ title, value, icon, tone = "blue", trend, trendLabel = t("vs période préc."), invertTrend = false, hint, onClick }) {
  const hasTrend = trend !== undefined && trend !== null && Number.isFinite(trend);
  const good = invertTrend ? trend <= 0 : trend >= 0;
  const Component = onClick ? "button" : "div";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`group flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-card transition sm:p-5 ${onClick ? "hover:border-brand-200 hover:shadow-md" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-slate-500">{title}</p>
        {icon && <IconBox icon={icon} tone={tone} size="sm" />}
      </div>
      <p className="tabular mt-2 truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{value}</p>
      <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2 text-xs">
        {hasTrend && (
          <span className={`inline-flex items-center gap-1 font-semibold ${good ? "text-emerald-600" : "text-rose-600"}`}>
            {trend >= 0 ? <FaArrowUp size={9} /> : <FaArrowDown size={9} />}
            {Math.abs(trend)} %
          </span>
        )}
        {hasTrend && <span className="text-slate-400">{trendLabel}</span>}
        {!hasTrend && hint && <span className="text-slate-500">{hint}</span>}
      </div>
    </Component>
  );
}
