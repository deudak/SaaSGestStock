import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaArrowRight, FaEye, FaEyeSlash } from "react-icons/fa";
import toast from "react-hot-toast";
import AuthLayout from "./AuthLayout";
import Button from "../../components/ui/Button";
import { Field, Input, inputClass } from "../../components/ui/Form";
import { useAuth } from "../../store/StoreContext";

import { t } from "../../i18n/index.js";

function passwordStrength(password) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

const strengthLabels = ["Trop faible", "Faible", "Moyen", "Bon", "Excellent"];
const strengthColors = ["bg-rose-500", "bg-rose-500", "bg-amber-500", "bg-emerald-500", "bg-emerald-600"];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ shop: "", name: "", email: "", phone: "", password: "", confirm: "", terms: false });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const strength = passwordStrength(form.password);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!form.shop.trim()) next.shop = t("Indiquez le nom de votre boutique.");
    if (!form.name.trim()) next.name = t("Indiquez votre nom.");
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = t("Adresse email invalide.");
    if (form.password.length < 8) next.password = t("8 caractères minimum.");
    if (form.password !== form.confirm) next.confirm = t("Les mots de passe ne correspondent pas.");
    if (!form.terms) next.terms = t("Vous devez accepter les conditions d'utilisation.");
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    const result = await register({ name: form.name.trim(), email: form.email, phone: form.phone, password: form.password, shop: form.shop.trim() });
    setLoading(false);
    if (!result.ok) {
      setErrors({ email: result.error });
      return;
    }
    toast.success(t("Votre espace est prêt !"));
    navigate("/admin", { replace: true });
  };

  return (
    <AuthLayout>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t("Créer votre espace")}</h1>
      <p className="mt-1.5 text-sm text-slate-500">{t("Vous serez administrateur de votre boutique.")}</p>

      <form className="mt-8 space-y-4" onSubmit={handleSubmit} noValidate>
        <Field label={t("Nom de la boutique")} error={errors.shop} required>
          <Input value={form.shop} onChange={set("shop")} placeholder={t("Ex : Tech Akwa")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Votre nom")} error={errors.name} required>
            <Input value={form.name} onChange={set("name")} autoComplete="name" placeholder={t("Jean Dupont")} />
          </Field>
          <Field label={t("Téléphone")}>
            <Input type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" placeholder="699 00 00 00" />
          </Field>
        </div>
        <Field label={t("Email professionnel")} error={errors.email} required>
          <Input type="email" value={form.email} onChange={set("email")} autoComplete="email" placeholder={t("vous@entreprise.com")} />
        </Field>
        <Field label={t("Mot de passe")} error={errors.password} required>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={set("password")}
              autoComplete="new-password"
              placeholder={t("8 caractères minimum")}
              className={`${inputClass} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              aria-label={showPassword ? t("Masquer") : t("Afficher")}
            >
              {showPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
            </button>
          </div>
        </Field>
        {form.password && (
          <div className="-mt-1 flex items-center gap-3">
            <div className="flex flex-1 gap-1">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`h-1 flex-1 rounded-full ${i < strength ? strengthColors[strength] : "bg-slate-200"}`} />
              ))}
            </div>
            <span className="text-xs font-medium text-slate-500">{t(strengthLabels[strength])}</span>
          </div>
        )}
        <Field label={t("Confirmer le mot de passe")} error={errors.confirm} required>
          <Input type={showPassword ? "text" : "password"} value={form.confirm} onChange={set("confirm")} autoComplete="new-password" placeholder="••••••••" />
        </Field>

        <div>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-600">
            <input type="checkbox" checked={form.terms} onChange={set("terms")} className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand-600" />
            <span>{t("J'accepte les conditions d'utilisation et la politique de confidentialité.")}</span>
          </label>
          {errors.terms && <p className="mt-1.5 text-xs font-medium text-rose-600">{errors.terms}</p>}
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={loading} iconRight={loading ? undefined : FaArrowRight}>
          {loading ? t("Création de votre espace…") : t("Créer mon espace")}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-500">{t("Déjà inscrit ?")}{" "}
        <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">{t("Se connecter")}</Link>
      </p>
    </AuthLayout>
  );
}
