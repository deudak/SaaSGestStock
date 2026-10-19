import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FaCashRegister, FaExclamationTriangle, FaHistory, FaLock, FaWallet } from "react-icons/fa";
import { useStore } from "../../store/StoreContext";
import { Card, EmptyState, PageHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge, { Avatar } from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import StatCard from "../../components/ui/StatCard";
import { Select } from "../../components/ui/Form";
import { CashSummary, CloseCashForm } from "../../components/cash/CashForms";
import { PeriodPicker, usePeriod } from "../../components/accounting/AccountingUI";
import { cashSummary, sumBy } from "../../store/selectors";
import { formatDateTime, formatMoney, formatRelative } from "../../lib/format";
import { t } from "../../i18n/index.js";

/** Suivi des caisses de tous les vendeurs : caisses ouvertes, clôtures et écarts. */
export default function CashRegisters() {
  const { state, actions } = useStore();
  const period = usePeriod("month");
  const [seller, setSeller] = useState("all");
  const [detail, setDetail] = useState(null);
  const [closing, setClosing] = useState(null);

  const usersById = useMemo(() => Object.fromEntries(state.users.map((u) => [u.id, u])), [state.users]);
  const sessions = useMemo(() => state.cashSessions || [], [state.cashSessions]);
  const [now] = useState(() => Date.now());
  const open = sessions.filter((s) => s.status === "open").sort((a, b) => a.openedAt.localeCompare(b.openedAt));
  const closed = useMemo(
    () =>
      sessions
        .filter((s) => s.status === "closed" && new Date(s.closedAt) >= period.from && new Date(s.closedAt) <= period.to && (seller === "all" || s.sellerId === seller))
        .sort((a, b) => b.closedAt.localeCompare(a.closedAt)),
    [sessions, period.from, period.to, seller]
  );
  const shortages = sumBy(closed.filter((s) => s.difference < 0), (s) => -s.difference);
  const surpluses = sumBy(closed.filter((s) => s.difference > 0), (s) => s.difference);
  const withGap = closed.filter((s) => s.difference).length;
  const stale = open.filter((s) => now - new Date(s.openedAt).getTime() > 18 * 3600000);

  const detailSession = detail && sessions.find((s) => s.id === detail);
  const closingSession = closing && sessions.find((s) => s.id === closing);
  const sellers = state.users.filter((u) => u.role === "seller" || sessions.some((s) => s.sellerId === u.id));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t("Ventes")} title={t("Caisses")} description={t("Caisses ouvertes en ce moment, clôtures et écarts de caisse de chaque vendeur.")} actions={<PeriodPicker period={period} />} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard title={t("Caisses ouvertes")} value={open.length} icon={FaCashRegister} tone={stale.length ? "amber" : "blue"} hint={stale.length ? t("{0} ouverte(s) depuis plus de 18 h", [stale.length]) : t("En ce moment")} />
        <StatCard title={t("Clôtures")} value={closed.length} icon={FaHistory} tone="slate" hint={period.label} />
        <StatCard title={t("Manquants")} value={formatMoney(shortages)} icon={FaExclamationTriangle} tone={shortages ? "red" : "green"} hint={t("{0} clôture(s) avec écart", [withGap])} />
        <StatCard title={t("Excédents")} value={formatMoney(surpluses)} icon={FaWallet} tone="green" />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-900">{t("Caisses ouvertes")}</p>
        {open.length === 0 ? (
          <EmptyState icon={FaCashRegister} title={t("Aucune caisse ouverte")} description={t("Les vendeurs ouvrent leur caisse depuis le point de vente.")} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {open.map((s) => {
              const summary = cashSummary(s, state);
              const late = stale.includes(s);
              return (
                <Card key={s.id} className={late ? "border-amber-200" : ""}>
                  <div className="flex items-start gap-3">
                    <Avatar name={usersById[s.sellerId]?.name || "?"} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900">{usersById[s.sellerId]?.name || t("Vendeur")}</p>
                      <p className="text-xs text-slate-500">{t("Ouverte {0}", [formatRelative(s.openedAt)])}</p>
                    </div>
                    {late && <Badge tone="amber">{t("Non clôturée")}</Badge>}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[11px] text-slate-500">{t("Ventes")}</p>
                      <p className="tabular text-sm font-bold text-slate-900">
                        {summary.salesCount} · {formatMoney(summary.salesTotal)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[11px] text-slate-500">{t("Espèces attendues")}</p>
                      <p className="tabular text-sm font-bold text-slate-900">{formatMoney(summary.expected)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-1.5">
                    <Button size="sm" variant="secondary" className="flex-1" onClick={() => setDetail(s.id)}>
                      {t("Détail")}
                    </Button>
                    <Button size="sm" variant="dark" icon={FaLock} onClick={() => setClosing(s.id)}>
                      {t("Clôturer")}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold text-slate-900">{t("Historique des clôtures")}</p>
          <Select value={seller} onChange={(e) => setSeller(e.target.value)} className="w-48 py-2 text-sm" aria-label={t("Vendeur")}>
            <option value="all">{t("Tous vendeurs")}</option>
            {sellers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </div>
        {closed.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={FaHistory} title={t("Aucune clôture")} description={t("Aucune caisse clôturée sur cette période.")} />
          </div>
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-160 text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">{t("Vendeur")}</th>
                  <th className="px-4 py-3">{t("Ouverture")}</th>
                  <th className="px-4 py-3">{t("Clôture")}</th>
                  <th className="px-4 py-3 text-right">{t("Attendu")}</th>
                  <th className="px-4 py-3 text-right">{t("Compté")}</th>
                  <th className="px-4 py-3 text-right">{t("Écart")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {closed.map((s) => (
                  <tr key={s.id} className="cursor-pointer hover:bg-slate-50/60" onClick={() => setDetail(s.id)}>
                    <td className="px-4 py-3 font-medium text-slate-800">{usersById[s.sellerId]?.name || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDateTime(s.openedAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDateTime(s.closedAt)}</td>
                    <td className="tabular px-4 py-3 text-right">{formatMoney(s.expectedCash)}</td>
                    <td className="tabular px-4 py-3 text-right">{formatMoney(s.countedCash)}</td>
                    <td className={`tabular px-4 py-3 text-right font-semibold ${s.difference < 0 ? "text-rose-600" : s.difference > 0 ? "text-emerald-600" : "text-slate-900"}`}>
                      {s.difference > 0 ? "+" : ""}
                      {formatMoney(s.difference)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={Boolean(detailSession)} onClose={() => setDetail(null)} title={detailSession ? t("Caisse de {0}", [usersById[detailSession.sellerId]?.name || "—"]) : ""} size="lg">
        {detailSession && <CashSummary session={detailSession} summary={cashSummary(detailSession, state)} seller={usersById[detailSession.sellerId]} settings={state.settings} />}
      </Modal>
      <Modal isOpen={Boolean(closingSession)} onClose={() => setClosing(null)} title={closingSession ? t("Clôturer la caisse de {0}", [usersById[closingSession.sellerId]?.name || "—"]) : ""} description={t("À faire avec le vendeur : comptez les espèces présentes dans le tiroir.")} size="lg">
        {closingSession && (
          <CloseCashForm
            expected={cashSummary(closingSession, state).expected}
            onCancel={() => setClosing(null)}
            onSubmit={(data) => {
              actions.closeCashSession(closingSession.id, data);
              toast.success(t("Caisse clôturée"));
              setClosing(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
