import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { FaCheck, FaEdit, FaFileInvoiceDollar, FaHandHoldingUsd, FaPlus, FaTools, FaTrash, FaTruck } from "react-icons/fa";
import { useStore } from "../../../store/StoreContext";
import { useConfirm } from "../../../components/ui/Confirm";
import { Card, EmptyState, PageHeader } from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Tabs from "../../../components/ui/Tabs";
import Modal from "../../../components/ui/Modal";
import StatCard from "../../../components/ui/StatCard";
import { Field, Input, SearchInput, Select, Textarea } from "../../../components/ui/Form";
import { AccountInput, PeriodPicker, usePeriod } from "../../../components/accounting/AccountingUI";
import { EXPENSE_CATEGORIES, EXPENSE_METHODS, accountName, isValidAccount } from "../../../lib/accounting/chart";
import { splitVat } from "../../../lib/accounting/engine";
import { downloadCSV, todayStamp } from "../../../lib/csv";
import { formatDate, formatMoney, matches, toDateInput } from "../../../lib/format";

import { t } from "../../../i18n/index.js";

const METHOD_LABELS = Object.fromEntries(EXPENSE_METHODS.map((m) => [m.id, m.label]));
const OTHER = "__other";

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

function ExpenseForm({ initial, suppliers, taxRate, onSubmit, onCancel }) {
  const known = EXPENSE_CATEGORIES.some((c) => c.account === initial.account);
  const [form, setForm] = useState({
    account: "6222",
    label: "",
    amount: "",
    vat: "",
    method: "cash",
    supplierId: "",
    reference: "",
    note: "",
    ...initial,
    category: initial.account && !known ? OTHER : initial.account || "6222",
    date: toDateInput(initial.date),
  });
  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  const account = form.category === OTHER ? form.account : form.category;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const amount = Math.round(Number(form.amount) || 0);
        const vat = Math.round(Number(form.vat) || 0);
        if (amount <= 0) return toast.error(t("Montant invalide."));
        if (vat > amount) return toast.error(t("La TVA ne peut pas dépasser le montant."));
        if (!isValidAccount(account) || !["6", "2"].includes(account[0])) return toast.error(t("Choisissez un compte de charge (classe 6) ou d'immobilisation (classe 2)."));
        if (form.method === "unpaid" && !form.supplierId) return toast.error(t("Indiquez le fournisseur à payer."));
        onSubmit({
          date: new Date(form.date).toISOString(),
          account,
          label: form.label.trim() || EXPENSE_CATEGORIES.find((c) => c.account === account)?.label || accountName(account),
          amount,
          vat,
          method: form.method,
          supplierId: form.supplierId || null,
          reference: form.reference.trim(),
          note: form.note.trim(),
          maintenanceHistoryId: form.maintenanceHistoryId || null,
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Nature de la dépense")} required>
          <Select value={form.category} onChange={set("category")}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.account} value={c.account}>
                {t(c.label)} ({c.account})
              </option>
            ))}
            <option value={OTHER}>{t("Autre compte…")}</option>
          </Select>
        </Field>
        {form.category === OTHER ? (
          <Field label={t("Compte")} hint={isValidAccount(form.account) ? accountName(form.account) : t("Classe 6 (charge) ou 2 (immobilisation)")} required>
            <AccountInput value={form.account} onChange={(value) => setForm((p) => ({ ...p, account: value }))} placeholder={t("Ex : 6055")} />
          </Field>
        ) : (
          <Field label={t("Date")} required>
            <Input type="date" value={form.date} onChange={set("date")} />
          </Field>
        )}
      </div>
      {form.category === OTHER && (
        <Field label={t("Date")} required>
          <Input type="date" value={form.date} onChange={set("date")} />
        </Field>
      )}
      <Field label={t("Libellé")}>
        <Input value={form.label} onChange={set("label")} placeholder={EXPENSE_CATEGORIES.find((c) => c.account === account)?.label || t("Ex : facture ENEO septembre")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Montant TTC")} required>
          <Input type="number" min="1" value={form.amount} onChange={set("amount")} suffix="F" />
        </Field>
        <Field
          label={t("dont TVA récupérable")}
          hint={
            taxRate > 0 ? (<button type="button" className="font-semibold text-brand-600 hover:underline" onClick={() => setForm((p) => ({ ...p, vat: String(splitVat(Number(p.amount) || 0, taxRate).vat) }))}>{t("Calculer à")}{" "}{taxRate}%
                            </button>) : t("0 si non assujetti")
          }
        >
          <Input type="number" min="0" value={form.vat} onChange={set("vat")} suffix="F" />
        </Field>
        <Field label={t("Règlement")} required>
          <Select value={form.method} onChange={set("method")}>
            {EXPENSE_METHODS.map((m) => (
              <option key={m.id} value={m.id}>
                {t(m.label)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("Fournisseur")} hint={form.method === "unpaid" ? t("Obligatoire pour une dépense à payer") : t("Facultatif")}>
          <Select value={form.supplierId || ""} onChange={set("supplierId")}>
            <option value="">—</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={t("N° de facture / pièce")}>
        <Input value={form.reference} onChange={set("reference")} placeholder={t("Ex : FAC-2026-118")} />
      </Field>
      <Field label={t("Note")}>
        <Textarea value={form.note} onChange={set("note")} rows={2} />
      </Field>
      <FormFooter onCancel={onCancel} />
    </form>
  );
}

function SupplierPaymentForm({ initial, suppliers, purchaseOrders, onSubmit, onCancel }) {
  const [form, setForm] = useState({ supplierId: "", purchaseOrderId: "", amount: "", method: "transfer", note: "", ...initial, date: toDateInput(initial.date) });
  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  const orders = purchaseOrders.filter((o) => o.status === "received" && (!form.supplierId || o.supplierId === form.supplierId));
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const amount = Math.round(Number(form.amount) || 0);
        if (!form.supplierId) return toast.error(t("Choisissez le fournisseur."));
        if (amount <= 0) return toast.error(t("Montant invalide."));
        onSubmit({ date: new Date(form.date).toISOString(), supplierId: form.supplierId, purchaseOrderId: form.purchaseOrderId || null, amount, method: form.method, note: form.note.trim() });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Fournisseur")} required>
          <Select value={form.supplierId} onChange={set("supplierId")}>
            <option value="">—</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("Bon de commande")} hint={t("Facultatif")}>
          <Select value={form.purchaseOrderId || ""} onChange={set("purchaseOrderId")}>
            <option value="">—</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.id} · {formatMoney(o.items.reduce((s, i) => s + i.qty * i.cost, 0))}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("Date")} required>
          <Input type="date" value={form.date} onChange={set("date")} />
        </Field>
        <Field label={t("Montant")} required>
          <Input type="number" min="1" value={form.amount} onChange={set("amount")} suffix="F" />
        </Field>
        <Field label={t("Payé par")} required>
          <Select value={form.method} onChange={set("method")}>
            {EXPENSE_METHODS.filter((m) => m.id !== "unpaid").map((m) => (
              <option key={m.id} value={m.id}>
                {t(m.label)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={t("Note")}>
        <Input value={form.note} onChange={set("note")} placeholder={t("Ex : acompte, solde facture…")} />
      </Field>
      <FormFooter onCancel={onCancel} label={t("Enregistrer le règlement")} />
    </form>
  );
}

export default function AccountingExpenses() {
  const { state, actions } = useStore();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "expenses";
  const setTab = (value) => setParams(value === "expenses" ? {} : { tab: value }, { replace: true });
  const period = usePeriod("month");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // { type: "expense" | "payment", data }

  const suppliers = state.suppliers;
  const supplierName = (id) => suppliers.find((s) => s.id === id)?.name || "—";
  const inPeriod = (date) => new Date(date) >= period.from && new Date(date) <= period.to;

  const expenses = useMemo(
    () => (state.expenses || []).filter((e) => inPeriod(e.date) && matches(search, e.label, e.reference, e.note, accountName(e.account))).sort((a, b) => b.date.localeCompare(a.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.expenses, period.from, period.to, search]
  );
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const byCategory = useMemo(() => {
    const map = new Map();
    for (const e of expenses) map.set(e.account, (map.get(e.account) || 0) + e.amount);
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [expenses]);

  // Soldes fournisseurs : réceptions + dépenses à payer − règlements
  const supplierBalances = useMemo(
    () =>
      suppliers
        .map((s) => {
          const purchases = state.purchaseOrders.filter((o) => o.supplierId === s.id && o.status === "received").reduce((sum, o) => sum + o.items.reduce((item, i) => item + i.qty * i.cost, 0), 0);
          const unpaid = (state.expenses || []).filter((e) => e.supplierId === s.id && e.method === "unpaid").reduce((sum, e) => sum + e.amount, 0);
          const paid = (state.supplierPayments || []).filter((p) => p.supplierId === s.id).reduce((sum, p) => sum + p.amount, 0);
          return { ...s, purchases: purchases + unpaid, paid, due: purchases + unpaid - paid };
        })
        .filter((s) => s.purchases || s.paid)
        .sort((a, b) => b.due - a.due),
    [suppliers, state.purchaseOrders, state.expenses, state.supplierPayments]
  );
  const payments = (state.supplierPayments || []).filter((p) => inPeriod(p.date)).sort((a, b) => b.date.localeCompare(a.date));

  const posted = new Set((state.expenses || []).map((e) => e.maintenanceHistoryId).filter(Boolean));
  const maintenanceToPost = state.maintenanceHistory.filter((h) => h.cost > 0 && !posted.has(h.id)).sort((a, b) => b.date.localeCompare(a.date));

  const close = () => setModal(null);
  const remove = async (kind, record) => {
    const ok = await confirm({ title: t("Supprimer cette écriture ?"), message: `${record.label || supplierName(record.supplierId)} — ${formatMoney(record.amount)}`, confirmLabel: t("Supprimer") });
    if (!ok) return;
    if (kind === "expense") actions.deleteExpense(record.id);
    else actions.deleteSupplierPayment(record.id);
    toast.success(t("Supprimé"));
  };

  const exportExpenses = () =>
    downloadCSV(`depenses-${todayStamp()}`, expenses, [
      { label: t("Date"), value: (e) => formatDate(e.date) },
      { label: t("Compte"), value: (e) => e.account },
      { label: t("Intitulé du compte"), value: (e) => accountName(e.account) },
      { label: t("Libellé"), value: (e) => e.label },
      { label: t("Montant TTC"), value: (e) => e.amount },
      { label: t("TVA"), value: (e) => e.vat || 0 },
      { label: t("Règlement"), value: (e) => METHOD_LABELS[e.method] },
      { label: t("Fournisseur"), value: (e) => (e.supplierId ? supplierName(e.supplierId) : "") },
      { label: t("Pièce"), value: (e) => e.reference || "" },
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("Comptabilité")}
        title={t("Dépenses et fournisseurs")}
        description={t("Charges de la boutique, dettes et règlements fournisseurs. Chaque saisie génère son écriture comptable.")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={FaHandHoldingUsd} onClick={() => setModal({ type: "payment", data: {} })}>{t("Régler un fournisseur")}</Button>
            <Button icon={FaPlus} onClick={() => setModal({ type: "expense", data: {} })}>{t("Nouvelle dépense")}</Button>
          </div>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "expenses", label: t("Dépenses"), icon: FaFileInvoiceDollar },
            { value: "suppliers", label: t("Fournisseurs"), icon: FaTruck, count: supplierBalances.filter((s) => s.due > 0).length },
            { value: "maintenance", label: t("Maintenance"), icon: FaTools, count: maintenanceToPost.length },
          ]}
        />
        {tab !== "maintenance" && <PeriodPicker period={period} />}
      </div>

      {tab === "expenses" && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard title={t("Total des dépenses")} value={formatMoney(total)} icon={FaFileInvoiceDollar} tone="amber" hint={t("{0} saisie(s) · {1}", [expenses.length, period.label])} />
            {byCategory.map(([account, value]) => (
              <StatCard key={account} title={EXPENSE_CATEGORIES.find((c) => c.account === account)?.label || accountName(account)} value={formatMoney(value)} icon={FaFileInvoiceDollar} tone="slate" hint={t("Compte {0}", [account])} />
            ))}
          </div>
          <Card padded={false}>
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <SearchInput value={search} onChange={setSearch} placeholder={t("Libellé, pièce, compte…")} className="sm:max-w-xs" />
              <Button size="sm" variant="secondary" onClick={exportExpenses} disabled={!expenses.length}>{t("Exporter (Excel)")}</Button>
            </div>
            {expenses.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={FaFileInvoiceDollar} title={t("Aucune dépense sur la période")} description={t("Loyer, électricité, salaires, transport : enregistrez chaque dépense pour un résultat juste.")} />
              </div>
            ) : (
              <div className="scrollbar-thin overflow-x-auto">
                <table className="w-full min-w-160 text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">{t("Date")}</th>
                      <th className="px-4 py-3">{t("Libellé")}</th>
                      <th className="px-4 py-3">{t("Compte")}</th>
                      <th className="px-4 py-3">{t("Règlement")}</th>
                      <th className="px-4 py-3 text-right">{t("Montant")}</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expenses.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50/60">
                        <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(e.date)}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">{t(e.label)}</p>
                          {(e.reference || e.supplierId) && (
                            <p className="text-xs text-slate-500">
                              {[e.reference, e.supplierId && supplierName(e.supplierId)].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          <span className="tabular font-semibold">{e.account}</span> {accountName(e.account)}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">{METHOD_LABELS[e.method]}</td>
                        <td className="tabular px-4 py-3 text-right font-semibold text-slate-900">
                          {formatMoney(e.amount)}
                          {e.vat > 0 && <p className="text-[11px] font-normal text-slate-500">{t("dont TVA")}{" "}{formatMoney(e.vat)}</p>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <Button size="icon-sm" variant="ghost" onClick={() => setModal({ type: "expense", data: e })} aria-label={t("Modifier")}>
                            <FaEdit size={12} />
                          </Button>
                          <Button size="icon-sm" variant="danger-ghost" onClick={() => remove("expense", e)} aria-label={t("Supprimer")}>
                            <FaTrash size={11} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {tab === "suppliers" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card padded={false}>
            <div className="border-b border-slate-100 p-4">
              <p className="font-semibold text-slate-900">{t("Soldes fournisseurs")}</p>
              <p className="text-xs text-slate-500">{t("Marchandises reçues et factures à payer, moins les règlements (toutes périodes).")}</p>
            </div>
            {supplierBalances.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={FaTruck} title={t("Aucune dette fournisseur")} description={t("Les réceptions de bons de commande apparaîtront ici.")} />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {supplierBalances.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{s.name}</p>
                      <p className="text-xs text-slate-500">{t("Achats")}{" "}{formatMoney(s.purchases)}{" "}{t("· Réglé")}{" "}{formatMoney(s.paid)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`tabular font-bold ${s.due > 0 ? "text-amber-600" : "text-emerald-600"}`}>{formatMoney(s.due)}</p>
                      {s.due > 0 && (
                        <button type="button" className="text-xs font-semibold text-brand-600 hover:underline" onClick={() => setModal({ type: "payment", data: { supplierId: s.id, amount: String(s.due) } })}>{t("Régler")}</button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {Number(state.settings.openingPayables) > 0 && (
              <p className="border-t border-slate-100 p-4 text-xs text-slate-500">{t("Dettes d'ouverture non détaillées par fournisseur :")}{" "}{formatMoney(state.settings.openingPayables)}.
                              </p>
            )}
          </Card>
          <Card padded={false}>
            <div className="border-b border-slate-100 p-4">
              <p className="font-semibold text-slate-900">{t("Règlements ·")}{" "}{t(period.label)}</p>
            </div>
            {payments.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={FaHandHoldingUsd} title={t("Aucun règlement")} description={t("Enregistrez les paiements faits à vos fournisseurs.")} />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 p-4 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800">{supplierName(p.supplierId)}</p>
                      <p className="text-xs text-slate-500">
                        {formatDate(p.date)} · {METHOD_LABELS[p.method]}
                        {p.purchaseOrderId ? ` · ${p.purchaseOrderId}` : ""}
                        {p.note ? ` · ${p.note}` : ""}
                      </p>
                    </div>
                    <p className="tabular font-semibold text-slate-900">{formatMoney(p.amount)}</p>
                    <Button size="icon-sm" variant="ghost" onClick={() => setModal({ type: "payment", data: p })} aria-label={t("Modifier")}>
                      <FaEdit size={12} />
                    </Button>
                    <Button size="icon-sm" variant="danger-ghost" onClick={() => remove("payment", p)} aria-label={t("Supprimer")}>
                      <FaTrash size={11} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === "maintenance" && (
        <Card padded={false}>
          <div className="border-b border-slate-100 p-4">
            <p className="font-semibold text-slate-900">{t("Interventions de maintenance à comptabiliser")}</p>
            <p className="text-xs text-slate-500">{t("Les coûts saisis par les maintenanciers ne sont pas encore des dépenses : vérifiez-les puis comptabilisez-les (compte 624).")}</p>
          </div>
          {maintenanceToPost.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={FaTools} title={t("Tout est comptabilisé")} description={t("Aucun coût de maintenance en attente.")} />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {maintenanceToPost.map((h) => (
                <li key={h.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium text-slate-800">
                      {h.product} — {h.action}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(h.date)} · {h.technician}
                      {h.note ? ` · ${h.note}` : ""}
                    </p>
                  </div>
                  <p className="tabular font-semibold text-slate-900">{formatMoney(h.cost)}</p>
                  <Button
                    size="sm"
                    icon={FaCheck}
                    onClick={() =>
                      setModal({ type: "expense", data: { account: "624", label: t("Maintenance — {0} : {1}", [h.product, h.action]), amount: String(h.cost), date: h.date, note: h.note || "", maintenanceHistoryId: h.id } })
                    }
                  >{t("Comptabiliser")}</Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Modal isOpen={modal?.type === "expense"} onClose={close} title={modal?.data?.id ? t("Modifier la dépense") : t("Nouvelle dépense")} size="lg">
        {modal?.type === "expense" && (
          <ExpenseForm
            initial={modal.data}
            suppliers={suppliers}
            taxRate={Number(state.settings.taxRate) || 0}
            onCancel={close}
            onSubmit={(data) => {
              actions.saveExpense(modal.data.id ? { ...data, id: modal.data.id } : data);
              toast.success(t("Dépense enregistrée"));
              close();
            }}
          />
        )}
      </Modal>
      <Modal isOpen={modal?.type === "payment"} onClose={close} title={modal?.data?.id ? t("Modifier le règlement") : t("Règlement fournisseur")}>
        {modal?.type === "payment" && (
          <SupplierPaymentForm
            initial={modal.data}
            suppliers={suppliers}
            purchaseOrders={state.purchaseOrders}
            onCancel={close}
            onSubmit={(data) => {
              actions.saveSupplierPayment(modal.data.id ? { ...data, id: modal.data.id } : data);
              toast.success(t("Règlement enregistré"));
              close();
            }}
          />
        )}
      </Modal>
    </div>
  );
}
