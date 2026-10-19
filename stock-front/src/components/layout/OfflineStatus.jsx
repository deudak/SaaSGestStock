import toast from "react-hot-toast";
import { FaDownload, FaExclamationTriangle, FaSignOutAlt, FaSyncAlt, FaWifi } from "react-icons/fa";
import { OFFLINE_LIMIT_DAYS, OFFLINE_WARNING_DAYS, useConnectivity } from "../../store/ConnectivityContext";
import { useStore } from "../../store/StoreContext";
import Button from "../ui/Button";

import { locale, t } from "../../i18n/index.js";

const formatSync = (date) =>
  date ? date.toLocaleString(locale(), { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "jamais";

const plural = (n) => `${n} jour${n > 1 ? "s" : ""}`;

/**
 * Pastille d'état dans l'en-tête : en ligne / hors ligne + jours restants, et modifications
 * en attente d'envoi. Un clic relance la vérification et la synchronisation.
 */
export function ConnectivityBadge({ sync }) {
  const { ready, online, checking, daysLeft, lastSync, checkNow } = useConnectivity();
  if (!ready) return null;

  const pending = sync?.pending || 0;
  const busy = checking || sync?.syncing;
  const warning = !online && daysLeft <= OFFLINE_WARNING_DAYS;
  const tone = online ? (pending ? "bg-sky-50 text-sky-700" : "bg-emerald-50 text-emerald-700") : warning ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700";
  const dot = online ? (pending ? "bg-sky-500" : "bg-emerald-500") : warning ? "bg-rose-500" : "bg-amber-500";
  const label = online ? (pending ? t("Envoi · {0}", [pending]) : t("Synchronisé")) : t("Hors ligne");
  const details = [
    t("Dernier contact avec le serveur : {0}", [formatSync(lastSync)]),
    pending ? t(pending > 1 ? "{0} modifications en attente d'envoi" : "{0} modification en attente d'envoi", [pending]) : t("Aucune modification en attente"),
  ].join(" — ");

  return (
    <button
      type="button"
      onClick={async () => {
        if (await checkNow()) sync?.syncNow();
      }}
      disabled={busy}
      title={t("{0}. Cliquer pour synchroniser.", [details])}
      className={`inline-flex h-8 items-center gap-2 rounded-full px-3 text-xs font-semibold transition hover:brightness-95 ${tone}`}
    >
      <span className={`h-2 w-2 rounded-full ${dot} ${busy ? "animate-pulse" : ""}`} />
      {online ? (
        label
      ) : (
        <span>
          {label}
          <span className="hidden sm:inline">
            {" "}
            · {plural(daysLeft)}
            {pending ? t(" · {0} en attente", [pending]) : ""}
          </span>
        </span>
      )}
    </button>
  );
}

/** Alerte affichée quand la fin de la période hors ligne approche. */
export function OfflineBanner() {
  const { ready, online, daysLeft, expired } = useConnectivity();
  if (!ready || online || expired || daysLeft > OFFLINE_WARNING_DAYS) return null;

  return (
    <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800 sm:px-6 lg:px-8">
      <FaExclamationTriangle className="shrink-0" size={13} />
      <p>{t("Mode hors ligne : il reste")}{" "}<strong>{plural(daysLeft)}</strong>{" "}{t("avant le verrouillage de l'application. Connectez-vous à internet pour synchroniser.")}</p>
    </div>
  );
}

/** Écran bloquant une fois la période hors ligne dépassée. Les données restent intactes. */
export function OfflineLock({ onLogout }) {
  const { checking, checkNow, lastSync, clockTampered } = useConnectivity();
  const { actions } = useStore();

  const retry = async () => {
    if (await checkNow()) toast.success(t("Connexion rétablie"));
    else toast.error(t("Serveur toujours injoignable"));
  };

  const backup = () => {
    const blob = new Blob([actions.exportData()], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `sauvegarde-dym-stock-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-pop">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <FaWifi size={20} />
        </span>
        <h1 className="mt-4 text-lg font-bold text-slate-900">{t("Connexion requise")}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {clockTampered ? t("La date de cet appareil est antérieure à la dernière utilisation. Corrigez la date du système ou connectez-vous à internet.") : t("L'application a fonctionné hors ligne pendant plus de {0} jours. Connectez-vous à internet pour continuer.", [OFFLINE_LIMIT_DAYS])}
        </p>
        <p className="mt-1 text-xs text-slate-500">{t("Dernière synchronisation :")}{" "}{formatSync(lastSync)}{t(". Vos données sont conservées sur cet appareil.")}</p>
        <div className="mt-6 flex flex-col gap-2">
          <Button icon={FaSyncAlt} onClick={retry} disabled={checking}>
            {checking ? t("Vérification…") : t("Réessayer la connexion")}
          </Button>
          <Button variant="secondary" icon={FaDownload} onClick={backup}>{t("Télécharger une sauvegarde")}</Button>
          <Button variant="ghost" icon={FaSignOutAlt} onClick={onLogout}>{t("Déconnexion")}</Button>
        </div>
      </div>
    </div>
  );
}
