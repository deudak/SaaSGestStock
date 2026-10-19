import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { FaCalendarAlt, FaCheck, FaCreditCard, FaExclamationTriangle, FaHandHoldingUsd, FaPlus, FaPrint, FaTimes, FaWallet, FaWhatsapp } from "react-icons/fa";
import { useStore } from "../../store/StoreContext";
import { useConfirm } from "../../components/ui/Confirm";
import { Card, EmptyState, InfoRow, PageHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge, { Avatar } from "../../components/ui/Badge";
import Tabs from "../../components/ui/Tabs";
import Modal from "../../components/ui/Modal";
import StatCard from "../../components/ui/StatCard";
import { Field, Input, SearchInput, Select, Textarea } from "../../components/ui/Form";
import { addDays, formatDate, formatMoney, formatRelative, matches, toDateInput } from "../../lib/format";
import { printInstallmentStatement } from "../../lib/print";
import { INSTALLMENT_STATUS, PAYMENT_LABELS, installmentPaid, installmentRemaining, installmentStatus, sumBy } from "../../store/selectors";

import { t } from "../../i18n/index.js";

function PaymentForm({ installment, onSubmit, onCancel }) {
  const remaining = installmentRemaining(installment);
  const [amount, setAmount] = useState(String(remaining));
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(toDateInput());
  const [note, setNote] = useState("");
  const value = Number(amount) || 0;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (value <= 0) return toast.error(t("Montant invalide."));
        if (value > remaining) return toast.error(t("Le montant dépasse le reste à payer ({0}).", [formatMoney(remaining)]));
        onSubmit({ amount: value, method, note, date: new Date(`${date}T${new Date().toTimeString().slice(0, 8)}`).toISOString() });
      }}
    >
      <div className="rounded-xl bg-slate-50 p-3 text-sm">
        <InfoRow label={t("Reste à payer")} strong>
          {formatMoney(remaining)}
        </InfoRow>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Montant reçu")} required>
          <Input type="number" min="1" max={remaining} value={amount} onChange={(e) => setAmount(e.target.value)} suffix="F" />
        </Field>
        <Field label={t("Mode de paiement")}>
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            {Object.entries(PAYMENT_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("Date du versement")}>
          <Input type="date" max={toDateInput()} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={t("Note")}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Facultatif")} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[0.25, 0.5, 1].map((share) => (
          <button key={share} type="button" onClick={() => setAmount(String(Math.round(remaining * share)))} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700">
            {share === 1 ? t("Solde total") : `${share * 100} %`}
          </button>
        ))}
      </div>
      {value > 0 && value <= remaining && (
        <p className="text-sm text-slate-600">{t("Après ce versement :")}{" "}<b className="tabular">{formatMoney(remaining - value)}</b>{" "}{t("restant")}{remaining - value === 0 && t(" — dossier soldé 🎉")}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>{t("Annuler")}</Button>
        <Button type="submit" variant="success" icon={FaCheck}>{t("Enregistrer le versement")}</Button>
      </div>
    </form>
  );
}

function NewInstallmentForm({ customers, onSubmit, onCancel }) {
  const [form, setForm] = useState({ customerId: "", label: "", total: "", deposit: "", method: "cash", dueDate: toDateInput(addDays(new Date(), 30)), notes: "" });
  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const total = Number(form.total) || 0;
        const deposit = Number(form.deposit) || 0;
        if (!form.customerId) return toast.error(t("Choisissez un client."));
        if (!form.label.trim()) return toast.error(t("Décrivez l'objet de la créance."));
        if (total <= 0) return toast.error(t("Montant total invalide."));
        if (deposit > total) return toast.error(t("L'acompte dépasse le montant total."));
        const customer = customers.find((c) => c.id === form.customerId);
        onSubmit({ ...form, total, deposit, customerName: customer.name, label: form.label.trim(), dueDate: new Date(form.dueDate).toISOString() });
      }}
    >
      <p className="rounded-xl bg-brand-50 px-3 py-2.5 text-xs text-brand-800">{t("Pour une vente de produits en stock, utilisez plutôt le point de vente en mode « Échelonné » : le stock et la facture seront gérés automatiquement.")}</p>
      <Field label={t("Client")} required>
        <Select value={form.customerId} onChange={set("customerId")}>
          <option value="">{t("Choisir…")}</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.phone}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("Objet")} required>
        <Input value={form.label} onChange={set("label")} placeholder={t("Ex : Reprise d'un ancien solde, prestation…")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Montant total")} required>
          <Input type="number" min="1" value={form.total} onChange={set("total")} suffix="F" />
        </Field>
        <Field label={t("Acompte versé")}>
          <Input type="number" min="0" value={form.deposit} onChange={set("deposit")} suffix="F" />
        </Field>
        <Field label={t("Mode de l'acompte")}>
          <Select value={form.method} onChange={set("method")}>
            {Object.entries(PAYMENT_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("Échéance finale")} required>
          <Input type="date" value={form.dueDate} onChange={set("dueDate")} />
        </Field>
      </div>
      <Field label={t("Notes")}>
        <Textarea value={form.notes} onChange={set("notes")} rows={2} />
      </Field>
      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>{t("Annuler")}</Button>
        <Button type="submit" icon={FaCheck}>{t("Créer le dossier")}</Button>
      </div>
    </form>
  );
}

export default function Installments() {
  const { state, actions, currentUser } = useStore();
  const confirm = useConfirm();
  const isAdmin = currentUser.role === "admin";
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState("open");
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState(isAdmin ? "all" : "mine");
  const [modal, setModal] = useState(null);
  const [editingDue, setEditingDue] = useState(false);
  const selectedId = params.get("id");

  const usersById = useMemo(() => Object.fromEntries(state.users.map((u) => [u.id, u])), [state.users]);
  const customersById = useMemo(() => Object.fromEntries(state.customers.map((c) => [c.id, c])), [state.customers]);

  const scoped = useMemo(() => state.installments.filter((i) => !i.cancelled && (scope === "all" || i.sellerId === currentUser.id)), [state.installments, scope, currentUser.id]);

  const withStatus = useMemo(() => scoped.map((i) => ({ ...i, status: installmentStatus(i), paid: installmentPaid(i), remaining: installmentRemaining(i) })), [scoped]);

  const counts = {
    open: withStatus.filter((i) => i.status !== "paid").length,
    late: withStatus.filter((i) => i.status === "late").length,
    soon: withStatus.filter((i) => i.status === "soon").length,
    paid: withStatus.filter((i) => i.status === "paid").length,
  };

  const list = withStatus
    .filter((i) => (tab === "all" ? true : tab === "open" ? i.status !== "paid" : i.status === tab))
    .filter((i) => matches(search, i.id, i.customerName, i.label))
    .sort((a, b) => (a.status === "paid") - (b.status === "paid") || new Date(a.dueDate) - new Date(b.dueDate));

  const outstanding = sumBy(withStatus, (i) => i.remaining);
  const lateAmount = sumBy(withStatus.filter((i) => i.status === "late"), (i) => i.remaining);
  const collectedMonth = sumBy(
    withStatus.flatMap((i) => i.payments),
    (p) => (new Date(p.date) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1) ? p.amount : 0)
  );

  const selected = withStatus.find((i) => i.id === selectedId) || state.installments.find((i) => i.id === selectedId);
  const selectedFull = selected ? { ...selected, status: installmentStatus(selected), paid: installmentPaid(selected), remaining: installmentRemaining(selected) } : null;

  const select = (id) => {
    const copy = new URLSearchParams(params);
    if (id) copy.set("id", id);
    else copy.delete("id");
    setParams(copy, { replace: true });
    setEditingDue(false);
  };

  const reminderLink = (item) => {
    const customer = customersById[item.customerId];
    if (!customer?.phone) return null;
    const digits = customer.phone.replace(/\D/g, "");
    const text = t("Bonjour {0}, petit rappel de {1} : il reste {2} à régler pour « {3} » (échéance du {4}). Merci !", [item.customerName, state.settings.shopName, formatMoney(item.remaining), item.label, formatDate(item.dueDate)]);
    return `https://wa.me/${digits.length === 9 ? `237${digits}` : digits}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("Clientèle")}
        title={isAdmin ? t("Créances clients") : t("Paiements échelonnés")}
        description={t("Suivi des ventes à crédit, des versements et des échéances.")}
        actions={
          <Button icon={FaPlus} onClick={() => setModal("new")}>{t("Nouveau dossier")}</Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard title={t("Encours total")} value={formatMoney(outstanding)} icon={FaWallet} hint={t("{0} dossier(s) ouvert(s)", [counts.open])} />
        <StatCard title={t("En retard")} value={formatMoney(lateAmount)} icon={FaExclamationTriangle} tone="red" hint={t("{0} dossier(s)", [counts.late])} onClick={() => setTab("late")} />
        <StatCard title={t("Échéance sous 7 jours")} value={counts.soon} icon={FaCalendarAlt} tone="amber" hint={t("À relancer")} onClick={() => setTab("soon")} />
        <StatCard title={t("Encaissé ce mois")} value={formatMoney(collectedMonth)} icon={FaHandHoldingUsd} tone="green" hint={t("Acomptes et versements")} />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={tab}
          onChange={setTab}
          size="sm"
          options={[
            { value: "open", label: t("Ouverts"), count: counts.open },
            { value: "late", label: t("En retard"), count: counts.late },
            { value: "soon", label: t("Échéance proche"), count: counts.soon },
            { value: "paid", label: t("Soldés"), count: counts.paid },
            { value: "all", label: t("Tous") },
          ]}
        />
        <div className="flex gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder={t("Client, n°, objet…")} className="flex-1 lg:w-64" />
          {!isAdmin && (
            <Select value={scope} onChange={(e) => setScope(e.target.value)} className="w-40" aria-label={t("Portée")}>
              <option value="mine">{t("Mes dossiers")}</option>
              <option value="all">{t("Toute la boutique")}</option>
            </Select>
          )}
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={FaCreditCard} title={t("Aucun dossier")} description={t("Les ventes échelonnées du point de vente apparaîtront ici.")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((item) => {
            const st = INSTALLMENT_STATUS[item.status];
            const progress = item.total ? Math.round((item.paid / item.total) * 100) : 0;
            return (
              <Card
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => select(item.id)}
                onKeyDown={(e) => e.key === "Enter" && select(item.id)}
                className={`flex cursor-pointer flex-col outline-none transition hover:shadow-md focus-visible:ring-4 focus-visible:ring-brand-500/20 ${item.status === "late" ? "border-rose-200" : "hover:border-slate-300"}`}
              >
                <div className="flex items-start gap-3">
                  <Avatar name={item.customerName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{item.customerName}</p>
                    <p className="truncate text-xs text-slate-500">
                      <span className="font-mono">{item.id}</span> · {t(item.label)}
                    </p>
                  </div>
                  <Badge tone={st.tone} dot>
                    {t(st.label)}
                  </Badge>
                </div>
                <div className="mt-4">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="tabular font-bold text-slate-900">{formatMoney(item.remaining)}</span>
                    <span className="text-xs text-slate-500">{t("restant sur")}{" "}{formatMoney(item.total)}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${item.status === "paid" ? "bg-emerald-500" : item.status === "late" ? "bg-rose-500" : "bg-brand-500"}`} style={{ width: `${Math.max(progress, 2)}%` }} />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[11px] text-slate-500">
                    <span>{progress}{" "}{t("% payé ·")}{" "}{item.payments.length}{" "}{t("versement(s)")}</span>
                    <span className={item.status === "late" ? "font-semibold text-rose-600" : ""}>
                      {item.status === "paid" ? t("Soldé") : t("Échéance {0}", [formatRelative(item.dueDate)])}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={Boolean(selectedFull)}
        onClose={() => select(null)}
        title={selectedFull ? t("Dossier {0}", [selectedFull.id]) : ""}
        description={selectedFull?.label}
        size="lg"
        footer={
          selectedFull && (
            <>
              {selectedFull.remaining > 0 && reminderLink(selectedFull) && (
                <a
                  href={reminderLink(selectedFull)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 sm:mr-auto"
                >
                  <FaWhatsapp size={14} />{" "}{t("Relancer")}</a>
              )}
              <Button variant="secondary" icon={FaPrint} onClick={() => printInstallmentStatement(selectedFull, { settings: state.settings, customer: customersById[selectedFull.customerId] })}>{t("Relevé")}</Button>
              {selectedFull.remaining > 0 && (
                <Button variant="success" icon={FaHandHoldingUsd} onClick={() => setModal("payment")}>{t("Encaisser un versement")}</Button>
              )}
            </>
          )
        }
      >
        {selectedFull && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Avatar name={selectedFull.customerName} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{selectedFull.customerName}</p>
                <p className="text-xs text-slate-500">
                  {customersById[selectedFull.customerId]?.phone || "—"}{" "}{t("· Suivi par")}{" "}{usersById[selectedFull.sellerId]?.name || "—"}
                  {selectedFull.saleId && t(" · Vente {0}", [selectedFull.saleId])}
                </p>
              </div>
              <Badge tone={INSTALLMENT_STATUS[selectedFull.status].tone} dot>
                {t(INSTALLMENT_STATUS[selectedFull.status].label)}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">{t("Montant total")}</p>
                <p className="tabular font-bold text-slate-900">{formatMoney(selectedFull.total)}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-[11px] text-emerald-700">{t("Déjà versé")}</p>
                <p className="tabular font-bold text-emerald-700">{formatMoney(selectedFull.paid)}</p>
              </div>
              <div className={`rounded-xl p-3 ${selectedFull.remaining ? "bg-amber-50" : "bg-slate-50"}`}>
                <p className="text-[11px] text-amber-700">{t("Reste à payer")}</p>
                <p className="tabular font-bold text-amber-700">{formatMoney(selectedFull.remaining)}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <FaCalendarAlt className="text-slate-400" size={12} />{t("Échéance finale :")}{editingDue ? (
                  <Input
                    type="date"
                    defaultValue={toDateInput(selectedFull.dueDate)}
                    className="w-40 py-1.5"
                    autoFocus
                    onBlur={(e) => {
                      if (e.target.value) {
                        actions.updateInstallment(selectedFull.id, { dueDate: new Date(e.target.value).toISOString() });
                        toast.success(t("Échéance reportée"));
                      }
                      setEditingDue(false);
                    }}
                  />
                ) : (
                  <b>{formatDate(selectedFull.dueDate)}</b>
                )}
              </div>
              {!editingDue && selectedFull.remaining > 0 && (
                <Button size="xs" variant="ghost" onClick={() => setEditingDue(true)}>{t("Reporter")}</Button>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("Versements")}</p>
              {selectedFull.payments.length === 0 ? (
                <p className="text-sm text-slate-500">{t("Aucun versement enregistré.")}</p>
              ) : (
                <ol className="relative space-y-3 border-l-2 border-slate-100 pl-5">
                  {[...selectedFull.payments]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((p) => (
                      <li key={p.id} className="relative">
                        <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 ring-2 ring-emerald-100" />
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="tabular text-sm font-semibold text-slate-900">{formatMoney(p.amount)}</p>
                            <p className="text-xs text-slate-500">
                              {formatDate(p.date)} · {PAYMENT_LABELS[p.method]}
                              {p.note && ` · ${p.note}`}
                            </p>
                          </div>
                          {isAdmin && (
                            <button
                              type="button"
                              className="rounded-md p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600"
                              aria-label={t("Supprimer ce versement")}
                              onClick={async () => {
                                if (await confirm({ title: t("Supprimer ce versement ?"), message: t("{0} du {1} sera retiré du dossier.", [formatMoney(p.amount), formatDate(p.date)]), confirmLabel: t("Supprimer") })) {
                                  actions.removeInstallmentPayment(selectedFull.id, p.id);
                                  toast.success(t("Versement supprimé"));
                                }
                              }}
                            >
                              <FaTimes size={11} />
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={modal === "payment" && Boolean(selectedFull)} onClose={() => setModal(null)} title={t("Encaisser un versement")} description={selectedFull ? `${selectedFull.customerName} · ${selectedFull.id}` : ""}>
        {modal === "payment" && selectedFull && (
          <PaymentForm
            installment={selectedFull}
            onCancel={() => setModal(null)}
            onSubmit={(payment) => {
              actions.addInstallmentPayment(selectedFull.id, payment);
              toast.success(payment.amount >= selectedFull.remaining ? t("Dossier soldé !") : t("{0} encaissé", [formatMoney(payment.amount)]));
              setModal(null);
            }}
          />
        )}
      </Modal>

      <Modal isOpen={modal === "new"} onClose={() => setModal(null)} title={t("Nouveau dossier de paiement")} size="lg">
        {modal === "new" && (
          <NewInstallmentForm
            customers={[...state.customers].sort((a, b) => a.name.localeCompare(b.name, "fr"))}
            onCancel={() => setModal(null)}
            onSubmit={(data) => {
              actions.createInstallment({ ...data, sellerId: currentUser.id });
              toast.success(t("Dossier créé"));
              setModal(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
