import { useMemo, useState } from "react";
import { FaBoxOpen, FaCashRegister, FaCreditCard, FaTools, FaTruck } from "react-icons/fa";
import { useStore } from "../../store/StoreContext";
import { formatDate, formatMoney, startOfDay } from "../../lib/format";
import { installmentRemaining, installmentStatus, isAssignedTo, lowStockProducts } from "../../store/selectors";

import { t } from "../../i18n/index.js";

/** Alertes calculées à partir des données : stock, créances, maintenance, livraisons. */
export default function useNotifications() {
  const { state, currentUser } = useStore();
  const isAdmin = currentUser?.role === "admin";
  const base = isAdmin ? "/admin" : "/seller";
  const [now] = useState(() => Date.now());

  return useMemo(() => {
    const list = [];

    // Maintenancier : uniquement ses interventions et les pannes à prendre en charge
    // Comptable : points à régulariser dans la comptabilité
    if (currentUser?.role === "accountant") {
      const posted = new Set((state.expenses || []).map((e) => e.maintenanceHistoryId).filter(Boolean));
      const toPost = state.maintenanceHistory.filter((h) => h.cost > 0 && !posted.has(h.id));
      if (!state.settings.accountingStart) {
        list.push({ id: "acc-start", icon: FaTools, tone: "amber", title: t("Ouverture des comptes à définir"), detail: t("Date d'ouverture et soldes de départ"), to: "/accountant/settings" });
      }
      if (toPost.length) {
        list.push({ id: "acc-maint", icon: FaTools, tone: "violet", title: t("{0} coût(s) de maintenance à comptabiliser", [toPost.length]), detail: t("Interventions payées non enregistrées en charges"), to: "/accountant/expenses?tab=maintenance" });
      }
      return list;
    }

    if (currentUser?.role === "technician") {
      const endOfToday = new Date(startOfDay().getTime() + 86400000);
      state.maintenanceTasks
        .filter((task) => task.status !== "Terminé")
        .forEach((task) => {
          const unassigned = !task.technicianId && !task.assignedTo;
          if (unassigned) {
            list.push({ id: `mt-${task.id}`, icon: FaTools, tone: "violet", title: t("Panne signalée : {0}", [task.product]), detail: task.task, to: "/technician" });
          } else if (isAssignedTo(task, currentUser) && new Date(task.date) < endOfToday) {
            const late = new Date(task.date) < startOfDay();
            list.push({ id: `mt-${task.id}`, icon: FaTools, tone: late ? "red" : "amber", title: `${late ? "En retard" : "Aujourd'hui"} : ${task.product}`, detail: task.task, to: "/technician" });
          }
        });
      const priority = { red: 0, violet: 1, amber: 2 };
      return list.sort((a, b) => priority[a.tone] - priority[b.tone]);
    }

    lowStockProducts(state.products).forEach((product) => {
      list.push({
        id: `stock-${product.id}`,
        icon: FaBoxOpen,
        tone: product.stock <= 0 ? "red" : "amber",
        // Stock négatif : des appareils hors ligne ont vendu plus que le stock réel
        title: product.stock < 0 ? t("Survente : {0}", [product.name]) : product.stock === 0 ? t("Rupture : {0}", [product.name]) : t("Stock bas : {0}", [product.name]),
        detail: product.stock < 0 ? t("Stock à {0} : vendu au-delà du disponible, à régulariser", [product.stock]) : t("{0} en stock · seuil {1}", [product.stock, product.alertThreshold]),
        to: isAdmin ? `/admin/products?q=${encodeURIComponent(product.name)}` : "/seller/pos",
      });
    });

    state.installments
      .filter((item) => isAdmin || item.sellerId === currentUser?.id)
      .forEach((item) => {
        const status = installmentStatus(item);
        if (status === "late" || status === "soon") {
          list.push({
            id: `inst-${item.id}`,
            icon: FaCreditCard,
            tone: status === "late" ? "red" : "amber",
            title: status === "late" ? t("Paiement en retard — {0}", [item.customerName]) : t("Échéance proche — {0}", [item.customerName]),
            detail: t("{0} restant · échéance {1}", [formatMoney(installmentRemaining(item)), formatDate(item.dueDate)]),
            to: `${base}/installments?id=${item.id}`,
          });
        }
      });

    if (isAdmin) {
      state.maintenanceTasks
        .filter((task) => task.status === "Signalé" || task.status === "À remplacer")
        .forEach((task) => {
          list.push({
            id: `mt-${task.id}`,
            icon: FaTools,
            tone: task.status === "Signalé" ? "violet" : "red",
            title: task.status === "Signalé" ? t("Signalement : {0}", [task.product]) : t("À remplacer : {0}", [task.product]),
            detail: task.task,
            to: "/admin/maintenance",
          });
        });

      // Caisses oubliées et manquants de caisse des 3 derniers jours
      const userName = (id) => state.users.find((u) => u.id === id)?.name || t("Vendeur");
      (state.cashSessions || []).forEach((session) => {
        const age = now - new Date(session.status === "open" ? session.openedAt : session.closedAt).getTime();
        if (session.status === "open" && age > 18 * 3600000) {
          list.push({ id: `cash-${session.id}`, icon: FaCashRegister, tone: "amber", title: t("Caisse non clôturée : {0}", [userName(session.sellerId)]), detail: t("Ouverte depuis le {0}", [formatDate(session.openedAt)]), to: "/admin/cash" });
        } else if (session.status === "closed" && session.difference < 0 && age < 3 * 86400000) {
          list.push({ id: `cash-${session.id}`, icon: FaCashRegister, tone: "red", title: t("Manquant de caisse : {0}", [formatMoney(-session.difference)]), detail: t("{0} · clôture du {1}", [userName(session.sellerId), formatDate(session.closedAt)]), to: "/admin/cash" });
        }
      });

      state.purchaseOrders
        .filter((order) => order.status === "sent" && new Date(order.expectedAt) <= new Date())
        .forEach((order) => {
          list.push({
            id: `po-${order.id}`,
            icon: FaTruck,
            tone: "blue",
            title: t("Livraison attendue : {0}", [order.id]),
            detail: t("Prévue le {0} — à réceptionner", [formatDate(order.expectedAt)]),
            to: "/admin/purchases",
          });
        });
    }

    const priority = { red: 0, violet: 1, amber: 2, blue: 3 };
    return list.sort((a, b) => priority[a.tone] - priority[b.tone]);
  }, [state.products, state.installments, state.maintenanceTasks, state.purchaseOrders, state.maintenanceHistory, state.expenses, state.settings.accountingStart, state.cashSessions, state.users, isAdmin, currentUser, base, now]);
}
