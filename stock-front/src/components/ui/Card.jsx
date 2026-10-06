export function Card({ className = "", padded = true, children, ...props }) {
  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-white shadow-card ${padded ? "p-5" : ""} ${className}`} {...props}>
      {children}
    </div>
  );
}

const iconTones = {
  blue: "bg-brand-50 text-brand-600 ring-brand-100",
  green: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  amber: "bg-amber-50 text-amber-600 ring-amber-100",
  red: "bg-rose-50 text-rose-600 ring-rose-100",
  violet: "bg-violet-50 text-violet-600 ring-violet-100",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function IconBox({ icon: Icon, tone = "blue", size = "md" }) {
  const box = size === "sm" ? "h-8 w-8 rounded-lg" : size === "lg" ? "h-12 w-12 rounded-2xl" : "h-10 w-10 rounded-xl";
  const iconSize = size === "sm" ? 13 : size === "lg" ? 20 : 16;
  return (
    <div className={`flex shrink-0 items-center justify-center ring-1 ring-inset ${box} ${iconTones[tone]}`}>
      <Icon size={iconSize} aria-hidden="true" />
    </div>
  );
}

export function CardHeader({ title, subtitle, icon, tone = "blue", action, className = "" }) {
  return (
    <div className={`mb-4 flex items-start justify-between gap-3 ${className}`}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && <IconBox icon={icon} tone={tone} size="sm" />}
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center ${className}`}>
      {Icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-card ring-1 ring-slate-200">
          <Icon size={20} aria-hidden="true" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Ligne libellé / valeur utilisée dans les récapitulatifs */
export function InfoRow({ label, children, strong = false }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`tabular text-right ${strong ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>{children}</span>
    </div>
  );
}
