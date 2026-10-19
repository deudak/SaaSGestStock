import { t } from "../../i18n/index.js";
/** Onglets segmentés. options : [{ value, label, count?, icon? }] */
export default function Tabs({ value, onChange, options, className = "", size = "md" }) {
  const pad = size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm";
  return (
    <div className={`scrollbar-thin -mx-1 overflow-x-auto px-1 ${className}`}>
      <div className="inline-flex min-w-max gap-1 rounded-xl bg-slate-100 p-1" role="tablist">
        {options.map((option) => {
          const active = option.value === value;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(option.value)}
              className={`inline-flex items-center gap-2 rounded-lg font-semibold transition ${pad} ${
                active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {Icon && <Icon size={12} aria-hidden="true" />}
              {t(option.label)}
              {option.count !== undefined && (
                <span className={`rounded-md px-1.5 py-px text-[10px] font-bold tabular ${active ? "bg-brand-50 text-brand-700" : "bg-slate-200/70 text-slate-500"}`}>
                  {option.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
