import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FaBan, FaCashRegister, FaFileExport, FaFileInvoice, FaReceipt, FaChevronRight } from "react-icons/fa";
import { useStore } from "../../store/StoreContext";
import { Card, EmptyState, InfoRow, PageHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge, { Avatar } from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import { Field, Input, SearchInput, Select, Textarea } from "../../components/ui/Form";
import { addDays, formatDateTime, formatMoney, isSameDay, matches, startOfDay, toDateInput } from "../../lib/format";
import { downloadCSV, todayStamp } from "../../lib/csv";
import { printReceipt, printSaleInvoice } from "../../lib/print";
import { INSTALLMENT_STATUS, PAYMENT_LABELS, installmentPaid, installmentStatus, sumBy } from "../../store/selectors";

import { t } from "../../i18n/index.js";

const PERIODS = [
  { value: "today", label: "Aujourd'hui" },
  { value: "7", label: "7 derniers jours" },
  { value: "30", label: "30 derniers jours" },
  { value: "90", label: "90 derniers jours" },
  { value: "all", label: "Toute la période" },
  { value: "custom", label: "Personnalisée…" },
];

function SaleStatus({ sale, installment }) {
  if (sale.status === "cancelled") return <Badge tone="slate">{t("Annulée")}</Badge>;
  if (sale.mode === "credit" && installment) {
    const st = INSTALLMENT_STATUS[installmentStatus(installment)];
    return <Badge tone={st.tone} dot>{t(st.label)}</Badge>;
  }
  return <Badge tone="green" dot>{t("Payée")}</Badge>;
}

export default function Sales() {
  const { state, actions, currentUser } = useStore();
  const isAdmin = currentUser.role === "admin";
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("30");
  const [from, setFrom] = useState(toDateInput(addDays(new Date(), -30)));
  const [to, setTo] = useState(toDateInput());
  const [method, setMethod] = useState("all");
  const [mode, setMode] = useState("all");
  const [status, setStatus] = useState("all");
  const [seller, setSeller] = useState("all");
  const [limit, setLimit] = useState(30);
  const [selectedId, setSelectedId] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const usersById = useMemo(() => Object.fromEntries(state.users.map((u) => [u.id, u])), [state.users]);
  const installmentsById = useMemo(() => Object.fromEntries(state.installments.map((i) => [i.id, i])), [state.installments]);
  const sellers = state.users.filter((u) => u.role === "seller");

  const filtered = useMemo(() => {
    let start = null;
    let end = null;
    if (period === "today") start = startOfDay();
    else if (period === "custom") {
      start = from ? startOfDay(from) : null;
      end = to ? addDays(startOfDay(to), 1) : null;
    } else if (period !== "all") start = addDays(startOfDay(), -Number(period) + 1);

    return state.sales.filter((sale) => {
      const date = new Date(sale.date);
      if (!isAdmin && sale.sellerId !== currentUser.id) return false;
      if (isAdmin && seller !== "all" && sale.sellerId !== seller) return false;
      if (start && date < start) return false;
      if (end && date >= end) return false;
      if (method !== "all" && sale.method !== method) return false;
      if (mode !== "all" && sale.mode !== mode) return false;
      if (status === "cancelled" && sale.status !== "cancelled") return false;
      if (status === "completed" && sale.status === "cancelled") return false;
      if (status === "unpaid") {
        const inst = installmentsById[sale.installmentId];
        if (!inst || sale.status === "cancelled" || installmentStatus(inst) === "paid") return false;
      }
      return matches(search, sale.id, sale.customerName, ...sale.items.map((i) => i.name));
    });
  }, [state.sales, period, from, to, method, mode, status, seller, search, isAdmin, currentUser.id, installmentsById]);

  const valid = filtered.filter((s) => s.status !== "cancelled");
  const totals = {
    revenue: sumBy(valid, (s) => s.total),
    paid: sumBy(valid, (s) => (s.installmentId && installmentsById[s.installmentId] ? installmentPaid(installmentsById[s.installmentId]) : s.paid)),
  };

  const selected = state.sales.find((s) => s.id === selectedId);
  const selectedInstallment = selected?.installmentId ? installmentsById[selected.installmentId] : null;
  const selectedCustomer = selected?.customerId ? state.customers.find((c) => c.id === selected.customerId) : null;
  const canCancel = selected && selected.status !== "cancelled" && (isAdmin || (selected.sellerId === currentUser.id && isSameDay(selected.date, new Date())));

  const exportSales = () =>
    downloadCSV(`ventes-${todayStamp()}`, filtered, [
      { label: "N°", value: (s) => s.id },
      { label: t("Date"), value: (s) => formatDateTime(s.date) },
      { label: t("Client"), value: (s) => s.customerName },
      { label: t("Vendeur"), value: (s) => usersById[s.sellerId]?.name || "" },
      { label: t("Articles"), value: (s) => s.items.map((i) => `${i.qty}x ${i.name}`).join(" | ") },
      { label: t("Remise"), value: (s) => s.discount || 0 },
      { label: t("Total"), value: (s) => s.total },
      { label: t("Encaissé"), value: (s) => (s.installmentId && installmentsById[s.installmentId] ? installmentPaid(installmentsById[s.installmentId]) : s.paid) },
      { label: t("Paiement"), value: (s) => PAYMENT_LABELS[s.method] },
      { label: t("Type"), value: (s) => (s.mode === "credit" ? t("Échelonné") : t("Comptant")) },
      { label: t("Statut"), value: (s) => (s.status === "cancelled" ? t("Annulée") : t("Validée")) },
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("Ventes")}
        title={isAdmin ? t("Toutes les ventes") : t("Mes ventes")}
        description={t("Historique, factures, tickets et annulations.")}
        actions={
          <>
            <Button variant="secondary" icon={FaFileExport} onClick={exportSales}>{t("Exporter")}</Button>
            {!isAdmin && (
              <Button to="/seller/pos" icon={FaCashRegister}>{t("Nouvelle vente")}</Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: t("Ventes"), value: valid.length },
          { label: t("Chiffre d'affaires"), value: formatMoney(totals.revenue) },
          { label: t("Encaissé"), value: formatMoney(totals.paid), tone: "text-emerald-600" },
          { label: t("Reste dû"), value: formatMoney(totals.revenue - totals.paid), tone: totals.revenue - totals.paid > 0 ? "text-amber-600" : "" },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-card">
            <p className="text-xs font-medium text-slate-500">{t(item.label)}</p>
            <p className={`tabular mt-0.5 truncate text-lg font-bold text-slate-900 ${item.tone || ""}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <Card padded={false}>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]">
          <SearchInput value={search} onChange={setSearch} placeholder={t("N°, client, produit…")} className="sm:col-span-2 lg:col-span-1" />
          <Select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label={t("Période")}>
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {t(p.label)}
              </option>
            ))}
          </Select>
          <Select value={method} onChange={(e) => setMethod(e.target.value)} aria-label={t("Mode de paiement")}>
            <option value="all">{t("Tous paiements")}</option>
            {Object.entries(PAYMENT_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t("Statut")}>
            <option value="all">{t("Tous statuts")}</option>
            <option value="completed">{t("Validées")}</option>
            <option value="unpaid">{t("Non soldées")}</option>
            <option value="cancelled">{t("Annulées")}</option>
          </Select>
          {isAdmin ? (
            <Select value={seller} onChange={(e) => setSeller(e.target.value)} aria-label={t("Vendeur")}>
              <option value="all">{t("Tous vendeurs")}</option>
              {sellers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          ) : (
            <Select value={mode} onChange={(e) => setMode(e.target.value)} aria-label={t("Type de vente")}>
              <option value="all">{t("Comptant et échelonné")}</option>
              <option value="cash">{t("Comptant")}</option>
              <option value="credit">{t("Échelonné")}</option>
            </Select>
          )}
          {period === "custom" && (
            <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-5 lg:max-w-md">
              <Field label={t("Du")}>
                <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label={t("Au")}>
                <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
              </Field>
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={FaReceipt} title={t("Aucune vente")} description={t("Aucune vente ne correspond à ces critères.")} />
          </div>
        ) : (
          <>
            <div className="scrollbar-thin hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">{t("Vente")}</th>
                    <th className="px-4 py-3">{t("Client")}</th>
                    {isAdmin && <th className="hidden px-4 py-3 xl:table-cell">{t("Vendeur")}</th>}
                    <th className="px-4 py-3">{t("Paiement")}</th>
                    <th className="px-4 py-3 text-right">{t("Montant")}</th>
                    <th className="px-4 py-3">{t("Statut")}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.slice(0, limit).map((sale) => (
                    <tr key={sale.id} onClick={() => setSelectedId(sale.id)} className="cursor-pointer hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <p className="font-mono text-[13px] font-semibold text-slate-900">{sale.id}</p>
                        <p className="text-xs text-slate-500">{formatDateTime(sale.date)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="max-w-56 truncate font-medium text-slate-800">{t(sale.customerName)}</p>
                        <p className="max-w-56 truncate text-xs text-slate-500">
                          {sale.items.reduce((s, i) => s + i.qty, 0)}{" "}{t("article(s) ·")}{" "}{sale.items[0]?.name}
                          {sale.items.length > 1 && "…"}
                        </p>
                      </td>
                      {isAdmin && <td className="hidden px-4 py-3 text-slate-600 xl:table-cell">{usersById[sale.sellerId]?.name || "—"}</td>}
                      <td className="px-4 py-3 text-slate-600">
                        {PAYMENT_LABELS[sale.method]}
                        {sale.mode === "credit" && <p className="text-xs text-amber-600">{t("Échelonné")}</p>}
                      </td>
                      <td className={`tabular px-4 py-3 text-right font-semibold ${sale.status === "cancelled" ? "text-slate-400 line-through" : "text-slate-900"}`}>{formatMoney(sale.total)}</td>
                      <td className="px-4 py-3">
                        <SaleStatus sale={sale} installment={installmentsById[sale.installmentId]} />
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        <FaChevronRight size={11} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-slate-100 md:hidden">
              {filtered.slice(0, limit).map((sale) => (
                <li key={sale.id}>
                  <button type="button" onClick={() => setSelectedId(sale.id)} className="flex w-full items-center gap-3 p-4 text-left">
                    <Avatar name={sale.customerName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{t(sale.customerName)}</p>
                      <p className="truncate text-xs text-slate-500">
                        {sale.id} · {formatDateTime(sale.date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`tabular text-sm font-semibold ${sale.status === "cancelled" ? "text-slate-400 line-through" : "text-slate-900"}`}>{formatMoney(sale.total)}</p>
                      <SaleStatus sale={sale} installment={installmentsById[sale.installmentId]} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
              <span>
                {Math.min(limit, filtered.length)}{" "}{t("sur")}{" "}{filtered.length}{" "}{t("vente(s)")}</span>
              {filtered.length > limit && (
                <Button size="sm" variant="secondary" onClick={() => setLimit((l) => l + 30)}>{t("Afficher plus")}</Button>
              )}
            </div>
          </>
        )}
      </Card>

      <Modal
        isOpen={Boolean(selected)}
        onClose={() => {
          setSelectedId(null);
          setCancelling(false);
        }}
        title={selected ? t("Vente {0}", [selected.id]) : ""}
        description={selected ? formatDateTime(selected.date) : ""}
        size="lg"
        footer={
          selected &&
          !cancelling && (
            <>
              {canCancel && (
                <Button variant="danger-ghost" icon={FaBan} onClick={() => setCancelling(true)} className="sm:mr-auto">{t("Annuler la vente")}</Button>
              )}
              <Button variant="secondary" icon={FaReceipt} onClick={() => printReceipt(selected, { settings: state.settings, seller: usersById[selected.sellerId] })}>{t("Ticket")}</Button>
              <Button icon={FaFileInvoice} onClick={() => printSaleInvoice(selected, { settings: state.settings, customer: selectedCustomer, seller: usersById[selected.sellerId], installment: selectedInstallment })}>{t("Facture")}</Button>
            </>
          )
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Avatar name={selected.customerName} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{t(selected.customerName)}</p>
                <p className="text-xs text-slate-500">
                  {selectedCustomer?.phone || t("Client non enregistré")}{" "}{t("· Vendeur :")}{" "}{usersById[selected.sellerId]?.name || "—"}
                </p>
              </div>
              <SaleStatus sale={selected} installment={selectedInstallment} />
            </div>

            {selected.status === "cancelled" && (
              <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">{t("Annulée le")}{" "}{formatDateTime(selected.cancelledAt)}— {selected.cancelReason}{t(". Les articles ont été remis en stock.")}</div>
            )}

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">{t("Article")}</th>
                    <th className="px-3 py-2 text-center">{t("Qté")}</th>
                    <th className="px-3 py-2 text-right">{t("P.U.")}</th>
                    <th className="px-3 py-2 text-right">{t("Total")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selected.items.map((item) => (
                    <tr key={item.productId}>
                      <td className="px-3 py-2.5 text-slate-800">{item.name}</td>
                      <td className="tabular px-3 py-2.5 text-center">{item.qty}</td>
                      <td className="tabular px-3 py-2.5 text-right text-slate-600">{formatMoney(item.price)}</td>
                      <td className="tabular px-3 py-2.5 text-right font-semibold">{formatMoney(item.qty * item.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ml-auto max-w-xs">
              <InfoRow label={t("Sous-total")}>{formatMoney(selected.subtotal)}</InfoRow>
              {selected.discount > 0 && <InfoRow label={t("Remise")}>− {formatMoney(selected.discount)}</InfoRow>}
              <InfoRow label={t("Total")} strong>
                {formatMoney(selected.total)}
              </InfoRow>
              <InfoRow label={t("Payé ({0})", [PAYMENT_LABELS[selected.method]])}>{formatMoney(selectedInstallment ? installmentPaid(selectedInstallment) : selected.paid)}</InfoRow>
              {selectedInstallment && <InfoRow label={t("Dossier d'échelonnement")}>{selectedInstallment.id}</InfoRow>}
            </div>

            {cancelling && (
              <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50/50 p-4">
                <p className="text-sm font-semibold text-rose-800">{t("Annuler cette vente ?")}</p>
                <p className="text-xs text-rose-700">{t("Les articles seront remis en stock")}{selectedInstallment ? t(" et le dossier d'échelonnement sera clôturé") : ""}{t(". Cette action est irréversible.")}</p>
                <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={2} placeholder={t("Motif de l'annulation (obligatoire)")} />
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setCancelling(false)}>{t("Retour")}</Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={FaBan}
                    disabled={!cancelReason.trim()}
                    onClick={() => {
                      actions.cancelSale(selected.id, cancelReason.trim());
                      toast.success(t("Vente {0} annulée, stock réintégré", [selected.id]));
                      setCancelling(false);
                      setCancelReason("");
                    }}
                  >{t("Confirmer l'annulation")}</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
