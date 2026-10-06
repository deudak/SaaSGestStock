/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createSeed, DEFAULT_SETTINGS, STORE_VERSION, uid } from "./seed";

// Toutes les données de l'application vivent ici et sont persistées dans le navigateur.
// Chaque action correspond à un futur endpoint de l'API Laravel (stock-api) :
// il suffira de remplacer le corps des actions par des appels axios.

const STORAGE_KEY = "dymStore";
const SESSION_KEY = "dymSession";

const StoreContext = createContext(null);

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.version === STORE_VERSION) {
        return { ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings } };
      }
    }
  } catch {
    // données corrompues : on repart des données de démonstration
  }
  return createSeed();
}

function loadSession() {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

const pad = (value, size) => String(value).padStart(size, "0");

export function StoreProvider({ children }) {
  const [state, setState] = useState(loadState);
  const [sessionUserId, setSessionUserId] = useState(loadSession);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // stockage plein ou indisponible : l'application continue en mémoire
    }
  }, [state]);

  useEffect(() => {
    try {
      if (sessionUserId) localStorage.setItem(SESSION_KEY, sessionUserId);
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  }, [sessionUserId]);

  const currentUser = useMemo(
    () => state.users.find((user) => user.id === sessionUserId && user.status === "actif") || null,
    [state.users, sessionUserId]
  );

  const update = useCallback((recipe) => setState((prev) => recipe(prev)), []);

  const actions = useMemo(() => {
    const userName = () => state.users.find((u) => u.id === sessionUserId)?.name || "Système";

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

    return {
      // ---------- Authentification ----------
      login(email, password) {
        const user = state.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
        if (!user || user.password !== password) return { ok: false, error: "Email ou mot de passe incorrect." };
        if (user.status !== "actif") return { ok: false, error: "Ce compte est désactivé. Contactez l'administrateur." };
        setSessionUserId(user.id);
        return { ok: true, user };
      },
      logout() {
        setSessionUserId(null);
      },
      register({ name, email, phone, password, shop }) {
        if (state.users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
          return { ok: false, error: "Un compte existe déjà avec cet email." };
        }
        const user = { id: uid("u"), name, email: email.trim(), phone, password, role: "admin", shop: shop || "Siège", status: "actif", createdAt: new Date().toISOString() };
        update((prev) => ({ ...prev, users: [...prev.users, user], settings: { ...prev.settings, shopName: shop || prev.settings.shopName } }));
        setSessionUserId(user.id);
        return { ok: true, user };
      },

      // ---------- Utilisateurs / vendeurs ----------
      saveUser(data) {
        const email = data.email.trim().toLowerCase();
        if (state.users.some((u) => u.email.toLowerCase() === email && u.id !== data.id)) {
          return { ok: false, error: "Cet email est déjà utilisé." };
        }
        update((prev) => {
          if (data.id) {
            return { ...prev, users: prev.users.map((u) => (u.id === data.id ? { ...u, ...data, password: data.password || u.password } : u)) };
          }
          return { ...prev, users: [...prev.users, { role: "seller", status: "actif", ...data, id: uid("u"), createdAt: new Date().toISOString() }] };
        });
        return { ok: true };
      },
      deleteUser(id) {
        update((prev) => ({ ...prev, users: prev.users.filter((u) => u.id !== id) }));
      },
      changePassword(id, current, next) {
        const user = state.users.find((u) => u.id === id);
        if (!user || user.password !== current) return { ok: false, error: "Le mot de passe actuel est incorrect." };
        update((prev) => ({ ...prev, users: prev.users.map((u) => (u.id === id ? { ...u, password: next } : u)) }));
        return { ok: true };
      },

      // ---------- Produits & catégories ----------
      saveProduct(data) {
        update((prev) => {
          if (data.id) {
            const before = prev.products.find((p) => p.id === data.id);
            const products = prev.products.map((p) => (p.id === data.id ? { ...p, ...data } : p));
            const diff = Number(data.stock) - (before?.stock ?? 0);
            const stockMovements = diff !== 0 && before
              ? [movement({ ...before, ...data }, diff > 0 ? "in" : "out", Math.abs(diff), "Correction d'inventaire", "INV"), ...prev.stockMovements]
              : prev.stockMovements;
            return { ...prev, products, stockMovements };
          }
          const nextIndex = prev.products.length + 1;
          const product = { image: "", description: "", ...data, id: uid("p"), sku: data.sku || `DYM-${pad(nextIndex, 4)}`, createdAt: new Date().toISOString() };
          const stockMovements = product.stock > 0
            ? [movement(product, "in", product.stock, "Stock initial", "CRÉATION"), ...prev.stockMovements]
            : prev.stockMovements;
          return { ...prev, products: [product, ...prev.products], stockMovements };
        });
      },
      deleteProduct(id) {
        update((prev) => ({ ...prev, products: prev.products.filter((p) => p.id !== id) }));
      },
      adjustStock(productId, type, qty, reason) {
        update((prev) => {
          const product = prev.products.find((p) => p.id === productId);
          if (!product) return prev;
          const counter = prev.counters.adjustment + 1;
          const delta = type === "in" ? qty : -Math.min(qty, product.stock);
          return {
            ...prev,
            counters: { ...prev.counters, adjustment: counter },
            products: prev.products.map((p) => (p.id === productId ? { ...p, stock: p.stock + delta } : p)),
            stockMovements: [movement(product, type, Math.abs(delta), reason, `AJ-${pad(counter, 4)}`), ...prev.stockMovements],
          };
        });
      },
      addCategory(name) {
        update((prev) => ({ ...prev, categories: [...prev.categories, name] }));
      },
      renameCategory(oldName, newName) {
        update((prev) => ({
          ...prev,
          categories: prev.categories.map((c) => (c === oldName ? newName : c)),
          products: prev.products.map((p) => (p.category === oldName ? { ...p, category: newName } : p)),
        }));
      },
      deleteCategory(name) {
        update((prev) => ({
          ...prev,
          categories: prev.categories.filter((c) => c !== name),
          products: prev.products.map((p) => (p.category === name ? { ...p, category: "Autre" } : p)),
        }));
      },

      // ---------- Fournisseurs ----------
      saveSupplier(data) {
        update((prev) =>
          data.id
            ? { ...prev, suppliers: prev.suppliers.map((s) => (s.id === data.id ? { ...s, ...data } : s)) }
            : { ...prev, suppliers: [{ ...data, id: uid("s") }, ...prev.suppliers] }
        );
      },
      deleteSupplier(id) {
        update((prev) => ({
          ...prev,
          suppliers: prev.suppliers.filter((s) => s.id !== id),
          products: prev.products.map((p) => (p.supplierId === id ? { ...p, supplierId: "" } : p)),
        }));
      },

      // ---------- Approvisionnements ----------
      savePurchaseOrder(data) {
        if (data.id) {
          update((prev) => ({ ...prev, purchaseOrders: prev.purchaseOrders.map((o) => (o.id === data.id ? { ...o, ...data } : o)) }));
          return data.id;
        }
        const counter = state.counters.purchaseOrder + 1;
        const id = `BC-${pad(counter, 4)}`;
        update((prev) => {
          return {
            ...prev,
            counters: { ...prev.counters, purchaseOrder: counter },
            purchaseOrders: [{ status: "draft", receivedAt: null, ...data, id, createdAt: new Date().toISOString() }, ...prev.purchaseOrders],
          };
        });
        return id;
      },
      setPurchaseOrderStatus(id, status) {
        update((prev) => {
          const order = prev.purchaseOrders.find((o) => o.id === id);
          if (!order || order.status === "received") return prev;
          let { products, stockMovements } = prev;
          if (status === "received") {
            products = products.map((p) => {
              const line = order.items.find((item) => item.productId === p.id);
              return line ? { ...p, stock: p.stock + line.qty, cost: line.cost || p.cost } : p;
            });
            const moves = order.items
              .map((item) => {
                const product = prev.products.find((p) => p.id === item.productId);
                return product ? movement(product, "in", item.qty, "Réception fournisseur", order.id) : null;
              })
              .filter(Boolean);
            stockMovements = [...moves, ...stockMovements];
          }
          return {
            ...prev,
            products,
            stockMovements,
            purchaseOrders: prev.purchaseOrders.map((o) =>
              o.id === id ? { ...o, status, receivedAt: status === "received" ? new Date().toISOString() : o.receivedAt } : o
            ),
          };
        });
      },
      deletePurchaseOrder(id) {
        update((prev) => ({ ...prev, purchaseOrders: prev.purchaseOrders.filter((o) => o.id !== id) }));
      },

      // ---------- Clients ----------
      saveCustomer(data) {
        if (data.id) {
          update((prev) => ({ ...prev, customers: prev.customers.map((c) => (c.id === data.id ? { ...c, ...data } : c)) }));
          return data.id;
        }
        const id = uid("c");
        const customer = { notes: "", ...data, id, createdAt: new Date().toISOString() };
        update((prev) => ({ ...prev, customers: [customer, ...prev.customers] }));
        return id;
      },
      deleteCustomer(id) {
        update((prev) => ({ ...prev, customers: prev.customers.filter((c) => c.id !== id) }));
      },

      // ---------- Ventes ----------
      /**
       * Enregistre une vente : décrémente le stock, trace les mouvements,
       * crée le dossier de paiement échelonné si vente à crédit.
       */
      createSale({ items, customerId, customerName, discount = 0, method, mode, deposit = 0, dueDate, sellerId }) {
        const saleCounter = state.counters.sale + 1;
        const saleId = `V-${pad(saleCounter, 5)}`;
        const subtotal = items.reduce((sum, item) => sum + item.qty * item.price, 0);
        const total = Math.max(0, subtotal - discount);
        const now = new Date().toISOString();
        const lines = items.map((item) => {
          const product = state.products.find((p) => p.id === item.productId);
          return { productId: item.productId, name: product?.name ?? item.name, qty: item.qty, price: item.price, cost: product?.cost ?? 0 };
        });
        const paid = mode === "credit" ? Math.min(total, deposit) : total;
        const installmentCounter = mode === "credit" ? state.counters.installment + 1 : state.counters.installment;
        const installmentId = mode === "credit" ? `TR-${installmentCounter}` : null;
        const depositPayment = { id: uid("pay"), date: now, amount: paid, method, note: "Acompte" };

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
          let installments = prev.installments;
          if (mode === "credit") {
            installments = [
              {
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
              },
              ...installments,
            ];
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

          return {
            ...prev,
            counters: { ...prev.counters, sale: saleCounter, installment: installmentCounter },
            sales: [sale, ...prev.sales],
            products,
            installments,
            stockMovements: [...moves, ...prev.stockMovements],
          };
        });
        return sale;
      },
      /** Annule une vente et remet les articles en stock */
      cancelSale(saleId, reason = "Annulation") {
        update((prev) => {
          const sale = prev.sales.find((s) => s.id === saleId);
          if (!sale || sale.status === "cancelled") return prev;
          const products = prev.products.map((p) => {
            const line = sale.items.find((l) => l.productId === p.id);
            return line ? { ...p, stock: p.stock + line.qty } : p;
          });
          const moves = sale.items
            .filter((line) => prev.products.some((p) => p.id === line.productId))
            .map((line) => ({ id: uid("mv"), productId: line.productId, productName: line.name, type: "in", qty: line.qty, reason: `Retour — ${reason}`, reference: sale.id, date: new Date().toISOString(), userName: userName() }));
          return {
            ...prev,
            products,
            stockMovements: [...moves, ...prev.stockMovements],
            sales: prev.sales.map((s) => (s.id === saleId ? { ...s, status: "cancelled", cancelReason: reason, cancelledAt: new Date().toISOString() } : s)),
            installments: prev.installments.map((i) => (i.saleId === saleId ? { ...i, cancelled: true } : i)),
          };
        });
      },

      // ---------- Paiements échelonnés ----------
      createInstallment(data) {
        update((prev) => {
          const counter = prev.counters.installment + 1;
          const payments = data.deposit > 0 ? [{ id: uid("pay"), date: new Date().toISOString(), amount: data.deposit, method: data.method || "cash", note: "Acompte" }] : [];
          return {
            ...prev,
            counters: { ...prev.counters, installment: counter },
            installments: [
              { id: `TR-${counter}`, saleId: null, customerId: data.customerId, customerName: data.customerName, label: data.label, total: data.total, payments, dueDate: data.dueDate, sellerId: data.sellerId, createdAt: new Date().toISOString(), notes: data.notes || "" },
              ...prev.installments,
            ],
          };
        });
      },
      updateInstallment(id, patch) {
        update((prev) => ({ ...prev, installments: prev.installments.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
      },
      addInstallmentPayment(id, { amount, method, note, date }) {
        update((prev) => ({
          ...prev,
          installments: prev.installments.map((i) =>
            i.id === id ? { ...i, payments: [...i.payments, { id: uid("pay"), date: date || new Date().toISOString(), amount, method, note }] } : i
          ),
          sales: prev.sales.map((s) => (s.installmentId === id ? { ...s, paid: (s.paid || 0) + amount } : s)),
        }));
      },
      removeInstallmentPayment(id, paymentId) {
        update((prev) => {
          const payment = prev.installments.find((i) => i.id === id)?.payments.find((p) => p.id === paymentId);
          return {
            ...prev,
            installments: prev.installments.map((i) => (i.id === id ? { ...i, payments: i.payments.filter((p) => p.id !== paymentId) } : i)),
            sales: prev.sales.map((s) => (s.installmentId === id && payment ? { ...s, paid: Math.max(0, (s.paid || 0) - payment.amount) } : s)),
          };
        });
      },

      // ---------- Maintenance ----------
      saveMaintenanceTask(data) {
        update((prev) =>
          data.id
            ? { ...prev, maintenanceTasks: prev.maintenanceTasks.map((t) => (t.id === data.id ? { ...t, ...data } : t)) }
            : { ...prev, maintenanceTasks: [{ source: "admin", reportedBy: null, ...data, id: uid("mt") }, ...prev.maintenanceTasks] }
        );
      },
      deleteMaintenanceTask(id) {
        update((prev) => ({ ...prev, maintenanceTasks: prev.maintenanceTasks.filter((t) => t.id !== id) }));
      },
      /** Clôture une intervention et l'archive dans l'historique avec son coût réel */
      completeMaintenanceTask(id, { cost, technician, note }) {
        update((prev) => {
          const task = prev.maintenanceTasks.find((t) => t.id === id);
          if (!task) return prev;
          return {
            ...prev,
            maintenanceTasks: prev.maintenanceTasks.map((t) => (t.id === id ? { ...t, status: "Terminé" } : t)),
            maintenanceHistory: [
              { id: uid("mh"), product: task.product, action: task.task, technician: technician || task.assignedTo || "—", date: new Date().toISOString(), cost: Number(cost) || 0, note: note || "" },
              ...prev.maintenanceHistory,
            ],
          };
        });
      },
      addMaintenanceHistory(data) {
        update((prev) => ({ ...prev, maintenanceHistory: [{ ...data, id: uid("mh") }, ...prev.maintenanceHistory] }));
      },
      deleteMaintenanceHistory(id) {
        update((prev) => ({ ...prev, maintenanceHistory: prev.maintenanceHistory.filter((h) => h.id !== id) }));
      },
      saveTechSheet(data) {
        update((prev) =>
          data.id
            ? { ...prev, techSheets: prev.techSheets.map((s) => (s.id === data.id ? { ...s, ...data } : s)) }
            : { ...prev, techSheets: [{ ...data, id: uid("ts") }, ...prev.techSheets] }
        );
      },
      deleteTechSheet(id) {
        update((prev) => ({ ...prev, techSheets: prev.techSheets.filter((s) => s.id !== id) }));
      },

      // ---------- Paramètres & données ----------
      saveSettings(patch) {
        update((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
      },
      exportData() {
        return JSON.stringify(state, null, 2);
      },
      importData(json) {
        const parsed = JSON.parse(json);
        if (!parsed || !Array.isArray(parsed.products) || !Array.isArray(parsed.users)) {
          throw new Error("Fichier de sauvegarde invalide.");
        }
        setState({ ...createSeed(), ...parsed, version: STORE_VERSION });
      },
      resetData() {
        setState(createSeed());
        setSessionUserId(null);
      },
    };
  }, [state, sessionUserId, update]);

  const value = useMemo(() => ({ state, actions, currentUser }), [state, actions, currentUser]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore doit être utilisé dans <StoreProvider>");
  return context;
}

export function useAuth() {
  const { currentUser, actions } = useStore();
  return { user: currentUser, login: actions.login, logout: actions.logout, register: actions.register };
}
