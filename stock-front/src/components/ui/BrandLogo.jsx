const initials = (name) =>
  (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");

/** Logo de l'entreprise cliente, ou ses initiales sur sa couleur si aucun logo n'est défini. */
export default function BrandLogo({ settings, className = "h-9 w-9" }) {
  if (settings.logo) {
    return (
      <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1 ${className}`}>
        <img src={settings.logo} alt="" className="max-h-full max-w-full object-contain" />
      </span>
    );
  }
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white ${className}`} aria-hidden="true">
      {initials(settings.shopName)}
    </span>
  );
}
