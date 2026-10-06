import { FaBoxes, FaCashRegister, FaChartLine, FaCreditCard } from "react-icons/fa";
import logo from "../../assets/logo.svg";

const features = [
  { icon: FaCashRegister, title: "Point de vente rapide", text: "Encaissez en quelques clics, imprimez tickets et factures." },
  { icon: FaBoxes, title: "Stock toujours juste", text: "Chaque vente, retour et réception met le stock à jour." },
  { icon: FaCreditCard, title: "Ventes à crédit maîtrisées", text: "Acomptes, échéances et relances au même endroit." },
  { icon: FaChartLine, title: "Pilotage clair", text: "Chiffre d'affaires, marges et alertes en temps réel." },
];

export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-white">
      <aside className="relative hidden w-[46%] max-w-[640px] flex-col justify-between overflow-hidden bg-ink-900 p-12 text-white lg:flex">
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-600/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px]" />

        <div className="relative flex items-center gap-3">
          <img src={logo} alt="" className="h-10 w-10 rounded-xl" />
          <span className="text-lg font-bold tracking-tight">DYM Stock</span>
        </div>

        <div className="relative">
          <h2 className="max-w-md text-[32px] font-bold leading-tight tracking-tight">
            Gérez votre boutique, votre stock et vos créances sans effort.
          </h2>
          <ul className="mt-10 space-y-6">
            {features.map((feature) => (
              <li key={feature.title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-brand-300 ring-1 ring-white/10">
                  <feature.icon size={15} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-white">{feature.title}</span>
                  <span className="mt-0.5 block text-sm text-slate-400">{feature.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-500">© {new Date().getFullYear()} DYM Stock · Tous droits réservés</p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[400px] animate-pop-in">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src={logo} alt="" className="h-10 w-10 rounded-xl" />
            <span className="text-lg font-bold tracking-tight text-slate-900">DYM Stock</span>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
