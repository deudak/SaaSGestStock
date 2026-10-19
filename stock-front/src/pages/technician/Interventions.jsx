import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  FaBullhorn,
  FaCalendarAlt,
  FaCheck,
  FaCheckCircle,
  FaClipboardCheck,
  FaCloudUploadAlt,
  FaExchangeAlt,
  FaExclamationTriangle,
  FaHandPaper,
  FaPlay,
  FaPlus,
  FaTools,
  FaUser,
} from "react-icons/fa";
import { useStore } from "../../store/StoreContext";
import { useConnectivity } from "../../store/ConnectivityContext";
import { Card, EmptyState, PageHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Tabs from "../../components/ui/Tabs";
import Modal from "../../components/ui/Modal";
import StatCard from "../../components/ui/StatCard";
import { Field, Input, Textarea } from "../../components/ui/Form";
import { formatDate, formatMoney, formatRelative, startOfDay, toDateInput } from "../../lib/format";
import { MAINTENANCE_STATUS, isAssignedTo } from "../../store/selectors";

import { t } from "../../i18n/index.js";

const isUrgent = (task) => task.task.startsWith("[URGENT]");
const taskLabel = (task) => task.task.replace(/^\[URGENT\]\s*/, "");

function CloseForm({ task, onSubmit, onCancel }) {
  const [form, setForm] = useState({ cost: String(task.costEstimate || ""), note: "" });
  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.note.trim()) return toast.error(t("Décrivez ce qui a été fait."));
        onSubmit({ cost: Number(form.cost) || 0, note: form.note.trim() });
      }}
    >
      <div className="rounded-xl bg-slate-50 p-3 text-sm">
        <p className="font-semibold text-slate-900">{task.product}</p>
        <p className="text-slate-600">{taskLabel(task)}</p>
      </div>
      <Field label={t("Compte rendu")} required hint={t("Pièces changées, réglages, garantie, conseils…")}>
        <Textarea value={form.note} onChange={set("note")} rows={3} placeholder={t("Ex : rouleau d'entraînement remplacé, tests d'impression OK")} autoFocus />
      </Field>
      <Field label={t("Coût réel (pièces + main d'œuvre)")}>
        <Input type="number" min="0" value={form.cost} onChange={set("cost")} suffix="F" />
      </Field>
      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>{t("Annuler")}</Button>
        <Button type="submit" variant="success" icon={FaCheck}>{t("Clôturer l'intervention")}</Button>
      </div>
    </form>
  );
}

function NewTaskForm({ equipment, onSubmit, onCancel }) {
  const [form, setForm] = useState({ product: "", task: "", date: toDateInput() });
  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.product.trim() || !form.task.trim()) return toast.error(t("Équipement et description requis."));
        onSubmit({ product: form.product.trim(), task: form.task.trim(), date: new Date(form.date).toISOString() });
      }}
    >
      <Field label={t("Équipement")} required>
        <Input list="technician-equipment" value={form.product} onChange={set("product")} placeholder={t("Ex : Climatiseur boutique Akwa")} />
      </Field>
      <datalist id="technician-equipment">
        {equipment.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <Field label={t("Intervention")} required>
        <Textarea value={form.task} onChange={set("task")} rows={2} placeholder={t("Ex : entretien préventif des filtres")} />
      </Field>
      <Field label={t("Date prévue")}>
        <Input type="date" value={form.date} onChange={set("date")} />
      </Field>
      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>{t("Annuler")}</Button>
        <Button type="submit" icon={FaCheck}>{t("Planifier")}</Button>
      </div>
    </form>
  );
}

function TaskCard({ task, mine, reporter, onStart, onReplace, onClose, onClaim }) {
  const late = new Date(task.date) < startOfDay();
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={MAINTENANCE_STATUS[task.status]?.tone} dot>
            {t(task.status)}
          </Badge>
          {isUrgent(task) && (
            <Badge tone="red" icon={FaExclamationTriangle}>{t("Urgent")}</Badge>
          )}
          {late && <Badge tone="red">{t("En retard")}</Badge>}
          {task.source === "seller" && <Badge tone="violet" icon={FaBullhorn}>{t("Signalé par")}{" "}{reporter?.name || t("un vendeur")}</Badge>}
        </div>
        <p className="mt-1.5 font-semibold text-slate-900">{task.product}</p>
        <p className="text-sm text-slate-600">{taskLabel(task)}</p>
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <FaCalendarAlt size={10} /> {formatDate(task.date)} ({formatRelative(task.date)})
          </span>
          {!mine && (
            <span className="inline-flex items-center gap-1">
              <FaUser size={10} /> {task.assignedTo || t("Non assigné")}
            </span>
          )}
          {task.costEstimate > 0 && <span>{t("Estimé :")}{" "}{formatMoney(task.costEstimate)}</span>}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {mine ? (
          <>
            {task.status !== "En cours" && (
              <Button size="sm" variant="secondary" icon={FaPlay} onClick={onStart}>{t("Démarrer")}</Button>
            )}
            {task.status !== "À remplacer" && (
              <Button size="sm" variant="secondary" icon={FaExchangeAlt} onClick={onReplace} title={t("L'équipement n'est pas réparable")}>{t("À remplacer")}</Button>
            )}
            <Button size="sm" variant="success" icon={FaClipboardCheck} onClick={onClose}>{t("Clôturer")}</Button>
          </>
        ) : (
          !task.technicianId && (
            <Button size="sm" icon={FaHandPaper} onClick={onClaim}>{t("Prendre en charge")}</Button>
          )
        )}
      </div>
    </li>
  );
}

export default function TechnicianInterventions() {
  const { state, actions, currentUser } = useStore();
  const { online } = useConnectivity();
  const [tab, setTab] = useState("mine");
  const [modal, setModal] = useState(null); // { type: "close" | "new", task? }

  const usersById = useMemo(() => Object.fromEntries(state.users.map((u) => [u.id, u])), [state.users]);
  const byDate = (a, b) => (isUrgent(b) - isUrgent(a)) || new Date(a.date) - new Date(b.date);

  const open = useMemo(() => state.maintenanceTasks.filter((item) => item.status !== "Terminé"), [state.maintenanceTasks]);
  const mine = useMemo(() => open.filter((item) => isAssignedTo(item, currentUser)).sort(byDate), [open, currentUser]);
  const toClaim = useMemo(() => open.filter((item) => !item.technicianId && !item.assignedTo).sort(byDate), [open]);
  const others = useMemo(() => open.filter((item) => !isAssignedTo(item, currentUser)).sort(byDate), [open, currentUser]);

  const [today] = useState(() => startOfDay());
  const endOfToday = new Date(today.getTime() + 86400000);
  const dueToday = mine.filter((item) => new Date(item.date) < endOfToday);
  const late = mine.filter((item) => new Date(item.date) < today);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const doneThisMonth = state.maintenanceHistory.filter(
    (h) => new Date(h.date) >= monthStart && (h.technicianId ? h.technicianId === currentUser.id : h.technician === currentUser.name)
  );

  const equipment = useMemo(
    () => [...new Set([...state.techSheets.map((s) => s.product), ...state.maintenanceTasks.map((item) => item.product)])],
    [state.techSheets, state.maintenanceTasks]
  );

  const pending = state.outbox?.length || 0;
  const list = tab === "mine" ? mine : tab === "claim" ? toClaim : others;

  const setStatus = (task, status, message) => {
    actions.saveMaintenanceTask({ id: task.id, status });
    toast.success(message);
  };
  const claim = (task) => {
    actions.saveMaintenanceTask({ id: task.id, technicianId: currentUser.id, assignedTo: currentUser.name, status: task.status === "Signalé" ? "Planifié" : task.status });
    toast.success(t("Intervention ajoutée à votre liste"));
    setTab("mine");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("Espace maintenancier")}
        title={t("Bonjour {0}", [currentUser.name.split(" ")[0]])}
        description={t("Vos interventions du jour, les pannes signalées par les vendeurs et le suivi de vos réparations.")}
        actions={
          <Button icon={FaPlus} onClick={() => setModal({ type: "new" })}>{t("Nouvelle intervention")}</Button>
        }
      />

      <div
        className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-[13px] ${pending ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}
        role="status"
      >
        {pending ? <FaCloudUploadAlt className="shrink-0" /> : <FaCheckCircle className="shrink-0" />}
        {pending ? t("{0} modification{1} en attente d'envoi{2}", [pending, pending > 1 ? "s" : "", online ? "…" : " : elles partiront dès le retour du réseau."]) : t("Tout est synchronisé avec l'administrateur.")}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard title={t("À faire aujourd'hui")} value={dueToday.length} icon={FaTools} hint={t("{0} intervention(s) assignée(s)", [mine.length])} onClick={() => setTab("mine")} />
        <StatCard title={t("En retard")} value={late.length} icon={FaExclamationTriangle} tone={late.length ? "red" : "green"} hint={t("Date prévue dépassée")} onClick={() => setTab("mine")} />
        <StatCard title={t("Pannes à prendre")} value={toClaim.length} icon={FaBullhorn} tone={toClaim.length ? "violet" : "green"} hint={t("Signalées, sans technicien")} onClick={() => setTab("claim")} />
        <StatCard title={t("Terminées ce mois")} value={doneThisMonth.length} icon={FaCheckCircle} tone="slate" hint={formatMoney(doneThisMonth.reduce((sum, h) => sum + (h.cost || 0), 0))} />
      </div>

      <Card padded={false}>
        <div className="border-b border-slate-100 p-4">
          <Tabs
            value={tab}
            onChange={setTab}
            size="sm"
            options={[
              { value: "mine", label: t("Mes interventions"), count: mine.length },
              { value: "claim", label: t("À prendre en charge"), count: toClaim.length },
              { value: "others", label: t("Équipe"), count: others.length },
            ]}
          />
        </div>
        {list.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={FaCheckCircle}
              title={tab === "mine" ? t("Aucune intervention en cours") : tab === "claim" ? t("Aucune panne en attente") : t("Rien d'autre en cours")}
              description={tab === "mine" ? t("Prenez en charge une panne signalée ou planifiez une intervention.") : t("Tout est pris en charge.")}
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                mine={tab === "mine"}
                reporter={task.reportedBy ? usersById[task.reportedBy] : null}
                onStart={() => setStatus(task, "En cours", t("Intervention démarrée"))}
                onReplace={() => setStatus(task, "À remplacer", t("L'administrateur est prévenu : équipement à remplacer"))}
                onClose={() => setModal({ type: "close", task })}
                onClaim={() => claim(task)}
              />
            ))}
          </ul>
        )}
      </Card>

      <Modal isOpen={modal?.type === "close"} onClose={() => setModal(null)} title={t("Clôturer l'intervention")}>
        {modal?.type === "close" && (
          <CloseForm
            task={modal.task}
            onCancel={() => setModal(null)}
            onSubmit={({ cost, note }) => {
              actions.completeMaintenanceTask(modal.task.id, { cost, note, technician: currentUser.name });
              toast.success(t("Intervention clôturée et archivée"));
              setModal(null);
            }}
          />
        )}
      </Modal>
      <Modal isOpen={modal?.type === "new"} onClose={() => setModal(null)} title={t("Nouvelle intervention")} description={t("Elle sera ajoutée à votre liste et visible par l'administrateur.")}>
        {modal?.type === "new" && (
          <NewTaskForm
            equipment={equipment}
            onCancel={() => setModal(null)}
            onSubmit={(data) => {
              actions.saveMaintenanceTask({ ...data, status: "Planifié", source: "admin", technicianId: currentUser.id, assignedTo: currentUser.name });
              toast.success(t("Intervention planifiée"));
              setTab("mine");
              setModal(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
