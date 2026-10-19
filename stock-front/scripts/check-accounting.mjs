// Contrôle du moteur comptable sur les données réelles d'une entreprise.
// Usage : node scripts/check-accounting.mjs <email> <mot de passe> [url de l'API]
import { balanceSheet, buildJournal, incomeStatement, trialBalance, vatReport } from "../src/lib/accounting/engine.js";

const [email, password, api = "http://127.0.0.1:8000"] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage : node scripts/check-accounting.mjs <email> <mot de passe> [url de l'API]");
  process.exit(1);
}

const call = async (method, path, body, token) => {
  const response = await fetch(`${api}/api${path}`, {
    method,
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`${method} ${path} : ${response.status} ${await response.text()}`);
  return response.json();
};

const session = await call("POST", "/auth/login", { email, password });
try {
  const data = await call("GET", "/bootstrap", null, session.token);
  const state = { expenses: [], supplierPayments: [], journalEntries: [], ...data };
  const settings = session.company.settings;
  const from = new Date(new Date().getFullYear(), 0, 1);
  const to = new Date();

  const { entries, start } = buildJournal(state, settings, { from, to });
  const unbalanced = entries.filter((e) => e.debit !== e.credit);
  const balance = trialBalance(entries, null, to);
  const income = incomeStatement(entries, from, to);
  const sheet = balanceSheet(entries, to);
  const vat = vatReport(entries, from, to);

  console.log(`Entreprise : ${session.company.name} — ouverture le ${start.toLocaleDateString("fr-FR")}`);
  console.log(`Écritures : ${entries.length} (déséquilibrées : ${unbalanced.length})`);
  console.log(`Balance : débit ${balance.totals.debit} / crédit ${balance.totals.credit}`);
  console.log(`Résultat ${from.getFullYear()} : CA HT ${income.values.TA}, charges ${income.charges}, résultat ${income.result}`);
  console.log(`Bilan : actif ${sheet.totalActif} / passif ${sheet.totalPassif} — ${sheet.balanced ? "équilibré" : "DÉSÉQUILIBRÉ"}`);
  console.log(`TVA due sur l'année : ${vat.total.due}`);
  process.exitCode = unbalanced.length || !sheet.balanced || balance.totals.debit !== balance.totals.credit ? 1 : 0;
} finally {
  await call("POST", "/auth/logout", null, session.token);
}
