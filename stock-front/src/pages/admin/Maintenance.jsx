import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  FaBullhorn,
  FaCalendarAlt,
  FaCheck,
  FaCheckCircle,
  FaClipboardCheck,
  FaEdit,
  FaExclamationTriangle,
  FaFileAlt,
  FaHistory,
  FaMoneyBillWave,
  FaPlus,
  FaTools,
  FaTrash,
  FaUserCog,
  FaBalanceScale,
} from "react-icons/fa";
import { useStore } from "../../store/StoreContext";
import { useConfirm } from "../../components/ui/Confirm";
import { Card, EmptyState, PageHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Tabs from "../../components/ui/Tabs";
import Modal from "../../components/ui/Modal";
import StatCard from "../../components/ui/StatCard";
import { Field, Input, Select, Textarea } from "../../components/ui/Form";
import { formatDate, formatMoney, formatRelative, toDateInput } from "../../lib/format";
import { MAINTENANCE_STATUS, openMaintenance, sumBy } from "../../store/selectors";

import { t } from "../../i18n/index.js";

const TASK_STATUSES = ["Signalé", "Planifié", "En cours", "À remplacer", "Terminé"];

function useForm(initial) {
  const [form, setForm] = useState(initial);
  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  return [form, set, setForm];
}

function FormFooter({ onCancel, label = t("Enregistrer") }) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
      <Button variant="secondary" onClick={onCancel}>{t("Annuler")}</Button>
      <Button type="submit" icon={FaCheck}>
        {label}
      </Button>
    </div>
  );
}

function TaskForm({ initial, equipment, technicians, onSubmit, onCancel }) {
  const [form, set] = useForm({ product: "", task: "", status: "Planifié", assignedTo: "", costEstimate: "", ...initial, technicianId: initial.technicianId || "", date: toDateInput(initial.date) });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.product.trim() || !form.task.trim()) return toast.error(t("Équipement et description requis."));
        const technician = technicians.find((item) => item.id === form.technicianId);
        onSubmit({
          ...form,
          technicianId: technician ? technician.id : null,
          assignedTo: technician ? technician.name : form.assignedTo.trim(),
          date: new Date(form.date).toISOString(),
          costEstimate: Number(form.costEstimate) || 0,
        });
      }}
    >
      <Field label={t("Équipement")} required>
        <Input list="equipment-list" value={form.product} onChange={set("product")} placeholder={t("Ex : Climatiseur boutique Akwa")} />
      </Field>
      <datalist id="equipment-list">
        {equipment.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <Field label={t("Intervention")} required>
        <Textarea value={form.task} onChange={set("task")} rows={2} placeholder={t("Nature de l'intervention ou du problème")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Date prévue")}>
          <Input type="date" value={form.date} onChange={set("date")} />
        </Field>
        <Field label={t("Statut")}>
          <Select value={form.status} onChange={set("status")}>
            {TASK_STATUSES.filter((s) => s !== "Terminé").map((s) => (
              <option key={s} value={s}>{t(s)}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("Technicien")} hint={technicians.length ? t("Le maintenancier la verra dans son espace.") : t("Créez des comptes maintenanciers dans Équipe.")}>
          <Select value={form.technicianId} onChange={set("technicianId")}>
            <option value="">{t("Prestataire externe / non assigné")}</option>
            {technicians.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          {!form.technicianId && <Input value={form.assignedTo} onChange={set("assignedTo")} placeholder={t("Nom du prestataire (facultatif)")} className="mt-2" />}
        </Field>
        <Field label={t("Coût estimé")}>
          <Input type="number" min="0" value={form.costEstimate} onChange={set("costEstimate")} suffix="F" />
        </Field>
      </div>
      <FormFooter onCancel={onCancel} />
    </form>
  );
}

function CompleteForm({ task, onSubmit, onCancel }) {
  const [form, set] = useForm({ cost: String(task.costEstimate || ""), technician: task.assignedTo || "", note: "" });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
    >
      <div className="rounded-xl bg-slate-50 p-3 text-sm">
        <p className="font-semibold text-slate-900">{task.product}</p>
        <p className="text-slate-600">{task.task}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Coût réel")} hint={t("Archivé dans l'historique")}>
          <Input type="number" min="0" value={form.cost} onChange={set("cost")} suffix="F" />
        </Field>
        <Field label={t("Technicien")}>
          <Input value={form.technician} onChange={set("technician")} />
        </Field>
      </div>
      <Field label={t("Compte rendu")}>
        <Textarea value={form.note} onChange={set("note")} rows={2} placeholder={t("Pièces changées, garantie…")} />
      </Field>
      <FormFooter onCancel={onCancel} label={t("Clôturer l'intervention")} />
    </form>
  );
}

function HistoryForm({ equipment, onSubmit, onCancel }) {
  const [form, set] = useForm({ product: "", action: "", technician: "", date: toDateInput(), cost: "", note: "" });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.product.trim() || !form.action.trim()) return toast.error(t("Équipement et action requis."));
        onSubmit({ ...form, date: new Date(form.date).toISOString(), cost: Number(form.cost) || 0 });
      }}
    >
      <Field label={t("Équipement")} required>
        <Input list="equipment-list-h" value={form.product} onChange={set("product")} />
      </Field>
      <datalist id="equipment-list-h">
        {equipment.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <Field label={t("Action réalisée")} required>
        <Input value={form.action} onChange={set("action")} placeholder={t("Ex : Remplacement de la carte mère")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("Technicien")}>
          <Input value={form.technician} onChange={set("technician")} />
        </Field>
        <Field label={t("Date")}>
          <Input type="date" value={form.date} onChange={set("date")} />
        </Field>
        <Field label={t("Coût")}>
          <Input type="number" min="0" value={form.cost} onChange={set("cost")} suffix="F" />
        </Field>
      </div>
      <Field label={t("Note")}>
        <Textarea value={form.note} onChange={set("note")} rows={2} />
      </Field>
      <FormFooter onCancel={onCancel} label={t("Archiver")} />
    </form>
  );
}

function SheetForm({ initial, onSubmit, onCancel }) {
  const [form, set] = useForm({ product: "", model: "", info: "", originalValue: "", ...initial, purchaseDate: toDateInput(initial.purchaseDate) });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.product.trim()) return toast.error(t("Nom de l'équipement requis."));
        onSubmit({ ...form, originalValue: Number(form.originalValue) || 0, purchaseDate: new Date(form.purchaseDate).toISOString() });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Équipement")} required>
          <Input value={form.product} onChange={set("product")} placeholder={t("Climatiseur Samsung")} />
        </Field>
        <Field label={t("Modèle / n° de série")}>
          <Input value={form.model} onChange={set("model")} placeholder={t("AR18 WindFree")} />
        </Field>
        <Field label={t("Valeur d'achat")}>
          <Input type="number" min="0" value={form.originalValue} onChange={set("originalValue")} suffix="F" />
        </Field>
        <Field label={t("Date d'acquisition")}>
          <Input type="date" value={form.purchaseDate} onChange={set("purchaseDate")} />
        </Field>
      </div>
      <Field label={t("Caractéristiques techniques")}>
        <Textarea value={form.info} onChange={set("info")} rows={3} />
      </Field>
      <FormFooter onCancel={onCancel} />
    </form>
  );
}

export default function AdminMaintenance() {
  const { state, actions } = useStore();
  const confirm = useConfirm();
  const [tab, setTab] = useState("tasks");
  const [filter, setFilter] = useState("open");
  const [modal, setModal] = useState(null); // { type, data }

  const usersById = useMemo(() => Object.fromEntries(state.users.map((u) => [u.id, u])), [state.users]);
  const technicians = useMemo(() => state.users.filter((u) => u.role === "technician" && u.status === "actif"), [state.users]);
  const open = openMaintenance(state.maintenanceTasks);
  const reports = state.maintenanceTasks.filter((item) => item.status === "Signalé");
  const [yearAgo] = useState(() => Date.now() - 365 * 86400000);
  const spentYear = sumBy(state.maintenanceHistory.filter((h) => new Date(h.date).getTime() >= yearAgo), (h) => h.cost);

  const equipment = useMemo(
    () => [...new Set([...state.techSheets.map((s) => s.product), ...state.maintenanceTasks.map((item) => item.product), ...state.maintenanceHistory.map((h) => h.product)])],
    [state.techSheets, state.maintenanceTasks, state.maintenanceHistory]
  );

  const tasks = state.maintenanceTasks
    .filter((item) => (filter === "open" ? item.status !== "Terminé" : filter === "all" ? true : item.status === filter))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const costReport = useMemo(
    () =>
      state.techSheets
        .map((sheet) => {
          const repairs = sumBy(state.maintenanceHistory.filter((h) => h.product.toLowerCase() === sheet.product.toLowerCase()), (h) => h.cost);
          const ratio = sheet.originalValue ? (repairs / sheet.originalValue) * 100 : 0;
          const status = ratio >= 100 ? "red" : ratio >= 50 ? "amber" : "green";
          return { ...sheet, repairs, ratio, status };
        })
        .sort((a, b) => b.ratio - a.ratio),
    [state.techSheets, state.maintenanceHistory]
  );

  const close = () => setModal(null);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("Organisation")}
        title={t("Maintenance")}
        description={t("Signalements des vendeurs, planning des interventions, fiches techniques et coûts d'entretien.")}
        actions={
          <Button icon={FaPlus} onClick={() => setModal({ type: "task", data: {} })}>{t("Planifier une intervention")}</Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard title={t("Interventions ouvertes")} value={open.length} icon={FaTools} hint={t("{0} en retard", [open.filter((item) => new Date(item.date) < new Date()).length])} />
        <StatCard title={t("Signalements à traiter")} value={reports.length} icon={FaBullhorn} tone={reports.length ? "violet" : "green"} hint={t("Remontés par les vendeurs")} onClick={() => { setTab("tasks"); setFilter("Signalé"); }} />
        <StatCard title={t("Coût estimé à venir")} value={formatMoney(sumBy(open, (item) => item.costEstimate))} icon={FaMoneyBillWave} tone="amber" hint={t("Interventions ouvertes")} />
        <StatCard title={t("Dépensé sur 12 mois")} value={formatMoney(spentYear)} icon={FaHistory} tone="slate" hint={t("{0} intervention(s) archivée(s)", [state.maintenanceHistory.length])} />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "tasks", label: t("Interventions"), icon: FaCalendarAlt, count: open.length },
          { value: "history", label: t("Historique"), icon: FaHistory },
          { value: "sheets", label: t("Fiches techniques"), icon: FaFileAlt, count: state.techSheets.length },
          { value: "costs", label: t("Rentabilité"), icon: FaBalanceScale },
        ]}
      />

      {tab === "tasks" && (
        <Card padded={false}>
          <div className="border-b border-slate-100 p-4">
            <Tabs
              value={filter}
              onChange={setFilter}
              size="sm"
              options={[
                { value: "open", label: t("Ouvertes"), count: open.length },
                ...TASK_STATUSES.map((s) => ({ value: s, label: s, count: state.maintenanceTasks.filter((item) => item.status === s).length })),
                { value: "all", label: t("Toutes") },
              ]}
            />
          </div>
          {tasks.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={FaCheckCircle} title={t("Rien à afficher")} description={t("Aucune intervention dans cette catégorie.")} />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {tasks.map((task) => {
                const late = task.status !== "Terminé" && new Date(task.date) < new Date(new Date().toDateString());
                const reporter = task.reportedBy ? usersById[task.reportedBy] : null;
                return (
                  <li key={task.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={MAINTENANCE_STATUS[task.status]?.tone} dot>
                          {t(task.status)}
                        </Badge>
                        {late && <Badge tone="red">{t("En retard")}</Badge>}
                        {task.source === "seller" && <Badge tone="violet" icon={FaBullhorn}>{t("Signalé par")}{" "}{reporter?.name || t("un vendeur")}</Badge>}
                      </div>
                      <p className="mt-1.5 font-semibold text-slate-900">{task.product}</p>
                      <p className="text-sm text-slate-600">{task.task}</p>
                      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <FaCalendarAlt size={10} /> {formatDate(task.date)} ({formatRelative(task.date)})
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <FaUserCog size={10} /> {task.assignedTo || t("Non assigné")}
                        </span>
                        {task.costEstimate > 0 && <span>{t("Estimé :")}{" "}{formatMoney(task.costEstimate)}</span>}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {task.status !== "Terminé" && (
                        <>
                          <Select
                            value={task.status}
                            onChange={(e) => {
                              if (e.target.value === "Terminé") return setModal({ type: "complete", data: task });
                              actions.saveMaintenanceTask({ id: task.id, status: e.target.value });
                              toast.success(t("Statut mis à jour"));
                            }}
                            className="w-40 py-1.5 text-xs"
                            aria-label={t("Statut")}
                          >
                            {TASK_STATUSES.map((s) => (
                              <option key={s} value={s}>{t(s)}</option>
                            ))}
                          </Select>
                          <Button size="sm" variant="success" icon={FaClipboardCheck} onClick={() => setModal({ type: "complete", data: task })}>{t("Clôturer")}</Button>
                        </>
                      )}
                      <Button size="icon-sm" variant="ghost" onClick={() => setModal({ type: "task", data: task })} aria-label={t("Modifier")}>
                        <FaEdit size={12} />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="danger-ghost"
                        aria-label={t("Supprimer")}
                        onClick={async () => {
                          if (await confirm({ title: t("Supprimer cette intervention ?"), message: `${task.product} — ${task.task}`, confirmLabel: t("Supprimer") })) {
                            actions.deleteMaintenanceTask(task.id);
                            toast.success(t("Intervention supprimée"));
                          }
                        }}
                      >
                        <FaTrash size={11} />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {tab === "history" && (
        <Card padded={false}>
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <p className="text-sm text-slate-600">{t("Total archivé :")}{" "}<b className="tabular text-slate-900">{formatMoney(sumBy(state.maintenanceHistory, (h) => h.cost))}</b>
            </p>
            <Button size="sm" variant="secondary" icon={FaPlus} onClick={() => setModal({ type: "history" })}>{t("Archiver une intervention")}</Button>
          </div>
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-160 text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">{t("Date")}</th>
                  <th className="px-4 py-3">{t("Équipement")}</th>
                  <th className="px-4 py-3">{t("Action")}</th>
                  <th className="px-4 py-3">{t("Technicien")}</th>
                  <th className="px-4 py-3 text-right">{t("Coût")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...state.maintenanceHistory]
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                  .map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(h.date)}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{h.product}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {h.action}
                        {h.note && <p className="text-xs italic text-slate-400">{h.note}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{h.technician}</td>
                      <td className="tabular px-4 py-3 text-right font-semibold text-slate-900">{formatMoney(h.cost)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="icon-sm"
                          variant="danger-ghost"
                          aria-label={t("Supprimer")}
                          onClick={async () => {
                            if (await confirm({ title: t("Supprimer cette ligne d'historique ?"), message: `${h.product} — ${h.action}`, confirmLabel: t("Supprimer") })) actions.deleteMaintenanceHistory(h.id);
                          }}
                        >
                          <FaTrash size={11} />
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "sheets" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="secondary" icon={FaPlus} onClick={() => setModal({ type: "sheet", data: {} })}>{t("Nouvelle fiche")}</Button>
          </div>
          {state.techSheets.length === 0 ? (
            <EmptyState icon={FaFileAlt} title={t("Aucune fiche technique")} description={t("Documentez vos équipements pour suivre leur coût d'entretien.")} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {state.techSheets.map((sheet) => (
                <Card key={sheet.id} className="flex flex-col">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{sheet.model || t("Modèle non renseigné")}</p>
                  <p className="mt-0.5 font-semibold text-slate-900">{sheet.product}</p>
                  {sheet.info && <p className="mt-2 rounded-lg bg-slate-50 p-2.5 text-xs leading-relaxed text-slate-600">{sheet.info}</p>}
                  <div className="mt-3 flex justify-between text-xs text-slate-500">
                    <span>{t("Valeur :")}{" "}<b className="tabular text-slate-800">{formatMoney(sheet.originalValue)}</b></span>
                    <span>{t("Acquis le")}{" "}{formatDate(sheet.purchaseDate)}</span>
                  </div>
                  <div className="mt-auto flex gap-1.5 pt-4">
                    <Button size="sm" variant="secondary" className="flex-1" icon={FaTools} onClick={() => setModal({ type: "task", data: { product: sheet.product, task: t("Maintenance préventive") } })}>{t("Planifier")}</Button>
                    <Button size="icon-sm" variant="ghost" onClick={() => setModal({ type: "sheet", data: sheet })} aria-label={t("Modifier")}>
                      <FaEdit size={12} />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="danger-ghost"
                      aria-label={t("Supprimer")}
                      onClick={async () => {
                        if (await confirm({ title: t("Supprimer cette fiche ?"), message: sheet.product, confirmLabel: t("Supprimer") })) actions.deleteTechSheet(sheet.id);
                      }}
                    >
                      <FaTrash size={11} />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "costs" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">{t("Rapport du cumul des réparations à la valeur d'achat de chaque équipement. Au-delà de 50 %, envisagez un remplacement.")}</p>
          {costReport.length === 0 ? (
            <EmptyState icon={FaBalanceScale} title={t("Aucune fiche technique")} description={t("Créez des fiches pour suivre la rentabilité de vos équipements.")} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {costReport.map((item) => (
                <Card key={item.id} className={item.status === "red" ? "border-rose-200" : item.status === "amber" ? "border-amber-200" : ""}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-slate-900">{item.product}</p>
                    <Badge tone={item.status}>{item.status === "red" ? t("Déficitaire") : item.status === "amber" ? t("Coût élevé") : t("Rentable")}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-slate-50 p-2.5">
                      <p className="text-[11px] text-slate-500">{t("Valeur d'achat")}</p>
                      <p className="tabular font-semibold text-slate-900">{formatMoney(item.originalValue)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2.5">
                      <p className="text-[11px] text-slate-500">{t("Réparations")}</p>
                      <p className="tabular font-semibold text-slate-900">{formatMoney(item.repairs)}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-slate-500">{t("Ratio réparations / valeur")}</span>
                      <span className="tabular font-semibold text-slate-800">{item.ratio.toFixed(0)} %</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${item.status === "red" ? "bg-rose-500" : item.status === "amber" ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, Math.max(item.ratio, 2))}%` }} />
                    </div>
                  </div>
                  {item.status === "red" && (
                    <p className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">
                      <FaExclamationTriangle className="mt-0.5 shrink-0" size={11} />{" "}{t("Les réparations dépassent la valeur de l'équipement : remplacement conseillé.")}</p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal isOpen={modal?.type === "task"} onClose={close} title={modal?.data?.id ? t("Modifier l'intervention") : t("Planifier une intervention")}>
        {modal?.type === "task" && (
          <TaskForm
            initial={modal.data}
            equipment={equipment}
            technicians={technicians}
            onCancel={close}
            onSubmit={(data) => {
              actions.saveMaintenanceTask(modal.data.id ? { ...data, id: modal.data.id } : data);
              toast.success(modal.data.id ? t("Intervention mise à jour") : t("Intervention planifiée"));
              close();
            }}
          />
        )}
      </Modal>
      <Modal isOpen={modal?.type === "complete"} onClose={close} title={t("Clôturer l'intervention")}>
        {modal?.type === "complete" && (
          <CompleteForm
            task={modal.data}
            onCancel={close}
            onSubmit={(data) => {
              actions.completeMaintenanceTask(modal.data.id, data);
              toast.success(t("Intervention clôturée et archivée"));
              close();
            }}
          />
        )}
      </Modal>
      <Modal isOpen={modal?.type === "history"} onClose={close} title={t("Archiver une intervention")}>
        {modal?.type === "history" && (
          <HistoryForm
            equipment={equipment}
            onCancel={close}
            onSubmit={(data) => {
              actions.addMaintenanceHistory(data);
              toast.success(t("Intervention archivée"));
              close();
            }}
          />
        )}
      </Modal>
      <Modal isOpen={modal?.type === "sheet"} onClose={close} title={modal?.data?.id ? t("Modifier la fiche") : t("Nouvelle fiche technique")} size="lg">
        {modal?.type === "sheet" && (
          <SheetForm
            initial={modal.data}
            onCancel={close}
            onSubmit={(data) => {
              actions.saveTechSheet(modal.data.id ? { ...data, id: modal.data.id } : data);
              toast.success(t("Fiche enregistrée"));
              close();
            }}
          />
        )}
      </Modal>
    </div>
  );
}
