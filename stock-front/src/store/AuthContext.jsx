/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { apiRequest } from "../lib/api";
import { readValue, writeValue } from "../lib/db";
import { useConnectivity } from "./ConnectivityContext";

import { t } from "../i18n/index.js";

// Session de l'utilisateur : jeton API + utilisateur + entreprise (nom, logo, paramètres).
// Tout est conservé sur l'appareil pour fonctionner hors ligne ; l'entreprise détermine
// quelles données locales sont chargées (une base par entreprise).

const SESSION_KEY = "session";
const CREDENTIALS_KEY = "offlineCredentials";

const AuthContext = createContext(null);

// ---- Connexion hors ligne : empreinte PBKDF2 du mot de passe (jamais le mot de passe lui-même) ----
const toHex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 150000 }, key, 256);
  return toHex(bits);
}

const canHash = () => Boolean(globalThis.crypto?.subtle);

async function rememberCredentials(email, password, session) {
  if (!canHash()) return;
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const all = (await readValue(CREDENTIALS_KEY)) || {};
  all[email.trim().toLowerCase()] = { salt, hash: await hashPassword(password, salt), session };
  await writeValue(CREDENTIALS_KEY, all).catch(() => {});
}

async function updateRememberedSession(email, session) {
  const all = (await readValue(CREDENTIALS_KEY)) || {};
  const entry = all[email.trim().toLowerCase()];
  if (!entry) return;
  all[email.trim().toLowerCase()] = { ...entry, session };
  await writeValue(CREDENTIALS_KEY, all).catch(() => {});
}

async function forgetCredentials(email) {
  const all = (await readValue(CREDENTIALS_KEY)) || {};
  delete all[email.trim().toLowerCase()];
  await writeValue(CREDENTIALS_KEY, all).catch(() => {});
}

const ACCOUNTING_KEYS = ["accountingStart", "openingCash", "openingBank", "openingMobile", "openingPayables"];
const accountingSettings = (settings) => Object.fromEntries(ACCOUNTING_KEYS.map((key) => [key, settings[key]]));

/** Convertit les paramètres du front (state.settings) en payload PUT /company. */
export function settingsToCompanyPayload(settings) {
  const { shopName, logo, ...rest } = settings;
  return { name: shopName, logo: logo || null, settings: rest };
}

export function AuthProvider({ children }) {
  const { online } = useConnectivity();
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const sessionRef = useRef(null);

  const saveSession = useCallback(async (next) => {
    sessionRef.current = next;
    setSession(next);
    await writeValue(SESSION_KEY, next).catch(() => {});
    if (next?.user?.email) updateRememberedSession(next.user.email, next);
  }, []);

  useEffect(() => {
    readValue(SESSION_KEY).then((saved) => {
      sessionRef.current = saved || null;
      setSession(saved || null);
      setReady(true);
    });
  }, []);

  const clearSession = useCallback(async () => {
    sessionRef.current = null;
    setSession(null);
    await writeValue(SESSION_KEY, null).catch(() => {});
  }, []);

  /** Requête authentifiée ; une session révoquée (401) déconnecte l'utilisateur. */
  const api = useCallback(
    async (method, path, body) => {
      const result = await apiRequest(method, path, { body, token: sessionRef.current?.token });
      if (result.status === 401 && sessionRef.current) {
        toast.error(t("Votre session a expiré. Reconnectez-vous."));
        await clearSession();
      }
      return result;
    },
    [clearSession]
  );

  /** Envoie au serveur les paramètres d'entreprise modifiés hors ligne, puis récupère l'état à jour. */
  const refresh = useCallback(async () => {
    const current = sessionRef.current;
    if (!current?.token) return;

    if (current.companyPending && ["admin", "accountant"].includes(current.user.role)) {
      // Le comptable ne modifie que les paramètres comptables (ouverture des comptes)
      const pushed =
        current.user.role === "admin"
          ? await api("PUT", "/company", settingsToCompanyPayload(current.companyPending))
          : await api("PUT", "/company/accounting", { settings: accountingSettings(current.companyPending) });
      if (pushed.network) return;
      if (!pushed.ok) toast.error(t("Paramètres non synchronisés : {0}", [pushed.error]));
      if (!sessionRef.current) return;
      await saveSession({ ...sessionRef.current, companyPending: null, company: pushed.ok ? pushed.data : sessionRef.current.company });
    }

    const me = await api("GET", "/me");
    if (me.ok && sessionRef.current) {
      await saveSession({ ...sessionRef.current, user: me.data.user, company: me.data.company });
    } else if (me.status === 403) {
      toast.error(me.error);
      await clearSession();
    }
  }, [api, clearSession, saveSession]);

  // Resynchronisation à chaque retour du réseau (compte désactivé, logo changé sur un autre poste…)
  useEffect(() => {
    if (ready && online) refresh();
  }, [ready, online, refresh]);

  const login = useCallback(
    async (email, password) => {
      const result = await apiRequest("POST", "/auth/login", { body: { email: email.trim(), password } });

      if (result.network) {
        // Hors ligne : on accepte un compte déjà connecté sur cet appareil
        const entry = ((await readValue(CREDENTIALS_KEY)) || {})[email.trim().toLowerCase()];
        if (!entry || !canHash()) {
          return { ok: false, error: t("Pas de connexion internet. La première connexion sur cet appareil doit se faire en ligne.") };
        }
        if ((await hashPassword(password, entry.salt)) !== entry.hash) return { ok: false, error: t("Email ou mot de passe incorrect.") };
        await saveSession(entry.session);
        return { ok: true, user: entry.session.user, offline: true };
      }

      if (!result.ok) {
        if (result.status === 401 || result.status === 403) await forgetCredentials(email);
        return { ok: false, error: result.error };
      }

      const next = { token: result.data.token, user: result.data.user, company: result.data.company, companyPending: null };
      await saveSession(next);
      await rememberCredentials(email, password, next);
      return { ok: true, user: next.user };
    },
    [saveSession]
  );

  const register = useCallback(
    async ({ shop, name, email, phone, password }) => {
      const result = await apiRequest("POST", "/auth/register", { body: { company_name: shop, name, email: email.trim(), phone, password } });
      if (result.network) return { ok: false, error: t("Connexion internet requise pour créer votre espace.") };
      if (!result.ok) return { ok: false, error: result.error };
      const next = { token: result.data.token, user: result.data.user, company: result.data.company, companyPending: null };
      await saveSession(next);
      await rememberCredentials(email, password, next);
      return { ok: true, user: next.user };
    },
    [saveSession]
  );

  const logout = useCallback(async () => {
    const current = sessionRef.current;
    await clearSession();
    if (current?.token && navigator.onLine) apiRequest("POST", "/auth/logout", { token: current.token });
  }, [clearSession]);

  /** Met à jour l'identité de l'entreprise tout de suite, et sur le serveur dès que possible. */
  const saveCompany = useCallback(
    async (settings) => {
      const current = sessionRef.current;
      if (!current) return;
      const local = { ...current.company, name: settings.shopName, logo: settings.logo || "", settings: settingsToCompanyPayload(settings).settings };
      await saveSession({ ...current, company: local, companyPending: settings });
      await refresh();
    },
    [refresh, saveSession]
  );

  const setUser = useCallback((user) => sessionRef.current && saveSession({ ...sessionRef.current, user }), [saveSession]);

  const value = useMemo(
    () => ({
      ready,
      user: session?.user ?? null,
      company: session?.company ?? null,
      companyPending: Boolean(session?.companyPending),
      api,
      login,
      register,
      logout,
      refresh,
      saveCompany,
      setUser,
      rememberPassword: (password) => session?.user && rememberCredentials(session.user.email, password, sessionRef.current),
    }),
    [ready, session, api, login, register, logout, refresh, saveCompany, setUser]
  );

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-brand-600" />
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error(t("useAuth doit être utilisé dans <AuthProvider>"));
  return context;
}
