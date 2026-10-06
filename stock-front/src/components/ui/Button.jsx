import { Link } from "react-router-dom";

const variants = {
  primary: "bg-brand-600 text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 focus-visible:ring-brand-500/40",
  secondary: "border border-slate-200 bg-white text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-slate-400/30",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-400/30",
  success: "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700 focus-visible:ring-emerald-500/40",
  danger: "bg-rose-600 text-white shadow-sm shadow-rose-600/20 hover:bg-rose-700 focus-visible:ring-rose-500/40",
  "danger-ghost": "text-rose-600 hover:bg-rose-50 focus-visible:ring-rose-400/30",
  dark: "bg-slate-900 text-white hover:bg-slate-800 focus-visible:ring-slate-500/40",
};

const sizes = {
  xs: "h-7 gap-1.5 rounded-lg px-2.5 text-xs",
  sm: "h-8 gap-1.5 rounded-lg px-3 text-xs",
  md: "h-10 gap-2 rounded-xl px-4 text-sm",
  lg: "h-12 gap-2 rounded-xl px-5 text-base",
  icon: "h-9 w-9 rounded-lg",
  "icon-sm": "h-8 w-8 rounded-lg",
};

function buttonClass({ variant = "primary", size = "md", className = "" } = {}) {
  return `inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`;
}

export default function Button({ variant, size, className, icon: Icon, iconRight: IconRight, children, to, type = "button", ...props }) {
  const iconSize = size === "xs" || size === "sm" || size === "icon-sm" ? 12 : 14;
  const content = (
    <>
      {Icon && <Icon size={iconSize} aria-hidden="true" />}
      {children}
      {IconRight && <IconRight size={iconSize} aria-hidden="true" />}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={buttonClass({ variant, size, className })} {...props}>
        {content}
      </Link>
    );
  }

  return (
    <button type={type} className={buttonClass({ variant, size, className })} {...props}>
      {content}
    </button>
  );
}
