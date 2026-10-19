/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { createEmptyState, DEFAULT_SETTINGS, STORE_VERSION, uid } from "./seed";
import { readValue, requestPersistentStorage, writeValue } from "../lib/db";
import { useAuth } from "./AuthContext";
import { useConnectivity } from "./ConnectivityContext";

import { t } from "../i18n/index.js";

export { useAuth } from "./AuthContext";

// Données métier de l'entreprise de l'utilisateur connecté, persistées sur l'appareil (IndexedDB)
// pour fonctionner hors ligne. Chaque entreprise a sa propre base locale (« store:<id> »).
//
// Synchronisation entre appareils : chaque action modifie l'état local tout de suite et ajoute
// ses opérations à une file (state.outbox). La file part vers POST /api/sync dès que le réseau
// est là ; la réponse contient les changements de tous les appareils depuis state.syncCursor.
// Le stock n'est jamais envoyé tel quel : seuls les mouvements le sont, le serveur fait le total.

const storeKey = (companyId) => `store:${companyId}`;
const LEGACY_KEYS = ["dymStore", "dymSession"];

const SYNC_INTERVAL = 30 * 1000;
const SYNC_BATCH = 200;

/** Entité synchronisée => clé du store */
const COLLECTIONS = {
  product: "products",
  category: "categories",
  supplier: "suppliers",
  customer: "customers",
  sale: "sales",
  installment: "installments",
  purchaseOrder: "purchaseOrders",
  movement: "stockMovements",
  task: "maintenanceTasks",
  history: "maintenanceHistory",
  sheet: "techSheets",
  expense: "expenses",
  supplierPayment: "supplierPayments",
  journalEntry: "journalEntries",
  cashSession: "cashSessions",
};

const StoreContext = createContext(null);

// eslint-disable-next-line no-unused-vars
const stripPassword = ({ password, ...user }) => user;

function normalizeState(parsed) {
  if (parsed?.version !== STORE_VERSION) return null;
  // eslint-disable-next-line no-unused-vars
  const { settings, counters, ...rest } = parsed; // les paramètres appartiennent à l'entreprise (serveur)
  return {
    ...createEmptyState(),
    ...rest,
    users: (rest.users || []).map(stripPassword),
    // Anciennes files (maintenance seule) : « type » est devenu « entity »
    outbox: (rest.outbox || []).map((op) => ({ ...op, entity: op.entity || op.type })),
  };
}

function clearLegacyState() {
  writeValue(LEGACY_KEYS[0], null).catch(() => {});
  try {
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
  }
}

/** Toutes les données de l'entreprise depuis le serveur (premier lancement, ou rechargement). */
async function fetchCompanyState(api) {
  const result = await api("GET", "/bootstrap");
  if (!result.ok) return null;
  const { cursor, ...data } = result.data;
  return { ...createEmptyState(), ...data, syncCursor: cursor };
}

// Code de secours si le serveur est injoignable : 5 caractères, jamais attribués par le serveur (3-4)
const localDeviceCode = () => Array.from({ length: 5 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

/** Code unique de l'appareil, utilisé dans les numéros (V-K7Q-0001) pour éviter tout doublon hors ligne. */
async function ensureDeviceCode(state, api) {
  if (state.deviceCode) return state;
  const result = await api("POST", "/devices", { label: navigator.userAgent.slice(0, 200) });
  return { ...state, deviceCode: result.ok ? result.data.code : localDeviceCode() };
}

async function loadCompanyState(companyId, api) {
  const saved = normalizeState(await readValue(storeKey(companyId)));
  const state = saved || (await fetchCompanyState(api)) || createEmptyState();
  clearLegacyState();
  return ensureDeviceCode(state, api);
}

const pad = (value, size) => String(value).padStart(size, "0");

/** Prochain numéro libre pour un préfixe (ex. « V-K7Q- »), calculé à partir des données. */
function nextNumber(values, prefix) {
  let max = 0;
  for (const value of values) {
    if (typeof value === "string" && value.startsWith(prefix)) {
      const n = parseInt(value.slice(prefix.length), 10);
      if (n > max) max = n;
    }
  }
  return max + 1;
}

/** Ajoute des opérations à la file d'envoi (fonctionne hors ligne). */
function queue(state, ...ops) {
  const added = ops.map(([entity, action, id, data]) => ({ opId: uid("op"), entity, action, id, data: action === "upsert" ? data : data ?? null }));
  return { ...state, outbox: [...(state.outbox || []), ...added] };
}

/** Données touchées par des opérations pas encore confirmées : on ne les écrase pas avec la version serveur. */
function pendingKeys(outbox) {
  const keys = new Set();
  for (const op of outbox) {
    if (op.entity === "payment") keys.add(`installment:${op.data?.installmentId}`);
    else if (op.entity === "movement") keys.add(`product:${op.data?.productId}`);
    else keys.add(`${op.entity}:${op.id}`);
  }
  return keys;
}

/** Applique les changements reçus du serveur sur l'état local. */
function applyChanges(state, changes, pending) {
  const next = { ...state };
  for (const change of changes) {
    const key = COLLECTIONS[change.entity];
    if (!key || pending.has(`${change.entity}:${change.id}`)) continue;
    const list = next[key] || [];

    if (change.entity === "category") {
      next[key] = change.action === "delete" ? list.filter((c) => c !== change.id) : list.includes(change.data) ? list : [...list, change.data];
    } else if (change.action === "delete") {
      next[key] = list.filter((record) => record.id !== change.id);
    } else {
      next[key] = list.some((record) => record.id === change.id) ? list.map((record) => (record.id === change.id ? change.data : record)) : [change.data, ...list];
    }
  }
  return next;
}

export function StoreProvider({ children }) {
  const { company, user } = useAuth();

  if (!company || !user) {
    return <StoreContext.Provider value={null}>{children}</StoreContext.Provider>;
  }
  // key : changer d'entreprise recharge entièrement les données
  return (
    <CompanyStoreLoader key={company.id} companyId={company.id}>
      {children}
    </CompanyStoreLoader>
  );
}

function CompanyStoreLoader({ companyId, children }) {
  const { api } = useAuth();
  const [initialState, setInitialState] = useState(null);

  useEffect(() => {
    let active = true;
    loadCompanyState(companyId, api).then((loaded) => active && setInitialState(loaded));
    requestPersistentStorage();
    return () => {
      active = false;
    };
  }, [companyId, api]);

  if (!initialState) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-brand-600" />
      </div>
    );
  }

  return (
    <LoadedStoreProvider companyId={companyId} initialState={initialState}>
      {children}
    </LoadedStoreProvider>
  );
}

function LoadedStoreProvider({ companyId, initialState, children }) {
  const { user: currentUser, company, api, saveCompany, setUser, rememberPassword, logout } = useAuth();
  const { online } = useConnectivity();
  const [state, setState] = useState(initialState);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const saveFailed = useRef(false);

  useEffect(() => {
    writeValue(storeKey(companyId), state)
      .then(() => {
        saveFailed.current = false;
      })
      .catch(() => {
        // stockage plein ou indisponible : l'application continue en mémoire
        if (!saveFailed.current) toast.error(t("Enregistrement local impossible : exportez une sauvegarde depuis les paramètres."));
        saveFailed.current = true;
      });
  }, [state, companyId]);

  // Comptes de l'entreprise : la liste fait foi côté serveur, gardée en cache pour le hors ligne
  useEffect(() => {
    if (!online) return;
    api("GET", "/users").then((result) => {
      if (result.ok) setState((prev) => ({ ...prev, users: result.data }));
    });
  }, [online, api]);

  // ---------- Synchronisation ----------
  const stateRef = useRef(state);
  const inFlight = useRef(false);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const syncNow = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSyncing(true);
    try {
      const ops = (stateRef.current.outbox || []).slice(0, SYNC_BATCH);
      const result = await api("POST", "/sync", { cursor: stateRef.current.syncCursor ?? null, ops });
      if (result.network || result.status === 401) return; // on réessaiera au retour du réseau

      const sent = new Set(ops.map((op) => op.opId));
      if (!result.ok) {
        // File refusée en bloc (données invalides) : on l'abandonne pour ne pas bloquer les suivantes
        if (ops.length) {
          toast.error(t("Synchronisation refusée : {0}", [result.error]));
          setState((prev) => ({ ...prev, outbox: prev.outbox.filter((op) => !sent.has(op.opId)) }));
        }
        return;
      }

      const { rejected = [], conflicts = [], changes = [], cursor, reset } = result.data;
      if (rejected.length) {
        toast.error(rejected.length === 1 ? t("Modification refusée : {0}", [rejected[0].error]) : t("{0} modifications refusées. Ex. : {1}", [rejected.length, rejected[0].error]));
      }
      conflicts.forEach((c) => toast.error(t("Stock insuffisant : « {0} » est à {1}. Une vente a dépassé le stock réel.", [c.name, c.stock]), { id: `conflict-${c.productId}`, duration: 8000 }));

      if (reset) {
        // Trop de changements ou appareil jamais synchronisé : on recharge tout depuis le serveur
        const fresh = await fetchCompanyState(api);
        if (fresh) {
          setState((prev) => ({ ...fresh, users: fresh.users || prev.users, deviceCode: prev.deviceCode, outbox: prev.outbox.filter((op) => !sent.has(op.opId)) }));
        }
      } else {
        setState((prev) => {
          const outbox = (prev.outbox || []).filter((op) => !sent.has(op.opId));
          return { ...applyChanges(prev, changes, pendingKeys(outbox)), outbox, syncCursor: cursor };
        });
      }
      setLastSyncAt(new Date());
    } finally {
      inFlight.current = false;
      setSyncing(false);
    }
  }, [api]);

  const pendingOps = state.outbox?.length || 0;
  useEffect(() => {
    if (online && pendingOps) syncNow();
  }, [online, pendingOps, syncNow]);

  useEffect(() => {
    if (!online) return undefined;
    syncNow();
    const interval = setInterval(syncNow, SYNC_INTERVAL);
    return () => clearInterval(interval);
  }, [online, syncNow]);

  // Identité et paramètres : ceux de l'entreprise, jamais ceux d'une autre
  const settings = useMemo(
    () => ({ ...DEFAULT_SETTINGS, ...company.settings, shopName: company.name, logo: company.logo || "" }),
    [company]
  );
  const visibleState = useMemo(() => ({ ...state, settings }), [state, settings]);
  const sync = useMemo(() => ({ pending: pendingOps, syncing, lastSyncAt, syncNow }), [pendingOps, syncing, lastSyncAt, syncNow]);

  const update = useCallback((recipe) => setState((prev) => recipe(prev)), []);

  const actions = useMemo(() => {
    const userName = () => currentUser?.name || "Système";
    const code = state.deviceCode;
    const replaceUser = (saved) =>
      update((prev) => ({ ...prev, users: prev.users.some((u) => u.id === saved.id) ? prev.users.map((u) => (u.id === saved.id ? saved : u)) : [...prev.users, saved] }));

    const movement = (product, type, qty, reason, reference) => ({
      id: uid("mv"),
      productId: product.id,
      productName: product.name,
      type,
      qty,
      reason,
      reference,
      date: new Date().toISOString(),
      userName: userName(),
    });
    const movementOp = (m) => ["movement", "upsert", m.id, m];

    /** Création ou modification d'une donnée simple, puis mise en file. Renvoie son identifiant. */
    const upsertRecord = (entity, key, prefix, data) => {
      const id = data.id || uid(prefix);
      update((prev) => {
        const list = prev[key] || [];
        const existing = list.find((r) => r.id === id);
        const record = existing ? { ...existing, ...data, id } : { ...data, id, createdAt: new Date().toISOString() };
        const next = existing ? list.map((r) => (r.id === id ? record : r)) : [record, ...list];
        return queue({ ...prev, [key]: next }, [entity, "upsert", id, record]);
      });
      return id;
    };
    const removeRecord = (entity, key, id) => update((prev) => queue({ ...prev, [key]: (prev[key] || []).filter((r) => r.id !== id) }, [entity, "delete", id]));

    return {
      // ---------- Session ----------
      logout,

      // ---------- Utilisateurs / vendeurs (gérés par le serveur : connexion requise) ----------
      async saveUser(data) {
        const isSelf = data.id && data.id === currentUser?.id;
        const fields = { name: data.name, email: data.email, phone: data.phone ?? "", shop: data.shop ?? "" };
        let result;
        if (isSelf) {
          result = await api("PUT", "/me", fields);
        } else if (data.id) {
          // eslint-disable-next-line no-unused-vars
          const { id, createdAt, ...patch } = data;
          result = await api("PUT", `/users/${data.id}`, patch);
        } else {
          result = await api("POST", "/users", { role: "seller", status: "actif", ...data });
        }
        if (!result.ok) return { ok: false, error: result.network ? t("Connexion internet requise pour gérer les comptes.") : result.error };
        replaceUser(result.data);
        if (isSelf) setUser(result.data);
        return { ok: true, user: result.data };
      },
      async deleteUser(id) {
        const result = await api("DELETE", `/users/${id}`);
        if (!result.ok) return { ok: false, error: result.network ? t("Connexion internet requise pour gérer les comptes.") : result.error };
        update((prev) => ({ ...prev, users: prev.users.filter((u) => u.id !== id) }));
        return { ok: true };
      },
      async changePassword(id, current, next) {
        const result = await api("PUT", "/me/password", { current_password: current, password: next });
        if (!result.ok) return { ok: false, error: result.network ? t("Connexion internet requise pour changer de mot de passe.") : result.error };
        await rememberPassword(next);
        return { ok: true };
      },

      // ---------- Produits & catégories ----------
      saveProduct(data) {
        update((prev) => {
          if (data.id) {
            const before = prev.products.find((p) => p.id === data.id);
            const product = { ...before, ...data };
            const products = prev.products.map((p) => (p.id === data.id ? product : p));
            const diff = Number(data.stock) - (before?.stock ?? 0);
            const correction = diff !== 0 && before ? movement(product, diff > 0 ? "in" : "out", Math.abs(diff), "Correction d'inventaire", "INV") : null;
            const next = { ...prev, products, stockMovements: correction ? [correction, ...prev.stockMovements] : prev.stockMovements };
            return queue(next, ["product", "upsert", product.id, product], ...(correction ? [movementOp(correction)] : []));
          }
          const product = { image: "", description: "", ...data, id: uid("p"), sku: data.sku || `${code}-${pad(prev.products.length + 1, 4)}`, createdAt: new Date().toISOString() };
          const initial = product.stock > 0 ? movement(product, "in", product.stock, "Stock initial", "CRÉATION") : null;
          const next = { ...prev, products: [product, ...prev.products], stockMovements: initial ? [initial, ...prev.stockMovements] : prev.stockMovements };
          return queue(next, ["product", "upsert", product.id, product], ...(initial ? [movementOp(initial)] : []));
        });
      },
      deleteProduct(id) {
        update((prev) => queue({ ...prev, products: prev.products.filter((p) => p.id !== id) }, ["product", "delete", id]));
      },
      adjustStock(productId, type, qty, reason) {
        update((prev) => {
          const product = prev.products.find((p) => p.id === productId);
          if (!product) return prev;
          const prefix = `AJ-${code}-`;
          const reference = `${prefix}${pad(nextNumber(prev.stockMovements.map((m) => m.reference), prefix), 3)}`;
          const delta = type === "in" ? qty : -Math.min(qty, product.stock);
          const move = movement(product, type, Math.abs(delta), reason, reference);
          const next = {
            ...prev,
            products: prev.products.map((p) => (p.id === productId ? { ...p, stock: p.stock + delta } : p)),
            stockMovements: [move, ...prev.stockMovements],
          };
          return queue(next, movementOp(move));
        });
      },
      addCategory(name) {
        update((prev) => queue({ ...prev, categories: [...prev.categories, name] }, ["category", "upsert", name, { name }]));
      },
      renameCategory(oldName, newName) {
        update((prev) => {
          const moved = prev.products.filter((p) => p.category === oldName).map((p) => ({ ...p, category: newName }));
          const next = {
            ...prev,
            categories: prev.categories.map((c) => (c === oldName ? newName : c)),
            products: prev.products.map((p) => moved.find((m) => m.id === p.id) || p),
          };
          return queue(next, ["category", "upsert", newName, { name: newName }], ...moved.map((p) => ["product", "upsert", p.id, p]), ["category", "delete", oldName]);
        });
      },
      deleteCategory(name) {
        update((prev) => {
          const moved = prev.products.filter((p) => p.category === name).map((p) => ({ ...p, category: "Autre" }));
          const next = {
            ...prev,
            categories: prev.categories.filter((c) => c !== name),
            products: prev.products.map((p) => moved.find((m) => m.id === p.id) || p),
          };
          const ensureOther = moved.length ? [["category", "upsert", "Autre", { name: "Autre" }]] : [];
          return queue(next, ...ensureOther, ...moved.map((p) => ["product", "upsert", p.id, p]), ["category", "delete", name]);
        });
      },

      // ---------- Fournisseurs ----------
      saveSupplier(data) {
        update((prev) => {
          const existing = data.id ? prev.suppliers.find((s) => s.id === data.id) : null;
          const supplier = existing ? { ...existing, ...data } : { ...data, id: uid("s") };
          const suppliers = existing ? prev.suppliers.map((s) => (s.id === supplier.id ? supplier : s)) : [supplier, ...prev.suppliers];
          return queue({ ...prev, suppliers }, ["supplier", "upsert", supplier.id, supplier]);
        });
      },
      deleteSupplier(id) {
        update((prev) => {
          const detached = prev.products.filter((p) => p.supplierId === id).map((p) => ({ ...p, supplierId: "" }));
          const next = {
            ...prev,
            suppliers: prev.suppliers.filter((s) => s.id !== id),
            products: prev.products.map((p) => detached.find((d) => d.id === p.id) || p),
          };
          return queue(next, ...detached.map((p) => ["product", "upsert", p.id, p]), ["supplier", "delete", id]);
        });
      },

      // ---------- Approvisionnements ----------
      savePurchaseOrder(data) {
        if (data.id) {
          update((prev) => {
            const order = { ...prev.purchaseOrders.find((o) => o.id === data.id), ...data };
            return queue({ ...prev, purchaseOrders: prev.purchaseOrders.map((o) => (o.id === data.id ? order : o)) }, ["purchaseOrder", "upsert", order.id, order]);
          });
          return data.id;
        }
        const prefix = `BC-${code}-`;
        const id = `${prefix}${pad(nextNumber(state.purchaseOrders.map((o) => o.id), prefix), 3)}`;
        const order = { status: "draft", receivedAt: null, ...data, id, createdAt: new Date().toISOString() };
        update((prev) => queue({ ...prev, purchaseOrders: [order, ...prev.purchaseOrders] }, ["purchaseOrder", "upsert", id, order]));
        return id;
      },
      setPurchaseOrderStatus(id, status) {
        update((prev) => {
          const order = prev.purchaseOrders.find((o) => o.id === id);
          if (!order || order.status === "received") return prev;
          const updatedOrder = { ...order, status, receivedAt: status === "received" ? new Date().toISOString() : order.receivedAt };
          let { products, stockMovements } = prev;
          const ops = [["purchaseOrder", "upsert", id, updatedOrder]];
          if (status === "received") {
            const costChanged = [];
            products = products.map((p) => {
              const line = order.items.find((item) => item.productId === p.id);
              if (!line) return p;
              const next = { ...p, stock: p.stock + line.qty, cost: line.cost || p.cost };
              if (next.cost !== p.cost) costChanged.push(next);
              return next;
            });
            const moves = order.items
              .map((item) => {
                const product = prev.products.find((p) => p.id === item.productId);
                return product ? movement(product, "in", item.qty, "Réception fournisseur", order.id) : null;
              })
              .filter(Boolean);
            stockMovements = [...moves, ...stockMovements];
            ops.push(...costChanged.map((p) => ["product", "upsert", p.id, p]), ...moves.map(movementOp));
          }
          const next = { ...prev, products, stockMovements, purchaseOrders: prev.purchaseOrders.map((o) => (o.id === id ? updatedOrder : o)) };
          return queue(next, ...ops);
        });
      },
      deletePurchaseOrder(id) {
        update((prev) => queue({ ...prev, purchaseOrders: prev.purchaseOrders.filter((o) => o.id !== id) }, ["purchaseOrder", "delete", id]));
      },

      // ---------- Clients ----------
      saveCustomer(data) {
        if (data.id) {
          update((prev) => {
            const customer = { ...prev.customers.find((c) => c.id === data.id), ...data };
            return queue({ ...prev, customers: prev.customers.map((c) => (c.id === data.id ? customer : c)) }, ["customer", "upsert", customer.id, customer]);
          });
          return data.id;
        }
        const id = uid("c");
        const customer = { notes: "", ...data, id, createdAt: new Date().toISOString() };
        update((prev) => queue({ ...prev, customers: [customer, ...prev.customers] }, ["customer", "upsert", id, customer]));
        return id;
      },
      deleteCustomer(id) {
        update((prev) => queue({ ...prev, customers: prev.customers.filter((c) => c.id !== id) }, ["customer", "delete", id]));
      },

      // ---------- Ventes ----------
      /**
       * Enregistre une vente : décrémente le stock, trace les mouvements,
       * crée le dossier de paiement échelonné si vente à crédit.
       */
      createSale({ items, customerId, customerName, discount = 0, method, mode, deposit = 0, dueDate, sellerId }) {
        const salePrefix = `V-${code}-`;
        const saleId = `${salePrefix}${pad(nextNumber(state.sales.map((s) => s.id), salePrefix), 4)}`;
        const subtotal = items.reduce((sum, item) => sum + item.qty * item.price, 0);
        const total = Math.max(0, subtotal - discount);
        const now = new Date().toISOString();
        const lines = items.map((item) => {
          const product = state.products.find((p) => p.id === item.productId);
          return { productId: item.productId, name: product?.name ?? item.name, qty: item.qty, price: item.price, cost: product?.cost ?? 0 };
        });
        const paid = mode === "credit" ? Math.min(total, deposit) : total;
        const installmentPrefix = `TR-${code}-`;
        const installmentId = mode === "credit" ? `${installmentPrefix}${nextNumber(state.installments.map((i) => i.id), installmentPrefix)}` : null;
        const depositPayment = { id: uid("pay"), date: now, amount: paid, method, note: "Acompte", receivedBy: sellerId };

        const sale = {
          id: saleId,
          date: now,
          sellerId,
          customerId: customerId || null,
          customerName: customerName || "Client de passage",
          items: lines,
          subtotal,
          discount,
          total,
          paid,
          method,
          mode,
          status: "completed",
          installmentId,
        };

        update((prev) => {
          const ops = [["sale", "upsert", saleId, sale]];
          let installments = prev.installments;
          if (mode === "credit") {
            const installment = {
              id: installmentId,
              saleId,
              customerId,
              customerName,
              label: lines.map((line) => line.name).join(", "),
              total,
              payments: paid > 0 ? [depositPayment] : [],
              dueDate,
              sellerId,
              createdAt: now,
              notes: "",
            };
            installments = [installment, ...installments];
            ops.push(["installment", "upsert", installmentId, installment]);
            if (paid > 0) ops.push(["payment", "upsert", depositPayment.id, { ...depositPayment, installmentId }]);
          }

          const products = prev.products.map((p) => {
            const line = lines.find((l) => l.productId === p.id);
            return line ? { ...p, stock: Math.max(0, p.stock - line.qty) } : p;
          });
          const moves = lines.map((line) => ({
            id: uid("mv"),
            productId: line.productId,
            productName: line.name,
            type: "out",
            qty: line.qty,
            reason: "Vente",
            reference: saleId,
            date: now,
            userName: prev.users.find((u) => u.id === sellerId)?.name || "Vendeur",
          }));
          ops.push(...moves.map(movementOp));

          return queue({ ...prev, sales: [sale, ...prev.sales], products, installments, stockMovements: [...moves, ...prev.stockMovements] }, ...ops);
        });
        return sale;
      },
      /** Annule une vente et remet les articles en stock */
      cancelSale(saleId, reason = "Annulation") {
        update((prev) => {
          const sale = prev.sales.find((s) => s.id === saleId);
          if (!sale || sale.status === "cancelled") return prev;
          const cancelled = { ...sale, status: "cancelled", cancelReason: reason, cancelledAt: new Date().toISOString() };
          const products = prev.products.map((p) => {
            const line = sale.items.find((l) => l.productId === p.id);
            return line ? { ...p, stock: p.stock + line.qty } : p;
          });
          const moves = sale.items
            .filter((line) => prev.products.some((p) => p.id === line.productId))
            .map((line) => ({ id: uid("mv"), productId: line.productId, productName: line.name, type: "in", qty: line.qty, reason: `Retour — ${reason}`, reference: sale.id, date: new Date().toISOString(), userName: userName() }));
          const closedInstallments = prev.installments.filter((i) => i.saleId === saleId).map((i) => ({ ...i, cancelled: true }));
          const next = {
            ...prev,
            products,
            stockMovements: [...moves, ...prev.stockMovements],
            sales: prev.sales.map((s) => (s.id === saleId ? cancelled : s)),
            installments: prev.installments.map((i) => closedInstallments.find((c) => c.id === i.id) || i),
          };
          return queue(next, ["sale", "upsert", saleId, cancelled], ...moves.map(movementOp), ...closedInstallments.map((i) => ["installment", "upsert", i.id, i]));
        });
      },

      // ---------- Paiements échelonnés ----------
      createInstallment(data) {
        update((prev) => {
          const prefix = `TR-${code}-`;
          const id = `${prefix}${nextNumber(prev.installments.map((i) => i.id), prefix)}`;
          const payments = data.deposit > 0 ? [{ id: uid("pay"), date: new Date().toISOString(), amount: data.deposit, method: data.method || "cash", note: "Acompte", receivedBy: currentUser?.id }] : [];
          const installment = { id, saleId: null, customerId: data.customerId, customerName: data.customerName, label: data.label, total: data.total, payments, dueDate: data.dueDate, sellerId: data.sellerId, createdAt: new Date().toISOString(), notes: data.notes || "" };
          return queue(
            { ...prev, installments: [installment, ...prev.installments] },
            ["installment", "upsert", id, installment],
            ...payments.map((p) => ["payment", "upsert", p.id, { ...p, installmentId: id }])
          );
        });
      },
      updateInstallment(id, patch) {
        update((prev) => {
          const installment = { ...prev.installments.find((i) => i.id === id), ...patch };
          return queue({ ...prev, installments: prev.installments.map((i) => (i.id === id ? installment : i)) }, ["installment", "upsert", id, installment]);
        });
      },
      addInstallmentPayment(id, { amount, method, note, date }) {
        const payment = { id: uid("pay"), date: date || new Date().toISOString(), amount, method, note, receivedBy: currentUser?.id };
        update((prev) =>
          queue(
            {
              ...prev,
              installments: prev.installments.map((i) => (i.id === id ? { ...i, payments: [...i.payments, payment] } : i)),
              sales: prev.sales.map((s) => (s.installmentId === id ? { ...s, paid: (s.paid || 0) + amount } : s)),
            },
            ["payment", "upsert", payment.id, { ...payment, installmentId: id }]
          )
        );
      },
      removeInstallmentPayment(id, paymentId) {
        update((prev) => {
          const payment = prev.installments.find((i) => i.id === id)?.payments.find((p) => p.id === paymentId);
          const next = {
            ...prev,
            installments: prev.installments.map((i) => (i.id === id ? { ...i, payments: i.payments.filter((p) => p.id !== paymentId) } : i)),
            sales: prev.sales.map((s) => (s.installmentId === id && payment ? { ...s, paid: Math.max(0, (s.paid || 0) - payment.amount) } : s)),
          };
          return queue(next, ["payment", "delete", paymentId, { installmentId: id }]);
        });
      },

      // ---------- Maintenance ----------
      saveMaintenanceTask(data) {
        update((prev) => {
          const existing = data.id ? prev.maintenanceTasks.find((item) => item.id === data.id) : null;
          const task = existing
            ? { ...existing, ...data }
            : { source: "admin", reportedBy: null, technicianId: null, assignedTo: "", costEstimate: 0, ...data, id: data.id || uid("mt") };
          const maintenanceTasks = existing ? prev.maintenanceTasks.map((item) => (item.id === task.id ? task : item)) : [task, ...prev.maintenanceTasks];
          return queue({ ...prev, maintenanceTasks }, ["task", "upsert", task.id, task]);
        });
      },
      deleteMaintenanceTask(id) {
        update((prev) => queue({ ...prev, maintenanceTasks: prev.maintenanceTasks.filter((item) => item.id !== id) }, ["task", "delete", id]));
      },
      /** Clôture une intervention et l'archive dans l'historique avec son coût réel */
      completeMaintenanceTask(id, { cost, technician, note }) {
        update((prev) => {
          const task = prev.maintenanceTasks.find((item) => item.id === id);
          if (!task) return prev;
          const done = { ...task, status: "Terminé" };
          const entry = {
            id: uid("mh"),
            product: task.product,
            action: task.task,
            technician: technician || task.assignedTo || "—",
            technicianId: task.technicianId || (currentUser?.role === "technician" ? currentUser.id : null),
            date: new Date().toISOString(),
            cost: Number(cost) || 0,
            note: note || "",
          };
          const next = {
            ...prev,
            maintenanceTasks: prev.maintenanceTasks.map((item) => (item.id === id ? done : item)),
            maintenanceHistory: [entry, ...prev.maintenanceHistory],
          };
          return queue(next, ["task", "upsert", id, done], ["history", "upsert", entry.id, entry]);
        });
      },
      addMaintenanceHistory(data) {
        const entry = { technicianId: null, ...data, id: uid("mh") };
        update((prev) => queue({ ...prev, maintenanceHistory: [entry, ...prev.maintenanceHistory] }, ["history", "upsert", entry.id, entry]));
      },
      deleteMaintenanceHistory(id) {
        update((prev) => queue({ ...prev, maintenanceHistory: prev.maintenanceHistory.filter((h) => h.id !== id) }, ["history", "delete", id]));
      },
      saveTechSheet(data) {
        update((prev) => {
          const existing = data.id ? prev.techSheets.find((s) => s.id === data.id) : null;
          const sheet = existing ? { ...existing, ...data } : { ...data, id: uid("ts") };
          const techSheets = existing ? prev.techSheets.map((s) => (s.id === sheet.id ? sheet : s)) : [sheet, ...prev.techSheets];
          return queue({ ...prev, techSheets }, ["sheet", "upsert", sheet.id, sheet]);
        });
      },
      deleteTechSheet(id) {
        update((prev) => queue({ ...prev, techSheets: prev.techSheets.filter((s) => s.id !== id) }, ["sheet", "delete", id]));
      },

      // ---------- Caisse journalière ----------
      /** Ouvre la caisse du vendeur connecté avec son fond de caisse. */
      openCashSession(openingFloat, note = "") {
        const session = { id: uid("cs"), sellerId: currentUser.id, status: "open", openedAt: new Date().toISOString(), openingFloat: Math.max(0, Math.round(Number(openingFloat) || 0)), movements: [], note };
        update((prev) => queue({ ...prev, cashSessions: [session, ...(prev.cashSessions || [])] }, ["cashSession", "upsert", session.id, session]));
        return session;
      },
      /** Versement en banque, petite dépense ou apport pendant la session. */
      addCashMovement(sessionId, { type, amount, reason }) {
        update((prev) => {
          const session = (prev.cashSessions || []).find((s) => s.id === sessionId);
          if (!session || session.status !== "open") return prev;
          const movement = { id: uid("cm"), type, amount: Math.round(Number(amount) || 0), reason: reason || "", at: new Date().toISOString() };
          const next = { ...session, movements: [...(session.movements || []), movement] };
          return queue({ ...prev, cashSessions: prev.cashSessions.map((s) => (s.id === sessionId ? next : s)) }, ["cashSession", "upsert", sessionId, next]);
        });
      },
      /** Clôture : espèces comptées, écart avec les espèces attendues. */
      closeCashSession(sessionId, { countedCash, expectedCash, denominations, note }) {
        update((prev) => {
          const session = (prev.cashSessions || []).find((s) => s.id === sessionId);
          if (!session || session.status !== "open") return prev;
          const counted = Math.max(0, Math.round(Number(countedCash) || 0));
          const next = { ...session, status: "closed", closedAt: new Date().toISOString(), countedCash: counted, expectedCash: Math.max(0, Math.round(expectedCash)), difference: counted - Math.round(expectedCash), denominations: denominations || null, note: note || session.note || "" };
          return queue({ ...prev, cashSessions: prev.cashSessions.map((s) => (s.id === sessionId ? next : s)) }, ["cashSession", "upsert", sessionId, next]);
        });
      },

      // ---------- Comptabilité (administrateur) ----------
      saveExpense(data) {
        return upsertRecord("expense", "expenses", "ex", data);
      },
      deleteExpense(id) {
        removeRecord("expense", "expenses", id);
      },
      saveSupplierPayment(data) {
        return upsertRecord("supplierPayment", "supplierPayments", "sp", data);
      },
      deleteSupplierPayment(id) {
        removeRecord("supplierPayment", "supplierPayments", id);
      },
      saveJournalEntry(data) {
        return upsertRecord("journalEntry", "journalEntries", "je", data);
      },
      deleteJournalEntry(id) {
        removeRecord("journalEntry", "journalEntries", id);
      },

      // ---------- Paramètres & données ----------
      /** Identité et paramètres de l'entreprise : appliqués tout de suite, envoyés au serveur dès que possible. */
      saveSettings(patch) {
        return saveCompany({ ...settings, ...patch });
      },
      exportData() {
        // eslint-disable-next-line no-unused-vars
        const { outbox, syncCursor, deviceCode, ...data } = visibleState;
        return JSON.stringify(data, null, 2);
      },
      /** Remplace les données de cet appareil par celles du serveur. */
      async resetData() {
        const fresh = await fetchCompanyState(api);
        if (!fresh) return { ok: false, error: t("Connexion internet requise pour recharger les données.") };
        setState((prev) => ({ ...fresh, deviceCode: prev.deviceCode }));
        return { ok: true };
      },
    };
  }, [state, visibleState, settings, currentUser, api, logout, saveCompany, setUser, rememberPassword, update]);

  const value = useMemo(() => ({ state: visibleState, actions, currentUser, sync }), [visibleState, actions, currentUser, sync]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error(t("useStore doit être utilisé dans <StoreProvider>"));
  return context;
}
