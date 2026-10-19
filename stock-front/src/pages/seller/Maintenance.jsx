import { useState } from "react";
import toast from "react-hot-toast";
import { FaBullhorn, FaCheckCircle, FaInfoCircle, FaPaperPlane, FaTools } from "react-icons/fa";
import { useStore } from "../../store/StoreContext";
import { Card, CardHeader, EmptyState, PageHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { Field, Input, Select, Textarea } from "../../components/ui/Form";
import { formatDate, formatRelative } from "../../lib/format";
import { MAINTENANCE_STATUS } from "../../store/selectors";

import { t } from "../../i18n/index.js";

const URGENCY = [
  { value: "normal", label: "Normale" },
  { value: "high", label: "Urgente — bloque les ventes" },
];

export default function SellerMaintenance() {
  const { state, actions, currentUser } = useStore();
  const [form, setForm] = useState({ product: "", task: "", urgency: "normal" });

  const equipment = [...new Set([...state.techSheets.map((s) => s.product), ...state.maintenanceTasks.map((item) => item.product)])];
  const mine = state.maintenanceTasks.filter((item) => item.reportedBy === currentUser.id).sort((a, b) => b.date.localeCompare(a.date));
  const scheduled = state.maintenanceTasks.filter((item) => item.status !== "Terminé" && item.source === "admin").sort((a, b) => a.date.localeCompare(b.date));

  const submit = (e) => {
    e.preventDefault();
    if (!form.product.trim() || !form.task.trim()) return toast.error(t("Précisez l'équipement et le problème."));
    actions.saveMaintenanceTask({
      product: form.product.trim(),
      task: form.urgency === "high" ? `[URGENT] ${form.task.trim()}` : form.task.trim(),
      date: new Date().toISOString(),
      status: "Signalé",
      assignedTo: "",
      costEstimate: 0,
      source: "seller",
      reportedBy: currentUser.id,
    });
    setForm({ product: "", task: "", urgency: "normal" });
    toast.success(t("Signalement envoyé à l'administrateur"));
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t("Compte")} title={t("Signalements")} description={t("Signalez une panne d'équipement : l'administrateur est alerté immédiatement.")} />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title={t("Signaler un problème")} subtitle={t("Caisse, imprimante, climatisation, éclairage…")} icon={FaBullhorn} tone="violet" />
            <form className="space-y-4" onSubmit={submit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("Équipement concerné")} required>
                  <Input list="seller-equipment" value={form.product} onChange={(e) => setForm((p) => ({ ...p, product: e.target.value }))} placeholder={t("Ex : Imprimante de caisse")} />
                </Field>
                <Field label={t("Urgence")}>
                  <Select value={form.urgency} onChange={(e) => setForm((p) => ({ ...p, urgency: e.target.value }))}>
                    {URGENCY.map((u) => (
                      <option key={u.value} value={u.value}>
                        {t(u.label)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <datalist id="seller-equipment">
                {equipment.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <Field label={t("Description du problème")} required>
                <Textarea value={form.task} onChange={(e) => setForm((p) => ({ ...p, task: e.target.value }))} rows={4} placeholder={t("Que se passe-t-il ? Depuis quand ? Avez-vous essayé de redémarrer ?")} />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" icon={FaPaperPlane}>{t("Envoyer le signalement")}</Button>
              </div>
            </form>
          </Card>

          <Card>
            <CardHeader title={t("Mes signalements")} subtitle={t("Suivez le traitement par l'administrateur")} icon={FaTools} />
            {mine.length === 0 ? (
              <EmptyState icon={FaCheckCircle} title={t("Aucun signalement")} description={t("Vos signalements et leur avancement apparaîtront ici.")} />
            ) : (
              <ul className="divide-y divide-slate-100">
                {mine.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800">{item.product}</p>
                      <p className="text-sm text-slate-600">{item.task}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{t("Envoyé")}{" "}{formatRelative(item.date)}
                        {item.assignedTo && t(" · Pris en charge par {0}", [item.assignedTo])}
                      </p>
                    </div>
                    <Badge tone={MAINTENANCE_STATUS[item.status]?.tone} dot>
                      {item.status === "Terminé" ? t("Résolu") : item.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={t("Interventions prévues")} subtitle={t("Planifiées par l'administrateur")} icon={FaTools} tone="slate" />
            {scheduled.length === 0 ? (
              <p className="text-sm text-slate-500">{t("Aucune intervention planifiée.")}</p>
            ) : (
              <ul className="space-y-3">
                {scheduled.map((item) => (
                  <li key={item.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">{item.product}</p>
                      <Badge tone={MAINTENANCE_STATUS[item.status]?.tone}>{t(item.status)}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-600">{item.task}</p>
                    <p className="mt-1 text-xs text-slate-400">{t("Prévu le")}{" "}{formatDate(item.date)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="bg-brand-50/50">
            <div className="flex gap-3">
              <FaInfoCircle className="mt-0.5 shrink-0 text-brand-600" size={14} />
              <p className="text-sm text-slate-600">{t("Un produit vendu défectueux ? Annulez la vente depuis « Mes ventes » le jour même, ou contactez l'administrateur pour un retour.")}</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
