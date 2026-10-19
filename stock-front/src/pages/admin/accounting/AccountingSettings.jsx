import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FaBook, FaDoorOpen, FaSave } from "react-icons/fa";
import { useStore } from "../../../store/StoreContext";
import { Card, CardHeader, PageHeader } from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import { Field, Input, SearchInput } from "../../../components/ui/Form";
import { useJournal } from "../../../components/accounting/AccountingUI";
import { ACCOUNT_OPTIONS, CLASSES, TREASURY_ACCOUNTS } from "../../../lib/accounting/chart";
import { formatMoney, matches } from "../../../lib/format";

import { locale, t } from "../../../i18n/index.js";

const FIELDS = ["accountingStart", "openingCash", "openingBank", "openingMobile", "openingPayables"];

/** Ouverture des comptes : date de départ et soldes connus à cette date. */
export default function AccountingSettings() {
  const { state, actions } = useStore();
  const [form, setForm] = useState(() => Object.fromEntries(FIELDS.map((f) => [f, state.settings[f] ?? ""])));
  const [search, setSearch] = useState("");
  const dirty = FIELDS.some((f) => String(form[f] ?? "") !== String(state.settings[f] ?? ""));

  // Aperçu du bilan d'ouverture calculé (stock et créances déduits des données)
  const { entries, start } = useJournal(undefined, undefined);
  const opening = entries.find((e) => e.source.type === "opening");
  const openingLine = (account) => opening?.lines.find((l) => l.account === account);

  const accounts = useMemo(() => ACCOUNT_OPTIONS.filter((a) => matches(search, a.code, a.name)), [search]);

  const save = (event) => {
    event.preventDefault();
    if (form.accountingStart && !/^\d{4}-\d{2}-\d{2}$/.test(form.accountingStart)) return toast.error(t("Date d'ouverture invalide."));
    actions.saveSettings({
      accountingStart: form.accountingStart || "",
      openingCash: Math.round(Number(form.openingCash)) || 0,
      openingBank: Math.round(Number(form.openingBank)) || 0,
      openingMobile: Math.round(Number(form.openingMobile)) || 0,
      openingPayables: Math.max(0, Math.round(Number(form.openingPayables)) || 0),
    });
    toast.success(t("Paramètres comptables enregistrés"));
  };

  return (
    <form onSubmit={save} className="space-y-6">
      <PageHeader
        eyebrow={t("Comptabilité")}
        title={t("Paramètres comptables")}
        description={t("Date d'ouverture des comptes et soldes de départ. Plan comptable OHADA (SYSCOHADA révisé).")}
        actions={
          <Button type="submit" icon={FaSave} disabled={!dirty}>{t("Enregistrer")}</Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader title={t("Ouverture des comptes")} subtitle={t("Ce que possédait et devait l'entreprise au premier jour")} icon={FaDoorOpen} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("Date d'ouverture")} hint={form.accountingStart ? t("Les opérations antérieures sont résumées dans le bilan d'ouverture.") : t("Non définie : première opération ({0}).", [start.toLocaleDateString(locale())])} className="sm:col-span-2">
              <Input type="date" value={form.accountingStart} onChange={(e) => setForm((p) => ({ ...p, accountingStart: e.target.value }))} />
            </Field>
            {TREASURY_ACCOUNTS.map((item) => (
              <Field key={item.setting} label={`${item.label} (${item.account})`} hint={t("Solde à la date d'ouverture (négatif si découvert)")}>
                <Input type="number" value={form[item.setting]} onChange={(e) => setForm((p) => ({ ...p, [item.setting]: e.target.value }))} suffix="F" />
              </Field>
            ))}
            <Field label={t("Dettes fournisseurs (401)")} hint={t("Factures fournisseurs restant à payer")}>
              <Input type="number" min="0" value={form.openingPayables} onChange={(e) => setForm((p) => ({ ...p, openingPayables: e.target.value }))} suffix="F" />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title={t("Bilan d'ouverture")} subtitle={t("Au {0} (enregistré)", [start.toLocaleDateString(locale())])} icon={FaBook} tone="slate" />
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span className="text-slate-600">{t("Stock de marchandises (31)")}</span>
              <span className="tabular font-semibold">{formatMoney(openingLine("31")?.debit || 0)}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-slate-600">{t("Créances clients (411)")}</span>
              <span className="tabular font-semibold">{formatMoney(openingLine("411")?.debit || 0)}</span>
            </li>
            {TREASURY_ACCOUNTS.map((item) => {
              const l = openingLine(item.account);
              return (
                <li key={item.account} className="flex justify-between">
                  <span className="text-slate-600">
                    {t(item.label)} ({item.account})
                  </span>
                  <span className="tabular font-semibold">{formatMoney((l?.debit || 0) - (l?.credit || 0))}</span>
                </li>
              );
            })}
            <li className="flex justify-between">
              <span className="text-slate-600">{t("Dettes fournisseurs (401)")}</span>
              <span className="tabular font-semibold">− {formatMoney(openingLine("401")?.credit || 0)}</span>
            </li>
            <li className="flex justify-between border-t border-slate-100 pt-2 font-bold">
              <span>{t("Capitaux propres (101)")}</span>
              <span className="tabular">{formatMoney((openingLine("101")?.credit || 0) - (openingLine("101")?.debit || 0))}</span>
            </li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">{t("Stock et créances sont calculés à partir des mouvements et des dossiers de paiement. Les capitaux propres équilibrent le bilan.")}</p>
        </Card>
      </div>

      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-slate-900">{t("Plan comptable OHADA (SYSCOHADA révisé)")}</p>
            <p className="text-xs text-slate-500">{t("Comptes utilisés par l'application. Tout autre numéro du plan peut être saisi dans les écritures manuelles.")}</p>
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder={t("Numéro ou intitulé…")} className="sm:max-w-xs" />
        </div>
        <div className="grid gap-x-8 p-4 lg:grid-cols-2">
          {Object.entries(CLASSES).map(([classNumber, className]) => {
            const rows = accounts.filter((a) => a.code[0] === classNumber);
            if (!rows.length) return null;
            return (
              <section key={classNumber} className="mb-5">
                <p className="mb-1.5 border-b border-slate-200 pb-1 text-xs font-bold uppercase tracking-wide text-slate-700">{t("Classe")}{" "}{classNumber}— {className}
                </p>
                <ul className="text-sm">
                  {rows.map((a) => (
                    <li key={a.code} className={`flex gap-3 py-0.5 ${a.level === 2 ? "mt-1.5 font-semibold text-slate-900" : "text-slate-600"}`} style={{ paddingLeft: `${(a.level - 2) * 14}px` }}>
                      <span className="tabular w-12 shrink-0">{a.code}</span>
                      <span>{a.name}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </Card>
    </form>
  );
}
