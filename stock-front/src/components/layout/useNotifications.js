import { useMemo } from "react";
import { FaBoxOpen, FaCreditCard, FaTools, FaTruck } from "react-icons/fa";
import { useStore } from "../../store/StoreContext";
import { formatDate, formatMoney } from "../../lib/format";
import { installmentRemaining, installmentStatus, lowStockProducts } from "../../store/selectors";

/** Alertes calculées à partir des données : stock, créances, maintenance, livraisons. */
export default function useNotifications() {
  const { state, currentUser } = useStore();
  const isAdmin = currentUser?.role === "admin";
  const base = isAdmin ? "/admin" : "/seller";

  return useMemo(() => {
    const list = [];

    lowStockProducts(state.products).forEach((product) => {
      list.push({
        id: `stock-${product.id}`,
        icon: FaBoxOpen,
        tone: product.stock <= 0 ? "red" : "amber",
        title: product.stock <= 0 ? `Rupture : ${product.name}` : `Stock bas : ${product.name}`,
        detail: `${product.stock} en stock · seuil ${product.alertThreshold}`,
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
            title: status === "late" ? `Paiement en retard — ${item.customerName}` : `Échéance proche — ${item.customerName}`,
            detail: `${formatMoney(installmentRemaining(item))} restant · échéance ${formatDate(item.dueDate)}`,
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
            title: task.status === "Signalé" ? `Signalement : ${task.product}` : `À remplacer : ${task.product}`,
            detail: task.task,
            to: "/admin/maintenance",
          });
        });

      state.purchaseOrders
        .filter((order) => order.status === "sent" && new Date(order.expectedAt) <= new Date())
        .forEach((order) => {
          list.push({
            id: `po-${order.id}`,
            icon: FaTruck,
            tone: "blue",
            title: `Livraison attendue : ${order.id}`,
            detail: `Prévue le ${formatDate(order.expectedAt)} — à réceptionner`,
            to: "/admin/purchases",
          });
        });
    }

    const priority = { red: 0, violet: 1, amber: 2, blue: 3 };
    return list.sort((a, b) => priority[a.tone] - priority[b.tone]);
  }, [state.products, state.installments, state.maintenanceTasks, state.purchaseOrders, isAdmin, currentUser?.id, base]);
}
