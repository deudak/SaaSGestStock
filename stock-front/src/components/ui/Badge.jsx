import { initials } from "../../lib/format";

const tones = {
  blue: "bg-brand-50 text-brand-700 ring-brand-600/15",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  red: "bg-rose-50 text-rose-700 ring-rose-600/15",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/15",
  slate: "bg-slate-100 text-slate-600 ring-slate-500/15",
};

const dots = {
  blue: "bg-brand-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
  violet: "bg-violet-500",
  slate: "bg-slate-400",
};

export default function Badge({ tone = "slate", dot = false, icon: Icon, children, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tones[tone]} ${className}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dots[tone]}`} />}
      {Icon && <Icon size={10} aria-hidden="true" />}
      {children}
    </span>
  );
}

const avatarColors = [
  "bg-brand-600",
  "bg-emerald-600",
  "bg-violet-600",
  "bg-amber-500",
  "bg-sky-600",
  "bg-rose-500",
  "bg-teal-600",
  "bg-indigo-600",
];

export function Avatar({ name, size = "md", className = "" }) {
  const hash = [...(name || "")].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const color = avatarColors[hash % avatarColors.length];
  const sizes = {
    xs: "h-6 w-6 text-[10px] rounded-md",
    sm: "h-8 w-8 text-xs rounded-lg",
    md: "h-10 w-10 text-sm rounded-xl",
    lg: "h-14 w-14 text-lg rounded-2xl",
    xl: "h-20 w-20 text-2xl rounded-2xl",
  };
  return (
    <div className={`flex shrink-0 items-center justify-center font-semibold text-white ${color} ${sizes[size]} ${className}`} aria-hidden="true">
      {initials(name)}
    </div>
  );
}
