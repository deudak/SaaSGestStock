import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FaBook, FaCheck, FaChevronDown, FaChevronRight, FaEdit, FaExchangeAlt, FaPlus, FaPrint, FaTimes, FaTrash } from "react-icons/fa";
import { useStore } from "../../../store/StoreContext";
import { useConfirm } from "../../../components/ui/Confirm";
import { Card, EmptyState, PageHeader } from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import Tabs from "../../../components/ui/Tabs";
import Modal from "../../../components/ui/Modal";
import { Field, Input, SearchInput, Select } from "../../../components/ui/Form";
import { AccountInput, PeriodPicker, amount, useJournal, usePeriod } from "../../../components/accounting/AccountingUI";
import { JOURNALS, TREASURY_ACCOUNTS, accountName, isValidAccount } from "../../../lib/accounting/chart";
import { downloadCSV, todayStamp } from "../../../lib/csv";
import { escapeHtml, printAccountingReport } from "../../../lib/print";
import { formatDate, formatMoney, matches, toDateInput } from "../../../lib/format";

import { localized, t } from "../../../i18n/index.js";

const SOURCE_LABELS = localized({
  opening: "Ouverture",
  sale: "Vente",
  installment: "Créance",
  purchaseOrder: "Réception",
  expense: "Dépense",
  supplierPayment: "Règlement",
  journalEntry: "Saisie manuelle",
  stock: "Inventaire",
  cashSession: "Caisse",
});

const emptyLine = () => ({ account: "", label: "", debit: "", credit: "" });

/** Saisie d'une écriture manuelle à plusieurs lignes, refusée tant qu'elle n'est pas équilibrée. */
function EntryForm({ initial, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    journal: "OD",
    label: "",
    reference: "",
    ...initial,
    date: toDateInput(initial.date),
    lines: initial.lines?.length ? initial.lines.map((l) => ({ ...l, debit: l.debit ? String(l.debit) : "", credit: l.credit ? String(l.credit) : "" })) : [emptyLine(), emptyLine()],
  });
  const setLine = (index, field, value) => setForm((p) => ({ ...p, lines: p.lines.map((l, i) => (i === index ? { ...l, [field]: value, ...(field === "debit" && value ? { credit: "" } : field === "credit" && value ? { debit: "" } : {}) } : l)) }));
  const debit = form.lines.reduce((s, l) => s + (Math.round(Number(l.debit)) || 0), 0);
  const credit = form.lines.reduce((s, l) => s + (Math.round(Number(l.credit)) || 0), 0);
  const balanced = debit > 0 && debit === credit;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.label.trim()) return toast.error(t("Libellé obligatoire."));
        const lines = form.lines
          .filter((l) => l.account || Number(l.debit) || Number(l.credit))
          .map((l) => ({ account: l.account, label: l.label.trim(), debit: Math.round(Number(l.debit)) || 0, credit: Math.round(Number(l.credit)) || 0 }));
        if (lines.length < 2) return toast.error(t("Une écriture a au moins deux lignes."));
        if (lines.some((l) => !isValidAccount(l.account))) return toast.error(t("Numéro de compte invalide sur une ligne."));
        if (lines.some((l) => (l.debit > 0) === (l.credit > 0))) return toast.error(t("Chaque ligne a un montant au débit ou au crédit."));
        if (!balanced) return toast.error(t("L'écriture n'est pas équilibrée."));
        onSubmit({ date: new Date(form.date).toISOString(), journal: form.journal, label: form.label.trim(), reference: form.reference.trim(), lines });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("Date")} required>
          <Input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
        </Field>
        <Field label={t("Journal")}>
          <Select value={form.journal} onChange={(e) => setForm((p) => ({ ...p, journal: e.target.value }))}>
            {Object.entries(JOURNALS).map(([code, name]) => (
              <option key={code} value={code}>
                {code} — {name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("Pièce")}>
          <Input value={form.reference} onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))} placeholder={t("N° de pièce")} />
        </Field>
      </div>
      <Field label={t("Libellé")} required>
        <Input value={form.label} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} placeholder={t("Ex : Apport en capital, emprunt, virement caisse → banque")} />
      </Field>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-140 text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">{t("Compte")}</th>
              <th className="px-3 py-2">{t("Libellé de ligne")}</th>
              <th className="w-32 px-3 py-2 text-right">{t("Débit")}</th>
              <th className="w-32 px-3 py-2 text-right">{t("Crédit")}</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {form.lines.map((l, i) => (
              <tr key={i}>
                <td className="px-2 py-1.5">
                  <AccountInput value={l.account} onChange={(value) => setLine(i, "account", value)} className="py-1.5 text-sm" />
                  {isValidAccount(l.account) && <p className="mt-0.5 truncate px-1 text-[11px] text-slate-500">{accountName(l.account)}</p>}
                </td>
                <td className="px-2 py-1.5">
                  <Input value={l.label} onChange={(e) => setLine(i, "label", e.target.value)} className="py-1.5 text-sm" />
                </td>
                <td className="px-2 py-1.5">
                  <Input type="number" min="0" value={l.debit} onChange={(e) => setLine(i, "debit", e.target.value)} className="py-1.5 text-right text-sm" />
                </td>
                <td className="px-2 py-1.5">
                  <Input type="number" min="0" value={l.credit} onChange={(e) => setLine(i, "credit", e.target.value)} className="py-1.5 text-right text-sm" />
                </td>
                <td className="px-1">
                  {form.lines.length > 2 && (
                    <button type="button" onClick={() => setForm((p) => ({ ...p, lines: p.lines.filter((_, j) => j !== i) }))} className="rounded p-1 text-slate-400 hover:text-rose-600" aria-label={t("Retirer la ligne")}>
                      <FaTimes size={11} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50 text-sm font-semibold">
              <td className="px-3 py-2" colSpan={2}>
                <button type="button" className="text-xs font-semibold text-brand-600 hover:underline" onClick={() => setForm((p) => ({ ...p, lines: [...p.lines, emptyLine()] }))}>{t("+ Ajouter une ligne")}</button>
              </td>
              <td className="tabular px-3 py-2 text-right">{amount(debit, { blankZero: false })}</td>
              <td className="tabular px-3 py-2 text-right">{amount(credit, { blankZero: false })}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className={`text-xs font-medium ${balanced ? "text-emerald-600" : "text-amber-600"}`}>
        {balanced ? t("Écriture équilibrée.") : t("Écart : {0} — le total des débits doit égaler celui des crédits.", [formatMoney(Math.abs(debit - credit))])}
      </p>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>{t("Annuler")}</Button>
        <Button type="submit" icon={FaCheck} disabled={!balanced}>{t("Enregistrer l'écriture")}</Button>
      </div>
    </form>
  );
}

/** Virement interne (caisse → banque, Mobile Money → caisse…) : écriture prête à l'emploi. */
function TransferForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({ from: "571", to: "521", amount: "", date: toDateInput() });
  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));
  const label = (code) => TREASURY_ACCOUNTS.find((item) => item.account === code)?.label;
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const value = Math.round(Number(form.amount)) || 0;
        if (form.from === form.to) return toast.error(t("Choisissez deux comptes différents."));
        if (value <= 0) return toast.error(t("Montant invalide."));
        onSubmit({
          date: new Date(form.date).toISOString(),
          journal: "TR",
          label: t("Virement {0} → {1}", [label(form.from), label(form.to)]),
          reference: "",
          lines: [
            { account: form.to, label: "", debit: value, credit: 0 },
            { account: form.from, label: "", debit: 0, credit: value },
          ],
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {["from", "to"].map((field) => (
          <Field key={field} label={field === "from" ? t("De") : t("Vers")}>
            <Select value={form[field]} onChange={set(field)}>
              {TREASURY_ACCOUNTS.map((item) => (
                <option key={item.account} value={item.account}>
                  {t(item.label)} ({item.account})
                </option>
              ))}
            </Select>
          </Field>
        ))}
        <Field label={t("Montant")} required>
          <Input type="number" min="1" value={form.amount} onChange={set("amount")} suffix="F" />
        </Field>
        <Field label={t("Date")}>
          <Input type="date" value={form.date} onChange={set("date")} />
        </Field>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>{t("Annuler")}</Button>
        <Button type="submit" icon={FaCheck}>{t("Enregistrer le virement")}</Button>
      </div>
    </form>
  );
}

export default function AccountingJournal() {
  const { state, actions } = useStore();
  const confirm = useConfirm();
  const period = usePeriod("month");
  const { entries } = useJournal(period.from, period.to);
  const [journal, setJournal] = useState("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(() => new Set());
  const [modal, setModal] = useState(null); // { type: "entry" | "transfer", data }

  const list = useMemo(
    () =>
      entries.filter(
        (e) =>
          new Date(e.date) >= period.from &&
          (journal === "all" || e.journal === journal) &&
          matches(search, e.label, e.ref, e.number, ...e.lines.map((l) => l.account))
      ),
    [entries, period.from, journal, search]
  );
  const totals = list.reduce((item, e) => ({ debit: item.debit + e.debit, credit: item.credit + e.credit }), { debit: 0, credit: 0 });
  const toggle = (id) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const manual = (entry) => entry.source.type === "journalEntry" && (state.journalEntries || []).find((j) => j.id === entry.source.id);

  const exportCsv = () =>
    downloadCSV(
      `journal-${todayStamp()}`,
      list.flatMap((e) => e.lines.map((l) => ({ e, l }))),
      [
        { label: "N°", value: ({ e }) => e.number },
        { label: t("Date"), value: ({ e }) => formatDate(e.date) },
        { label: t("Journal"), value: ({ e }) => e.journal },
        { label: t("Pièce"), value: ({ e }) => e.ref },
        { label: t("Compte"), value: ({ l }) => l.account },
        { label: t("Intitulé du compte"), value: ({ l }) => accountName(l.account) },
        { label: t("Libellé"), value: ({ e, l }) => l.label || e.label },
        { label: t("Débit"), value: ({ l }) => l.debit || "" },
        { label: t("Crédit"), value: ({ l }) => l.credit || "" },
      ]
    );

  const print = () => {
    const rows = list
      .map(
        (e) =>
          `<tr class="sub"><td>${e.number}</td><td>${formatDate(e.date)}</td><td colspan="2">${escapeHtml(e.label)}</td><td></td><td></td></tr>` +
          e.lines.map((l) => `<tr><td></td><td></td><td>${l.account}</td><td>${escapeHtml(accountName(l.account))}</td><td class="r">${amount(l.debit)}</td><td class="r">${amount(l.credit)}</td></tr>`).join("")
      )
      .join("");
    printAccountingReport(
      "Journal général",
      t("Période : {0}", [period.label]) + (journal !== "all" ? ` · ${JOURNALS[journal]}` : ""),
      `<table><thead><tr><th>N°</th><th>Date</th><th>Compte</th><th>Libellé</th><th class="r">Débit</th><th class="r">Crédit</th></tr></thead><tbody>${rows}</tbody>
       <tfoot><tr class="total"><td colspan="4">Totaux</td><td class="r">${amount(totals.debit)}</td><td class="r">${amount(totals.credit)}</td></tr></tfoot></table>`,
      state.settings
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("Comptabilité")}
        title={t("Journal")}
        description={t("Toutes les écritures : générées automatiquement à partir des ventes, encaissements, achats et dépenses, et saisies manuelles.")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={FaExchangeAlt} onClick={() => setModal({ type: "transfer" })}>{t("Virement interne")}</Button>
            <Button icon={FaPlus} onClick={() => setModal({ type: "entry", data: {} })}>{t("Écriture manuelle")}</Button>
          </div>
        }
      />

      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between">
          <Tabs
            value={journal}
            onChange={setJournal}
            size="sm"
            options={[{ value: "all", label: t("Tous") }, ...Object.entries(JOURNALS).map(([value, label]) => ({ value, label: `${value} · ${label.split(" (")[0]}` }))]}
          />
          <div className="flex flex-wrap items-center gap-2">
            <PeriodPicker period={period} />
            <SearchInput value={search} onChange={setSearch} placeholder={t("Libellé, pièce, compte…")} className="w-56" />
            <Button size="sm" variant="secondary" icon={FaPrint} onClick={print} disabled={!list.length}>{t("Imprimer")}</Button>
            <Button size="sm" variant="secondary" onClick={exportCsv} disabled={!list.length}>{t("Excel")}</Button>
          </div>
        </div>

        {list.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={FaBook} title={t("Aucune écriture")} description={t("Aucune écriture sur cette période.")} />
          </div>
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-180 text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="w-8 px-3 py-3" />
                  <th className="px-3 py-3">{t("N°")}</th>
                  <th className="px-3 py-3">{t("Date")}</th>
                  <th className="px-3 py-3">{t("Libellé")}</th>
                  <th className="px-3 py-3">{t("Origine")}</th>
                  <th className="px-3 py-3 text-right">{t("Montant")}</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {list.map((entry) => {
                  const expanded = open.has(entry.id);
                  const editable = manual(entry);
                  return [
                    <tr key={entry.id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50/60" onClick={() => toggle(entry.id)}>
                      <td className="px-3 py-3 text-slate-400">{expanded ? <FaChevronDown size={10} /> : <FaChevronRight size={10} />}</td>
                      <td className="tabular whitespace-nowrap px-3 py-3 text-xs font-semibold text-slate-600">{entry.number}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-500">{formatDate(entry.date)}</td>
                      <td className="px-3 py-3 font-medium text-slate-800">
                        {t(entry.label)}
                        {entry.ref && <span className="ml-2 text-xs font-normal text-slate-400">{entry.ref}</span>}
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={entry.source.type === "journalEntry" ? "violet" : "slate"}>{SOURCE_LABELS[entry.source.type]}</Badge>
                      </td>
                      <td className="tabular whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-900">{formatMoney(entry.debit)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {editable && (
                          <>
                            <Button size="icon-sm" variant="ghost" onClick={() => setModal({ type: "entry", data: editable })} aria-label={t("Modifier")}>
                              <FaEdit size={12} />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="danger-ghost"
                              aria-label={t("Supprimer")}
                              onClick={async () => {
                                if (await confirm({ title: t("Supprimer cette écriture ?"), message: entry.label, confirmLabel: t("Supprimer") })) {
                                  actions.deleteJournalEntry(editable.id);
                                  toast.success(t("Écriture supprimée"));
                                }
                              }}
                            >
                              <FaTrash size={11} />
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>,
                    expanded &&
                      entry.lines.map((l, i) => (
                        <tr key={`${entry.id}-${i}`} className="bg-slate-50/70 text-xs">
                          <td />
                          <td />
                          <td className="tabular px-3 py-1.5 font-semibold text-slate-700">{l.account}</td>
                          <td className="px-3 py-1.5 text-slate-600" colSpan={2}>
                            {accountName(l.account)}
                            {l.label && <span className="text-slate-400"> · {t(l.label)}</span>}
                          </td>
                          <td className="tabular px-3 py-1.5 text-right text-slate-700">
                            {l.debit ? `D ${amount(l.debit)}` : `C ${amount(l.credit)}`}
                          </td>
                          <td />
                        </tr>
                      )),
                  ];
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 text-sm font-bold">
                  <td colSpan={5} className="px-3 py-3">
                    {list.length}{" "}{t("écriture(s) — total débit = total crédit")}</td>
                  <td className="tabular px-3 py-3 text-right">{formatMoney(totals.debit)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={modal?.type === "entry"} onClose={() => setModal(null)} title={modal?.data?.id ? t("Modifier l'écriture") : t("Écriture manuelle")} size="lg">
        {modal?.type === "entry" && (
          <EntryForm
            initial={modal.data}
            onCancel={() => setModal(null)}
            onSubmit={(data) => {
              actions.saveJournalEntry(modal.data.id ? { ...data, id: modal.data.id } : data);
              toast.success(t("Écriture enregistrée"));
              setModal(null);
            }}
          />
        )}
      </Modal>
      <Modal isOpen={modal?.type === "transfer"} onClose={() => setModal(null)} title={t("Virement interne")} description={t("Dépôt de la caisse en banque, retrait, transfert Mobile Money…")}>
        {modal?.type === "transfer" && (
          <TransferForm
            onCancel={() => setModal(null)}
            onSubmit={(data) => {
              actions.saveJournalEntry(data);
              toast.success(t("Virement enregistré"));
              setModal(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
