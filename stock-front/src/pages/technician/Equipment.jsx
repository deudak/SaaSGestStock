import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FaCheck, FaChevronDown, FaChevronUp, FaEdit, FaFileAlt, FaPlus } from "react-icons/fa";
import { useStore } from "../../store/StoreContext";
import { Card, EmptyState, PageHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import { Field, Input, SearchInput, Textarea } from "../../components/ui/Form";
import { formatDate, matches, toDateInput } from "../../lib/format";
import { MAINTENANCE_STATUS } from "../../store/selectors";

import { t } from "../../i18n/index.js";

/** Fiche technique, sans la valeur d'achat (information financière réservée à l'administrateur). */
function SheetForm({ initial, onSubmit, onCancel }) {
  const [form, setForm] = useState({ product: "", model: "", info: "", ...initial, purchaseDate: initial.purchaseDate ? toDateInput(initial.purchaseDate) : "" });
  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.product.trim()) return toast.error(t("Nom de l'équipement requis."));
        onSubmit({
          product: form.product.trim(),
          model: form.model.trim(),
          info: form.info.trim(),
          purchaseDate: form.purchaseDate ? new Date(form.purchaseDate).toISOString() : null,
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Équipement")} required>
          <Input value={form.product} onChange={set("product")} placeholder={t("Climatiseur Samsung")} />
        </Field>
        <Field label={t("Modèle / n° de série")}>
          <Input value={form.model} onChange={set("model")} placeholder={t("AR18 WindFree")} />
        </Field>
        <Field label={t("Date de mise en service")}>
          <Input type="date" value={form.purchaseDate} onChange={set("purchaseDate")} />
        </Field>
      </div>
      <Field label={t("Caractéristiques techniques")} hint={t("Puissance, références des pièces, consignes d'entretien…")}>
        <Textarea value={form.info} onChange={set("info")} rows={4} />
      </Field>
      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>{t("Annuler")}</Button>
        <Button type="submit" icon={FaCheck}>{t("Enregistrer")}</Button>
      </div>
    </form>
  );
}

export default function TechnicianEquipment() {
  const { state, actions } = useStore();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null);

  const sheets = useMemo(
    () =>
      state.techSheets
        .filter((sheet) => matches(search, sheet.product, sheet.model, sheet.info))
        .map((sheet) => {
          const key = sheet.product.toLowerCase();
          const history = state.maintenanceHistory.filter((h) => h.product.toLowerCase() === key).sort((a, b) => new Date(b.date) - new Date(a.date));
          const open = state.maintenanceTasks.filter((item) => item.product.toLowerCase() === key && item.status !== "Terminé");
          return { ...sheet, history, open };
        })
        .sort((a, b) => b.open.length - a.open.length || a.product.localeCompare(b.product)),
    [state.techSheets, state.maintenanceHistory, state.maintenanceTasks, search]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("Espace maintenancier")}
        title={t("Équipements")}
        description={t("Fiches techniques du parc et historique des réparations de chaque équipement.")}
        actions={
          <Button icon={FaPlus} onClick={() => setEditing({})}>{t("Nouvelle fiche")}</Button>
        }
      />

      <SearchInput value={search} onChange={setSearch} placeholder={t("Rechercher un équipement…")} className="sm:max-w-sm" />

      {sheets.length === 0 ? (
        <EmptyState icon={FaFileAlt} title={t("Aucune fiche technique")} description={t("Créez une fiche pour chaque équipement que vous entretenez.")} action={<Button icon={FaPlus} onClick={() => setEditing({})}>{t("Nouvelle fiche")}</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sheets.map((sheet) => {
            const isOpen = expanded === sheet.id;
            return (
              <Card key={sheet.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{sheet.model || t("Modèle non renseigné")}</p>
                    <p className="mt-0.5 font-semibold text-slate-900">{sheet.product}</p>
                  </div>
                  {sheet.open.length > 0 && (
                    <Badge tone={MAINTENANCE_STATUS[sheet.open[0].status]?.tone} dot>
                      {t(sheet.open[0].status)}
                    </Badge>
                  )}
                </div>
                {sheet.info && <p className="mt-2 whitespace-pre-line rounded-lg bg-slate-50 p-2.5 text-xs leading-relaxed text-slate-600">{sheet.info}</p>}
                <p className="mt-3 text-xs text-slate-500">
                  {sheet.purchaseDate ? t("En service depuis le {0} · ", [formatDate(sheet.purchaseDate)]) : ""}
                  {sheet.history.length}{" "}{t("réparation")}{sheet.history.length > 1 ? "s" : ""}
                </p>

                {isOpen && (
                  <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                    {sheet.history.length === 0 ? (
                      <li className="text-xs text-slate-500">{t("Aucune réparation enregistrée.")}</li>
                    ) : (
                      sheet.history.map((h) => (
                        <li key={h.id} className="text-xs">
                          <p className="font-medium text-slate-800">
                            {formatDate(h.date)} — {h.action}
                          </p>
                          <p className="text-slate-500">
                            {h.technician}
                            {h.note ? ` · ${h.note}` : ""}
                          </p>
                        </li>
                      ))
                    )}
                  </ul>
                )}

                <div className="mt-auto flex gap-1.5 pt-4">
                  <Button size="sm" variant="secondary" className="flex-1" icon={isOpen ? FaChevronUp : FaChevronDown} onClick={() => setExpanded(isOpen ? null : sheet.id)}>
                    {isOpen ? t("Masquer l'historique") : t("Historique")}
                  </Button>
                  <Button size="icon-sm" variant="ghost" onClick={() => setEditing(sheet)} aria-label={t("Modifier la fiche")}>
                    <FaEdit size={12} />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? t("Modifier la fiche") : t("Nouvelle fiche technique")} size="lg">
        {editing && (
          <SheetForm
            initial={editing}
            onCancel={() => setEditing(null)}
            onSubmit={(data) => {
              actions.saveTechSheet(editing.id ? { ...data, id: editing.id } : { ...data, originalValue: 0 });
              toast.success(t("Fiche enregistrée"));
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
