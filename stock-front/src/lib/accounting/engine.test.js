import { describe, expect, it } from "vitest";
import { accountBalance, accountLedger, balanceSheet, buildJournal, incomeStatement, splitVat, trialBalance, vatReport } from "./engine";

// Scénario chiffré sur le 1er trimestre 2026 (TVA 19,25 % incluse dans les prix)
const settings = { taxRate: 19.25, accountingStart: "2026-01-01", openingCash: 100000, openingBank: 500000, openingMobile: 0, openingPayables: 50000 };

const state = {
  products: [{ id: "p1", name: "Casque", cost: 1000, stock: 8 }],
  stockMovements: [
    { id: "m1", productId: "p1", type: "in", qty: 10, date: "2026-01-04T10:00:00.000Z", reason: "Réception fournisseur" },
    { id: "m2", productId: "p1", type: "out", qty: 2, date: "2026-02-10T10:00:00.000Z", reason: "Vente" },
  ],
  customers: [{ id: "c1", name: "Awa" }],
  suppliers: [{ id: "s1", name: "TechDistrib" }],
  sales: [
    { id: "V-1", date: "2026-02-10T10:00:00.000Z", total: 11925, mode: "cash", method: "cash", status: "completed", customerName: "Client de passage" },
    { id: "V-2", date: "2026-02-15T10:00:00.000Z", total: 23850, mode: "credit", method: "cash", status: "completed", customerId: "c1", installmentId: "TR-1" },
    { id: "V-3", date: "2026-03-05T10:00:00.000Z", total: 11925, mode: "cash", method: "cash", status: "cancelled", cancelledAt: "2026-03-06T10:00:00.000Z", cancelReason: "Erreur" },
  ],
  installments: [
    {
      id: "TR-1",
      saleId: "V-2",
      customerId: "c1",
      total: 23850,
      createdAt: "2026-02-15T10:00:00.000Z",
      payments: [
        { id: "pay1", date: "2026-02-15T10:00:00.000Z", amount: 5000, method: "cash" },
        { id: "pay2", date: "2026-03-01T10:00:00.000Z", amount: 10000, method: "mobile" },
      ],
    },
  ],
  purchaseOrders: [{ id: "BC-1", supplierId: "s1", status: "received", receivedAt: "2026-01-04T10:00:00.000Z", items: [{ productId: "p1", qty: 10, cost: 1000 }] }],
  supplierPayments: [{ id: "sp1", supplierId: "s1", date: "2026-01-20T10:00:00.000Z", amount: 6000, method: "transfer" }],
  expenses: [
    { id: "e1", date: "2026-02-01T10:00:00.000Z", account: "6222", label: "Loyer", amount: 50000, vat: 0, method: "transfer" },
    { id: "e2", date: "2026-02-02T10:00:00.000Z", account: "6052", label: "Électricité", amount: 11925, vat: 1925, method: "cash" },
  ],
  journalEntries: [
    { id: "j1", date: "2026-01-02T10:00:00.000Z", journal: "OD", label: "Apport en capital", lines: [{ account: "521", debit: 200000, credit: 0 }, { account: "101", debit: 0, credit: 200000 }] },
  ],
};

const from = new Date(2026, 0, 1);
const to = new Date(2026, 2, 31, 23, 59, 59, 999);
const { entries } = buildJournal(state, settings, { from, to });

describe("moteur comptable", () => {
  it("sépare la TVA d'un prix TTC", () => {
    expect(splitVat(11925, 19.25)).toEqual({ ht: 10000, vat: 1925 });
    expect(splitVat(5000, 0)).toEqual({ ht: 5000, vat: 0 });
  });

  it("ne produit que des écritures équilibrées", () => {
    for (const entry of entries) expect(entry.debit, entry.label).toBe(entry.credit);
    const { totals } = trialBalance(entries, from, to);
    expect(totals.debit).toBe(totals.credit);
  });

  it("calcule le compte de résultat (marge, charges, variation de stock)", () => {
    const { values, result } = incomeStatement(entries, from, to);
    expect(values.TA).toBe(30000); // 10 000 + 20 000 + 10 000 − annulation 10 000
    expect(values.RA).toBe(10000);
    expect(values.RB).toBe(-8000); // stock passé de 0 à 8 000
    expect(values.XA).toBe(28000);
    expect(values.RE).toBe(50000);
    expect(values.RC).toBe(10000);
    expect(result).toBe(-32000);
  });

  it("suit la trésorerie, les clients et les fournisseurs", () => {
    expect(accountBalance(entries, "571", to)).toBe(105000);
    expect(accountBalance(entries, "521", to)).toBe(644000);
    expect(accountBalance(entries, "552", to)).toBe(10000);
    expect(accountBalance(entries, "411", to)).toBe(8850);
    expect(accountBalance(entries, "401", to)).toBe(-54000);
    expect(accountBalance(entries, "31", to)).toBe(8000);
  });

  it("calcule la TVA due", () => {
    const { total } = vatReport(entries, from, to);
    expect(total).toEqual({ collected: 5775, deductible: 1925, due: 3850 });
  });

  it("produit un bilan équilibré", () => {
    const sheet = balanceSheet(entries, to);
    expect(sheet.balanced).toBe(true);
    expect(sheet.totalActif).toBe(777775);
    expect(sheet.passif.capital).toBe(750000);
    expect(sheet.passif.resultat).toBe(-32000);
  });

  it("donne le résultat exact d'une sous-période (variation de stock comprise)", () => {
    const feb = incomeStatement(entries, new Date(2026, 1, 1), new Date(2026, 1, 28, 23, 59, 59, 999));
    expect(feb.values.RB).toBe(2000); // 2 casques sortis en février
    expect(feb.values.TA).toBe(30000);
  });

  it("tient un grand livre avec solde progressif", () => {
    const ledger = accountLedger(entries, "411", from, to);
    expect(ledger.rows.map((r) => r.balance)).toEqual([23850, 18850, 8850]);
  });

  it("ignore ce qui précède l'ouverture des comptes", () => {
    const later = buildJournal(state, { ...settings, accountingStart: "2026-03-01" }, { to }).entries;
    for (const entry of later) expect(entry.date >= new Date(2026, 2, 1).toISOString()).toBe(true);
    // La créance du client à l'ouverture reprend ce qui restait dû au 1er mars
    expect(accountBalance(later, "411", new Date(2026, 2, 1))).toBe(18850);
    expect(balanceSheet(later, to).balanced).toBe(true);
  });
});

describe("plan comptable OHADA", () => {
  it("n'utilise que des comptes du plan OHADA", async () => {
    const { ACCOUNTS, EXPENSE_CATEGORIES, TREASURY_ACCOUNTS, TREASURY_BY_METHOD } = await import("./chart.js");
    const used = [
      ...entries.flatMap((e) => e.lines.map((l) => l.account)),
      ...EXPENSE_CATEGORIES.map((c) => c.account),
      ...TREASURY_ACCOUNTS.map((t) => t.account),
      ...Object.values(TREASURY_BY_METHOD),
    ];
    for (const code of new Set(used)) expect(ACCOUNTS[code], `compte ${code}`).toBeTypeOf("string");
    expect(ACCOUNTS[421]).toBe("Personnel, avances et acomptes");
    expect(ACCOUNTS[422]).toBe("Personnel, rémunérations dues");
  });

  it("classe les rubriques du compte de résultat selon le SYSCOHADA", () => {
    const manual = (lines) => buildJournal({ ...state, journalEntries: [{ id: "x", date: "2026-02-20T10:00:00.000Z", journal: "OD", label: "Test", lines }] }, settings, { from, to }).entries;
    const withServices = manual([{ account: "571", debit: 5000, credit: 0 }, { account: "706", debit: 0, credit: 5000 }]);
    const values = incomeStatement(withServices, from, to).values;
    expect(values.TA).toBe(30000); // les services (706) ne sont pas des ventes de marchandises
    expect(values.TB).toBe(5000);
    expect(values.XA).toBe(28000); // la marge commerciale ne change pas

    const financial = incomeStatement(manual([{ account: "671", debit: 3000, credit: 0 }, { account: "521", debit: 0, credit: 3000 }]), from, to).values;
    expect(financial.RJ).toBe(3000);
    expect(financial.XF).toBe(-3000);
  });

  it("range les postes du bilan selon le plan OHADA", () => {
    const lines = [
      { account: "521", debit: 100000, credit: 0 },
      { account: "141", debit: 0, credit: 60000 }, // subvention d'équipement : capitaux propres
      { account: "191", debit: 0, credit: 40000 }, // provision pour litige
    ];
    const withEntry = buildJournal({ ...state, journalEntries: [{ id: "y", date: "2026-02-20T10:00:00.000Z", journal: "OD", label: "Test", lines }] }, settings, { from, to }).entries;
    const sheet = balanceSheet(withEntry, to);
    expect(sheet.passif.reserves).toBe(60000);
    expect(sheet.passif.provisions).toBe(40000);
    expect(sheet.balanced).toBe(true);
  });
});

describe("caisse journalière", () => {
  it("passe les mouvements et l'écart de caisse en comptabilité", () => {
    const session = {
      id: "cs1",
      sellerId: "u1",
      status: "closed",
      openedAt: "2026-02-10T07:00:00.000Z",
      closedAt: "2026-02-10T19:00:00.000Z",
      openingFloat: 20000,
      movements: [
        { id: "m1", type: "deposit", amount: 50000, reason: "Banque", at: "2026-02-10T15:00:00.000Z" },
        { id: "m2", type: "expense", amount: 2000, reason: "Ramette de papier", at: "2026-02-10T16:00:00.000Z" },
      ],
      difference: -500,
    };
    const withCash = buildJournal({ ...state, users: [{ id: "u1", name: "Jean" }], cashSessions: [session] }, settings, { from, to }).entries;
    for (const entry of withCash) expect(entry.debit).toBe(entry.credit);
    // Caisse : 105 000 − 50 000 versés − 2 000 dépensés − 500 manquants
    expect(accountBalance(withCash, "571", to)).toBe(52500);
    expect(accountBalance(withCash, "521", to)).toBe(694000);
    expect(incomeStatement(withCash, from, to).values.RG).toBe(2500); // 658 : dépense de caisse + manquant
    expect(balanceSheet(withCash, to).balanced).toBe(true);
  });
});
