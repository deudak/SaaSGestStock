import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FaCheck, FaEnvelope, FaLock, FaPhone, FaReceipt, FaShieldAlt, FaStore, FaUser, FaCalendarAlt } from "react-icons/fa";
import { useStore } from "../../store/StoreContext";
import { Card, CardHeader, PageHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge, { Avatar } from "../../components/ui/Badge";
import { Field, Input } from "../../components/ui/Form";
import { formatDate, formatMoney } from "../../lib/format";
import { ROLE_LABELS, activeSales, sumBy } from "../../store/selectors";

import { t } from "../../i18n/index.js";
import { PreferenceChoices } from "../../components/layout/Preferences";
import { FaSlidersH } from "react-icons/fa";

export default function Profile() {
  const { state, actions, currentUser } = useStore();
  const [info, setInfo] = useState({ name: currentUser.name, email: currentUser.email, phone: currentUser.phone || "", shop: currentUser.shop || "" });
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [pwdErrors, setPwdErrors] = useState({});

  const stats = useMemo(() => {
    const mine = activeSales(state.sales).filter((s) => s.sellerId === currentUser.id);
    return { count: mine.length, revenue: sumBy(mine, (s) => s.total) };
  }, [state.sales, currentUser.id]);

  const dirty = info.name !== currentUser.name || info.email !== currentUser.email || info.phone !== (currentUser.phone || "") || info.shop !== (currentUser.shop || "");

  const saveInfo = async (e) => {
    e.preventDefault();
    if (!info.name.trim()) return toast.error(t("Le nom est obligatoire."));
    if (!/^\S+@\S+\.\S+$/.test(info.email)) return toast.error(t("Email invalide."));
    const result = await actions.saveUser({ id: currentUser.id, ...info, name: info.name.trim(), email: info.email.trim() });
    if (!result.ok) return toast.error(result.error);
    toast.success(t("Profil mis à jour"));
  };

  const savePassword = async (e) => {
    e.preventDefault();
    const next = {};
    if (!pwd.current) next.current = t("Saisissez votre mot de passe actuel.");
    if (pwd.next.length < 6) next.next = t("6 caractères minimum.");
    if (pwd.next !== pwd.confirm) next.confirm = t("Les mots de passe ne correspondent pas.");
    setPwdErrors(next);
    if (Object.keys(next).length) return;
    const result = await actions.changePassword(currentUser.id, pwd.current, pwd.next);
    if (!result.ok) return setPwdErrors({ current: result.error });
    setPwd({ current: "", next: "", confirm: "" });
    toast.success(t("Mot de passe modifié"));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader eyebrow={t("Compte")} title={t("Mon profil")} description={t("Vos informations personnelles et la sécurité de votre compte.")} />

      <Card className="overflow-hidden" padded={false}>
        <div className="h-20 bg-linear-to-r from-brand-600 to-brand-800" />
        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end">
          <Avatar name={currentUser.name} size="xl" className="-mt-10 ring-4 ring-white" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">{currentUser.name}</h2>
              <Badge tone={{ admin: "violet", technician: "amber", accountant: "green" }[currentUser.role] || "blue"}>{ROLE_LABELS[currentUser.role]}</Badge>
            </div>
            <p className="text-sm text-slate-500">{currentUser.email}</p>
          </div>
          <div className="flex gap-6 text-sm">
            {currentUser.role === "seller" && (
              <div>
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <FaReceipt size={10} />{" "}{t("Ventes réalisées")}</p>
                <p className="tabular font-bold text-slate-900">
                  {stats.count} · {formatMoney(stats.revenue)}
                </p>
              </div>
            )}
            <div>
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <FaCalendarAlt size={10} />{" "}{t("Membre depuis")}</p>
              <p className="font-bold text-slate-900">{formatDate(currentUser.createdAt)}</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("Informations personnelles")} icon={FaUser} />
          <form className="space-y-4" onSubmit={saveInfo}>
            <Field label={t("Nom complet")}>
              <Input value={info.name} onChange={(e) => setInfo((p) => ({ ...p, name: e.target.value }))} />
            </Field>
            <Field label={t("Email de connexion")}>
              <div className="relative">
                <FaEnvelope className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                <Input type="email" className="pl-10" value={info.email} onChange={(e) => setInfo((p) => ({ ...p, email: e.target.value }))} />
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("Téléphone")}>
                <div className="relative">
                  <FaPhone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={11} />
                  <Input type="tel" className="pl-10" value={info.phone} onChange={(e) => setInfo((p) => ({ ...p, phone: e.target.value }))} />
                </div>
              </Field>
              <Field label={currentUser.role === "technician" ? t("Zone d'intervention") : t("Point de vente")}>
                <div className="relative">
                  <FaStore className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={11} />
                  <Input className="pl-10" value={info.shop} onChange={(e) => setInfo((p) => ({ ...p, shop: e.target.value }))} disabled={currentUser.role !== "admin"} />
                </div>
              </Field>
            </div>
            <div className="flex justify-end pt-1">
              <Button type="submit" icon={FaCheck} disabled={!dirty}>{t("Enregistrer")}</Button>
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader title={t("Sécurité")} subtitle={t("Modifiez votre mot de passe régulièrement")} icon={FaShieldAlt} tone="green" />
          <form className="space-y-4" onSubmit={savePassword} noValidate>
            <Field label={t("Mot de passe actuel")} error={pwdErrors.current}>
              <Input type="password" autoComplete="current-password" value={pwd.current} onChange={(e) => setPwd((p) => ({ ...p, current: e.target.value }))} />
            </Field>
            <Field label={t("Nouveau mot de passe")} error={pwdErrors.next}>
              <Input type="password" autoComplete="new-password" value={pwd.next} onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))} />
            </Field>
            <Field label={t("Confirmer le nouveau mot de passe")} error={pwdErrors.confirm}>
              <Input type="password" autoComplete="new-password" value={pwd.confirm} onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))} />
            </Field>
            <div className="flex justify-end pt-1">
              <Button type="submit" variant="dark" icon={FaLock}>{t("Changer le mot de passe")}</Button>
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader title={t("Préférences")} subtitle={t("Langue et affichage de cet appareil")} icon={FaSlidersH} tone="violet" />
          <PreferenceChoices />
        </Card>
      </div>
    </div>
  );
}
