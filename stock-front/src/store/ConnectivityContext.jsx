/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { readValue, writeValue } from "../lib/db";
import { API_URL } from "../lib/api";

import { t } from "../i18n/index.js";

// Mode hors ligne : l'application fonctionne sans réseau pendant OFFLINE_LIMIT_DAYS jours
// après le dernier contact avec le serveur. Passé ce délai, elle se verrouille
// (les données restent intactes) jusqu'à la prochaine connexion.

export const OFFLINE_LIMIT_DAYS = 30;
export const OFFLINE_WARNING_DAYS = 7;

const LEASE_KEY = "offlineLease";
const DAY = 24 * 60 * 60 * 1000;
const CHECK_INTERVAL = 60 * 1000;
// Tolérance avant de considérer que l'horloge du poste a été reculée
const CLOCK_TOLERANCE = DAY;

const ConnectivityContext = createContext(null);

async function pingServer() {
  try {
    const response = await fetch(`${API_URL}/api/ping`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    return response.ok;
  } catch {
    return false;
  }
}

export function ConnectivityProvider({ children }) {
  // lastSync : dernier contact réussi avec le serveur ; lastSeen : date la plus récente observée sur ce poste
  const [lease, setLease] = useState(null);
  const [online, setOnline] = useState(false);
  const [checking, setChecking] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const leaseRef = useRef(null);

  const saveLease = useCallback((next) => {
    leaseRef.current = next;
    setLease(next);
    writeValue(LEASE_KEY, next).catch(() => {});
  }, []);

  const checkNow = useCallback(async () => {
    setChecking(true);
    const reachable = navigator.onLine && (await pingServer());
    const current = Date.now();
    setOnline(reachable);
    setNow(current);
    if (reachable) {
      saveLease({ lastSync: current, lastSeen: current });
    } else if (leaseRef.current && current > leaseRef.current.lastSeen) {
      saveLease({ ...leaseRef.current, lastSeen: current });
    }
    setChecking(false);
    return reachable;
  }, [saveLease]);

  useEffect(() => {
    let active = true;
    readValue(LEASE_KEY).then((saved) => {
      if (!active) return;
      const current = Date.now();
      // Premier lancement : l'application vient d'être chargée depuis le serveur
      saveLease(saved?.lastSync ? saved : { lastSync: current, lastSeen: current });
      checkNow();
    });

    const interval = setInterval(checkNow, CHECK_INTERVAL);
    const onVisible = () => document.visibilityState === "visible" && checkNow();
    const onOffline = () => setOnline(false);
    window.addEventListener("online", checkNow);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("online", checkNow);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [checkNow, saveLease]);

  const value = useMemo(() => {
    if (!lease) {
      return { ready: false, online, checking, checkNow, expired: false, clockTampered: false, daysLeft: OFFLINE_LIMIT_DAYS, lastSync: null };
    }
    const clockTampered = now < lease.lastSeen - CLOCK_TOLERANCE;
    const elapsed = Math.max(now, lease.lastSeen) - lease.lastSync;
    const remaining = OFFLINE_LIMIT_DAYS * DAY - elapsed;
    return {
      ready: true,
      online,
      checking,
      checkNow,
      lastSync: new Date(lease.lastSync),
      daysLeft: Math.max(0, Math.ceil(remaining / DAY)),
      expired: !online && (remaining <= 0 || clockTampered),
      clockTampered,
    };
  }, [lease, online, checking, checkNow, now]);

  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
}

export function useConnectivity() {
  const context = useContext(ConnectivityContext);
  if (!context) throw new Error(t("useConnectivity doit être utilisé dans <ConnectivityProvider>"));
  return context;
}
