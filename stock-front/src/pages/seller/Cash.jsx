import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FaCashRegister, FaExchangeAlt, FaHistory, FaLock, FaLockOpen } from "react-icons/fa";
import { useStore } from "../../store/StoreContext";
import { Card, CardHeader, EmptyState, PageHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import { CashMovementForm, CashSummary, CloseCashForm, OpenCashForm } from "../../components/cash/CashForms";
import { cashSummary, openCashSession } from "../../store/selectors";
import { formatDateTime, formatMoney, formatRelative } from "../../lib/format";
import { t } from "../../i18n/index.js";

/** Caisse du vendeur : ouverture, mouvements, clôture et historique de ses sessions. */
export default function SellerCash() {
  const { state, actions, currentUser } = useStore();
  const [modal, setModal] = useState(null); // "open" | "movement" | "close"
  const [detail, setDetail] = useState(null);

  const sessions = useMemo(() => (state.cashSessions || []).filter((s) => s.sellerId === currentUser.id).sort((a, b) => b.openedAt.localeCompare(a.openedAt)), [state.cashSessions, currentUser.id]);
  const current = openCashSession(state.cashSessions, currentUser.id);
  const summary = useMemo(() => (current ? cashSummary(current, state) : null), [current, state]);
  const history = sessions.filter((s) => s.status === "closed");
  // Proposition : le même fond de caisse que la dernière fois
  const lastFloat = history[0]?.openingFloat || 0;
  const detailSession = detail && sessions.find((s) => s.id === detail);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow={t("Mon activité")}
        title={t("Ma caisse")}
        description={t("Ouvrez votre caisse en début de journée, enregistrez les versements et dépenses, puis comptez les espèces à la fermeture.")}
        actions={
          current ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={FaExchangeAlt} onClick={() => setModal("movement")}>
                {t("Mouvement de caisse")}
              </Button>
              <Button variant="dark" icon={FaLock} onClick={() => setModal("close")}>
                {t("Clôturer la caisse")}
              </Button>
            </div>
          ) : (
            <Button icon={FaLockOpen} onClick={() => setModal("open")}>
              {t("Ouvrir la caisse")}
            </Button>
          )
        }
      />

      {current ? (
        <Card>
          <CardHeader title={t("Caisse ouverte")} subtitle={t("Depuis {0} ({1})", [formatDateTime(current.openedAt), formatRelative(current.openedAt)])} icon={FaCashRegister} tone="green" />
          <CashSummary session={current} summary={summary} seller={currentUser} settings={state.settings} />
        </Card>
      ) : (
        <EmptyState
          icon={FaCashRegister}
          title={t("Caisse fermée")}
          description={t("Ouvrez la caisse avec le fond de caisse présent dans le tiroir pour commencer à vendre.")}
          action={
            <Button icon={FaLockOpen} onClick={() => setModal("open")}>
              {t("Ouvrir la caisse")}
            </Button>
          }
        />
      )}

      <Card padded={false}>
        <div className="border-b border-slate-100 p-4">
          <CardHeader title={t("Mes caisses précédentes")} icon={FaHistory} tone="slate" className="mb-0" />
        </div>
        {history.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={FaHistory} title={t("Aucune caisse clôturée")} description={t("Vos clôtures de caisse apparaîtront ici.")} />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {history.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => setDetail(s.id)} className="flex w-full items-center gap-3 p-4 text-left text-sm hover:bg-slate-50/60">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-slate-800">{formatDateTime(s.openedAt)}</span>
                    <span className="block text-xs text-slate-500">{t("Compté {0} · attendu {1}", [formatMoney(s.countedCash), formatMoney(s.expectedCash)])}</span>
                  </span>
                  <Badge tone={s.difference ? "red" : "green"}>{s.difference ? `${s.difference > 0 ? "+" : ""}${formatMoney(s.difference)}` : t("Juste")}</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal isOpen={modal === "open"} onClose={() => setModal(null)} title={t("Ouvrir la caisse")}>
        {modal === "open" && (
          <OpenCashForm
            suggestedFloat={lastFloat}
            onCancel={() => setModal(null)}
            onSubmit={(amount) => {
              actions.openCashSession(amount);
              toast.success(t("Caisse ouverte"));
              setModal(null);
            }}
          />
        )}
      </Modal>
      <Modal isOpen={modal === "movement" && Boolean(current)} onClose={() => setModal(null)} title={t("Mouvement de caisse")}>
        {modal === "movement" && current && (
          <CashMovementForm
            expected={summary.expected}
            onCancel={() => setModal(null)}
            onSubmit={(movement) => {
              actions.addCashMovement(current.id, movement);
              toast.success(t("Mouvement enregistré"));
              setModal(null);
            }}
          />
        )}
      </Modal>
      <Modal isOpen={modal === "close" && Boolean(current)} onClose={() => setModal(null)} title={t("Clôturer la caisse")} description={t("Comptez les espèces présentes dans le tiroir.")} size="lg">
        {modal === "close" && current && (
          <CloseCashForm
            expected={summary.expected}
            onCancel={() => setModal(null)}
            onSubmit={(data) => {
              actions.closeCashSession(current.id, data);
              toast.success(data.countedCash === data.expectedCash ? t("Caisse clôturée : le compte est juste") : t("Caisse clôturée avec un écart de {0}", [formatMoney(data.countedCash - data.expectedCash)]));
              setModal(null);
            }}
          />
        )}
      </Modal>
      <Modal isOpen={Boolean(detailSession)} onClose={() => setDetail(null)} title={t("Caisse du {0}", [detailSession ? formatDateTime(detailSession.openedAt) : ""])} size="lg">
        {detailSession && <CashSummary session={detailSession} summary={cashSummary(detailSession, state)} seller={currentUser} settings={state.settings} />}
      </Modal>
    </div>
  );
}
