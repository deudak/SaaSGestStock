import { addDays, isSameDay, startOfDay } from "../lib/format";
import { PAYMENT_METHODS } from "./seed";

export const PAYMENT_LABELS = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.id, m.label]));

// ---------------- Produits ----------------
export function productStatus(product) {
  if (product.stock <= 0) return "out";
  if (product.stock <= product.alertThreshold) return "low";
  return "ok";
}

export const PRODUCT_STATUS = {
  ok: { label: "En stock", tone: "green" },
  low: { label: "Stock bas", tone: "amber" },
  out: { label: "Rupture", tone: "red" },
};

export function lowStockProducts(products) {
  return products
    .filter((product) => productStatus(product) !== "ok")
    .sort((a, b) => a.stock - b.stock);
}

export function stockValue(products) {
  return products.reduce(
    (acc, product) => ({
      cost: acc.cost + product.stock * (product.cost || 0),
      retail: acc.retail + product.stock * product.price,
    }),
    { cost: 0, retail: 0 }
  );
}

// ---------------- Ventes ----------------
export function activeSales(sales) {
  return sales.filter((sale) => sale.status !== "cancelled");
}

export function saleMargin(sale) {
  return sale.items.reduce((sum, item) => sum + (item.price - (item.cost || 0)) * item.qty, 0) - (sale.discount || 0);
}

export function salesBetween(sales, from, to) {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  return sales.filter((sale) => {
    const time = new Date(sale.date).getTime();
    return time >= start && time < end;
  });
}

export function sumBy(list, getter) {
  return list.reduce((sum, item) => sum + (Number(getter(item)) || 0), 0);
}

/** Totaux sur une période et la période précédente de même durée */
export function periodSummary(sales, days) {
  const end = addDays(startOfDay(), 1);
  const start = addDays(end, -days);
  const prevStart = addDays(start, -days);
  const list = activeSales(salesBetween(sales, start, end));
  const prevList = activeSales(salesBetween(sales, prevStart, start));
  return {
    list,
    prevList,
    revenue: sumBy(list, (s) => s.total),
    prevRevenue: sumBy(prevList, (s) => s.total),
    margin: sumBy(list, saleMargin),
    prevMargin: sumBy(prevList, saleMargin),
    count: list.length,
    prevCount: prevList.length,
    units: sumBy(list, (s) => sumBy(s.items, (i) => i.qty)),
    prevUnits: sumBy(prevList, (s) => sumBy(s.items, (i) => i.qty)),
  };
}

/** Série journalière pour les graphiques */
export function dailySeries(sales, days) {
  const today = startOfDay();
  const list = activeSales(sales);
  return Array.from({ length: days }, (_, index) => {
    const day = addDays(today, index - days + 1);
    const daySales = list.filter((sale) => isSameDay(sale.date, day));
    return {
      date: day.toISOString(),
      label:
        days <= 7
          ? day.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "")
          : day.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
      revenue: sumBy(daySales, (s) => s.total),
      margin: sumBy(daySales, saleMargin),
      count: daySales.length,
    };
  });
}

export function monthlySeries(sales, months = 6) {
  const list = activeSales(sales);
  const now = new Date();
  return Array.from({ length: months }, (_, index) => {
    const ref = new Date(now.getFullYear(), now.getMonth() - (months - 1 - index), 1);
    const next = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
    const monthSales = salesBetween(list, ref, next);
    return {
      label: ref.toLocaleDateString("fr-FR", { month: "short" }).replace(".", ""),
      revenue: sumBy(monthSales, (s) => s.total),
      margin: sumBy(monthSales, saleMargin),
      count: monthSales.length,
    };
  });
}

export function topProducts(sales, limit = 5) {
  const map = new Map();
  activeSales(sales).forEach((sale) =>
    sale.items.forEach((item) => {
      const entry = map.get(item.productId) || { productId: item.productId, name: item.name, qty: 0, revenue: 0 };
      entry.qty += item.qty;
      entry.revenue += item.qty * item.price;
      map.set(item.productId, entry);
    })
  );
  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

export function paymentBreakdown(sales) {
  const list = activeSales(sales);
  return PAYMENT_METHODS.map((method) => {
    const subset = list.filter((sale) => sale.method === method.id);
    return { id: method.id, name: method.label, value: sumBy(subset, (s) => s.paid ?? s.total), count: subset.length };
  }).filter((entry) => entry.count > 0);
}

export function categoryBreakdown(sales, products) {
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));
  const map = new Map();
  activeSales(sales).forEach((sale) =>
    sale.items.forEach((item) => {
      const category = byId[item.productId]?.category || "Autre";
      map.set(category, (map.get(category) || 0) + item.qty * item.price);
    })
  );
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

// ---------------- Paiements échelonnés ----------------
export function installmentPaid(installment) {
  return sumBy(installment.payments, (p) => p.amount);
}

export function installmentRemaining(installment) {
  return Math.max(0, installment.total - installmentPaid(installment));
}

export function installmentStatus(installment) {
  if (installment.cancelled) return "cancelled";
  if (installmentRemaining(installment) <= 0) return "paid";
  if (new Date(installment.dueDate) < startOfDay()) return "late";
  const soon = addDays(startOfDay(), 7);
  if (new Date(installment.dueDate) <= soon) return "soon";
  return "ongoing";
}

export const INSTALLMENT_STATUS = {
  ongoing: { label: "En cours", tone: "blue" },
  soon: { label: "Échéance proche", tone: "amber" },
  late: { label: "En retard", tone: "red" },
  paid: { label: "Soldé", tone: "green" },
  cancelled: { label: "Annulé", tone: "slate" },
};

export function totalReceivables(installments) {
  return sumBy(
    installments.filter((i) => !i.cancelled),
    installmentRemaining
  );
}

// ---------------- Clients ----------------
export function customerStats(customer, sales, installments) {
  const customerSales = activeSales(sales).filter((sale) => sale.customerId === customer.id);
  const spent = sumBy(customerSales, (s) => s.total);
  const debt = sumBy(
    installments.filter((i) => i.customerId === customer.id && !i.cancelled),
    installmentRemaining
  );
  const lastSale = customerSales.reduce((latest, sale) => (!latest || sale.date > latest ? sale.date : latest), null);
  let segment = "regular";
  if (spent >= 500000 || customerSales.length >= 10) segment = "vip";
  else if (Date.now() - new Date(customer.createdAt).getTime() < 30 * 86400000) segment = "new";
  else if (lastSale && Date.now() - new Date(lastSale).getTime() > 45 * 86400000) segment = "inactive";
  return { orders: customerSales.length, spent, debt, lastSale, segment, sales: customerSales };
}

export const CUSTOMER_SEGMENTS = {
  vip: { label: "VIP", tone: "amber" },
  regular: { label: "Fidèle", tone: "green" },
  new: { label: "Nouveau", tone: "blue" },
  inactive: { label: "Inactif", tone: "slate" },
};

// ---------------- Approvisionnements ----------------
export const PO_STATUS = {
  draft: { label: "Brouillon", tone: "slate" },
  sent: { label: "Envoyée", tone: "blue" },
  received: { label: "Reçue", tone: "green" },
  cancelled: { label: "Annulée", tone: "red" },
};

export function purchaseOrderTotal(order) {
  return sumBy(order.items, (item) => item.qty * item.cost);
}

// ---------------- Maintenance ----------------
export const MAINTENANCE_STATUS = {
  Signalé: { tone: "violet" },
  Planifié: { tone: "blue" },
  "En cours": { tone: "amber" },
  "À remplacer": { tone: "red" },
  Terminé: { tone: "green" },
};

export function openMaintenance(tasks) {
  return tasks.filter((task) => task.status !== "Terminé");
}
