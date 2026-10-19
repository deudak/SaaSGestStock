// Moteur comptable (SYSCOHADA, partie double, inventaire intermittent).
//
// Les écritures ne sont pas saisies deux fois : elles sont calculées à partir des opérations
// de l'application (ventes, versements, réceptions fournisseurs, mouvements de stock), plus les
// saisies propres à la comptabilité (dépenses, règlements fournisseurs, écritures manuelles).
// Toutes les écritures produites sont équilibrées (total débit = total crédit).

import { TREASURY_BY_METHOD, TREASURY_ACCOUNTS, accountClass, accountName } from "./chart.js";

import { locale, localized, t } from "../../i18n/index.js";

const JOURNAL_ORDER = { AN: 0, VE: 1, AC: 2, TR: 3, OD: 4 };

const treasuryAccount = (method) => TREASURY_BY_METHOD[method] || "571";
const time = (value) => new Date(value).getTime();
const round = (value) => Math.round(Number(value) || 0);

function line(account, debit, credit, label) {
  return { account: String(account), debit: round(debit), credit: round(credit), ...(label ? { label } : {}) };
}

/** Sépare un montant TTC en hors taxe + TVA (prix « TVA incluse »). */
export function splitVat(total, rate) {
  const r = Number(rate) || 0;
  if (r <= 0) return { ht: round(total), vat: 0 };
  const vat = Math.round((total * r) / (100 + r));
  return { ht: round(total) - vat, vat };
}

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Date d'ouverture des comptes : paramètre de l'entreprise, sinon la plus ancienne opération. */
export function accountingStart(state, settings) {
  if (settings.accountingStart) return new Date(`${settings.accountingStart}T00:00:00`);
  const dates = [
    ...state.sales.map((s) => s.date),
    ...state.installments.map((i) => i.createdAt),
    ...state.purchaseOrders.map((o) => o.receivedAt || o.createdAt),
    ...(state.expenses || []).map((e) => e.date),
    ...(state.supplierPayments || []).map((p) => p.date),
    ...(state.journalEntries || []).map((e) => e.date),
  ].filter(Boolean);
  if (!dates.length) return new Date(new Date().getFullYear(), 0, 1);
  return startOfDay(Math.min(...dates.map(time)));
}

/** Valeur du stock à une date (quantités reconstituées à partir des mouvements, au coût d'achat actuel). */
export function stockValuation(products, movements) {
  const byProduct = new Map();
  for (const m of movements) {
    if (!m.productId) continue;
    const list = byProduct.get(m.productId) || [];
    list.push({ t: time(m.date), delta: m.type === "in" ? m.qty : -m.qty });
    byProduct.set(m.productId, list);
  }
  return (date) => {
    const item = time(date);
    let total = 0;
    for (const product of products) {
      let qty = Number(product.stock) || 0;
      for (const move of byProduct.get(product.id) || []) if (move.t > item) qty -= move.delta;
      total += Math.max(0, qty) * (Number(product.cost) || 0);
    }
    return round(total);
  };
}

/** Fins de mois entre deux dates (dernier instant du mois, heure locale). */
function monthEnds(from, to) {
  const ends = [];
  const cursor = new Date(from.getFullYear(), from.getMonth() + 1, 1);
  while (cursor.getTime() <= to.getTime()) {
    ends.push(new Date(cursor.getTime() - 1));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return ends;
}

/**
 * Journal général jusqu'à `to`.
 * `from` sert à placer une écriture de variation de stock juste avant la période demandée,
 * pour que le compte de résultat de la période soit exact.
 */
export function buildJournal(state, settings, { from, to } = {}) {
  const start = accountingStart(state, settings);
  const end = to ? new Date(to) : new Date();
  const rate = settings.taxRate;
  const entries = [];
  const customerName = (id, fallback) => state.customers.find((c) => c.id === id)?.name || fallback || t("Client");
  const supplierName = (id) => state.suppliers.find((s) => s.id === id)?.name || t("Fournisseur");
  const inRange = (value) => value && time(value) >= start.getTime() && time(value) <= end.getTime();

  const add = (entry) => {
    const lines = entry.lines.filter((l) => l.debit || l.credit);
    if (lines.length >= 2) entries.push({ ...entry, date: new Date(entry.date).toISOString(), lines });
  };

  // ---------- Ouverture (À nouveaux) ----------
  const valuation = stockValuation(state.products, state.stockMovements);
  const openingStock = valuation(start);
  const openingReceivables = state.installments
    .filter((i) => !i.cancelled && i.createdAt && time(i.createdAt) < start.getTime())
    .reduce((sum, i) => sum + Math.max(0, i.total - i.payments.filter((p) => time(p.date) < start.getTime()).reduce((s, p) => s + p.amount, 0)), 0);
  const opening = [line("31", openingStock, 0, t("Stock de marchandises")), line("411", openingReceivables, 0, t("Créances clients"))];
  for (const { account, label, setting } of TREASURY_ACCOUNTS) {
    const amount = round(settings[setting]);
    opening.push(amount >= 0 ? line(account, amount, 0, t(label)) : line(account, 0, -amount, t("{0} (découvert)", [t(label)])));
  }
  opening.push(line("401", 0, settings.openingPayables, t("Dettes fournisseurs")));
  const openingBalance = opening.reduce((sum, l) => sum + l.debit - l.credit, 0);
  opening.push(openingBalance >= 0 ? line("101", 0, openingBalance, t("Capitaux propres d'ouverture")) : line("101", -openingBalance, 0, t("Capitaux propres d'ouverture")));
  add({ id: "opening", date: start, journal: "AN", ref: "OUV", label: t("Bilan d'ouverture"), source: { type: "opening" }, lines: opening });

  // ---------- Ventes ----------
  for (const sale of state.sales) {
    if (!inRange(sale.date) || !sale.total) continue;
    const { ht, vat } = splitVat(sale.total, rate);
    const debitAccount = sale.mode === "credit" ? "411" : treasuryAccount(sale.method);
    const who = customerName(sale.customerId, sale.customerName);
    add({
      id: `sale-${sale.id}`,
      date: sale.date,
      journal: "VE",
      ref: sale.id,
      label: t("Vente {0} — {1}", [sale.id, who]),
      source: { type: "sale", id: sale.id },
      lines: [line(debitAccount, sale.total, 0), line("701", 0, ht), line("4431", 0, vat)],
    });
    if (sale.status === "cancelled" && inRange(sale.cancelledAt)) {
      add({
        id: `cancel-${sale.id}`,
        date: sale.cancelledAt,
        journal: "VE",
        ref: sale.id,
        label: t("Annulation vente {0}{1}", [sale.id, sale.cancelReason ? ` — ${sale.cancelReason}` : ""]),
        source: { type: "sale", id: sale.id },
        lines: [line("701", ht, 0), line("4431", vat, 0), line(debitAccount, 0, sale.total)],
      });
    }
  }

  // ---------- Créances : dossiers hors caisse et versements ----------
  for (const installment of state.installments) {
    const who = customerName(installment.customerId, installment.customerName);
    if (!installment.saleId && !installment.cancelled && inRange(installment.createdAt)) {
      const { ht, vat } = splitVat(installment.total, rate);
      add({
        id: `inst-${installment.id}`,
        date: installment.createdAt,
        journal: "VE",
        ref: installment.id,
        label: `${installment.label} — ${who}`,
        source: { type: "installment", id: installment.id },
        lines: [line("411", installment.total, 0), line("701", 0, ht), line("4431", 0, vat)],
      });
    }
    for (const payment of installment.payments) {
      if (!inRange(payment.date)) continue;
      add({
        id: `pay-${payment.id}`,
        date: payment.date,
        journal: "TR",
        ref: installment.id,
        label: t("Encaissement {0}{1}", [who, payment.note ? ` — ${payment.note}` : ""]),
        source: { type: "installment", id: installment.id },
        lines: [line(treasuryAccount(payment.method), payment.amount, 0), line("411", 0, payment.amount)],
      });
    }
  }

  // ---------- Achats de marchandises (réceptions) ----------
  for (const order of state.purchaseOrders) {
    if (order.status !== "received" || !inRange(order.receivedAt)) continue;
    const total = order.items.reduce((sum, item) => sum + item.qty * item.cost, 0);
    add({
      id: `po-${order.id}`,
      date: order.receivedAt,
      journal: "AC",
      ref: order.id,
      label: t("Réception {0} — {1}", [order.id, supplierName(order.supplierId)]),
      source: { type: "purchaseOrder", id: order.id },
      lines: [line("601", total, 0), line("401", 0, total)],
    });
  }

  // ---------- Dépenses et règlements fournisseurs ----------
  for (const expense of state.expenses || []) {
    if (!inRange(expense.date)) continue;
    const vat = round(expense.vat);
    add({
      id: `exp-${expense.id}`,
      date: expense.date,
      journal: "AC",
      ref: expense.reference || expense.id,
      label: expense.label,
      source: { type: "expense", id: expense.id },
      lines: [line(expense.account, expense.amount - vat, 0), line("4452", vat, 0), line(expense.method === "unpaid" ? "401" : treasuryAccount(expense.method), 0, expense.amount)],
    });
  }
  for (const payment of state.supplierPayments || []) {
    if (!inRange(payment.date)) continue;
    add({
      id: `sp-${payment.id}`,
      date: payment.date,
      journal: "TR",
      ref: payment.purchaseOrderId || payment.id,
      label: t("Règlement {0}{1}", [supplierName(payment.supplierId), payment.note ? ` — ${payment.note}` : ""]),
      source: { type: "supplierPayment", id: payment.id },
      lines: [line("401", payment.amount, 0), line(treasuryAccount(payment.method), 0, payment.amount)],
    });
  }

  // ---------- Caisse journalière : mouvements et écarts de caisse ----------
  const userName = (id) => state.users?.find((u) => u.id === id)?.name || t("Vendeur");
  for (const session of state.cashSessions || []) {
    const who = userName(session.sellerId);
    for (const m of session.movements || []) {
      if (!inRange(m.at) || !m.amount) continue;
      const base = { id: `cm-${m.id}`, date: m.at, ref: session.id, source: { type: "cashSession", id: session.id } };
      if (m.type === "deposit") {
        add({ ...base, journal: "TR", label: t("Versement en banque — caisse de {0}", [who]), lines: [line("521", m.amount, 0), line("571", 0, m.amount)] });
      } else if (m.type === "expense") {
        add({ ...base, journal: "AC", label: t("Dépense de caisse — {0}", [m.reason || who]), lines: [line("658", m.amount, 0), line("571", 0, m.amount)] });
      } else if (m.type === "in") {
        add({ ...base, journal: "TR", label: t("Apport en caisse — {0}", [m.reason || who]), lines: [line("571", m.amount, 0), line("471", 0, m.amount)] });
      }
    }
    const diff = Number(session.difference) || 0;
    if (session.status === "closed" && diff && inRange(session.closedAt)) {
      add({
        id: `cd-${session.id}`,
        date: session.closedAt,
        journal: "OD",
        ref: session.id,
        label: diff < 0 ? t("Écart de caisse (manquant) — {0}", [who]) : t("Écart de caisse (excédent) — {0}", [who]),
        source: { type: "cashSession", id: session.id },
        lines: diff < 0 ? [line("658", -diff, 0), line("571", 0, -diff)] : [line("571", diff, 0), line("758", 0, diff)],
      });
    }
  }

  // ---------- Écritures manuelles ----------
  for (const entry of state.journalEntries || []) {
    if (!inRange(entry.date)) continue;
    add({ id: `je-${entry.id}`, date: entry.date, journal: entry.journal, ref: entry.reference || "", label: entry.label, source: { type: "journalEntry", id: entry.id }, lines: entry.lines.map((l) => line(l.account, l.debit, l.credit, l.label)) });
  }

  // ---------- Variation des stocks (inventaire intermittent) ----------
  const points = [...monthEnds(start, end), end];
  if (from && time(from) > start.getTime() && time(from) <= end.getTime()) points.push(new Date(time(from) - 1));
  let previous = openingStock;
  for (const point of [...new Set(points.map((p) => p.getTime()))].sort((a, b) => a - b).map((item) => new Date(item))) {
    if (point.getTime() <= start.getTime()) continue;
    const value = valuation(point);
    const diff = value - previous;
    if (diff !== 0) {
      add({
        id: `var-${point.getTime()}`,
        date: point,
        journal: "OD",
        ref: "STOCK",
        label: t("Variation des stocks au {0}", [point.toLocaleDateString(locale())]),
        source: { type: "stock" },
        lines: diff > 0 ? [line("31", diff, 0), line("6031", 0, diff)] : [line("6031", -diff, 0), line("31", 0, -diff)],
      });
    }
    previous = value;
  }

  // Tri chronologique et numérotation par journal
  entries.sort((a, b) => a.date.localeCompare(b.date) || JOURNAL_ORDER[a.journal] - JOURNAL_ORDER[b.journal] || a.id.localeCompare(b.id));
  const counters = {};
  for (const entry of entries) {
    counters[entry.journal] = (counters[entry.journal] || 0) + 1;
    entry.number = `${entry.journal}${String(counters[entry.journal]).padStart(5, "0")}`;
    entry.debit = entry.lines.reduce((sum, l) => sum + l.debit, 0);
    entry.credit = entry.lines.reduce((sum, l) => sum + l.credit, 0);
  }
  return { entries, start, end };
}

// ------------------------------------------------------------------ cumuls

const within = (entry, from, to) => (!from || entry.date >= new Date(from).toISOString()) && (!to || entry.date <= new Date(to).toISOString());

/** Totaux débit / crédit par compte sur une période. */
export function totalsByAccount(entries, from, to) {
  const totals = new Map();
  for (const entry of entries) {
    if (!within(entry, from, to)) continue;
    for (const l of entry.lines) {
      const current = totals.get(l.account) || { debit: 0, credit: 0 };
      current.debit += l.debit;
      current.credit += l.credit;
      totals.set(l.account, current);
    }
  }
  return totals;
}

const balanceOf = (totals, prefixes) => {
  let sum = 0;
  for (const [account, item] of totals) if (prefixes.some((p) => account.startsWith(p))) sum += item.debit - item.credit;
  return sum;
};

/** Balance des comptes : soldes avant la période, mouvements de la période, soldes de fin. */
export function trialBalance(entries, from, to) {
  const before = from ? totalsByAccount(entries, null, new Date(time(from) - 1)) : new Map();
  const during = totalsByAccount(entries, from, to);
  const accounts = [...new Set([...before.keys(), ...during.keys()])].sort();
  const rows = accounts.map((account) => {
    const b = before.get(account) || { debit: 0, credit: 0 };
    const d = during.get(account) || { debit: 0, credit: 0 };
    const opening = b.debit - b.credit;
    const closing = opening + d.debit - d.credit;
    return { account, name: accountName(account), opening, debit: d.debit, credit: d.credit, closing };
  });
  const totals = rows.reduce((item, r) => ({ debit: item.debit + r.debit, credit: item.credit + r.credit }), { debit: 0, credit: 0 });
  return { rows, totals };
}

/** Grand livre d'un compte (ou d'une racine : « 57 » regroupe 571…). */
export function accountLedger(entries, account, from, to) {
  const matches = (code) => code === account || code.startsWith(account);
  let balance = 0;
  const rows = [];
  for (const entry of entries) {
    if (to && !within(entry, null, to)) continue;
    for (const l of entry.lines) {
      if (!matches(l.account)) continue;
      if (from && entry.date < new Date(from).toISOString()) {
        balance += l.debit - l.credit;
        continue;
      }
      rows.push({ id: `${entry.id}-${rows.length}`, entry, account: l.account, label: l.label || entry.label, debit: l.debit, credit: l.credit, balance: 0 });
    }
  }
  const opening = balance;
  for (const row of rows) {
    balance += row.debit - row.credit;
    row.balance = balance;
  }
  return { opening, rows, closing: balance, debit: rows.reduce((s, r) => s + r.debit, 0), credit: rows.reduce((s, r) => s + r.credit, 0) };
}

// ------------------------------------------------------------------ compte de résultat

/** Rubrique du compte de résultat SYSCOHADA d'un compte de classe 6, 7 ou 8. */
function incomeLine(account) {
  const c = accountClass(account);
  const starts = (...prefixes) => prefixes.some((p) => account.startsWith(p));
  if (c === 7) {
    if (starts("701")) return "TA";
    if (starts("70")) return "TB"; // produits fabriqués, travaux, services, produits accessoires
    if (starts("77", "787", "797")) return "TF";
    return "TC"; // subventions, production immobilisée, autres produits, transferts et reprises d'exploitation
  }
  if (c === 6) {
    if (starts("6031")) return "RB";
    if (starts("601")) return "RA";
    if (starts("60")) return "RC"; // matières, fournitures et autres achats, variations des autres stocks
    if (starts("61")) return "RD";
    if (starts("62", "63")) return "RE";
    if (starts("64")) return "RF";
    if (starts("66")) return "RH";
    if (starts("67", "697")) return "RJ";
    if (starts("68", "69")) return "RI";
    return "RG";
  }
  if (c === 8) return starts("89") ? "RK" : "XH";
  return null;
}

export const INCOME_LABELS = localized({
  TA: "Ventes de marchandises",
  RA: "Achats de marchandises",
  RB: "Variation de stocks de marchandises",
  XA: "MARGE COMMERCIALE",
  TB: "Ventes de produits, travaux, services vendus et produits accessoires",
  TC: "Subventions d'exploitation et autres produits",
  RC: "Achats de matières, fournitures et autres achats (eau, électricité…)",
  RD: "Transports",
  RE: "Services extérieurs (loyer, entretien, télécoms…)",
  RF: "Impôts et taxes",
  RG: "Autres charges",
  XC: "VALEUR AJOUTÉE",
  RH: "Charges de personnel",
  XD: "EXCÉDENT BRUT D'EXPLOITATION",
  RI: "Dotations aux amortissements, provisions et dépréciations",
  XE: "RÉSULTAT D'EXPLOITATION",
  TF: "Produits financiers",
  RJ: "Frais financiers",
  XF: "RÉSULTAT FINANCIER",
  XG: "RÉSULTAT DES ACTIVITÉS ORDINAIRES",
  XH: "Résultat hors activités ordinaires",
  RK: "Impôt sur le résultat",
  XI: "RÉSULTAT NET",
});

/** Compte de résultat d'une période : rubriques SYSCOHADA (produits en positif, charges en positif). */
export function incomeStatement(entries, from, to) {
  const totals = totalsByAccount(entries, from, to);
  const v = Object.fromEntries(Object.keys(INCOME_LABELS).map((k) => [k, 0]));
  for (const [account, item] of totals) {
    const key = incomeLine(account);
    if (!key) continue;
    // Produits et résultat HAO : solde créditeur ; charges : solde débiteur
    v[key] += key.startsWith("T") || key === "XH" ? item.credit - item.debit : item.debit - item.credit;
  }
  v.XA = v.TA - v.RA - v.RB;
  v.XC = v.XA + v.TB + v.TC - v.RC - v.RD - v.RE - v.RF - v.RG;
  v.XD = v.XC - v.RH;
  v.XE = v.XD - v.RI;
  v.XF = v.TF - v.RJ;
  v.XG = v.XE + v.XF;
  v.XI = v.XG + v.XH - v.RK;
  const revenue = v.TA + v.TB + v.TC + v.TF;
  const charges = v.RA + v.RB + v.RC + v.RD + v.RE + v.RF + v.RG + v.RH + v.RI + v.RJ + v.RK;
  return { values: v, revenue, charges, result: v.XI };
}

/** Résultat net (produits − charges) des écritures d'une période. */
export function netResult(entries, from, to) {
  return incomeStatement(entries, from, to).result;
}

// ------------------------------------------------------------------ bilan

/** Bilan à une date. L'exercice commence le 1er janvier : les résultats antérieurs vont en report à nouveau. */
export function balanceSheet(entries, date) {
  const at = new Date(date);
  const fiscalStart = new Date(at.getFullYear(), 0, 1);
  const totals = totalsByAccount(entries, null, at);
  const currentResult = netResult(entries, fiscalStart, at);
  const previousResult = netResult(entries, null, new Date(fiscalStart.getTime() - 1));

  const actif = { immobilisations: 0, stocks: 0, clients: 0, autresCreances: 0, tresorerie: 0 };
  const passif = { capital: 0, reserves: 0, report: previousResult, resultat: currentResult, provisions: 0, dettesFinancieres: 0, fournisseurs: 0, dettesFiscales: 0, autresDettes: 0, tresoreriePassif: 0 };
  const treasury = [];

  for (const [account, item] of totals) {
    const c = accountClass(account);
    const balance = item.debit - item.credit;
    if (balance === 0 || c >= 6) continue;
    if (c === 1) {
      if (account.startsWith("16") || account.startsWith("17") || account.startsWith("18")) passif.dettesFinancieres -= balance;
      else if (account.startsWith("19")) passif.provisions -= balance;
      else if (account.startsWith("11") || account.startsWith("14") || account.startsWith("15")) passif.reserves -= balance;
      else if (account.startsWith("12") || account.startsWith("13")) passif.report -= balance;
      else passif.capital -= balance;
    } else if (c === 2) actif.immobilisations += balance;
    else if (c === 3) actif.stocks += balance;
    else if (c === 4) {
      if (account.startsWith("49")) actif.clients += balance; // dépréciations des créances (en déduction)
      else if (balance > 0) {
        if (account.startsWith("41")) actif.clients += balance;
        else actif.autresCreances += balance;
      } else if (account.startsWith("40")) passif.fournisseurs -= balance;
      else if (account.startsWith("42") || account.startsWith("43") || account.startsWith("44")) passif.dettesFiscales -= balance;
      else passif.autresDettes -= balance;
    } else if (c === 5) {
      treasury.push({ account, name: accountName(account), balance });
      if (balance > 0) actif.tresorerie += balance;
      else passif.tresoreriePassif -= balance;
    }
  }

  const totalActif = Object.values(actif).reduce((s, x) => s + x, 0);
  const totalPassif = Object.values(passif).reduce((s, x) => s + x, 0);
  return { actif, passif, totalActif, totalPassif, treasury: treasury.sort((a, b) => a.account.localeCompare(b.account)), balanced: totalActif === totalPassif };
}

// ------------------------------------------------------------------ TVA et synthèse

/** TVA collectée, déductible et due, mois par mois. */
export function vatReport(entries, from, to) {
  const months = new Map();
  for (const entry of entries) {
    if (!within(entry, from, to)) continue;
    const key = entry.date.slice(0, 7);
    const m = months.get(key) || { month: key, collected: 0, deductible: 0 };
    for (const l of entry.lines) {
      if (l.account.startsWith("4431")) m.collected += l.credit - l.debit;
      if (l.account.startsWith("4452")) m.deductible += l.debit - l.credit;
    }
    months.set(key, m);
  }
  const rows = [...months.values()].filter((m) => m.collected || m.deductible).sort((a, b) => a.month.localeCompare(b.month)).map((m) => ({ ...m, due: m.collected - m.deductible }));
  const total = rows.reduce((item, r) => ({ collected: item.collected + r.collected, deductible: item.deductible + r.deductible, due: item.due + r.due }), { collected: 0, deductible: 0, due: 0 });
  return { rows, total };
}

/** Solde d'un compte (ou d'une racine) à une date. */
export function accountBalance(entries, prefix, to) {
  return balanceOf(totalsByAccount(entries, null, to), [prefix]);
}

/** Produits et charges mois par mois (graphique). */
export function monthlyResults(entries, from, to) {
  const months = new Map();
  for (const entry of entries) {
    if (!within(entry, from, to)) continue;
    const key = entry.date.slice(0, 7);
    const m = months.get(key) || { month: key, revenue: 0, charges: 0 };
    for (const l of entry.lines) {
      const c = accountClass(l.account);
      if (c === 7) m.revenue += l.credit - l.debit;
      if (c === 6) m.charges += l.debit - l.credit;
    }
    months.set(key, m);
  }
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month)).map((m) => ({ ...m, result: m.revenue - m.charges }));
}
