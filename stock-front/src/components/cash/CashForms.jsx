import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FaCheck, FaLock, FaPrint } from "react-icons/fa";
import Button from "../ui/Button";
import { Field, Input, Select, Textarea } from "../ui/Form";
import { CASH_DENOMINATIONS, CASH_MOVEMENT_TYPES, PAYMENT_LABELS } from "../../store/selectors";
import { formatDateTime, formatMoney } from "../../lib/format";
import { printCashReport } from "../../lib/print";
import { t } from "../../i18n/index.js";

function Footer({ onCancel, label, icon = FaCheck, variant }) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
      {onCancel && (
        <Button variant="secondary" onClick={onCancel}>
          {t("Annuler")}
        </Button>
      )}
      <Button type="submit" icon={icon} variant={variant}>
        {label}
      </Button>
    </div>
  );
}

/** Ouverture : fond de caisse présent dans le tiroir. */
export function OpenCashForm({ onSubmit, onCancel, suggestedFloat = 0 }) {
  const [amount, setAmount] = useState(suggestedFloat ? String(suggestedFloat) : "");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (amount === "" || Number(amount) < 0) return toast.error(t("Indiquez le fond de caisse (0 si vide)."));
        onSubmit(Number(amount));
      }}
    >
      <Field label={t("Fond de caisse")} hint={t("Espèces présentes dans le tiroir au moment de l'ouverture (monnaie).")} required>
        <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} suffix="F" autoFocus />
      </Field>
      <Footer onCancel={onCancel} label={t("Ouvrir la caisse")} />
    </form>
  );
}

/** Mouvement de caisse : versement en banque, petite dépense, apport. */
export function CashMovementForm({ onSubmit, onCancel, expected }) {
  const [form, setForm] = useState({ type: "deposit", amount: "", reason: "" });
  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const amount = Math.round(Number(form.amount)) || 0;
        if (amount <= 0) return toast.error(t("Montant invalide."));
        if (form.type !== "in" && amount > expected) return toast.error(t("Montant supérieur aux espèces en caisse ({0}).", [formatMoney(expected)]));
        if (form.type === "expense" && !form.reason.trim()) return toast.error(t("Précisez l'objet de la dépense."));
        onSubmit({ ...form, amount, reason: form.reason.trim() });
      }}
    >
      <Field label={t("Type de mouvement")}>
        <Select value={form.type} onChange={set("type")}>
          {["deposit", "expense", "in"].map((type) => (
            <option key={type} value={type}>
              {CASH_MOVEMENT_TYPES[type]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("Montant")} hint={form.type !== "in" ? t("Espèces en caisse : {0}", [formatMoney(expected)]) : undefined} required>
        <Input type="number" min="1" value={form.amount} onChange={set("amount")} suffix="F" />
      </Field>
      <Field label={form.type === "expense" ? t("Objet de la dépense") : t("Motif")} required={form.type === "expense"}>
        <Input value={form.reason} onChange={set("reason")} placeholder={form.type === "deposit" ? t("Ex : versement Afriland, bordereau n°…") : form.type === "expense" ? t("Ex : carburant groupe, ramette de papier") : t("Ex : monnaie apportée par le gérant")} />
      </Field>
      <Footer onCancel={onCancel} label={t("Enregistrer le mouvement")} />
    </form>
  );
}

/** Clôture : comptage des espèces (billet par billet ou montant total) et écart. */
export function CloseCashForm({ expected, onSubmit, onCancel }) {
  const [byCount, setByCount] = useState(true);
  const [counts, setCounts] = useState({});
  const [total, setTotal] = useState("");
  const [note, setNote] = useState("");
  const counted = useMemo(
    () => (byCount ? CASH_DENOMINATIONS.reduce((sum, value) => sum + value * (Number(counts[value]) || 0), 0) : Math.round(Number(total)) || 0),
    [byCount, counts, total]
  );
  const difference = counted - expected;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (difference !== 0 && !note.trim()) return toast.error(t("Expliquez l'écart de caisse dans la note."));
        const denominations = byCount ? Object.fromEntries(Object.entries(counts).filter(([, n]) => Number(n) > 0).map(([value, n]) => [value, Number(n)])) : null;
        onSubmit({ countedCash: counted, expectedCash: expected, denominations, note: note.trim() });
      }}
    >
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-sm">
        {[
          [true, t("Compter billet par billet")],
          [false, t("Saisir le total")],
        ].map(([value, label]) => (
          <button key={String(value)} type="button" onClick={() => setByCount(value)} className={`flex-1 rounded-lg px-3 py-2 font-medium ${byCount === value ? "bg-white text-slate-900 shadow-card" : "text-slate-500"}`}>
            {label}
          </button>
        ))}
      </div>

      {byCount ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {CASH_DENOMINATIONS.map((value) => (
            <label key={value} className="rounded-xl border border-slate-200 p-2">
              <span className="block text-[11px] font-semibold text-slate-500">{formatMoney(value)}</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={counts[value] ?? ""}
                onChange={(e) => setCounts((c) => ({ ...c, [value]: e.target.value }))}
                className="tabular mt-1 w-full rounded-md border-0 bg-slate-50 px-2 py-1 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="0"
                aria-label={t("Nombre de {0}", [formatMoney(value)])}
              />
            </label>
          ))}
        </div>
      ) : (
        <Field label={t("Espèces comptées")}>
          <Input type="number" min="0" value={total} onChange={(e) => setTotal(e.target.value)} suffix="F" autoFocus />
        </Field>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[11px] text-slate-500">{t("Attendu")}</p>
          <p className="tabular text-sm font-bold text-slate-900">{formatMoney(expected)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[11px] text-slate-500">{t("Compté")}</p>
          <p className="tabular text-sm font-bold text-slate-900">{formatMoney(counted)}</p>
        </div>
        <div className={`rounded-xl p-3 ${difference === 0 ? "bg-emerald-50" : "bg-rose-50"}`}>
          <p className="text-[11px] text-slate-500">{t("Écart")}</p>
          <p className={`tabular text-sm font-bold ${difference === 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {difference > 0 ? "+" : ""}
            {formatMoney(difference)}
          </p>
        </div>
      </div>

      <Field label={t("Note")} hint={difference !== 0 ? t("Obligatoire en cas d'écart : erreur de rendu de monnaie, billet faux…") : undefined} required={difference !== 0}>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </Field>
      <Footer onCancel={onCancel} label={t("Clôturer la caisse")} icon={FaLock} variant="dark" />
    </form>
  );
}

/** Récapitulatif d'une session : encaissements par moyen, espèces attendues, mouvements. */
export function CashSummary({ session, summary, seller, settings }) {
  const closed = session.status === "closed";
  const rows = [
    [t("Fond de caisse"), session.openingFloat || 0],
    [t("Espèces encaissées"), summary.byMethod.cash],
    summary.cashIn ? [t("Apports"), summary.cashIn] : null,
    summary.deposits ? [t("Versements en banque"), -summary.deposits] : null,
    summary.expenses ? [t("Petites dépenses"), -summary.expenses] : null,
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          [t("Ventes"), summary.salesCount],
          [t("Chiffre d'affaires"), formatMoney(summary.salesTotal)],
          [t("Total encaissé"), formatMoney(summary.collected)],
          [closed ? t("Écart") : t("Espèces attendues"), closed ? `${session.difference > 0 ? "+" : ""}${formatMoney(session.difference)}` : formatMoney(summary.expected)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] text-slate-500">{label}</p>
            <p className={`tabular mt-0.5 truncate text-sm font-bold ${closed && label === t("Écart") && session.difference ? "text-rose-600" : "text-slate-900"}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("Encaissements")}</p>
          <ul className="space-y-1 text-sm">
            {Object.entries(summary.byMethod).map(([method, value]) => (
              <li key={method} className="flex justify-between">
                <span className="text-slate-600">{PAYMENT_LABELS[method]}</span>
                <span className="tabular font-semibold text-slate-900">{formatMoney(value)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("Espèces")}</p>
          <ul className="space-y-1 text-sm">
            {rows.map(([label, value]) => (
              <li key={label} className="flex justify-between">
                <span className="text-slate-600">{label}</span>
                <span className="tabular font-semibold text-slate-900">{formatMoney(value)}</span>
              </li>
            ))}
            <li className="flex justify-between border-t border-slate-100 pt-1 font-bold">
              <span>{t("Espèces attendues")}</span>
              <span className="tabular">{formatMoney(closed ? session.expectedCash : summary.expected)}</span>
            </li>
            {closed && (
              <li className="flex justify-between font-bold">
                <span>{t("Espèces comptées")}</span>
                <span className="tabular">{formatMoney(session.countedCash)}</span>
              </li>
            )}
          </ul>
        </div>
      </div>

      {(session.movements || []).length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("Mouvements de caisse")}</p>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 text-sm">
            {session.movements.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <span className="font-medium text-slate-800">{CASH_MOVEMENT_TYPES[m.type]}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {formatDateTime(m.at)}
                    {m.reason ? ` · ${m.reason}` : ""}
                  </span>
                </span>
                <span className={`tabular shrink-0 font-semibold ${m.type === "in" ? "text-emerald-600" : "text-slate-900"}`}>
                  {m.type === "in" ? "+" : "−"} {formatMoney(m.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {session.note && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{session.note}</p>}

      <Button size="sm" variant="secondary" icon={FaPrint} onClick={() => printCashReport(session, summary, { settings, seller })}>
        {closed ? t("Imprimer le rapport de clôture") : t("Imprimer l'état de caisse")}
      </Button>
    </div>
  );
}
