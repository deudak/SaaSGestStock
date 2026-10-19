import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaArrowRight, FaEnvelope, FaEye, FaEyeSlash, FaLock, FaUserShield, FaUserTag } from "react-icons/fa";
import toast from "react-hot-toast";
import AuthLayout from "./AuthLayout";
import Button from "../../components/ui/Button";
import { Field, inputClass } from "../../components/ui/Form";
import { useAuth } from "../../store/StoreContext";
import { homePathFor } from "../../routes/paths";

import { t } from "../../i18n/index.js";

const demoAccounts = [
  { role: "Administrateur", email: "admin@dymstock.test", password: "Password123", icon: FaUserShield, tone: "text-brand-600 bg-brand-50" },
  { role: "Vendeur", email: "seller@dymstock.test", password: "Seller123", icon: FaUserTag, tone: "text-emerald-600 bg-emerald-50" },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const signIn = async (mail, pass) => {
    setError("");
    if (!mail || !pass) {
      setError(t("Renseignez votre email et votre mot de passe."));
      return;
    }
    setLoading(true);
    const result = await login(mail, pass);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success(result.offline ? t("Connecté hors ligne") : t("Bienvenue, {0} !", [result.user.name.split(" ")[0]]));
    const home = homePathFor(result.user);
    const from = location.state?.from;
    navigate(from && from.startsWith(home) ? from : home, { replace: true });
  };

  return (
    <AuthLayout>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t("Connexion")}</h1>
      <p className="mt-1.5 text-sm text-slate-500">{t("Accédez à votre espace de gestion.")}</p>

      <form
        className="mt-8 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          signIn(email, password);
        }}
        noValidate
      >
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{error}</div>}

        <Field label={t("Adresse email")}>
          <div className="relative">
            <FaEnvelope className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("vous@entreprise.com")} className={`${inputClass} pl-10`} />
          </div>
        </Field>

        <Field label={t("Mot de passe")}>
          <div className="relative">
            <FaLock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`${inputClass} pl-10 pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label={showPassword ? t("Masquer le mot de passe") : t("Afficher le mot de passe")}
            >
              {showPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
            </button>
          </div>
        </Field>

        <Button type="submit" size="lg" className="w-full" disabled={loading} iconRight={loading ? undefined : FaArrowRight}>
          {loading ? t("Connexion…") : t("Se connecter")}
        </Button>
      </form>

      <div className="mt-8">
        <div className="flex items-center gap-3 text-xs font-medium text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />{t("Comptes de démonstration")}<span className="h-px flex-1 bg-slate-200" />
        </div>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {demoAccounts.map((account) => (
            <button
              key={account.email}
              type="button"
              disabled={loading}
              onClick={() => {
                setEmail(account.email);
                setPassword(account.password);
                signIn(account.email, account.password);
              }}
              className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/40 disabled:opacity-60"
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${account.tone}`}>
                <account.icon size={14} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-slate-800">{t(account.role)}</span>
                <span className="block truncate text-[11px] text-slate-500">{account.email}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <p className="mt-8 text-center text-sm text-slate-500">{t("Nouvelle boutique ?")}{" "}
        <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700">{t("Créer un compte")}</Link>
      </p>
    </AuthLayout>
  );
}
